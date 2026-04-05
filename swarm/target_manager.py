"""Decentralized victim/target discovery, gossip, and distance-based claiming (P2P-only)."""

from __future__ import annotations

import hashlib
import math
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from swarm import config
from swarm.chain_manager import DroneRole

Location = Tuple[float, float, float]
RoleGetter = Callable[[], DroneRole]
PositionGetter = Callable[[], Location]
OnClaimCallback = Callable[["Target"], None]


def _location_key(location: Location) -> str:
    return f"{int(round(location[0] * 10))}_{int(round(location[1] * 10))}_{int(round(location[2] * 10))}"


def _distance(a: Location, b: Location) -> float:
    dx, dy, dz = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return math.sqrt(dx * dx + dy * dy + dz * dz)


class Target:
    def __init__(
        self,
        target_id: str,
        location: Location,
        timestamp: float,
        confidence: float,
        reported_by: str,
        status: str = "pending",
        assigned_to: Optional[str] = None,
        assigned_distance: Optional[float] = None,
        assigned_at: Optional[float] = None,
    ) -> None:
        self.id = target_id
        self.location = location
        self.timestamp = timestamp
        self.confidence = confidence
        self.reported_by = reported_by
        self.status = status
        self.assigned_to = assigned_to
        self.assigned_distance = assigned_distance
        self.assigned_at = assigned_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "location": list(self.location),
            "timestamp": self.timestamp,
            "confidence": self.confidence,
            "reported_by": self.reported_by,
            "status": self.status,
            "assigned_to": self.assigned_to,
            "assigned_distance": self.assigned_distance,
            "assigned_at": self.assigned_at,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Target":
        loc = d["location"]
        if isinstance(loc, (list, tuple)) and len(loc) >= 3:
            location = (float(loc[0]), float(loc[1]), float(loc[2]))
        else:
            location = (0.0, 0.0, 0.0)
        return cls(
            str(d["id"]),
            location,
            float(d["timestamp"]),
            float(d["confidence"]),
            str(d["reported_by"]),
            str(d.get("status", "pending")),
            d.get("assigned_to"),
            float(d["assigned_distance"]) if d.get("assigned_distance") is not None else None,
            float(d["assigned_at"]) if d.get("assigned_at") is not None else None,
        )


