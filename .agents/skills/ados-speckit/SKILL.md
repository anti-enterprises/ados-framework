---
name: ados-speckit
description: Use when bridging GitHub Spec Kit artifacts into ADOS execution from Codex.
---

# ADOS Spec Kit Bridge

Use this when a project has GitHub Spec Kit artifacts and implementation should run through ADOS instead of ad hoc task execution.

## Workflow

1. Run the Spec Kit gates in order: `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.checklist`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`.
2. Inspect `specs/<feature>/tasks.md`.
3. Convert with ADOS: `/execute-plan --from-speckit specs/<feature>/tasks.md --dry-run`.
4. Review the generated graph for phase labels, `[P]` parallel tasks, file paths, and user-story metadata.
5. Execute only after the graph is coherent and all Spec Kit artifacts agree.

## Notes

ADOS does not vendor Spec Kit. Install Spec Kit with `specify init --here --integration codex --integration-options="--skills"` and add the ADOS preset/extension from `spec-kit/`.
