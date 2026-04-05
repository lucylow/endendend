"""Tests for the metrics module."""

from swarm.metrics import Metrics


def test_counter_increment() -> None:
    m = Metrics()
    m.inc("msgs_sent", 5)
    m.inc("msgs_sent", 3)
    assert m.get_counter("msgs_sent") == 8


def test_histogram_summary() -> None:
    m = Metrics()
    for v in [1.0, 2.0, 3.0]:
        m.record("latency", v)
    s = m.get_summary()
    assert s["latency_avg"] == 2.0
    assert s["latency_max"] == 3.0
    assert s["latency_min"] == 1.0


def test_reset() -> None:
    m = Metrics()
    m.inc("x")
    m.record("y", 1.0)
    m.reset()
    assert m.get_counter("x") == 0
    assert m.get_summary() == {}
