/**
 * Framework mapping registry.
 *
 * The single control point for cross-integration between gstack (planning),
 * SPARC (roles), RuFlo (execution), and Claude Code skills.
 *
 * Each canonical task type maps to exactly one execution profile:
 * - SPARC role label + prompt template
 * - RuFlo agent type
 * - Claude Code skills to attach
 * - Validator skill for post-task verification
 * - Timeout and retry policy
 */

import type { CanonicalTaskType, FrameworkMapEntry, CanonicalTask, MappedTask } from "./types.js";
import { assertKnownSkillIds } from "./developer-skills.js";

// ---------------------------------------------------------------------------
// The Map
// ---------------------------------------------------------------------------

export const FRAMEWORK_MAP: Record<CanonicalTaskType, FrameworkMapEntry> = {
  design: {
    sparcRole: "architect",
    rufloAgent: "architect",
    skills: ["writing-plans", "plan-eng-review", "careful"],
    validator: "design-review",
    timeoutSec: 900,
    retries: 0,
    promptTemplate: [
      "You are a SPARC Architect.",
      "Design systems, define interfaces, and plan structure.",
      "Produce specifications — do not write implementation code.",
      "Output: interface definitions, data flow diagrams, file structure.",
    ].join(" "),
  },

  implement: {
    sparcRole: "coder",
    rufloAgent: "coder",
    skills: ["test-driven-development", "verification-before-completion", "careful"],
    validator: "qa",
    timeoutSec: 1800,
    retries: 1,
    promptTemplate: [
      "You are a SPARC Coder.",
      "Write clean, tested, production-quality code.",
      "Follow TDD: write a failing test first, then the minimal implementation to pass it.",
      "Verify your work compiles and tests pass before reporting completion.",
    ].join(" "),
  },

  test: {
    sparcRole: "reviewer",
    rufloAgent: "tester",
    skills: ["qa-only", "verification-before-completion"],
    validator: "qa",
    timeoutSec: 1200,
    retries: 0,
    promptTemplate: [
      "You are a SPARC Tester.",
      "Write comprehensive tests covering happy paths, edge cases, and error conditions.",
      "Verify acceptance criteria are met. Report coverage gaps.",
    ].join(" "),
  },

  debug: {
    sparcRole: "debugger",
    rufloAgent: "debugger",
    skills: ["systematic-debugging", "investigate", "careful"],
    validator: "verification-before-completion",
    timeoutSec: 1800,
    retries: 1,
    promptTemplate: [
      "You are a SPARC Debugger.",
      "Investigate systematically: reproduce, isolate, identify root cause, then fix.",
      "No fixes without evidence of the root cause.",
    ].join(" "),
  },

  review: {
    sparcRole: "reviewer",
    rufloAgent: "reviewer",
    skills: ["review", "requesting-code-review", "security-review", "careful"],
    validator: "qa",
    timeoutSec: 900,
    retries: 0,
    promptTemplate: [
      "You are a SPARC Reviewer.",
      "Audit code for correctness, security vulnerabilities, and maintainability.",
      "Flag issues with specific file paths and line numbers.",
    ].join(" "),
  },

  research: {
    sparcRole: "architect",
    rufloAgent: "researcher",
    skills: ["investigate", "context7", "graphify"],
    timeoutSec: 900,
    retries: 0,
    promptTemplate: [
      "You are a SPARC Researcher.",
      "Gather information, analyze existing patterns, and synthesize findings.",
      "Output: structured summary with recommendations and trade-offs.",
    ].join(" "),
  },
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export function getMapping(taskType: CanonicalTaskType): FrameworkMapEntry {
  const entry = FRAMEWORK_MAP[taskType];
  if (!entry) {
    throw new Error(
      `No framework mapping for task type "${taskType}". ` +
        `Valid types: ${Object.keys(FRAMEWORK_MAP).join(", ")}`,
    );
  }
  return entry;
}

export function validateFrameworkMapSkills(
  map: Record<CanonicalTaskType, FrameworkMapEntry> = FRAMEWORK_MAP,
): void {
  for (const [taskType, entry] of Object.entries(map)) {
    const skillIds = entry.validator ? [...entry.skills, entry.validator] : entry.skills;
    assertKnownSkillIds(skillIds, `framework map "${taskType}"`);
  }
}

// ---------------------------------------------------------------------------
// Apply mapping to a task
// ---------------------------------------------------------------------------

export function applyMapping(task: CanonicalTask, level: number): MappedTask {
  const entry = getMapping(task.type);
  const skills = mergeSkillIds(entry.skills, task.skillIds ?? []);
  assertKnownSkillIds(skills, `task "${task.id}"`);

  return {
    ...task,
    sparcRole: entry.sparcRole,
    rufloAgent: entry.rufloAgent,
    skills,
    validator: entry.validator,
    timeoutSec: entry.timeoutSec,
    retries: entry.retries,
    promptTemplate: entry.promptTemplate,
    concurrencyLevel: level,
  };
}

// ---------------------------------------------------------------------------
// Compose the full execution prompt for a task
// ---------------------------------------------------------------------------

export function composeTaskPrompt(task: MappedTask): string {
  const sections: string[] = [
    `## Role\n${task.promptTemplate}`,
    `## Task\n**${task.title}**\n${task.desc}`,
  ];

  const provenance: string[] = [];
  if (task.source) provenance.push(`Source: ${task.source}`);
  if (task.story) provenance.push(`Story: ${task.story}`);
  if (provenance.length > 0) {
    sections.push(`## Provenance\n${provenance.join("\n")}`);
  }

  if (task.files.create.length > 0 || task.files.modify.length > 0) {
    const fileLines: string[] = [];
    if (task.files.create.length > 0) {
      fileLines.push(`Create: ${task.files.create.join(", ")}`);
    }
    if (task.files.modify.length > 0) {
      fileLines.push(`Modify: ${task.files.modify.join(", ")}`);
    }
    sections.push(`## Files\n${fileLines.join("\n")}`);
  }

  if (task.steps.length > 0) {
    sections.push(`## Steps\n${task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  }

  if (task.acceptance.length > 0) {
    sections.push(
      `## Acceptance Criteria\n${task.acceptance.map((a) => `- ${a}`).join("\n")}`,
    );
  }

  if (task.skills.length > 0) {
    sections.push(
      `## Skills to Use\nInvoke these skills during execution: ${task.skills.join(", ")}`,
    );
  }

  return sections.join("\n\n");
}

function mergeSkillIds(defaultSkills: readonly string[], explicitSkills: readonly string[]): string[] {
  return Array.from(new Set([...defaultSkills, ...explicitSkills]));
}
