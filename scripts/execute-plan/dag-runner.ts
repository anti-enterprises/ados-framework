/**
 * Thin DAG scheduler.
 *
 * Executes tasks level-by-level with configurable parallelism.
 * Does NOT become a second orchestration framework — just schedules
 * ready tasks, collects results, and propagates blocked status.
 */

import type { ExecutionGraph, MappedTask, TaskResult, TaskStatus } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunOptions {
  maxParallel: number;
  dryRun: boolean;
  resumeResults?: TaskResult[];
}

export type TaskExecutor = (task: MappedTask, runDir: string) => Promise<TaskResult>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runDAG(
  graph: ExecutionGraph,
  executor: TaskExecutor,
  runDir: string,
  opts: RunOptions,
): Promise<TaskResult[]> {
  const allResults: TaskResult[] = [];
  const statusMap = new Map<string, TaskStatus>();

  // Initialize all tasks as pending
  for (const task of graph.tasks) {
    statusMap.set(task.id, "pending");
  }

  // Apply resume state: mark already-succeeded tasks
  if (opts.resumeResults) {
    for (const prev of opts.resumeResults) {
      if (prev.status === "success") {
        statusMap.set(prev.id, "success");
        allResults.push(prev);
      }
    }
  }

  // Process level by level
  for (const [levelIndex, level] of graph.levels.entries()) {
    const tasksToRun = level.filter((t) => statusMap.get(t.id) === "pending");

    if (tasksToRun.length === 0) continue;

    // Check for blocked tasks (any dependency failed or blocked)
    const { ready, blocked } = partitionByBlockedStatus(tasksToRun, statusMap);

    // Mark blocked tasks
    for (const task of blocked) {
      const failedDep = task.dependsOn.find((d) => {
        const s = statusMap.get(d);
        return s === "failed" || s === "blocked";
      });
      statusMap.set(task.id, "blocked");
      allResults.push({
        id: task.id,
        status: "blocked",
        agent: task.rufloAgent,
        executor: "ruflo",
        artifacts: [],
        error: `Blocked by failed dependency: ${failedDep}`,
      });
    }

    if (ready.length === 0) continue;

    if (opts.dryRun) {
      // In dry-run mode, mark all as "skipped" with informational result
      for (const task of ready) {
        statusMap.set(task.id, "skipped");
        allResults.push({
          id: task.id,
          status: "skipped",
          agent: task.rufloAgent,
          executor: "ruflo",
          artifacts: [],
          summary: `[dry-run] Would execute with ${task.rufloAgent} (${task.sparcRole})`,
        });
      }
      continue;
    }

    // Execute ready tasks in batches of maxParallel
    const batches = chunk(ready, opts.maxParallel);

    for (const batch of batches) {
      // Mark as running
      for (const task of batch) {
        statusMap.set(task.id, "running");
      }

      // Execute batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map((task) => executeWithTimeout(executor, task, runDir, task.timeoutSec)),
      );

      // Collect results
      for (let i = 0; i < batch.length; i++) {
        const task = batch[i];
        const settled = batchResults[i];

        let result: TaskResult;
        if (settled.status === "fulfilled") {
          result = settled.value;
        } else {
          result = {
            id: task.id,
            status: "failed",
            agent: task.rufloAgent,
            executor: "ruflo",
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            artifacts: [],
            error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
          };
        }

        // Handle retries
        if (result.status === "failed" && task.retries > 0) {
          const retryTask = { ...task, retries: task.retries - 1 };
          try {
            result = await executeWithTimeout(executor, retryTask, runDir, task.timeoutSec);
          } catch (retryErr) {
            result = {
              id: task.id,
              status: "failed",
              agent: task.rufloAgent,
              executor: "ruflo",
              startedAt: result.startedAt,
              finishedAt: new Date().toISOString(),
              artifacts: [],
              error: `Retry failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
            };
          }
        }

        statusMap.set(task.id, result.status);
        allResults.push(result);
      }
    }
  }

  // Propagate blocked status to any remaining pending tasks
  for (const task of graph.tasks) {
    if (statusMap.get(task.id) === "pending") {
      const failedDep = task.dependsOn.find((d) => {
        const s = statusMap.get(d);
        return s === "failed" || s === "blocked";
      });
      if (failedDep) {
        statusMap.set(task.id, "blocked");
        allResults.push({
          id: task.id,
          status: "blocked",
          agent: "none",
          executor: "ruflo",
          artifacts: [],
          error: `Blocked by failed dependency: ${failedDep}`,
        });
      }
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function partitionByBlockedStatus(
  tasks: MappedTask[],
  statusMap: Map<string, TaskStatus>,
): { ready: MappedTask[]; blocked: MappedTask[] } {
  const ready: MappedTask[] = [];
  const blocked: MappedTask[] = [];

  for (const task of tasks) {
    const hasFailedDep = task.dependsOn.some((d) => {
      const s = statusMap.get(d);
      return s === "failed" || s === "blocked";
    });

    const allDepsSatisfied = task.dependsOn.every((d) => {
      const s = statusMap.get(d);
      return s === "success" || s === "skipped" || !statusMap.has(d);
    });

    if (hasFailedDep) {
      blocked.push(task);
    } else if (allDepsSatisfied) {
      ready.push(task);
    }
    // If deps are still running/pending, they'll be picked up in a future level
  }

  return { ready, blocked };
}

async function executeWithTimeout(
  executor: TaskExecutor,
  task: MappedTask,
  runDir: string,
  timeoutSec: number,
): Promise<TaskResult> {
  const timeoutMs = timeoutSec * 1000;

  return new Promise<TaskResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Task ${task.id} timed out after ${timeoutSec}s`));
    }, timeoutMs);

    executor(task, runDir)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
