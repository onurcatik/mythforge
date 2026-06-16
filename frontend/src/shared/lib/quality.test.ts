import { describe, expect, it } from "vitest";

import { calculateReadinessScore, getPhaseEightChecklist } from "./quality";

describe("independent frontend quality gates", () => {
  it("calculates a weighted readiness score", () => {
    expect(
      calculateReadinessScore([
        { id: "a", title: "A", description: "A", status: "ready", owner: "frontend" },
        { id: "b", title: "B", description: "B", status: "watch", owner: "qa" },
        { id: "c", title: "C", description: "C", status: "blocked", owner: "qa" },
      ])
    ).toBe(52);
  });

  it("ships phase eight with backend contract safety covered", () => {
    const checklist = getPhaseEightChecklist();
    expect(checklist.some((item) => item.id === "backend-contract" && item.status === "ready")).toBe(true);
  });
});
