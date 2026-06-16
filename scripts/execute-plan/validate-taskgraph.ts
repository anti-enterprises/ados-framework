/**
 * TaskGraph validator.
 *
 * Pure functions that check the normalized graph for structural errors
 * before execution: unique IDs, valid dependencies, no cycles, valid types.
 */

import { CANONICAL_TASK_TYPES, type TaskGraph } from "./types.js";
import { assertKnownSkillIds } from "./developer-skills.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run all validations. Throws with aggregated error messages. */
export function validateGraph(graph: TaskGraph): void {
  const errors: string[] = [];

  try { validateNonEmpty(graph); } catch (e) { errors.push(msg(e)); }
  try { validateUniqueIds(graph); } catch (e) { errors.push(msg(e)); }
  try { validateTaskTypes(graph); } catch (e) { errors.push(msg(e)); }
  try { validateSkillIds(graph); } catch (e) { errors.push(msg(e)); }
  try { validateDependencies(graph); } catch (e) { errors.push(msg(e)); }
  try { detectCycles(graph); } catch (e) { errors.push(msg(e)); }

  if (errors.length > 0) {
    throw new Error(`TaskGraph validation failed:\n  - ${errors.join("\n  - ")}`);
  }
}

// ---------------------------------------------------------------------------
// Individual validators (exported for testing)
// ---------------------------------------------------------------------------

export function validateNonEmpty(graph: TaskGraph): void {
  if (graph.tasks.length === 0) {
    throw new Error("Empty task graph — nothing to execute");
  }
}

export function validateUniqueIds(graph: TaskGraph): void {
  const seen = new Set<string>();
  const dupes: string[] = [];

  for (const task of graph.tasks) {
    if (seen.has(task.id)) {
      dupes.push(task.id);
    }
    seen.add(task.id);
  }

  if (dupes.length > 0) {
    throw new Error(`Duplicate task IDs: ${dupes.join(", ")}`);
  }
}

export function validateTaskTypes(graph: TaskGraph): void {
  const invalid: string[] = [];

  for (const task of graph.tasks) {
    if (!CANONICAL_TASK_TYPES.includes(task.type)) {
      invalid.push(`${task.id}: "${task.type}"`);
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Unknown task types: ${invalid.join("; ")}`);
  }
}

export function validateSkillIds(graph: TaskGraph): void {
  for (const task of graph.tasks) {
    if (task.skillIds && task.skillIds.length > 0) {
      assertKnownSkillIds(task.skillIds, `task "${task.id}"`);
    }
  }
}

export function validateDependencies(graph: TaskGraph): void {
  const ids = new Set(graph.tasks.map((t) => t.id));
  const errors: string[] = [];

  for (const task of graph.tasks) {
    for (const dep of task.dependsOn) {
      if (dep === task.id) {
        errors.push(`${task.id} depends on itself`);
      } else if (!ids.has(dep)) {
        errors.push(`${task.id} depends on unknown task "${dep}"`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Dependency errors: ${errors.join("; ")}`);
  }
}

/**
 * Detect cycles using Kahn's algorithm (topological sort).
 * If the sort doesn't consume all nodes, there's a cycle.
 */
export function detectCycles(graph: TaskGraph): void {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const task of graph.tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  for (const task of graph.tasks) {
    for (const dep of task.dependsOn) {
      // dep -> task (dep must finish before task)
      const neighbors = adjacency.get(dep);
      if (neighbors) neighbors.push(task.id);
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    visited++;
    for (const neighbor of adjacency.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (visited < graph.tasks.length) {
    const cycleNodes = graph.tasks
      .filter((t) => (inDegree.get(t.id) ?? 0) > 0)
      .map((t) => t.id);
    throw new Error(`Dependency cycle detected involving: ${cycleNodes.join(", ")}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
