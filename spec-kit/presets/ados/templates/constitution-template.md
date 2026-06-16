# Project Constitution

## ADOS Engineering Principles

1. Specification before implementation: every non-trivial feature starts from a written spec, plan, and task breakdown.
2. Test-first implementation: implementation tasks must include failing tests before production code.
3. Explicit file ownership: tasks must name exact files to create or modify.
4. Curated skills only: execution tasks may only reference skill IDs from `config/developer-skills.json`.
5. Verification before completion: every task must state the command or manual check that proves it is complete.
6. Human-readable artifacts: specs, plans, and tasks must be plain Markdown that engineers can review without tool-specific context.

## Governance

- If a plan conflicts with this constitution, update the plan before coding.
- If requirements are ambiguous, run clarification before planning.
- If implementation reveals spec drift, update the Spec Kit artifacts before continuing.
