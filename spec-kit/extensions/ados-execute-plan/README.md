# ADOS Execute Plan Extension

This Spec Kit extension adds a bridge command that hands a generated `tasks.md` file to ADOS `/execute-plan --from-speckit`.

Install locally from an initialized Spec Kit project:

```bash
specify extension add --dev /path/to/ados-framework/spec-kit/extensions/ados-execute-plan
```

Typical workflow:

```text
/speckit.constitution
/speckit.specify
/speckit.clarify
/speckit.checklist
/speckit.plan
/speckit.tasks
/speckit.analyze
/speckit.ados-execute-plan --dry-run
```
