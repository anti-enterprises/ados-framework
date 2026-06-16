import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalTask, CanonicalTaskType, Priority, TaskGraph } from "./types.js";
import { assertKnownSkillIds } from "./developer-skills.js";

export interface SpecKitParseOptions {
  feature?: string;
  sourcePath?: string;
}

export function parseSpecKitTasks(markdown: string, opts: SpecKitParseOptions = {}): TaskGraph {
  const tasks: CanonicalTask[] = [];
  const lines = markdown.split(/\r?\n/);
  let currentPhase = opts.feature ?? "speckit";
  let currentStory: string | undefined;
  let lastBarrierId: string | undefined;
  let previousTaskId: string | undefined;
  let parallelSinceBarrier: string[] = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const rawLine = lines[lineNumber];
    const heading = parseHeading(rawLine);
    if (heading) {
      currentPhase = heading.title;
      currentStory = heading.story;
      continue;
    }

    const parsed = parseTaskLine(rawLine);
    if (!parsed) continue;

    const type = inferTaskType(parsed.title);
    const files = extractFiles(parsed.title, type);
    const skillIds = inferSkillIds(parsed.title, type);
    assertKnownSkillIds(skillIds, `Spec Kit task ${parsed.id}`);

    const dependsOn = parsed.parallelizable
      ? lastBarrierId ? [lastBarrierId] : []
      : parallelSinceBarrier.length > 0 ? [...parallelSinceBarrier] : previousTaskId ? [previousTaskId] : [];

    const task: CanonicalTask = {
      id: parsed.id,
      phase: currentPhase,
      type,
      title: parsed.title,
      desc: parsed.title,
      dependsOn,
      acceptance: [],
      files,
      steps: [parsed.title],
      priority: inferPriority(parsed.title),
      parallelizable: parsed.parallelizable,
      source: opts.sourcePath ? `speckit:${opts.sourcePath}` : "speckit",
      story: parsed.story ?? currentStory,
      skillIds,
    };

    tasks.push(task);

    if (parsed.parallelizable) {
      parallelSinceBarrier.push(parsed.id);
    } else {
      lastBarrierId = parsed.id;
      parallelSinceBarrier = [];
    }
    previousTaskId = parsed.id;
  }

  if (tasks.length === 0) {
    throw new Error("No Spec Kit task rows found in tasks.md");
  }

  return { tasks };
}

export function resolveSpecKitTasksPath(input: string | undefined, cwd = process.cwd()): string {
  if (!input || input.trim() === "") {
    return join(cwd, "specs", "tasks.md");
  }

  const trimmed = input.trim();
  if (trimmed.endsWith("tasks.md")) {
    return join(cwd, trimmed);
  }

  const direct = join(cwd, trimmed, "tasks.md");
  if (existsSync(direct)) return direct;

  return join(cwd, "specs", trimmed, "tasks.md");
}

interface ParsedTaskLine {
  id: string;
  title: string;
  parallelizable: boolean;
  story?: string;
}

function parseTaskLine(line: string): ParsedTaskLine | undefined {
  const match = line.match(/^\s*-\s+\[[ xX]\]\s+(T[A-Za-z0-9_-]+)\s+(.+)$/);
  if (!match) return undefined;

  const [, id, rest] = match;
  const parallelizable = /\[P\]/i.test(rest);
  const story = rest.match(/\[(US[0-9]+)\]/i)?.[1].toUpperCase();
  const title = rest
    .replace(/\[P\]\s*/i, "")
    .replace(/\[US[0-9]+\]\s*/i, "")
    .trim();

  return { id, title, parallelizable, story };
}

function parseHeading(line: string): { title: string; story?: string } | undefined {
  const match = line.match(/^\s*#{2,4}\s+(.+?)\s*$/);
  if (!match) return undefined;

  const title = match[1].trim();
  const storyNumber = title.match(/User Story\s+([0-9]+)/i)?.[1];
  return {
    title,
    story: storyNumber ? `US${storyNumber}` : undefined,
  };
}

function inferTaskType(title: string): CanonicalTaskType {
  const lower = title.toLowerCase();

  if (/\b(review|audit|inspect)\b/.test(lower)) return "review";
  if (/\b(debug|fix|reproduce|root cause)\b/.test(lower)) return "debug";
  if (/\b(test|tests|spec|contract)\b/.test(lower)) return "test";
  if (/\b(research|investigate|compare)\b/.test(lower)) return "research";
  if (/\b(design|architecture|model|schema|plan)\b/.test(lower)) return "design";

  return "implement";
}

function inferPriority(title: string): Priority {
  const lower = title.toLowerCase();
  if (/\b(blocker|critical|must|required)\b/.test(lower)) return "high";
  if (/\b(optional|nice-to-have|follow-up)\b/.test(lower)) return "low";
  return "normal";
}

function inferSkillIds(title: string, type: CanonicalTaskType): string[] {
  const lower = title.toLowerCase();
  const skillIds = new Set<string>();

  if (type === "test") {
    skillIds.add("test-driven-development");
    skillIds.add("qa-only");
  }
  if (type === "debug") {
    skillIds.add("systematic-debugging");
  }
  if (type === "review") {
    skillIds.add("review");
  }
  if (type === "implement") {
    skillIds.add("test-driven-development");
    skillIds.add("verification-before-completion");
  }
  if (/\b(security|auth|permission|secret)\b/.test(lower)) {
    skillIds.add("security-review");
  }
  if (/\b(ui|frontend|react|next\.js|css|design)\b/.test(lower)) {
    skillIds.add("frontend-design");
  }
  if (/\b(browser|playwright|visual|screenshot|localhost)\b/.test(lower)) {
    skillIds.add("browse");
  }

  return Array.from(skillIds);
}

function extractFiles(title: string, type: CanonicalTaskType): { create: string[]; modify: string[] } {
  const files = Array.from(title.matchAll(/`([^`]+)`/g), (match) => match[1])
    .filter((file) => looksLikePath(file));
  const uniqueFiles = Array.from(new Set(files));
  const lower = title.toLowerCase();
  const isCreate = /\b(create|add|write|document|define|generate|scaffold)\b/.test(lower)
    && !/\b(implement|update|modify|refactor)\b/.test(lower);

  if (isCreate || type === "test") {
    return { create: uniqueFiles, modify: [] };
  }

  return { create: [], modify: uniqueFiles };
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || /\.[A-Za-z0-9]+$/.test(value);
}
