# ADOS Spec Kit Preset

This preset customizes Spec Kit artifacts for ADOS engineering teams. It keeps Spec Kit as the upstream workflow and adds ADOS expectations for TDD, explicit file paths, review gates, curated skill IDs, and ADOS `/execute-plan` compatibility.

Install locally from an initialized Spec Kit project:

```bash
specify preset add --dev /path/to/ados-framework/spec-kit/presets/ados
```

Use this preset with the ADOS extension:

```bash
specify extension add --dev /path/to/ados-framework/spec-kit/extensions/ados-execute-plan
```
