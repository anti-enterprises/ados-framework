import { describe, it, expect } from "vitest";
import { runDAG } from "../../scripts/execute-plan/dag-runner.js";
import { buildExecutionGraph } from "../../scripts/execute-plan/build-execution-graph.js";
import type { TaskGraph, CanonicalTask, MappedTask, TaskResult } from "../../scripts/execute-plan/types.js";

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

// Simple executor that always succeeds
function successExecutor(): (task: MappedTask, runDir: string) => Promise<TaskResult> {
  const order: string[] = [];
  const executor = async (task: MappedTask, _runDir: string): Promise<TaskResult> => {
    order.push(task.id);
    return {
      id: task.id,
      status: "success",
      agent: task.rufloAgent,
      executor: "task-tool",
      artifacts: [],
      summary: `Completed ${task.id}`,
    };
  };
  (executor as any).order = order;
  return executor;
}

// Executor that fails on specific task IDs
function failingExecutor(failIds: string[]): (task: MappedTask, runDir: string) => Promise<TaskResult> {
  return async (task: MappedTask, _runDir: string): Promise<TaskResult> => {
    if (failIds.includes(task.id)) {
      return {
        id: task.id,
        status: "failed",
        agent: task.rufloAgent,
        executor: "task-tool",
        artifacts: [],
        error: `Task ${task.id} failed`,
      };
    }
    return {
      id: task.id,
      status: "success",
      agent: task.rufloAgent,
      executor: "task-tool",
      artifacts: [],
    };
  };
}

describe("runDAG", () => {
  it("executes independent tasks in parallel", async () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b" }),
        makeTask({ id: "c" }),
      ],
    };
    const exec = buildExecutionGraph(graph);
    const executor = successExecutor();

    const results = await runDAG(exec, executor, "/tmp/test-run", {
      maxParallel: 10,
      dryRun: false,
    });

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === "success")).toBe(true);
  });

  it("respects dependency ordering", async () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ],
    };
    const exec = buildExecutionGraph(graph);
    const executor = successExecutor();

    const results = await runDAG(exec, executor, "/tmp/test-run", {
      maxParallel: 10,
      dryRun: false,
    });

    const order = (executor as any).order;
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
  });

  it("blocks children when parent fails", async () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ],
    };
    const exec = buildExecutionGraph(graph);

    const results = await runDAG(exec, failingExecutor(["a"]), "/tmp/test-run", {
      maxParallel: 10,
      dryRun: false,
    });

    const statusMap = new Map(results.map((r) => [r.id, r.status]));
    expect(statusMap.get("a")).toBe("failed");
    expect(statusMap.get("b")).toBe("blocked");
    expect(statusMap.get("c")).toBe("blocked");
  });

  it("continues unrelated branches after failure", async () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b" }),
        makeTask({ id: "c", dependsOn: ["a"] }),
        makeTask({ id: "d", dependsOn: ["b"] }),
      ],
    };
    const exec = buildExecutionGraph(graph);

    const results = await runDAG(exec, failingExecutor(["a"]), "/tmp/test-run", {
      maxParallel: 10,
      dryRun: false,
    });

    const statusMap = new Map(results.map((r) => [r.id, r.status]));
    expect(statusMap.get("a")).toBe("failed");
    expect(statusMap.get("b")).toBe("success");
    expect(statusMap.get("c")).toBe("blocked");
    expect(statusMap.get("d")).toBe("success");
  });

  it("respects maxParallel", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const trackingExecutor = async (task: MappedTask): Promise<TaskResult> => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return {
        id: task.id,
        status: "success",
        agent: task.rufloAgent,
        executor: "task-tool",
        artifacts: [],
      };
    };

    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b" }),
        makeTask({ id: "c" }),
        makeTask({ id: "d" }),
      ],
    };
    const exec = buildExecutionGraph(graph);

    await runDAG(exec, trackingExecutor, "/tmp/test-run", {
      maxParallel: 2,
      dryRun: false,
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("dry-run marks all tasks as skipped", async () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ],
    };
    const exec = buildExecutionGraph(graph);
    const executor = successExecutor();

    const results = await runDAG(exec, executor, "/tmp/test-run", {
      maxParallel: 10,
      dryRun: true,
    });

    expect(results.every((r) => r.status === "skipped")).toBe(true);
    expect((executor as any).order).toHaveLength(0); // executor was never called
  });

  it("resume skips already-succeeded tasks", async () => {
    const graph: TaskGraph = {
      tasks: [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ],
    };
    const exec = buildExecutionGraph(graph);
    const executor = successExecutor();

    const previousResults: TaskResult[] = [
      { id: "a", status: "success", agent: "coder", executor: "ruflo", artifacts: [] },
    ];

    const results = await runDAG(exec, executor, "/tmp/test-run", {
      maxParallel: 10,
      dryRun: false,
      resumeResults: previousResults,
    });

    // "a" should be in results (from resume) but executor should NOT have run it
    const order = (executor as any).order;
    expect(order).not.toContain("a");
    expect(order).toContain("b");
    expect(order).toContain("c");

    const statusMap = new Map(results.map((r) => [r.id, r.status]));
    expect(statusMap.get("a")).toBe("success");
    expect(statusMap.get("b")).toBe("success");
    expect(statusMap.get("c")).toBe("success");
  });
});
