"""Collaborative GMM fusion: local clouds → compact components → global merge."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence, Tuple

import numpy as np

from ..types import SwarmMapMessage


@dataclass
class GmmMapFusion:
    max_components: int = 100

    def fit_local(self, xyz: np.ndarray, k: int = 32) -> List[Tuple[np.ndarray, np.ndarray, float]]:
        pts = np.asarray(xyz, dtype=np.float64).reshape(-1, 3)
        if pts.shape[0] < 4:
            return []
        rng = np.random.default_rng(0)
        k = min(k, pts.shape[0])
        idx = rng.choice(pts.shape[0], size=k, replace=False)
        seeds = pts[idx].copy()
        out: List[Tuple[np.ndarray, np.ndarray, float]] = []
        for m in seeds:
            d = np.linalg.norm(pts - m, axis=1)
            sel = d < 0.5
            if int(sel.sum()) < 3:
                continue
            chunk = pts[sel]
            c = np.cov(chunk.T) + 1e-4 * np.eye(3)
            w = float(sel.sum()) / float(pts.shape[0])
            out.append((chunk.mean(axis=0), c, w))
        wsum = sum(t[2] for t in out) or 1.0
        return [(m, c, w / wsum) for m, c, w in out]

    def merge(
        self,
        agent_components: Sequence[List[Tuple[np.ndarray, np.ndarray, float]]],
        timestamp_ns: int = 0,
    ) -> SwarmMapMessage:
        merged: List[Tuple[np.ndarray, np.ndarray, float]] = []
        for block in agent_components:
            merged.extend(block)
        merged.sort(key=lambda t: -t[2])
        merged = merged[: self.max_components]
        means = [m for m, _, _ in merged]
        if not means:
            return SwarmMapMessage(components=[], timestamp_ns=int(timestamp_ns))
        pts = np.stack(means, axis=0)
        center = pts.mean(axis=0)
        comps: List[Tuple[np.ndarray, np.ndarray, float]] = []
        for m, c, w in merged:
            comps.append((0.7 * m + 0.3 * center, c, w))
        return SwarmMapMessage(components=comps, timestamp_ns=int(timestamp_ns))
