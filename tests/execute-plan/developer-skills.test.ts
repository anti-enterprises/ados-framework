import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEVELOPER_SKILL_CATALOG,
  getDeveloperSkillIds,
  validateDeveloperSkillCatalog,
} from "../../scripts/execute-plan/developer-skills.js";
import { FRAMEWORK_MAP, validateFrameworkMapSkills } from "../../scripts/execute-plan/framework-map.js";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("developer skill catalog", () => {
  it("contains the curated developer skills ADOS attaches to execution tasks", () => {
    expect(getDeveloperSkillIds()).toEqual(
      expect.arrayContaining([
        "writing-plans",
        "test-driven-development",
        "systematic-debugging",
        "verification-before-completion",
        "qa-only",
        "review",
        "browse",
        "frontend-design",
        "frontend-performance",
        "frontend-ui-animator",
        "ux-content-design",
        "security-review",
        "security-best-practices",
        "playwright",
        "measurement",
        "vercel-deploy",
        "finishing-a-development-branch",
      ]),
    );
  });

  it("excludes marketing, operator-only, and explicitly omitted skills from the team developer bundle", () => {
    const ids = new Set(getDeveloperSkillIds());

    for (const excluded of [
      "cold-email",
      "ads",
      "copywriting",
      "b2b-positioning",
      "chatgpt-apps",
      "openai-docs",
    ]) {
      expect(ids.has(excluded)).toBe(false);
    }
  });

  it("points every path-backed skill at a checked-in source file", () => {
    for (const skill of DEVELOPER_SKILL_CATALOG.skills) {
      if (!skill.path) continue;

      expect(existsSync(resolve(repoRoot, skill.path)), skill.id).toBe(true);
    }
  });

  it("validates unique IDs and framework-map references", () => {
    expect(() => validateDeveloperSkillCatalog()).not.toThrow();
    expect(() => validateFrameworkMapSkills(FRAMEWORK_MAP)).not.toThrow();
  });
});
