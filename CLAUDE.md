# ados-framework

Cross-framework AI development skills for Claude Code. Bridges gstack (planning), SPARC (roles), and RuFlo (execution) into a unified pipeline.

## Quick Start

```bash
./bin/setup              # Install owned assets into current project
./bin/setup --full       # Also pull upstream deps (gstack, superpowers, claude-flow)
```

## Commands

- `/execute-plan <plan.md>` — Run a gstack plan through the cross-framework pipeline
- `/execute-plan --from-speckit <feature-or-tasks-path>` — Run GitHub Spec Kit `tasks.md` through the same pipeline
  - `--dry-run` — Normalize and display without executing
  - `--resume` — Skip already-succeeded tasks
  - `--max-parallel=N` — Limit concurrent tasks (default: 4)
  - `--phase=NAME` — Only run tasks in the named phase

## Architecture

```
gstack plan (Markdown) → TaskGraph (JSON) → framework-map → RuFlo execution
                                                ↓
                                          SPARC role prompts
                                          + skill attachment
                                          + timeout/retry policy
```

The framework-map (`scripts/execute-plan/framework-map.ts`) is the central control point. Skill IDs must exist in `config/developer-skills.json`.

## File Organization

- `.claude/commands/` — Slash commands (analysis, automation, github, hooks, monitoring, optimization, sparc)
- `.claude/agents/` — Agent definitions (core, sparc, github, swarm, consensus, optimization, v3, templates)
- `.claude/helpers/` — Hook handlers (routing, memory, learning, session, security)
- `scripts/execute-plan/` — TypeScript pipeline (types, normalizer, validator, framework-map, DAG runner)
- `skills/` — Bundled skills (SPARC methodology)
- `.agents/skills/` — Codex-facing ADOS wrappers
- `config/` — Default configurations and curated developer skill catalog
- `spec-kit/` — ADOS Spec Kit preset and extension assets

## Build & Test

```bash
npx vitest run           # Run all tests
npx tsc --noEmit         # Type check
```

## Upstream Dependencies

| Package | Required | What it provides |
|---|---|---|
| `@claude-flow/cli` (RuFlo) | Yes | Agent spawning, task management, swarm coordination |
| superpowers (plugin) | Yes | Core workflow skills — TDD, debugging, verification |
| gstack | No | Planning skills — /writing-plans, /ship, /review, /qa |
| frontend-design (plugin) | No | UI/UX design patterns |
| Spec Kit | No | Spec-driven development artifacts and agent integrations |

## Rules

- NEVER hardcode absolute paths — use `$CLAUDE_PROJECT_DIR` or `$HOME`
- NEVER commit runtime state (.claude-flow/data/, .claude-flow/sessions/)
- NEVER commit secrets or .env files
- Keep files under 500 lines
- Run tests after code changes
- Keep `config/developer-skills.json` developer-only; do not add marketing, sales, or operator skills
- Preserve existing user edits under `.claude/agents/**` unless explicitly asked to modify them
