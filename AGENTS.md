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
- Validate with `npm test`, `npm run typecheck`, and `./bin/setup --dry-run` before claiming the package is ready.
