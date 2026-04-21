"""Per-drone YASMIN state machine: discovery, election, explore/relay/solo loops."""

from __future__ import annotations

import threading
import time
from yasmin import Blackboard, State, StateMachine
from yasmin_ros.basic_outcomes import CANCEL, SUCCEED

try:
    from yasmin_viewer import YasminViewerPub
except ImportError:  # pragma: no cover - optional in minimal images
    YasminViewerPub = None  # type: ignore


class SwarmDiscoveryState(State):
    """DDS discovery proxy: peer count on the shared blackboard (updated by ROS)."""

    def __init__(self) -> None:
        super().__init__(outcomes=['peers_found', 'timeout'])
        self.set_description('Reads peer_count from blackboard; needs >=4 peers for swarm.')

    def execute(self, blackboard: Blackboard) -> str:
        try:
            peer_count = int(blackboard['peer_count'])
        except (KeyError, TypeError, ValueError):
            peer_count = 0
        if peer_count >= 4:
            return 'peers_found'
        return 'timeout'


class ExplorerElectionState(State):
    """Vertex-style election: deepest explorer wins when role not yet set."""

    def __init__(self) -> None:
        super().__init__(outcomes=['elected', 'backup'])
        self.set_description('Uses election_role if present; else depth vs peers.')

    def execute(self, blackboard: Blackboard) -> str:
        try:
            role = blackboard['election_role']
        except KeyError:
            role = None
        if role == 'elected':
            return 'elected'
        if role == 'backup':
            return 'backup'
        try:
            depth = float(blackboard['depth'])
        except (KeyError, TypeError, ValueError):
            depth = 0.0
        try:
            leader_depth = float(blackboard['leader_depth'])
        except (KeyError, TypeError, ValueError):
            leader_depth = depth
        if depth <= leader_depth + 1e-3:
            return 'elected'
        return 'backup'


class ExploringState(State):
    def __init__(self) -> None:
        super().__init__(outcomes=['spin'])
        self.set_description('Primary explorer; ticks until cancel.')

    def execute(self, blackboard: Blackboard) -> str:
        try:
            tick = float(blackboard['fsm_tick_s'])
        except (KeyError, TypeError, ValueError):
            tick = 0.5
        time.sleep(tick)
        return 'spin'


class RelayingState(State):
    def __init__(self) -> None:
        super().__init__(outcomes=['spin'])
        self.set_description('Relay / standby behavior.')

    def execute(self, blackboard: Blackboard) -> str:
        try:
            tick = float(blackboard['fsm_tick_s'])
        except (KeyError, TypeError, ValueError):
            tick = 0.5
        time.sleep(tick)
        return 'spin'


def create_swarm_fsm(viewer_name: str, drone_ns: str) -> StateMachine:
    """Build a cyclic swarm FSM; call ``sm(blackboard)`` in a worker thread."""
    outcomes = [SUCCEED, CANCEL]
    sm = StateMachine(outcomes=outcomes, handle_sigint=False)
    sm.set_description(f'endendend swarm FSM ({drone_ns})')

    sm.add_state(
        'DISCOVERY',
        SwarmDiscoveryState(),
        # Masterless DDS: quorum preferred, but always proceed to election for demos.
        transitions={'peers_found': 'ELECTION', 'timeout': 'ELECTION'},
    )
    sm.add_state(
        'ELECTION',
        ExplorerElectionState(),
        transitions={'elected': 'EXPLORING', 'backup': 'RELAYING'},
    )
    sm.add_state(
        'EXPLORING',
        ExploringState(),
        transitions={'spin': 'EXPLORING'},
    )
    sm.add_state(
        'RELAYING',
        RelayingState(),
        transitions={'spin': 'RELAYING'},
    )

    if YasminViewerPub is not None:
        try:
            YasminViewerPub(sm, f'{viewer_name}_{drone_ns.strip("/")}')
        except Exception:
            pass

    return sm


def start_fsm_thread(sm: StateMachine, blackboard: Blackboard) -> threading.Thread:
    """Run the state machine until cancel; share one ``Blackboard`` with ROS timers."""

    def _run() -> None:
        try:
            sm(blackboard)
        except Exception:
            pass

    t = threading.Thread(target=_run, name='endendend_yasmin', daemon=True)
    t.start()
    return t
