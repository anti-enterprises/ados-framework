---
description: Run ADOS execute-plan from the active Spec Kit tasks.md artifact
---

# /speckit.ados-execute-plan

Use this after `/speckit.analyze` has confirmed the feature artifacts are coherent.

## Arguments

`$ARGUMENTS` may include:

- `--dry-run` to normalize and display the ADOS graph without execution
- `--execute` to proceed after reviewing the graph
- a path to a feature directory or `tasks.md`

## Steps

1. Locate the active Spec Kit tasks file. If `$ARGUMENTS` includes a path, use it. Otherwise use the active feature directory's `tasks.md`.
2. Run `/execute-plan --from-speckit <tasks.md> --dry-run`.
3. Review the generated phases, dependencies, `[P]` parallel tasks, file paths, user-story labels, and skill IDs.
4. If `--execute` was provided and the graph is coherent, run `/execute-plan --from-speckit <tasks.md>`.
5. Stop before execution if Spec Kit artifacts disagree or required file paths are missing.
