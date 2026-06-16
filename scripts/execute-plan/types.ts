/**
 * Cross-framework execution pipeline types.
 *
 * Canonical interfaces bridging gstack (planning), SPARC (roles),
 * RuFlo (execution), and Claude Code skills/hooks.
 */

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

export type CanonicalTaskType =
  | "design"
  | "implement"
  | "test"
  | "debug"
  | "review"
  | "research";

export const CANONICAL_TASK_TYPES: readonly CanonicalTaskType[] = [
  "design",
  "implement",
  "test",
  "debug",
  "review",
  "research",
] as const;

export type SparcRole = "architect" | "coder" | "debugger" | "reviewer";

export type TaskStatus =
  | "pending"
  | "ready"
  | "running"
  | "success"
  | "failed"
  | "blocked"
  | "skipped";

export type Priority = "high" | "normal" | "low";

// ---------------------------------------------------------------------------
// Plan Input (raw gstack Markdown, pre-normalization)
// ---------------------------------------------------------------------------

export interface GstackTaskInput {
  id?: string;
  type?: string;
  title?: string;
  desc?: string;
  depends_on?: string[];
  phase?: string;
  acceptance?: string[];
}

export interface GstackPhaseInput {
  name?: string;
  tasks?: GstackTaskInput[];
}

export interface GstackPlanInput {
  phases?: GstackPhaseInput[];
}

// ---------------------------------------------------------------------------
// Canonical Task Graph (internal source of truth)
// ---------------------------------------------------------------------------

export interface CanonicalTask {
  id: string;
  phase: string;
  type: CanonicalTaskType;
  title: string;
  desc: string;
  dependsOn: string[];
  acceptance: string[];
  files: {
    create: string[];
    modify: string[];
  };
  steps: string[];
  priority: Priority;
  parallelizable: boolean;
  source?: string;
  story?: string;
  skillIds?: string[];
}

export interface TaskGraph {
  tasks: CanonicalTask[];
}

// ---------------------------------------------------------------------------
// Framework Mapping
// ---------------------------------------------------------------------------

export interface FrameworkMapEntry {
  sparcRole: SparcRole;
  rufloAgent: string;
  skills: string[];
  validator?: string;
  timeoutSec: number;
  retries: number;
  promptTemplate: string;
}

// ---------------------------------------------------------------------------
// Execution Graph (TaskGraph + resolved mappings + concurrency levels)
// ---------------------------------------------------------------------------

export interface MappedTask extends CanonicalTask {
  sparcRole: SparcRole;
  rufloAgent: string;
  skills: string[];
  validator?: string;
  timeoutSec: number;
  retries: number;
  promptTemplate: string;
  concurrencyLevel: number;
}

export interface ExecutionGraph {
  tasks: MappedTask[];
  levels: MappedTask[][];
}

// ---------------------------------------------------------------------------
// Execution Results
// ---------------------------------------------------------------------------

export interface TaskResult {
  id: string;
  status: TaskStatus;
  agent: string;
  executor: "ruflo" | "task-tool";
  startedAt?: string;
  finishedAt?: string;
  artifacts: string[];
  summary?: string;
  error?: string;
}

export interface RunSummary {
  runId: string;
  total: number;
  success: number;
  failed: number;
  blocked: number;
  skipped: number;
  resultsPath: string;
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Map raw task-type strings to canonical types. */
export const TYPE_ALIASES: Record<string, CanonicalTaskType> = {
  design: "design",
  implement: "implement",
  code: "implement",
  build: "implement",
  test: "test",
  qa: "test",
  validate: "test",
  debug: "debug",
  fix: "debug",
  review: "review",
  research: "research",
  investigate: "research",
};
