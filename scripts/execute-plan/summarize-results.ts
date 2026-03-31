/**
 * Results summarizer.
 *
 * Produces execution.results.json and execution.summary.md
 * from an array of TaskResult objects.
 */

import type { TaskResult, RunSummary } from "./types.js";
import { writeJSON, writeText } from "./io.js";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function summarizeResults(
  results: TaskResult[],
  runId: string,
  runDir: string,
): RunSummary {
  const summary: RunSummary = {
    runId,
    total: results.length,
    success: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "failed").length,
    blocked: results.filter((r) => r.status === "blocked").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    resultsPath: runDir,
  };

  // Write JSON results
  writeJSON(join(runDir, "execution.results.json"), results);

  // Write Markdown summary
  const md = buildMarkdownSummary(results, summary);
  writeText(join(runDir, "execution.summary.md"), md);

  return summary;
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function buildMarkdownSummary(results: TaskResult[], summary: RunSummary): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Execution Summary`);
  lines.push("");
  lines.push(`**Run ID:** ${summary.runId}`);
  lines.push(`**Timestamp:** ${new Date().toISOString()}`);
  lines.push(`**Results:** ${summary.resultsPath}`);
  lines.push("");

  // Totals
  lines.push("## Results");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total | ${summary.total} |`);
  lines.push(`| Success | ${summary.success} |`);
  lines.push(`| Failed | ${summary.failed} |`);
  lines.push(`| Blocked | ${summary.blocked} |`);
  lines.push(`| Skipped | ${summary.skipped} |`);
  lines.push("");

  // Task table
  lines.push("## Tasks");
  lines.push("");
  lines.push("| ID | Status | Agent | Executor | Summary |");
  lines.push("|---|---|---|---|---|");

  for (const r of results) {
    const statusIcon = STATUS_ICONS[r.status] ?? "?";
    const summaryText = r.error
      ? truncate(r.error, 60)
      : r.summary
        ? truncate(r.summary, 60)
        : "-";
    lines.push(
      `| ${r.id} | ${statusIcon} ${r.status} | ${r.agent} | ${r.executor} | ${summaryText} |`,
    );
  }
  lines.push("");

  // Failed tasks detail
  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    lines.push("## Failed Tasks");
    lines.push("");
    for (const r of failed) {
      lines.push(`### ${r.id}`);
      lines.push(`- **Agent:** ${r.agent}`);
      lines.push(`- **Executor:** ${r.executor}`);
      if (r.startedAt) lines.push(`- **Started:** ${r.startedAt}`);
      if (r.finishedAt) lines.push(`- **Finished:** ${r.finishedAt}`);
      if (r.error) lines.push(`- **Error:** ${r.error}`);
      lines.push("");
    }
  }

  // Blocked tasks
  const blocked = results.filter((r) => r.status === "blocked");
  if (blocked.length > 0) {
    lines.push("## Blocked Tasks");
    lines.push("");
    for (const r of blocked) {
      lines.push(`- **${r.id}**: ${r.error ?? "blocked by failed dependency"}`);
    }
    lines.push("");
  }

  // Next actions
  lines.push("## Next Actions");
  lines.push("");

  if (summary.failed > 0) {
    const failedIds = failed.map((r) => r.id).join(", ");
    lines.push(`- Fix failing tasks: ${failedIds}`);
    lines.push(`- Re-run with: \`/execute-plan --resume\``);
  }

  if (summary.blocked > 0) {
    lines.push(`- ${summary.blocked} tasks were blocked — they will run after dependencies are fixed`);
  }

  if (summary.failed === 0 && summary.blocked === 0) {
    lines.push("- All tasks completed successfully");
    if (summary.skipped > 0) {
      lines.push(`- ${summary.skipped} tasks were skipped (dry-run mode)`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_ICONS: Record<string, string> = {
  success: "[OK]",
  failed: "[FAIL]",
  blocked: "[BLOCKED]",
  skipped: "[SKIP]",
  running: "[RUN]",
  pending: "[PEND]",
  ready: "[READY]",
};

function truncate(s: string, max: number): string {
  const clean = s.replace(/\n/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 3) + "...";
}
