---
description: Plan N days of binary outcomes (3 max/day), apply prompting principles, output branded HTML tracker
---

# /define-done

Generate a Define Done tracker for the next N days.

## What it does

1. Asks how many days (default: 7) and whether to draft outcomes from active projects or take them from the user
2. Audits every outcome against the 6 Define Done rules
3. Generates a self-contained HTML file with localStorage persistence and a live scorecard
4. Saves to `008_Builds/define-done/{start-date}-define-done.html`
5. Screenshots it via vision-verify and returns the path

## Workflow

Invoke the `define-done` skill from `.claude/skills/define-done/`.

If $ARGUMENTS contains a number, use that as N. Otherwise default N=7.

Ask the user (one question only):
> *"3 outcomes per day (you tell me) or draft from your active projects?"*

If "draft" → read these files and propose outcomes:
- `01_Projects/Clients/Active/INDEX.md`
- `01_Projects/Internal/AY_Automate/AY_AUTOMATE_HQ.md`
- `01_Projects/Clients/Followups.md`
- `02_Areas/Sales/Pipeline/`

Show the proposed outcomes table, ask "ship it?" — only generate after sign-off.

## The 6 rules (audit every outcome)

1. **Named artifact.** "Send Acme proposal pdf to sarah@acme.com" — not "work on Acme."
2. **Verb-first, one sentence.** Imperative form. No hedges.
3. **Binary done/not-done at 5pm.** If you can't answer yes/no, rewrite.
4. **No "and".** Split or kill one half.
5. **No internal dependencies inside a day.** Outcome 2 cannot depend on outcome 1 shipping.
6. **External verbs > internal verbs.** Prefer send/ship/publish/merge/deploy over review/think/plan/explore.

Reject any outcome failing 2+ rules. Rewrite with the user.

## Output

```
008_Builds/define-done/{YYYY-MM-DD}-define-done.html
008_Builds/define-done/{YYYY-MM-DD}-define-done.png
```

## After generating

- Suggest pinning the HTML as a permanent browser tab
- Remind: open at 8am · tick at 5pm · don't open at 11pm
- One-line summary: "Tracker for N days · N*3 outcomes · live scorecard"
