import { describe, it, expect } from "vitest";
import { buildExecutionGraph, formatExecutionPlan } from "../../scripts/execute-plan/build-execution-graph.js";
import type { TaskGraph, CanonicalTask } from "../../scripts/execute-plan/types.js";

function makeTask(overrides: Partial<CanonicalTask> = {}): CanonicalTask {
  return {
    id: "task-1",
    phase: "default",
    type: "implement",
    title: "Test task",
    desc: "A test task",
    dependsOn: [],
    acceptance: [],
    files: { create: [], modify: [] },
    steps: [],
    priority: "normal",
    parallelizable: true,
    ...overrides,
  };
}

describe("buildExecutionGraph", () => {
  it("puts independent tasks in the same level", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b" }),
        makeTask({ id: "c" }),
      ],
    };

    const exec = buildExecutionGraph(graph);
    expect(exec.levels).toHaveLength(1);
    expect(exec.levels[0]).toHaveLength(3);
  });

  it("puts linear dependencies in sequential levels", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ],
    };

    const exec = buildExecutionGraph(graph);
    expect(exec.levels).toHaveLength(3);
    expect(exec.levels[0].map((t) => t.id)).toEqual(["a"]);
    expect(exec.levels[1].map((t) => t.id)).toEqual(["b"]);
    expect(exec.levels[2].map((t) => t.id)).toEqual(["c"]);
  });

  it("handles diamond dependency correctly", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["a"] }),
        makeTask({ id: "d", dependsOn: ["b", "c"] }),
      ],
    };

    const exec = buildExecutionGraph(graph);
    expect(exec.levels).toHaveLength(3);
    expect(exec.levels[0].map((t) => t.id)).toEqual(["a"]);
    expect(exec.levels[1].map((t) => t.id).sort()).toEqual(["b", "c"]);
    expect(exec.levels[2].map((t) => t.id)).toEqual(["d"]);
  });

  it("assigns concurrency levels to mapped tasks", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ],
    };

    const exec = buildExecutionGraph(graph);
    const taskA = exec.tasks.find((t) => t.id === "a")!;
    const taskB = exec.tasks.find((t) => t.id === "b")!;

    expect(taskA.concurrencyLevel).toBe(0);
    expect(taskB.concurrencyLevel).toBe(1);
  });

  it("applies framework mapping to tasks", () => {
    const graph: TaskGraph = {
      tasks: [makeTask({ id: "a", type: "design" })],
    };

    const exec = buildExecutionGraph(graph);
    expect(exec.tasks[0].sparcRole).toBe("architect");
    expect(exec.tasks[0].rufloAgent).toBe("architect");
    expect(exec.tasks[0].skills).toContain("writing-plans");
  });

  it("filters by phase", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a", phase: "setup" }),
        makeTask({ id: "b", phase: "build" }),
        makeTask({ id: "c", phase: "build" }),
      ],
    };

    const exec = buildExecutionGraph(graph, { phase: "build" });
    expect(exec.tasks).toHaveLength(2);
    expect(exec.tasks.every((t) => t.phase === "build")).toBe(true);
  });

  it("throws on unknown phase", () => {
    const graph: TaskGraph = {
      tasks: [makeTask({ id: "a", phase: "setup" })],
    };

    expect(() => buildExecutionGraph(graph, { phase: "nonexistent" })).toThrow(
      'No tasks found in phase "nonexistent"',
    );
  });
});

describe("formatExecutionPlan", () => {
  it("produces readable output", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a", title: "Design API", type: "design" }),
        makeTask({ id: "b", title: "Build API", type: "implement", dependsOn: ["a"] }),
      ],
    };

    const exec = buildExecutionGraph(graph);
    const output = formatExecutionPlan(exec);

    expect(output).toContain("2 tasks across 2 levels");
    expect(output).toContain("Level 0");
    expect(output).toContain("Level 1");
    expect(output).toContain("Design API");
    expect(output).toContain("Build API");
    expect(output).toContain("architect");
    expect(output).toContain("coder");
  });
});
