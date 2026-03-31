/**
 * Shared I/O utilities for the execute-plan pipeline.
 *
 * Run directory management, JSON read/write, ID generation.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Run ID
// ---------------------------------------------------------------------------

export function generateRunId(): string {
  return randomBytes(4).toString("hex");
}

// ---------------------------------------------------------------------------
// Run directory
// ---------------------------------------------------------------------------

const RUNS_ROOT = ".claude/runs";

export function createRunDir(baseDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = generateRunId();
  const dirName = `${timestamp}-${runId}`;
  const runDir = join(baseDir, RUNS_ROOT, dirName);

  mkdirSync(join(runDir, "results"), { recursive: true });
  return runDir;
}

// ---------------------------------------------------------------------------
// JSON I/O
// ---------------------------------------------------------------------------

export function readJSON<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function writeJSON(filePath: string, data: unknown): void {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Text I/O
// ---------------------------------------------------------------------------

export function writeText(filePath: string, content: string): void {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, content, "utf-8");
}

export function readText(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}
