import { describe, expect, it } from "vitest";
import { validateNormalizedOutput } from "../../scripts/execute-plan/plan-normalizer.js";

describe("validateNormalizedOutput", () => {
  it("preserves optional source, story, and skillIds task metadata", () => {
    const graph = validateNormalizedOutput({
      tasks: [
        {
          id: "T001",
          phase: "Phase 1",
          type: "implement",
          title: "Build feature",
          desc: "Implement the feature",
          dependsOn: [],
          acceptance: [],
          files: { create: [], modify: ["src/feature.ts"] },
          steps: [],
          priority: "normal",
          parallelizable: false,
          source: "speckit:specs/001-feature/tasks.md",
          story: "US1",
          skillIds: ["frontend-design", "browse"],
        },
      ],
    });

    expect(graph.tasks[0]).toMatchObject({
      source: "speckit:specs/001-feature/tasks.md",
      story: "US1",
      skillIds: ["frontend-design", "browse"],
    });
  });
});