class TargetManager:
    def __init__(
        self,
        my_id: str,
        vertex: Any,
        role_getter: RoleGetter,
        position_getter: PositionGetter,
        on_claim_callback: OnClaimCallback,
    ) -> None:
        self.my_id = my_id
        self.vertex = vertex
        self.role_getter = role_getter
        self.position_getter = position_getter
        self.on_claim_callback = on_claim_callback
        self.targets: Dict[str, Target] = {}
        self.claimed_target: Optional[str] = None
        self._reported_keys: Set[str] = set()
        self._last_claim_attempt: Dict[str, float] = {}
        self._claim_retry_interval = 2.0

    def tick(self) -> None:
        now = time.time()
        stale: List[str] = []
        for tid, t in self.targets.items():
            if t.status != "pending" or not t.assigned_to:
                continue
            if t.assigned_at is None:
                continue
            if now - t.assigned_at > config.TARGET_ASSIGN_TIMEOUT_SEC:
                stale.append(tid)
        for tid in stale:
            t = self.targets.get(tid)
            if not t:
                continue
            t.assigned_to = None
            t.assigned_distance = None
            t.assigned_at = None
            if self.claimed_target == tid:
                self.claimed_target = None
            self._broadcast_target(t, msg_type="TARGET_UPDATE")
        self._cleanup_old_resolved(now)

    def _cleanup_old_resolved(self, now: float) -> None:
        """Remove resolved targets kept locally past cleanup window (if any)."""
        to_del = [
            tid
            for tid, t in self.targets.items()
            if t.status == "resolved" and now - t.timestamp > config.TARGET_CLEANUP_TIMEOUT
        ]
        for tid in to_del:
            self.targets.pop(tid, None)

    def detect_target(self, location: Location, confidence: float) -> None:
        if confidence < config.TARGET_CONFIDENCE_THRESHOLD:
            return
        key = _location_key(location)
        target_id = f"victim_{key}"
        if target_id in self.targets:
            return
        if key in self._reported_keys:
            return
        self._reported_keys.add(key)
        self._create_and_announce_target(target_id, location, confidence, self.my_id)

    def ingest_peer_victim_detection(self, sender: str, location: Location, confidence: float) -> None:
        """Merge mock / peer VICTIM_DETECTED gossip (no local _reported_keys side effects)."""
        if confidence < config.TARGET_CONFIDENCE_THRESHOLD:
            return
        key = _location_key(location)
        target_id = f"victim_{key}"
        if target_id in self.targets:
            return
        self._create_and_announce_target(target_id, location, confidence, sender)

    def _create_and_announce_target(
        self,
        target_id: str,
        location: Location,
        confidence: float,
        reported_by: str,
    ) -> None:
        target = Target(target_id, location, time.time(), confidence, reported_by)
        self.targets[target_id] = target
        self._broadcast_target(target, msg_type="TARGET_ANNOUNCEMENT")
        self._try_claim(target_id)

    def _broadcast_target(self, target: Target, msg_type: str = "TARGET_ANNOUNCEMENT") -> None:
        self.vertex.broadcast({"type": msg_type, "target": target.to_dict()})

    def handle_message(self, sender: str, msg: Dict[str, Any]) -> None:
        msg_type = msg.get("type")
        if msg_type == "VICTIM_DETECTED":
            loc = msg.get("location")
            if isinstance(loc, (list, tuple)) and len(loc) >= 3:
                self.ingest_peer_victim_detection(
                    sender,
                    (float(loc[0]), float(loc[1]), float(loc[2])),
                    float(msg.get("confidence", 1.0)),
                )
            return
        if msg_type == "TARGET_ANNOUNCEMENT":
            self._handle_announcement(sender, msg["target"])
        elif msg_type == "TARGET_UPDATE":
            self._handle_update(sender, msg.get("target", {}))
        elif msg_type == "TARGET_CLAIM":
            self._handle_claim(
                sender,
                str(msg["target_id"]),
                float(msg["distance"]),
                str(msg["claimant"]),
            )
        elif msg_type == "TARGET_RESOLVED":
            self._handle_resolved(sender, str(msg["target_id"]))

    def _handle_announcement(self, _sender: str, target_dict: Dict[str, Any]) -> None:
        target = Target.from_dict(target_dict)
        if target.id not in self.targets:
            self.targets[target.id] = target
            self._try_claim(target.id)

    def _handle_update(self, _sender: str, target_dict: Dict[str, Any]) -> None:
        if not target_dict.get("id"):
            return
        target = Target.from_dict(target_dict)
        self.targets[target.id] = target
        self._try_claim(target.id)

    def _eligible_role(self) -> bool:
        role = self.role_getter()
        return role in (DroneRole.STANDBY, DroneRole.EXPLORER)

    def _swarm_ids_for_rendezvous(self) -> List[str]:
        emu = getattr(self.vertex, "emulator", None)
        if emu is not None:
            return sorted(emu.registered_node_ids())
        kp = getattr(self.vertex, "known_peers", None)
        if isinstance(kp, set):
            return sorted({self.my_id, *kp})
        return [self.my_id]

    @staticmethod
    def _rendezvous_winner(task_id: str, node_ids: List[str]) -> Optional[str]:
        if not node_ids:
            return None
        best: Optional[str] = None
        best_v = -1
        for nid in node_ids:
            h = hashlib.sha256(f"{task_id}|{nid}".encode()).digest()
            v = int.from_bytes(h[:8], "big")
            if v > best_v:
                best_v = v
                best = nid
        return best

    def _try_claim(self, target_id: str) -> None:
        target = self.targets.get(target_id)
        if not target or target.status != "pending":
            return
        if self.claimed_target is not None:
            return
        if not self._eligible_role():
            return
        if getattr(config, "TARGET_USE_RENDEZVOUS_CLAIM", False):
            winner = self._rendezvous_winner(target_id, self._swarm_ids_for_rendezvous())
            if winner is None or winner != self.my_id:
                return
            my_pos = self.position_getter()
            my_distance = _distance(my_pos, target.location)
            now = time.time()
            self._last_claim_attempt[target_id] = now
            self.vertex.broadcast(
                {
                    "type": "TARGET_CLAIM",
                    "target_id": target_id,
                    "distance": my_distance,
                    "claimant": self.my_id,
                    "rendezvous": True,
                }
            )
            self._apply_claim(target_id, my_distance, self.my_id)
            return
        my_pos = self.position_getter()
        my_distance = _distance(my_pos, target.location)
        now = time.time()
        last = self._last_claim_attempt.get(target_id, 0.0)
        if now - last < self._claim_retry_interval:
            return
        better = self._claim_wins(my_distance, self.my_id, target.assigned_distance, target.assigned_to)
        if not better:
            return
        self._last_claim_attempt[target_id] = now
        self.vertex.broadcast(
            {
                "type": "TARGET_CLAIM",
                "target_id": target_id,
                "distance": my_distance,
                "claimant": self.my_id,
            }
        )
        self._apply_claim(target_id, my_distance, self.my_id)

    @staticmethod
    def _claim_wins(
        distance: float,
        claimant: str,
        current_dist: Optional[float],
        current_holder: Optional[str],
    ) -> bool:
        if not current_holder:
            return True
        if current_dist is None:
            return True
        if distance < current_dist:
            return True
        if distance > current_dist:
            return False
        return claimant < current_holder

    def _apply_claim(self, target_id: str, distance: float, claimant: str) -> None:
        target = self.targets.get(target_id)
        if not target or target.status != "pending":
            return
        if not self._claim_wins(distance, claimant, target.assigned_distance, target.assigned_to):
            return
        target.assigned_to = claimant
        target.assigned_distance = distance
        target.assigned_at = time.time()
        if claimant == self.my_id:
            self.claimed_target = target_id
            self.on_claim_callback(target)
        elif self.claimed_target == target_id:
            self.claimed_target = None

    def _handle_claim(self, _sender: str, target_id: str, distance: float, claimant: str) -> None:
        self._apply_claim(target_id, distance, claimant)

    def _handle_resolved(self, _sender: str, target_id: str) -> None:
        if target_id in self.targets:
            del self.targets[target_id]
        if self.claimed_target == target_id:
            self.claimed_target = None
        if target_id.startswith("victim_"):
            self._reported_keys.discard(target_id[len("victim_") :])

    def reached_target(self) -> bool:
        if not self.claimed_target:
            return False
        target = self.targets.get(self.claimed_target)
        if not target:
            self.claimed_target = None
            return False
        target.status = "resolved"
        self.vertex.broadcast({"type": "TARGET_RESOLVED", "target_id": target.id})
        tid = target.id
        del self.targets[tid]
        self.claimed_target = None
        return True

    def targets_for_ui(self) -> List[Dict[str, Any]]:
        return [t.to_dict() for t in self.targets.values()]
