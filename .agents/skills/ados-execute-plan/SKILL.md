---
name: ados-execute-plan
description: Use when executing ADOS Markdown plans or ADOS-normalized task graphs from Codex.
---

# ADOS Execute Plan

Use ADOS for plan-first software work where tasks need SPARC roles, curated developer skills, dependency ordering, and verification.

## Workflow

1. Inspect the plan or Spec Kit task file before editing code.
2. Dry-run the graph: `/execute-plan <plan.md> --dry-run` or `/execute-plan --from-speckit <tasks.md> --dry-run`.
3. Confirm task order, dependencies, files, and skill attachments.
4. Execute task-by-task with TDD for implementation tasks.
5. Run `npm test`, `npm run typecheck`, and any project-specific checks before completion.

## Skill Catalog

Use `config/developer-skills.json` as the source of truth for allowed skill IDs. If a task requests a skill that is not in the catalog, stop and update the catalog deliberately rather than inventing a new ID in the plan.
