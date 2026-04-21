"""Blind handoff production mock: sweep → detect → low battery auction → rover rescue → repeat."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

from mockdata.agent_states import AerialDroneState, GroundRoverState
from mockdata.battery_sim import DEFAULT_PROFILE
from mockdata.config import BlindHandoffConfig
from mockdata.handoff_event_bus import HandoffEventBus
from mockdata.handoff_protocol import rescue_complete
from mockdata.rover_paths import lawnmower_segment_progress, step_toward, xz_distance
from mockdata.vertex_auction import RoverBidInput, VertexAuction
from mockdata.victim_detector import detect_victim
from mockdata.worldgen_airground import AirGroundWorld

Vec3 = Tuple[float, float, float]


class BlindHandoffEngine:
    """Drives the judge timeline on a repeating cycle (multi-victim handoffs)."""

    def __init__(
        self,
        seed: int = 42,
        world: Optional[Dict[str, Any]] = None,
        *,
        config: Optional[BlindHandoffConfig] = None,
    ) -> None:
        self.config = config or BlindHandoffConfig()
        if config is not None:
            self.seed = int(config.seed)
        elif world is not None:
            ws = world.get("seed")
            self.seed = int(ws) if isinstance(ws, (int, float)) else int(seed)
        else:
            self.seed = int(seed)
        self.world = world or AirGroundWorld().generate(self.seed)
        self.timeline: Dict[str, float] = {**self.world.get("timeline", {})}
        for k, v in {
            "detect_s": 15.0,
            "auction_start_s": 16.0,
            "bids_s": 18.0,
            "winner_s": 20.0,
            "rtb_done_s": 27.0,
            "rescue_arrival_s": 30.0,
            "cycle_reset_s": 38.0,
        }.items():
            self.timeline.setdefault(k, v)

        path_raw = self.world.get("sweep_path") or []
        self._sweep_path: List[Vec3] = [
            (float(p[0]), float(p[1]), float(p[2])) for p in path_raw if isinstance(p, (list, tuple)) and len(p) >= 3
        ]
        if not self._sweep_path:
            ast = self.world.get("aerial_start", [-80, 20, -80])
            self._sweep_path = [(float(ast[0]), float(ast[1]), float(ast[2]))]

        self.aerial = AerialDroneState(
            id="Aerial1",
            position=list(self._sweep_path[0]),
            speed_m_s=float(self.world.get("aerial_speed_m_s", 8.0)),
            altitude=float(self._sweep_path[0][1]),
        )
        self._sweep_distance = 0.0
        self._rtb_target: Vec3 = (
            float(self.world.get("aerial_start", self._sweep_path[0])[0]),
            float(self.world.get("aerial_start", self._sweep_path[0])[1]),
            float(self.world.get("aerial_start", self._sweep_path[0])[2]),
        )

        gspeed = float(self.world.get("ground_speed_m_s", 2.5))
        starts = self.world.get("ground_starts") or []
        meta = self.world.get("rover_meta") or []
        self.ground: List[GroundRoverState] = []
        for i, m in enumerate(meta):
            st = starts[i] if i < len(starts) else [0.0, 0.35, 0.0]
            self.ground.append(GroundRoverState.from_meta(st, m, gspeed))

        self.victims: List[Dict[str, Any]] = list(self.world.get("victims", []))
        self._victim_idx = 0
        self.t = 0.0
        self._cycle_t0 = 0.0
        self.rescues_completed = 0
        self.auction = VertexAuction()
        self._auction_open = False
        self._bids_submitted = False
        self.events = HandoffEventBus()
        self._replay_events: List[Dict[str, Any]] = []
        self._rescued_this_cycle = False

    def cycle_local(self) -> float:
        return self.t - self._cycle_t0

    def _current_victim(self) -> Optional[Dict[str, Any]]:
        if not self.victims:
            return None
        return self.victims[self._victim_idx % len(self.victims)]

    def _start_new_cycle(self) -> None:
        self._cycle_t0 = self.t
        self.auction.reset()
        self._auction_open = False
        self._bids_submitted = False
        self._rescued_this_cycle = False
        self.aerial.victim_detected = None
        self.aerial.mode = "sweep"
        self._sweep_distance = 0.0
        self.aerial.position = list(self._sweep_path[0])
        self.aerial.battery = 100.0
        for g in self.ground:
            g.current_task = None
        starts = self.world.get("ground_starts") or []
        for i, g in enumerate(self.ground):
            st = starts[i] if i < len(starts) else [0.0, 0.35, 0.0]
            g.position = [float(st[0]), float(st[1]), float(st[2])]
            g.battery = 100.0
        ast = self.world.get("aerial_start", self._sweep_path[0])
        self._rtb_target = (float(ast[0]), float(ast[1]), float(ast[2]))

    def _append_replay(self, ev: Dict[str, Any]) -> None:
        ev = {**ev, "sim_t": round(self.t, 3)}
        self._replay_events.append(ev)

    def step(self, dt: float) -> None:
        dt = max(0.0, float(dt))
        self.t += dt
        lt = self.cycle_local()
        tl = self.timeline
        victim_rec = self._current_victim()

        # --- Battery (piecewise, judge-sync: <20% by auction broadcast) ---
        prof = DEFAULT_PROFILE
        thr = float(self.config.low_battery_threshold)
        t_det = float(tl["detect_s"])
        t_au = float(tl["auction_start_s"])
        if lt < t_det:
            self.aerial.battery = max(thr + 5.0, 100.0 - (100.0 - (thr + 5.0)) / max(t_det, 1e-6) * lt)
            for g in self.ground:
                g.battery = max(55.0, 100.0 - prof.ground_idle_pct_s * lt * 0.2)
        elif lt < t_au:
            span = max(t_au - t_det, 1e-6)
            u = (lt - t_det) / span
            hi = thr + 5.0
            lo = max(8.0, thr - 3.0)
            self.aerial.battery = hi - (hi - lo) * u
        elif lt < tl["bids_s"]:
            self.aerial.battery = max(8.0, self.aerial.battery - prof.aerial_post_detect_pct_s * dt * 0.35)
        elif lt < tl["winner_s"]:
            self.aerial.battery = max(8.0, self.aerial.battery - prof.aerial_post_detect_pct_s * dt * 0.45)
        else:
            self.aerial.battery = max(6.0, self.aerial.battery - prof.aerial_sweep_pct_s * dt * 0.35)

        # --- Victim detection (FOV while sweeping) ---
        if victim_rec and lt < tl["detect_s"]:
            pos = tuple(self.aerial.position)  # type: ignore[arg-type]
            head = self.aerial.heading_deg
            hit = detect_victim(pos, head, [victim_rec])
            if hit:
                self.aerial.victim_detected = hit

        if victim_rec and lt >= tl["detect_s"] and self.aerial.victim_detected is None:
            p = victim_rec.get("pos", [0, 0, 0])
            self.aerial.victim_detected = {
                "coords": [float(p[0]), float(p[1]), float(p[2])],
                "confidence": 0.85,
                "type": "human",
                "victim_id": victim_rec.get("id", "victim"),
            }
            self._append_replay({"event": "VICTIM_DETECTED", "victim": victim_rec.get("id")})

        # --- Auction window ---
        if (
            victim_rec
            and lt >= tl["auction_start_s"]
            and not self._auction_open
            and self.aerial.victim_detected
        ):
            coords = tuple(self.aerial.victim_detected["coords"])  # type: ignore[arg-type]
            ev = self.auction.broadcast_task(coords)
            self._auction_open = True
            self._append_replay({"event": "AUCTION_START", "coords": list(coords)})
            self.events.emit({"type": "AUCTION_BROADCAST", "payload": ev})

        if (
            self._auction_open
            and not self._bids_submitted
            and lt >= tl["bids_s"]
            and self.auction.task_coords is not None
        ):
            inputs = [
                RoverBidInput(
                    g.id,
                    (float(g.position[0]), float(g.position[1]), float(g.position[2])),
                    g.battery,
                    g.capacity,
                )
                for g in self.ground
            ]
            self.auction.collect_from_rovers(inputs)
            self._bids_submitted = True
            self._append_replay(
                {
                    "event": "BIDS_SUBMITTED",
                    "bids": {k: dict(v) for k, v in self.auction.bids.items()},
                }
            )
            self.events.emit({"type": "BIDS_SUBMITTED", "count": len(self.auction.bids)})

        if self._auction_open and self.auction.winner is None and lt >= tl["winner_s"]:
            win = self.auction.select_winner()
            for g in self.ground:
                if win and g.id == win:
                    g.current_task = "rescue"
            self.aerial.mode = "rtb"
            self._append_replay({"event": "AUCTION_WINNER", "winner": win})
            self.events.emit({"type": "HANDOFF_WINNER", "winner": win})

        # --- Motion: sweep / RTB / rover rescue ---
        vic_coords: Optional[Vec3] = None
        if self.aerial.victim_detected:
            c = self.aerial.victim_detected.get("coords", [0, 0, 0])
            vic_coords = (float(c[0]), float(c[1]), float(c[2]))

        if lt < tl["winner_s"]:
            self._sweep_distance += self.aerial.speed_m_s * dt
            sp = lawnmower_segment_progress(self._sweep_path, self._sweep_distance)
            self.aerial.position = [sp[0], sp[1], sp[2]]
            if vic_coords:
                dx = vic_coords[0] - sp[0]
                dz = vic_coords[2] - sp[2]
                self.aerial.heading_deg = math.degrees(math.atan2(dz, dx))
        elif self.aerial.mode == "rtb" and lt < tl["rtb_done_s"]:
            cur = tuple(self.aerial.position)  # type: ignore[arg-type]
            nxt = step_toward(cur, self._rtb_target, self.aerial.speed_m_s * 0.85, dt, y_floor=self._rtb_target[1])
            self.aerial.position = [nxt[0], nxt[1], nxt[2]]
        elif lt >= tl["rtb_done_s"]:
            self.aerial.position = [self._rtb_target[0], self._rtb_target[1], self._rtb_target[2]]

        win = self.auction.winner
        if win and vic_coords and lt >= tl["winner_s"] and lt < tl["rescue_arrival_s"]:
            for g in self.ground:
                if g.id != win:
                    continue
                cur = (float(g.position[0]), float(g.position[1]), float(g.position[2]))
                nxt = step_toward(cur, vic_coords, g.speed_m_s, dt, y_floor=vic_coords[1])
                g.position = [nxt[0], nxt[1], nxt[2]]
                g.battery = max(20.0, g.battery - DEFAULT_PROFILE.ground_transit_pct_s * dt)

        # --- Rescue complete ---
        if win and vic_coords and lt >= tl["rescue_arrival_s"]:
            rover = next((g for g in self.ground if g.id == win), None)
            if rover and xz_distance(tuple(rover.position), vic_coords) > 2.5:
                rover.position = [vic_coords[0], vic_coords[1], vic_coords[2]]

        if win and not self._rescued_this_cycle and lt >= tl["rescue_arrival_s"]:
            vid = victim_rec.get("id", "victim") if victim_rec else "victim"
            self._append_replay(rescue_complete(vid, win, self.t))
            self.rescues_completed += 1
            self._rescued_this_cycle = True

        if lt >= tl["cycle_reset_s"]:
            self._victim_idx += 1
            self._start_new_cycle()

    def replay_log(self) -> List[Dict[str, Any]]:
        return list(self._replay_events)
