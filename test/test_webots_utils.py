"""Unit tests for webots simulation utilities (no Webots runtime)."""

from __future__ import annotations

import random
import unittest

from webots.scenarios.registry import build_context
from webots.utils.geometry import Rect, Vec2, distance, grid_partition, split_stripes_along_x


class TestGeometry(unittest.TestCase):
    def test_split_stripes_five_sectors(self) -> None:
        arena = Rect(-50, 50, -50, 50)
        stripes = split_stripes_along_x(arena, 5)
        self.assertEqual(len(stripes), 5)
        self.assertAlmostEqual(sum(s.width for s in stripes), arena.width)

    def test_grid_partition_deterministic(self) -> None:
        arena = Rect(0, 100, 0, 100)
        rng_a = random.Random(7)
        rng_b = random.Random(7)
        free1, blk1 = grid_partition(arena, 10, 10, rng_a, 0.2)
        free2, blk2 = grid_partition(arena, 10, 10, rng_b, 0.2)
        self.assertEqual(len(blk1), len(blk2))
        self.assertEqual(
            [(b.min_x, b.max_x, b.min_z, b.max_z) for b in blk1],
            [(b.min_x, b.max_x, b.min_z, b.max_z) for b in blk2],
        )
        self.assertEqual(len(free1), len(free2))

    def test_distance(self) -> None:
        self.assertEqual(distance(Vec2(0, 0), Vec2(3, 4)), 5.0)


class TestScenarios(unittest.TestCase):
    def test_generate_all_scenarios_wbt_non_empty(self) -> None:
        for name in ("fallen_comrade", "blind_handoff", "tunnel_blackout", "open_track"):
            ctx = build_context(name, seed=99)
            self.assertTrue("SwarmRobot" in ctx.wbt_text)
            self.assertEqual(ctx.artifacts.metadata["scenario"], name)


if __name__ == "__main__":
    unittest.main()
