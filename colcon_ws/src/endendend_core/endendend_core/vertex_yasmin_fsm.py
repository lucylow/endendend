"""
Track 2 YASMIN states aligned with ROS2swarm-style patterns (aggregation / chain / victim).

Library helpers to compose a ``StateMachine``; connect blackboard keys from ROS bridge nodes.
"""

from __future__ import annotations

import time

from yasmin import Blackboard, State, StateMachine


class AggregationFormationState(State):
    """Aggregation: wait until enough peers appear on the blackboard."""

    def __init__(self) -> None:
        super().__init__(outcomes=['ready', 'wait'])
        self.set_description('ROS2swarm aggregation → quorum for chain seed.')

    def execute(self, blackboard: Blackboard) -> str:
        try:
            n = int(blackboard['peer_count'])
        except (KeyError, TypeError, ValueError):
            n = 0
        return 'ready' if n >= 4 else 'wait'


class ChainFormationState(State):
    """Chain: proceed when relay coordinator marks chain ranks."""

    def __init__(self) -> None:
        super().__init__(outcomes=['chain_formed', 'forming'])
        self.set_description('ROS2swarm CHAIN → depth-ordered relay (blackboard hook).')

    def execute(self, blackboard: Blackboard) -> str:
        try:
            rank = int(blackboard['chain_rank'])
        except (KeyError, TypeError, ValueError):
            rank = -1
        return 'chain_formed' if rank >= 0 else 'forming'


class VictimExtractionState(State):
    """Victim extraction / bidding proxy (blackboard ``victim_dist`` from ROS bridge)."""

    def __init__(self) -> None:
        super().__init__(outcomes=['extracting', 'bidding', 'search'])
        self.set_description('ROS2swarm aggregation → extractor bid / approach.')

    def execute(self, blackboard: Blackboard) -> str:
        try:
            dist = float(blackboard['victim_dist'])
        except (KeyError, TypeError, ValueError):
            dist = 999.0
        if dist < 3.0:
            return 'extracting'
        if dist < 15.0:
            return 'bidding'
        return 'search'


class SearchSpinState(State):
    """Dispersion / continue tunnel search."""

    def __init__(self) -> None:
        super().__init__(outcomes=['spin'])
        self.set_description('Dispersion / continue tunnel search.')

    def execute(self, blackboard: Blackboard) -> str:
        try:
            time.sleep(float(blackboard['fsm_tick_s']))
        except (KeyError, TypeError, ValueError):
            time.sleep(0.5)
        return 'spin'


def create_track2_swarm_fsm(viewer_name: str, drone_ns: str) -> StateMachine:
    """Finite machine skeleton for Track 2 (extend / connect to ROS timers as needed)."""
    try:
        from yasmin_ros.basic_outcomes import CANCEL, SUCCEED
    except ImportError:  # pragma: no cover
        SUCCEED, CANCEL = 'succeeded', 'canceled'

    sm = StateMachine(outcomes=[SUCCEED, CANCEL], handle_sigint=False)
    sm.set_description(f'Track2 Vertex+ROS2swarm FSM ({viewer_name}, {drone_ns})')

    sm.add_state(
        'AGGREGATION',
        AggregationFormationState(),
        transitions={'ready': 'CHAIN', 'wait': 'AGGREGATION'},
    )
    sm.add_state(
        'CHAIN',
        ChainFormationState(),
        transitions={'chain_formed': 'VICTIM', 'forming': 'CHAIN'},
    )
    sm.add_state(
        'VICTIM',
        VictimExtractionState(),
        transitions={'extracting': 'SEARCH', 'bidding': 'VICTIM', 'search': 'SEARCH'},
    )
    sm.add_state('SEARCH', SearchSpinState(), transitions={'spin': 'SEARCH'})

    try:
        from yasmin_viewer import YasminViewerPub

        YasminViewerPub(sm, f'{viewer_name}_{drone_ns.strip("/")}_track2')
    except Exception:
        pass

    return sm
