---
name: define-done
description: Generate a branded HTML accountability tracker for the next N days using the "Define Done" ritual. Takes 3 outcomes per day max (binary, shippable, no fluff), applies Walid's prompting principles for Claude Code, and outputs a self-contained HTML file ready to pin in a browser tab. Use when the user says "define done", "plan my next 3 days", "build my weekly outcomes", "set my goals for the week", "what should I ship this week", or any request to plan daily outcomes with accountability.
---

# Define Done — Accountability HTML Generator

## What this skill does

Takes N days of goals from the user, applies the "Define Done" ritual rules, and writes a single self-contained HTML file to `008_Builds/define-done/{YYYY-MM-DD}-define-done.html`.

The HTML is designed to live in a browser tab and be checked twice a day:
- 8am: open it, do outcome 1
- 5pm: tick the checkboxes, close laptop

## The Define Done Ritual (rules baked into this skill)

1. **3 outcomes max per day.** Not 4. Not "and maybe also." 3.
2. **Outcomes, not tasks.** Binary. "Ship X to prod" / "Send Y to client" / "Publish Z post." Not "work on X."
3. **Written the night before, not the morning.** Morning-self is optimistic. Night-self is calibrated.
4. **5pm hard stop.** Did all 3 → win. Did fewer → roll. Did more → extras don't count.
5. **Weekly metric:** how many days hit 3/3, not total tasks shipped.

## When to invoke

Triggers:
- "define done"
- "plan my next [N] days"
- "set my outcomes for this week"
- "what should I ship this week"
- "build my weekly tracker"
- "make me an accountability page"
- "plan tomorrow" (default N=1)

## Workflow

### Step 1 — Gather inputs

Ask ONE question if missing:
> *"What 3 outcomes per day for the next [N] days? Or want me to draft them from your active projects?"*

If the user says "draft them" → read `01_Projects/Clients/Active/INDEX.md`, `01_Projects/Internal/AY_Automate/AY_AUTOMATE_HQ.md`, and `02_Areas/Sales/Pipeline/` for current priorities. Propose 3 outcomes per day, ask for sign-off, then generate.

### Step 2 — Apply the rules

Before writing the HTML, audit each outcome:

- ✗ "Work on the proposal" → reject. Not binary.
- ✓ "Send Acme proposal to Sarah" → accept.
- ✗ "Make progress on AYn8n" → reject. Vague.
- ✓ "Publish 5 workflows to AYn8n with screenshots" → accept.
- ✗ "Review the codebase" → reject. No ship.
- ✓ "Ship onboarding screen 1 to prod" → accept.

If any outcome fails, rewrite it before generating.

### Step 3 — Generate the HTML

Use the template at `templates/tracker-template.html`. Replace these markers:

| Marker | What to inject |
|---|---|
| `{{TITLE}}` | e.g. "Week of Jun 10 — Define Done" |
| `{{START_DATE}}` | First day, formatted "Mon · Jun 10" |
| `{{END_DATE}}` | Last day, formatted "Sun · Jun 16" |
| `{{TODAY_LABEL}}` | "Today is Tuesday, Jun 11" (or current day) |
| `{{DAYS_HTML}}` | The repeated day blocks (see template) |
| `{{NORTH_STAR}}` | One sentence: the weekly anchor (e.g. "ship 2 client builds, publish 3 posts") |
| `{{RITUAL_NOTE}}` | Customizable footer note. Default: the 4-line ritual reminder. |
| `{{BRAND_TAG}}` | From `${user_config.brand_name}`. Default: `DEFINE DONE` |
| `{{SIGNATURE}}` | From `${user_config.signature}`. Default: `DEFINE DONE · MIT LICENSED` |

## Applying user config (plugin mode)

When this skill runs inside the installed plugin, read these env-injected values from `${user_config.*}`:

- `${user_config.brand_name}` → `{{BRAND_TAG}}`
- `${user_config.accent_color}` → inject `<style>:root{--accent:VALUE}</style>` before `</head>`
- `${user_config.background_color}` → inject `--bg` override the same way
- `${user_config.hard_stop_time}` → use in stamps (e.g. `17:00 HARD STOP` instead of `5PM HARD STOP`)
- `${user_config.outcomes_per_day}` → cap N per day; reject extras
- `${user_config.signature}` → `{{SIGNATURE}}`

If `${user_config.*}` is not available (skill used outside plugin), fall back to template defaults.

For each day, emit a day block:
```html
<div class="day">
  <div class="day-head">
    <div class="day-name">{{DAY_NAME}}</div>
    <div class="day-date">{{DAY_DATE}}</div>
  </div>
  <ol class="outcomes">
    <li><label><input type="checkbox"><span>{{OUTCOME_1}}</span></label></li>
    <li><label><input type="checkbox"><span>{{OUTCOME_2}}</span></label></li>
    <li><label><input type="checkbox"><span>{{OUTCOME_3}}</span></label></li>
  </ol>
  <div class="day-foot">
    <span class="stamp">5PM HARD STOP</span>
    <span class="score" data-day="{{DAY_INDEX}}">0/3</span>
  </div>
</div>
```

### Step 4 — Save and verify

Save to: `008_Builds/define-done/{YYYY-MM-DD}-define-done.html` where `{YYYY-MM-DD}` = start date.

After writing, screenshot it with `vision-verify` to confirm it renders. Use viewport 1120x780 for the screenshot.

### Step 5 — Deliver

Return:
- File path of the HTML
- File path of the screenshot
- One-line summary: e.g. "Tracker for 5 days · 15 outcomes · file ready to pin in browser"
- Optional: suggest setting macOS to open this file on browser startup

## Prompting principles to embed (when drafting outcomes)

These come from the user's CLAUDE.md and from how Claude Code works best:

1. **Be concrete, name the artifact.** "Send X" beats "work on X." Same logic as Claude Code: name the file, not the topic.
2. **One sentence per outcome, present tense, verb-first.** Mirrors the prompt-engineering rule: short, declarative, no preamble.
3. **No "and."** If you write "and" inside an outcome, split it or kill one half. (Like Claude Code: one tool call per intent.)
4. **No dependencies inside one day.** Outcome 2 cannot depend on outcome 1 shipping. Otherwise day = brittle.
5. **Use the user's voice:** lowercase, direct, no hedge words. Match CLAUDE.md.
6. **Bias to "ship to someone."** Internal "review" = no ship. External "send / publish / merge / deploy" = ship.

## Output location

```
008_Builds/define-done/
  2026-06-10-define-done.html     ← N-day tracker
  2026-06-10-define-done.png      ← screenshot for review
```

## Chain to other skills

- After generating → suggest `vision-verify` to confirm render
- If outcomes mention LinkedIn posts → chain `linkedin-hooks` or `content`
- If outcomes mention client proposals → chain `proposal-builder`
- If outcomes mention prospect outreach → chain `cold-dance` or `enrich`

## Anti-slop rules for this skill

- No emojis in the HTML
- No em-dashes (—) — use middle dot · instead
- No "Additionally" / "Crucial" / "Delve" / "Landscape"
- Headlines lowercase
- Monospace stamps only for system/meta text (5PM HARD STOP, day index)
- No motivational copy. The system is mechanical, not inspirational.

## Example invocation

User: *"build my define-done tracker for the next 5 days"*

Claude:
1. Ask: "3 outcomes per day or draft from active projects?"
2. Apply rules to each outcome
3. Generate HTML at `008_Builds/define-done/2026-06-10-define-done.html`
4. Screenshot with vision-verify
5. Return: file path + 1-line summary
