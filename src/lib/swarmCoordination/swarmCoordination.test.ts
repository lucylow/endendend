import { describe, expect, it } from "vitest";
import { pickStandbyForRoleHandoff, stakeAmplifiedScores } from "./swarmCoordination";

describe("swarmCoordination", () => {
  it("stakeAmplifiedScores breaks near ties toward higher stake", () => {
    const s = stakeAmplifiedScores([100, 100], [0.51, 0.49], 1);
    expect(s[0]! > s[1]!).toBe(true);
  });

  it("pickStandbyForRoleHandoff prefers higher stake when battery similar", () => {
    const a = { id: "a", battery: 80, stakeAmount: 50 };
    const b = { id: "b", battery: 82, stakeAmount: 900 };
    expect(pickStandbyForRoleHandoff([a, b])?.id).toBe("b");
  });
});
