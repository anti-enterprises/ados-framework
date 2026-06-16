import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type AgentTarget = "claude" | "codex";

export interface DeveloperSkill {
  id: string;
  name: string;
  category: string;
  source: "superpowers" | "gstack" | "community" | "ados" | "plugin" | "personal";
  path?: string;
  agentTargets: AgentTarget[];
}

export interface DeveloperSkillCatalog {
  version: string;
  description: string;
  excludedCategories: string[];
  skills: DeveloperSkill[];
}

export const DEVELOPER_SKILL_CATALOG = require("../../config/developer-skills.json") as DeveloperSkillCatalog;

const SKILL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function getDeveloperSkillIds(catalog = DEVELOPER_SKILL_CATALOG): string[] {
  return catalog.skills.map((skill) => skill.id);
}

export function isDeveloperSkillId(id: string, catalog = DEVELOPER_SKILL_CATALOG): boolean {
  return getDeveloperSkillIds(catalog).includes(id);
}

export function assertKnownSkillIds(
  skillIds: readonly string[],
  context: string,
  catalog = DEVELOPER_SKILL_CATALOG,
): void {
  const known = new Set(getDeveloperSkillIds(catalog));
  const unknown = skillIds.filter((skillId) => !known.has(skillId));

  if (unknown.length > 0) {
    throw new Error(`${context} references unknown developer skills: ${unknown.join(", ")}`);
  }
}

export function validateDeveloperSkillCatalog(catalog = DEVELOPER_SKILL_CATALOG): void {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const skill of catalog.skills) {
    if (!SKILL_ID_PATTERN.test(skill.id)) {
      errors.push(`invalid skill id "${skill.id}"`);
    }

    if (ids.has(skill.id)) {
      errors.push(`duplicate skill id "${skill.id}"`);
    }
    ids.add(skill.id);

    if (catalog.excludedCategories.includes(skill.category)) {
      errors.push(`excluded category "${skill.category}" used by "${skill.id}"`);
    }

    if (skill.agentTargets.length === 0) {
      errors.push(`skill "${skill.id}" has no agent targets`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Developer skill catalog is invalid:\n  - ${errors.join("\n  - ")}`);
  }
}
