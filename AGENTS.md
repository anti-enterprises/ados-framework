# ADOS Framework

Use ADOS when a task should move from a written plan or GitHub Spec Kit tasks into a validated execution graph.

## Commands

- For ordinary Markdown plans, use `/execute-plan path/to/plan.md --dry-run` first, then execute after reviewing the graph.
- For GitHub Spec Kit features, use `/execute-plan --from-speckit specs/<feature>/tasks.md --dry-run` first.
- For Codex skill mode, use `$ados-execute-plan` for ADOS execution guidance and `$ados-speckit` for the Spec Kit bridge.

## Rules

- Keep implementation tasks test-first.
- Preserve user changes in `.claude/agents/**` unless explicitly asked to modify them.
- Use the curated developer skill catalog in `config/developer-skills.json`; do not add marketing, sales, or operator-only skills to execution mappings.
- Treat a machine-level ECC harness as the base and ADOS as a project overlay. When `harness-search` is available, resolve exact ECC skills, agents, workflows, and language rules on demand instead of copying the global catalog into this repository.
- `bin/setup` owns project-local ADOS assets only. It must not reset global Codex, Claude Code, or OpenCode configuration; use `bin/check-harness` for read-only compatibility checks.
- Validate with `npm test`, `npm run typecheck`, and `./bin/setup --dry-run` before claiming the package is ready.
