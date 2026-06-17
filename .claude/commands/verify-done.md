---
description: 5pm ritual. Check today's outcomes, log what shipped, flag what slipped, write tomorrow's 3.
---

# /verify-done

The 5pm hard stop ritual. Run it once per day, at 5pm, before closing the laptop.

## What it does

1. Loads the most recent tracker from `008_Builds/define-done/`
2. Asks the user what shipped today (one outcome at a time)
3. Updates the HTML state (preserves the live JS, but writes the truth)
4. Logs the day to `008_Builds/define-done/log.md`
5. If today < 3/3 → asks why one specific outcome slipped (not generic "what happened")
6. Prompts user to write tomorrow's 3 outcomes BEFORE closing the laptop
7. Optionally appends tomorrow's outcomes to the same tracker

## Workflow

### Step 1 — Load today's tracker

Find the latest file in `008_Builds/define-done/` matching `*-define-done.html`. Parse the day cards. Find today's day card.

### Step 2 — Verify each outcome

Walk through today's 3 outcomes one at a time. For each:

> *"Outcome 1: {{outcome_text}}. Did it ship? (y / n / partial)"*

If `n` or `partial` → one follow-up:
> *"What got in the way? One sentence. We're logging it, not analyzing it."*

Record the answer verbatim. Do not editorialize. Do not say "no worries, tomorrow's a new day."

### Step 3 — Update the HTML

Edit the today card in the HTML:
- Add `checked` attribute to checkboxes for shipped outcomes
- Update the `<span class="score">` to the final count (3/3, 2/3, etc.)
- Add a `data-verified="true"` attribute to the day card

### Step 4 — Log the day

Append to `008_Builds/define-done/log.md`:

```markdown
## {{YYYY-MM-DD}} · {{Day name}}

- [x/✗] outcome 1: {{text}}{{ · slipped because: ... if partial/no}}
- [x/✗] outcome 2: {{text}}
- [x/✗] outcome 3: {{text}}

Score: {{hit}}/3 · Closed at: {{time}}
```

### Step 5 — Define tomorrow

> *"Three outcomes for tomorrow. One sentence each. Verb-first. Done before you close the laptop."*

Audit each against the 6 rules from `/define-done`. Reject vague outcomes. Push back once, then accept.

Add tomorrow's outcomes as a new day card in the same tracker HTML (or roll over to a fresh weekly tracker if Sunday).

### Step 6 — Close

Print:
```
Today: {{hit}}/3
Week so far: {{week_hit}}/{{week_days}} days at 3/3
Tomorrow ready: yes

Close the laptop.
```

Do not ask follow-ups. Do not suggest "one more thing." The ritual ends with closing the laptop.

## What this command does NOT do

- Does not ask "how do you feel about today?"
- Does not generate motivational copy
- Does not extend the day past 5pm
- Does not add extras to today's score (extras don't count)

## Anti-slop guardrails

- No emojis in outputs
- No em-dashes (use · instead)
- Lowercase headings in user-facing text
- Mechanical, not inspirational
- The system runs you, you don't run the system
