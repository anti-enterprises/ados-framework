/**
 * Build execution graph from validated TaskGraph.
 *
 * Applies framework-map to each task and computes concurrency levels
 * via topological sort (Kahn's algorithm).
 */

import type { TaskGraph, ExecutionGraph, MappedTask } from "./types.js";
import { applyMapping } from "./framework-map.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuildOptions {
  /** Only include tasks in this phase. */
  phase?: string;
  /** Max tasks per concurrency level (hint for display; actual limit is in dag-runner). */
  maxParallel?: number;
}

export function buildExecutionGraph(
  graph: TaskGraph,
  opts: BuildOptions = {},
): ExecutionGraph {
  let tasks = graph.tasks;

  // Phase filter
  if (opts.phase) {
    tasks = tasks.filter((t) => t.phase === opts.phase);
    if (tasks.length === 0) {
      throw new Error(`No tasks found in phase "${opts.phase}"`);
    }
  }

  // Compute concurrency levels via topological sort
  const levels = computeLevels(tasks);

  // Apply framework mappings with level info
  const mappedTasks: MappedTask[] = [];
  for (const [levelIndex, levelTasks] of levels.entries()) {
    for (const task of levelTasks) {
      mappedTasks.push(applyMapping(task, levelIndex));
    }
  }

  const mappedLevels: MappedTask[][] = levels.map((levelTasks, levelIndex) =>
    levelTasks.map((task) => applyMapping(task, levelIndex)),
  );

  return { tasks: mappedTasks, levels: mappedLevels };
}

// ---------------------------------------------------------------------------
// Topological sort into concurrency levels
// ---------------------------------------------------------------------------

import type { CanonicalTask } from "./types.js";

function computeLevels(tasks: CanonicalTask[]): CanonicalTask[][] {
  const taskMap = new Map<string, CanonicalTask>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // In-degree: number of dependencies within the filtered set
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    dependents.set(task.id, []);
  }

  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      // Only count deps that exist in the current task set (phase filter may exclude some)
      if (taskMap.has(dep)) {
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
        dependents.get(dep)!.push(task.id);
      }
    }
  }

  const levels: CanonicalTask[][] = [];
  const remaining = new Set(tasks.map((t) => t.id));

  while (remaining.size > 0) {
    // Collect all tasks with in-degree 0
    const ready: CanonicalTask[] = [];
    for (const id of remaining) {
      if ((inDegree.get(id) ?? 0) === 0) {
        ready.push(taskMap.get(id)!);
      }
    }

    if (ready.length === 0) {
      // Shouldn't happen if validate-taskgraph ran first, but guard anyway
      const stuck = Array.from(remaining).join(", ");
      throw new Error(`Deadlock computing concurrency levels. Stuck tasks: ${stuck}`);
    }

    levels.push(ready);

    // Remove ready tasks and decrement dependents' in-degrees
    for (const task of ready) {
      remaining.delete(task.id);
      for (const dep of dependents.get(task.id) ?? []) {
        inDegree.set(dep, (inDegree.get(dep) ?? 1) - 1);
      }
    }
  }

  return levels;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function formatExecutionPlan(graph: ExecutionGraph): string {
  const lines: string[] = [
    `Execution Plan: ${graph.tasks.length} tasks across ${graph.levels.length} levels`,
    "",
  ];

  for (const [i, level] of graph.levels.entries()) {
    lines.push(`Level ${i} (${level.length} tasks, parallel):`);
    for (const task of level) {
      const deps = task.dependsOn.length > 0 ? ` [after: ${task.dependsOn.join(", ")}]` : "";
      lines.push(
        `  ${task.id}: ${task.title} — ${task.sparcRole}/${task.rufloAgent}${deps}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
