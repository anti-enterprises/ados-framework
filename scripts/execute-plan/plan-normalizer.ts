/**
 * Plan normalizer: LLM prompt template for Markdown -> TaskGraph conversion,
 * plus runtime validation of the LLM's output.
 */

import {
  CANONICAL_TASK_TYPES,
  TYPE_ALIASES,
  type CanonicalTask,
  type CanonicalTaskType,
  type Priority,
  type TaskGraph,
} from "./types.js";

// ---------------------------------------------------------------------------
// Prompt template for LLM-mediated Markdown -> JSON conversion
// ---------------------------------------------------------------------------

export function getNormalizationPrompt(planMarkdown: string): string {
  return `You are a plan normalizer. Convert the Markdown implementation plan below into a JSON TaskGraph object.

## Output Schema

Return ONLY valid JSON matching this structure (no markdown fences, no commentary):

{
  "tasks": [
    {
      "id": "string — use provided ID, or generate as phase-<phaseIndex>-task-<taskIndex>",
      "phase": "string — phase name, default 'default'",
      "type": "design | implement | test | debug | review | research",
      "title": "string — short task title",
      "desc": "string — full description including steps",
      "dependsOn": ["taskId", ...],
      "acceptance": ["criterion", ...],
      "files": { "create": ["path", ...], "modify": ["path", ...] },
      "steps": ["step text", ...],
      "priority": "high | normal | low",
      "parallelizable": true | false
    }
  ]
}

## Normalization Rules

Type mapping (case-insensitive):
- design -> "design"
- implement, code, build -> "implement"
- test, qa, validate -> "test"
- debug, fix -> "debug"
- review -> "review"
- research, investigate -> "research"
- If the type cannot be determined from the task title/description, default to "implement"

ID generation:
- If a task has an explicit ID, use it
- Otherwise generate: "<phase>-<phaseIndex>-<taskIndex>" (0-indexed)

Dependencies:
- Tasks within a phase are sequential by default (each depends on the previous)
- Unless they are clearly independent (no shared files, no data flow)
- Cross-phase: first task of phase N+1 depends on last task of phase N

Defaults:
- phase: "default" if no phase structure
- priority: "normal"
- parallelizable: true if no dependencies within the same concurrency group
- acceptance: extract from text or leave as empty array
- files.create / files.modify: extract from **Files:** lines or leave empty

Steps:
- Extract from checkbox items (- [ ] ...) or numbered lists

## Plan to Convert

${planMarkdown}`;
}

// ---------------------------------------------------------------------------
// Runtime validation of LLM output
// ---------------------------------------------------------------------------

export function validateNormalizedOutput(json: unknown): TaskGraph {
  if (typeof json !== "object" || json === null) {
    throw new Error("Normalized output must be an object");
  }

  const obj = json as Record<string, unknown>;

  if (!Array.isArray(obj.tasks)) {
    throw new Error("Normalized output must have a 'tasks' array");
  }

  const tasks: CanonicalTask[] = [];

  for (let i = 0; i < obj.tasks.length; i++) {
    const raw = obj.tasks[i] as Record<string, unknown>;
    const label = `tasks[${i}]`;

    const id = requireString(raw, "id", label);
    const phase = optionalString(raw, "phase", "default");
    const title = requireString(raw, "title", label);
    const desc = requireString(raw, "desc", label);
    const type = normalizeType(optionalString(raw, "type", "implement"), label);

    tasks.push({
      id,
      phase,
      type,
      title,
      desc,
      dependsOn: optionalStringArray(raw, "dependsOn"),
      acceptance: optionalStringArray(raw, "acceptance"),
      files: normalizeFiles(raw.files),
      steps: optionalStringArray(raw, "steps"),
      priority: normalizePriority(optionalString(raw, "priority", "normal")),
      parallelizable: typeof raw.parallelizable === "boolean" ? raw.parallelizable : true,
    });
  }

  if (tasks.length === 0) {
    throw new Error("Task graph is empty — no tasks parsed from plan");
  }

  return { tasks };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireString(obj: Record<string, unknown>, key: string, label: string): string {
  const val = obj[key];
  if (typeof val !== "string" || val.trim() === "") {
    throw new Error(`${label}.${key} must be a non-empty string, got ${JSON.stringify(val)}`);
  }
  return val.trim();
}

function optionalString(obj: Record<string, unknown>, key: string, fallback: string): string {
  const val = obj[key];
  if (typeof val === "string" && val.trim() !== "") return val.trim();
  return fallback;
}

function optionalStringArray(obj: Record<string, unknown>, key: string): string[] {
  const val = obj[key];
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string").map((s) => s.trim());
}

function normalizeType(raw: string, label: string): CanonicalTaskType {
  const lower = raw.toLowerCase().trim();
  const mapped = TYPE_ALIASES[lower];
  if (mapped) return mapped;

  if (CANONICAL_TASK_TYPES.includes(lower as CanonicalTaskType)) {
    return lower as CanonicalTaskType;
  }

  throw new Error(
    `${label}: unknown task type "${raw}". ` +
      `Valid types: ${Object.keys(TYPE_ALIASES).join(", ")}`,
  );
}

function normalizePriority(raw: string): Priority {
  const lower = raw.toLowerCase().trim();
  if (lower === "high" || lower === "normal" || lower === "low") return lower;
  return "normal";
}

function normalizeFiles(raw: unknown): { create: string[]; modify: string[] } {
  if (typeof raw !== "object" || raw === null) {
    return { create: [], modify: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    create: optionalStringArray(obj, "create"),
    modify: optionalStringArray(obj, "modify"),
  };
}
