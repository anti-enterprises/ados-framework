import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");

describe("bin/setup", () => {
  it("documents the Claude/Codex agent install selector", () => {
    const result = spawnSync("bash", ["bin/setup", "--help"], {
      cwd: packageRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--agents=claude|codex|both");
  });
});
