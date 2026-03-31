/**
 * Dual executor adapter: RuFlo MCP (primary) + Claude Code Task tool (fallback).
 *
 * Composes SPARC role prompts identically for both paths.
 * The framework-map is the single source of truth — the executor
 * choice is a runtime detail, not a prompt detail.
 */

import type { MappedTask, TaskResult } from "./types.js";
import { composeTaskPrompt } from "./framework-map.js";
import { writeJSON } from "./io.js";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecutorType = "ruflo" | "task-tool";

export interface ExecutorConfig {
  /** Preferred executor. Default: "ruflo". */
  preferred: ExecutorType;
  /** Whether to fall back to the other executor on failure. Default: true. */
  fallbackEnabled: boolean;
  /** RuFlo model selection. Default: "sonnet". */
  rufloModel: "haiku" | "sonnet" | "opus" | "inherit";
}

const DEFAULT_CONFIG: ExecutorConfig = {
  preferred: "ruflo",
  fallbackEnabled: true,
  rufloModel: "sonnet",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a single mapped task. Tries the preferred executor first,
 * falls back if enabled and the primary fails to spawn.
 */
export async function runTask(
  task: MappedTask,
  runDir: string,
  config: Partial<ExecutorConfig> = {},
): Promise<TaskResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const prompt = composeTaskPrompt(task);

  // Write the composed prompt to a file for auditing
  const promptPath = join(runDir, "results", `${task.id}.prompt.md`);
  writeJSON(promptPath.replace(".md", ".json"), {
    taskId: task.id,
    sparcRole: task.sparcRole,
    rufloAgent: task.rufloAgent,
    skills: task.skills,
    prompt,
  });

  const startedAt = new Date().toISOString();

  // Try preferred executor
  try {
    const result = await executeWith(cfg.preferred, task, prompt, runDir, cfg);
    return { ...result, startedAt, finishedAt: new Date().toISOString() };
  } catch (primaryError) {
    if (!cfg.fallbackEnabled) {
      return makeFailedResult(task, cfg.preferred, startedAt, primaryError);
    }

    // Fallback
    const fallback: ExecutorType = cfg.preferred === "ruflo" ? "task-tool" : "ruflo";
    try {
      const result = await executeWith(fallback, task, prompt, runDir, cfg);
      return { ...result, startedAt, finishedAt: new Date().toISOString() };
    } catch (fallbackError) {
      return makeFailedResult(task, fallback, startedAt, fallbackError);
    }
  }
}

// ---------------------------------------------------------------------------
// Executor dispatch
// ---------------------------------------------------------------------------

async function executeWith(
  executor: ExecutorType,
  task: MappedTask,
  prompt: string,
  runDir: string,
  config: ExecutorConfig,
): Promise<TaskResult> {
  switch (executor) {
    case "ruflo":
      return executeWithRuFlo(task, prompt, runDir, config);
    case "task-tool":
      return executeWithTaskTool(task, prompt, runDir);
    default:
      throw new Error(`Unknown executor: ${executor}`);
  }
}

// ---------------------------------------------------------------------------
// RuFlo MCP executor
// ---------------------------------------------------------------------------

/**
 * Execute via RuFlo MCP tools:
 * 1. mcp__ruflo__agent_spawn — spawn agent with SPARC role
 * 2. mcp__ruflo__task_create — create task and assign to agent
 * 3. Poll mcp__ruflo__task_status until completion or timeout
 *
 * NOTE: This function builds the MCP invocation descriptors.
 * In the actual Claude Code command, these become tool calls.
 * This module exports the invocation shape; the command template
 * orchestrates the actual MCP calls.
 */
async function executeWithRuFlo(
  task: MappedTask,
  prompt: string,
  runDir: string,
  config: ExecutorConfig,
): Promise<TaskResult> {
  // Build the RuFlo invocation descriptor
  const invocation = {
    agentSpawn: {
      tool: "mcp__ruflo__agent_spawn",
      params: {
        agentType: task.rufloAgent,
        task: prompt,
        model: config.rufloModel,
        agentId: `exec-${task.id}`,
        domain: task.phase,
      },
    },
    taskCreate: {
      tool: "mcp__ruflo__task_create",
      params: {
        type: mapToRufloTaskType(task.type),
        description: prompt,
        priority: task.priority,
        assignTo: [`exec-${task.id}`],
        tags: [task.sparcRole, task.phase, ...task.skills],
      },
    },
    timeout: task.timeoutSec,
    retries: task.retries,
  };

  // Write invocation descriptor for the command template to use
  const invocationPath = join(runDir, "results", `${task.id}.ruflo-invocation.json`);
  writeJSON(invocationPath, invocation);

  // Return a pending result — actual execution happens in the command template
  // which reads this descriptor and makes the MCP calls
  return {
    id: task.id,
    status: "success",
    agent: task.rufloAgent,
    executor: "ruflo",
    artifacts: [invocationPath],
    summary: `RuFlo invocation prepared for ${task.rufloAgent} agent`,
  };
}

// ---------------------------------------------------------------------------
// Claude Code Task tool executor
// ---------------------------------------------------------------------------

/**
 * Execute via Claude Code's Agent/Task tool.
 * Builds the agent invocation descriptor.
 */
async function executeWithTaskTool(
  task: MappedTask,
  prompt: string,
  runDir: string,
): Promise<TaskResult> {
  const invocation = {
    tool: "Agent",
    params: {
      description: `${task.sparcRole}: ${task.title}`,
      prompt,
      subagent_type: mapToSubagentType(task.rufloAgent),
      run_in_background: true,
      mode: "bypassPermissions",
    },
    timeout: task.timeoutSec,
    retries: task.retries,
  };

  const invocationPath = join(runDir, "results", `${task.id}.task-tool-invocation.json`);
  writeJSON(invocationPath, invocation);

  return {
    id: task.id,
    status: "success",
    agent: task.rufloAgent,
    executor: "task-tool",
    artifacts: [invocationPath],
    summary: `Task tool invocation prepared for ${task.rufloAgent} agent`,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapToRufloTaskType(canonical: string): string {
  const map: Record<string, string> = {
    design: "research",
    implement: "feature",
    test: "feature",
    debug: "bugfix",
    review: "refactor",
    research: "research",
  };
  return map[canonical] ?? "feature";
}

function mapToSubagentType(rufloAgent: string): string {
  // Map RuFlo agent types to Claude Code subagent types
  const map: Record<string, string> = {
    architect: "system-architect",
    coder: "coder",
    tester: "tester",
    debugger: "general-purpose",
    reviewer: "reviewer",
    researcher: "researcher",
  };
  return map[rufloAgent] ?? "general-purpose";
}

function makeFailedResult(
  task: MappedTask,
  executor: ExecutorType,
  startedAt: string,
  error: unknown,
): TaskResult {
  return {
    id: task.id,
    status: "failed",
    agent: task.rufloAgent,
    executor,
    startedAt,
    finishedAt: new Date().toISOString(),
    artifacts: [],
    error: error instanceof Error ? error.message : String(error),
  };
}
