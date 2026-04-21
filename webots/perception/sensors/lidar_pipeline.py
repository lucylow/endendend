#!/usr/bin/env python3
"""
Hokuyo UTM-30LX-style LiDAR: range/angular noise, dropout, dust attenuation,
optional angular supersampling, ground suppression, Euclidean clustering.

Outputs ``webots.perception.types.PointCloud`` (xyz + optional intensity).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

from ..types import PointCloud

logger = logging.getLogger(__name__)


@dataclass
class LidarNoiseConfig:
    range_sigma_scale: float = 0.01
    range_sigma_floor_m: float = 0.005
    angular_sigma_deg: float = 0.1
    dropout_range_scale_m: float = 100.0
    dust_beta_per_m: float = 0.0
    rng: Optional[np.random.Generator] = None

    def generator(self) -> np.random.Generator:
        return self.rng if self.rng is not None else np.random.default_rng()


class HokuyoUTM30LX:
    """270° FOV @ 0.25° (model); Webots arrays resampled as needed."""

    def __init__(self) -> None:
        self.min_range = 0.02
        self.max_range = 60.0
        self.angular_resolution = np.deg2rad(0.25)
        self.fov = np.deg2rad(270)
        self.points_per_scan = int(self.fov / self.angular_resolution)

    def scan_angles(self) -> np.ndarray:
        return np.linspace(-self.fov / 2, self.fov / 2, self.points_per_scan)

    def ranges_from_webots_or_mock(
        self, webots_scan: np.ndarray | None, timestamp_ns: int
    ) -> Tuple[np.ndarray, np.ndarray, int]:
        angles = self.scan_angles()
        if webots_scan is not None:
            scan = np.asarray(webots_scan, dtype=float).reshape(-1)
            if scan.size == angles.size:
                return scan, angles, timestamp_ns
            if scan.size > 0:
                idx = np.linspace(0, scan.size - 1, angles.size)
                resampled = np.interp(idx, np.arange(scan.size), scan)
                return resampled, angles, timestamp_ns
        rng = np.random.default_rng((timestamp_ns // 1_000_000) & 0xFFFF_FFFF)
        ranges = rng.uniform(0.5, 10.0, self.points_per_scan)
        return ranges, angles, timestamp_ns


class LidarNoiseModel:
    """Static helpers (vectorized path lives on ``LidarPerception``)."""

    @staticmethod
    def range_sigma_m(range_val: float) -> float:
        return 0.01 * float(range_val) + 0.005

    @staticmethod
    def dropout_probability(range_val: float) -> float:
        return float(1.0 - np.exp(-float(range_val) / 100.0))

    @staticmethod
    def dust_attenuation(beta_per_m: float, range_val: float) -> float:
        return float(np.exp(-beta_per_m * float(range_val)))


def _ransac_line_xz(
    xz: np.ndarray, iterations: int = 120, thresh_m: float = 0.06, rng: Optional[np.random.Generator] = None
) -> Tuple[np.ndarray, np.ndarray]:
    rng = rng or np.random.default_rng()
    n = xz.shape[0]
    if n < 3:
        return np.ones(n, dtype=bool), np.array([0.0, 1.0, 0.0])
    best_inl = np.zeros(n, dtype=bool)
    best_abc = np.array([0.0, 1.0, 0.0])
    best = 0
    for _ in range(iterations):
        i, j = int(rng.integers(0, n)), int(rng.integers(0, n))
        if i == j:
            continue
        x1, z1 = xz[i]
        x2, z2 = xz[j]
        dx, dz = x2 - x1, z2 - z1
        norm = (dx * dx + dz * dz) ** 0.5
        if norm < 1e-9:
            continue
        a, b = -dz / norm, dx / norm
        c = -(a * x1 + b * z1)
        dist = np.abs(a * xz[:, 0] + b * xz[:, 1] + c)
        inl = dist < thresh_m
        csum = int(inl.sum())
        if csum > best:
            best, best_inl, best_abc = csum, inl, np.array([a, b, c], dtype=np.float64)
    return best_inl, best_abc


def _cluster_xz(points: np.ndarray, eps: float = 0.10, min_samples: int = 8) -> List[np.ndarray]:
    """Lightweight Euclidean clusters in the ground (X-Z) plane."""
    if points.shape[0] < min_samples:
        return []
    xy = points[:, [0, 2]]
    n = xy.shape[0]
    labels = -np.ones(n, dtype=np.int32)
    lab = 0
    for i in range(n):
        if labels[i] >= 0:
            continue
        stack = [i]
        labels[i] = lab
        size = 0
        while stack:
            k = stack.pop()
            size += 1
            d = np.linalg.norm(xy - xy[k], axis=1)
            neigh = np.where((labels < 0) & (d <= eps))[0]
            for j in neigh:
                labels[j] = lab
                stack.append(j)
        if size >= min_samples:
            lab += 1
        else:
            for j in np.where(labels == lab)[0]:
                labels[j] = -1
            continue
    clusters: List[np.ndarray] = []
    for L in range(lab):
        m = labels == L
        if m.any():
            clusters.append(points[m])
    return clusters


class LidarPerception:
    """User-facing API: ``process_scan`` returns a typed ``PointCloud``."""

    def __init__(self, cfg: Optional[LidarNoiseConfig] = None, dust_scenario: bool = False) -> None:
        self.cfg = cfg or LidarNoiseConfig(
            dust_beta_per_m=0.02 if dust_scenario else 0.0,
        )
        self.hokuyo = HokuyoUTM30LX()
        self._frame = 0

    def process_scan(
        self,
        raw_scan: np.ndarray,
        angles_rad: Optional[np.ndarray] = None,
        stamp_ns: int = 0,
        supersample_deg: float = 0.25,
    ) -> PointCloud:
        rng = self.cfg.generator()
        if raw_scan.ndim == 2 and raw_scan.shape[1] >= 1:
            ranges = raw_scan[:, 0].astype(np.float64, copy=False)
            intensity = raw_scan[:, 1].astype(np.float64, copy=False) if raw_scan.shape[1] > 1 else None
        else:
            ranges = np.asarray(raw_scan, dtype=np.float64).reshape(-1)
            intensity = None

        n = int(ranges.shape[0])
        if angles_rad is None:
            angles = self.hokuyo.scan_angles()
            if angles.size != n:
                idx = np.linspace(0, self.hokuyo.points_per_scan - 1, n)
                angles = np.interp(idx, np.arange(self.hokuyo.points_per_scan), self.hokuyo.scan_angles())
        else:
            angles = np.asarray(angles_rad, dtype=np.float64).reshape(-1)

        int_on = intensity
        base_deg = float(np.rad2deg((angles[-1] - angles[0]) / max(n - 1, 1)))
        factor = max(1, int(round(base_deg / max(supersample_deg, 1e-3))))
        if factor > 1 and n > 2:
            ang_hi = np.linspace(angles[0], angles[-1], (n - 1) * factor + 1)
            ranges = np.interp(ang_hi, angles, ranges)
            if int_on is not None:
                int_on = np.interp(ang_hi, angles, int_on)
            angles = ang_hi
            n = int(ranges.shape[0])

        sig = self.cfg.range_sigma_scale * np.maximum(ranges, 0.0) + self.cfg.range_sigma_floor_m
        r_n = np.maximum(ranges + rng.normal(0.0, sig), 1e-4)
        a_n = angles + rng.normal(0.0, np.deg2rad(self.cfg.angular_sigma_deg), size=n)

        p_drop = 1.0 - np.exp(-np.clip(r_n, 0.0, None) / self.cfg.dropout_range_scale_m)
        dust = np.exp(-self.cfg.dust_beta_per_m * np.clip(r_n, 0.0, None))
        keep = (rng.uniform(size=n) > p_drop) & (rng.uniform(size=n) < dust)
        if not np.any(keep):
            keep[:] = True

        r, th = r_n[keep], a_n[keep]
        x = r * np.cos(th)
        z = r * np.sin(th)
        y = np.zeros_like(x)
        xyz = np.stack([x, y, z], axis=1)

        if int_on is not None:
            int_hi = np.interp(a_n, angles, int_on) if int_on.shape[0] == angles.shape[0] else int_on
            intens = np.clip(int_hi[keep], 0.0, 1.0)
        else:
            intens = np.clip(np.exp(-0.12 * r) * dust[keep], 0.0, 1.0)

        valid = (r > self.hokuyo.min_range) & (r < self.hokuyo.max_range)
        xyz, intens = xyz[valid], intens[valid]
        if xyz.shape[0] < 8:
            self._frame += 1
            return PointCloud(xyz=xyz, intensity=intens, stamp_ns=stamp_ns, frame_id=f"lidar-{self._frame}")

        xz = xyz[:, [0, 2]]
        inl, abc = _ransac_line_xz(xz, rng=rng)
        a, b, c = float(abc[0]), float(abc[1]), float(abc[2])
        line_d = np.abs(a * xz[:, 0] + b * xz[:, 1] + c)
        mask = (line_d > 0.08) | (~inl)
        xyz_f, int_f = xyz[mask], intens[mask]
        _ = _cluster_xz(xyz_f, eps=0.10, min_samples=8)

        self._frame += 1
        return PointCloud(xyz=xyz_f.astype(np.float64), intensity=int_f.astype(np.float64), stamp_ns=stamp_ns, frame_id=f"lidar-{self._frame}")


class LidarPerceptionPipeline(LidarPerception):
    """Back-compat alias with Webots-oriented entrypoint."""

    def process_webots(self, webots_scan: np.ndarray | None, timestamp_ns: int) -> PointCloud:
        raw, ang, ts = self.hokuyo.ranges_from_webots_or_mock(webots_scan, timestamp_ns)
        return self.process_scan(raw, ang, stamp_ns=ts)


def _benchmark_rmse_range(perc: LidarPerception, num_scans: int = 100) -> Tuple[float, float]:
    h = perc.hokuyo
    gt = 5.0
    errs: list[float] = []
    for i in range(num_scans):
        scan = np.full(h.points_per_scan, gt, dtype=float)
        cloud = perc.process_scan(scan, stamp_ns=int(i * 25_000_000))
        if cloud.xyz.size == 0:
            continue
        pr = np.linalg.norm(cloud.xyz[:, 0:2], axis=1)
        errs.append(float(np.sqrt(np.mean((pr - gt) ** 2))))
    if not errs:
        return 0.0, 0.0
    return float(np.mean(errs)), float(np.std(errs))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    p = LidarPerceptionPipeline(dust_scenario=True)
    m, s = _benchmark_rmse_range(p, num_scans=50)
    print(f"LiDAR range RMSE (mock wall @5m): {m:.4f}m ± {s:.4f}m")
