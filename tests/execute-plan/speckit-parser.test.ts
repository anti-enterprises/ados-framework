import { describe, expect, it } from "vitest";
import { parseSpecKitTasks } from "../../scripts/execute-plan/speckit-parser.js";

const tasksMarkdown = `# Tasks: Feature API

## Phase 1: Setup

- [ ] T001 Create package entrypoint in \`src/index.ts\`
- [ ] T002 [P] Add unit tests in \`tests/index.test.ts\`
- [ ] T003 [P] [US1] Add contract test for create API in \`tests/api.contract.test.ts\`
- [ ] T004 [US1] Implement create API handler in \`src/api.ts\`

### User Story 2 - Security review

- [ ] T005 [US2] Review security posture and document findings in \`docs/security.md\`
`;

describe("parseSpecKitTasks", () => {
  it("turns Spec Kit tasks.md into deterministic ADOS canonical tasks", () => {
    const graph = parseSpecKitTasks(tasksMarkdown, {
      feature: "001-feature-api",
      sourcePath: "specs/001-feature-api/tasks.md",
    });

    expect(graph.tasks.map((task) => task.id)).toEqual(["T001", "T002", "T003", "T004", "T005"]);
    expect(graph.tasks.map((task) => task.phase)).toEqual([
      "Phase 1: Setup",
      "Phase 1: Setup",
      "Phase 1: Setup",
      "Phase 1: Setup",
      "User Story 2 - Security review",
    ]);

    expect(graph.tasks[0]).toMatchObject({
      type: "implement",
      title: "Create package entrypoint in `src/index.ts`",
      parallelizable: false,
      dependsOn: [],
      source: "speckit:specs/001-feature-api/tasks.md",
    });

    expect(graph.tasks[1]).toMatchObject({
      type: "test",
      parallelizable: true,
      dependsOn: ["T001"],
      files: { create: ["tests/index.test.ts"], modify: [] },
      skillIds: ["test-driven-development", "qa-only"],
    });

    expect(graph.tasks[2]).toMatchObject({
      story: "US1",
      parallelizable: true,
      dependsOn: ["T001"],
    });

    expect(graph.tasks[3]).toMatchObject({
      type: "implement",
      story: "US1",
      parallelizable: false,
      dependsOn: ["T002", "T003"],
      files: { create: [], modify: ["src/api.ts"] },
    });

    expect(graph.tasks[4]).toMatchObject({
      type: "review",
      story: "US2",
      dependsOn: ["T004"],
      files: { create: ["docs/security.md"], modify: [] },
      skillIds: ["review", "security-review"],
    });
  });

  it("throws clearly when a Spec Kit task file contains no task rows", () => {
    expect(() => parseSpecKitTasks("# Tasks\n\nNo tasks yet.")).toThrow(
      "No Spec Kit task rows found",
    );
  });
});
