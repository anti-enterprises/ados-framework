import { describe, it, expect } from "vitest";
import {
  validateGraph,
  validateUniqueIds,
  validateDependencies,
  detectCycles,
  validateTaskTypes,
  validateNonEmpty,
} from "../../scripts/execute-plan/validate-taskgraph.js";
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

describe("validateNonEmpty", () => {
  it("throws on empty graph", () => {
    expect(() => validateNonEmpty({ tasks: [] })).toThrow("Empty task graph");
  });

  it("passes with tasks", () => {
    expect(() => validateNonEmpty({ tasks: [makeTask()] })).not.toThrow();
  });
});

describe("validateUniqueIds", () => {
  it("passes with unique IDs", () => {
    const graph: TaskGraph = {
      tasks: [makeTask({ id: "a" }), makeTask({ id: "b" })],
    };
    expect(() => validateUniqueIds(graph)).not.toThrow();
  });

  it("throws on duplicate IDs", () => {
    const graph: TaskGraph = {
      tasks: [makeTask({ id: "a" }), makeTask({ id: "a" })],
    };
    expect(() => validateUniqueIds(graph)).toThrow("Duplicate task IDs: a");
  });
});

describe("validateTaskTypes", () => {
  it("passes with valid types", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "1", type: "design" }),
        makeTask({ id: "2", type: "implement" }),
        makeTask({ id: "3", type: "test" }),
        makeTask({ id: "4", type: "debug" }),
        makeTask({ id: "5", type: "review" }),
        makeTask({ id: "6", type: "research" }),
      ],
    };
    expect(() => validateTaskTypes(graph)).not.toThrow();
  });

  it("throws on unknown type", () => {
    const graph: TaskGraph = {
      tasks: [makeTask({ id: "1", type: "deploy" as any })],
    };
    expect(() => validateTaskTypes(graph)).toThrow('Unknown task types: 1: "deploy"');
  });
});

describe("validateDependencies", () => {
  it("passes with valid deps", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ],
    };
    expect(() => validateDependencies(graph)).not.toThrow();
  });

  it("throws on missing dependency", () => {
    const graph: TaskGraph = {
      tasks: [makeTask({ id: "a", dependsOn: ["nonexistent"] })],
    };
    expect(() => validateDependencies(graph)).toThrow('depends on unknown task "nonexistent"');
  });

  it("throws on self-dependency", () => {
    const graph: TaskGraph = {
      tasks: [makeTask({ id: "a", dependsOn: ["a"] })],
    };
    expect(() => validateDependencies(graph)).toThrow("a depends on itself");
  });
});

describe("detectCycles", () => {
  it("passes with no cycles", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ],
    };
    expect(() => detectCycles(graph)).not.toThrow();
  });

  it("detects simple cycle", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a", dependsOn: ["b"] }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ],
    };
    expect(() => detectCycles(graph)).toThrow("Dependency cycle detected");
  });

  it("detects longer cycle", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a", dependsOn: ["c"] }),
        makeTask({ id: "b", dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ],
    };
    expect(() => detectCycles(graph)).toThrow("Dependency cycle detected");
  });

  it("passes diamond dependency (not a cycle)", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["a"] }),
        makeTask({ id: "d", dependsOn: ["b", "c"] }),
      ],
    };
    expect(() => detectCycles(graph)).not.toThrow();
  });
});

describe("validateGraph (aggregate)", () => {
  it("passes a valid graph", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a", type: "design" }),
        makeTask({ id: "b", type: "implement", dependsOn: ["a"] }),
      ],
    };
    expect(() => validateGraph(graph)).not.toThrow();
  });

  it("reports multiple errors", () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a", type: "bogus" as any }),
        makeTask({ id: "a", dependsOn: ["missing"] }),
      ],
    };
    try {
      validateGraph(graph);
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.message).toContain("Duplicate task IDs");
      expect(e.message).toContain("Unknown task types");
    }
  });
});
