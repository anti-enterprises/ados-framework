---
description: Interactive ritual to discover what "done" actually means for you. Run once. Produces your personal Define Done config.
---

# /performance

The configuration ritual. Run this once when starting Define Done.

Most people use Define Done badly because they never defined what "done" means for THEM. Ambitious founders think it means "ship a feature." Burnt-out founders think it means "answered the urgent thing." Both are wrong.

This command asks you 7 questions, audits your answers, and writes your personal Define Done config to `008_Builds/define-done/config.md`.

## Workflow

Ask the questions one at a time. Do not batch them. After each answer, store it. Do not editorialize.

### Q1 — Your role today
> *"In one sentence, what role do you play in your company today? Not your title. What is the work only you can do?"*

(Why: outcomes must serve that role, not the role you used to have.)

### Q2 — The shipped artifact
> *"Pick one thing you shipped last week that made you feel 'this was a real day's work.' What was it?"*

(Why: that artifact is your unit. Future outcomes must match its size and shape.)

### Q3 — The fake-work test
> *"Pick one thing you did last week that felt productive but didn't move anything. What was it?"*

(Why: this is your trap pattern. We will write a rule against it.)

### Q4 — Your hard stop
> *"What time do you want to close the laptop, every day, no exceptions? Pick a number."*

(Why: the hard stop is the foundation. If you don't pick a time, the system collapses into "until I feel done.")

### Q5 — Your weekly metric
> *"By Friday at 5pm, what single number tells you the week was a win?"*
>
> Examples: "3 client builds shipped" / "5 LinkedIn posts published" / "10 discovery calls booked" / "1 product release deployed"

(Why: this is your North Star. All weekly outcomes ladder to it.)

### Q6 — Your "and" trap
> *"What word or phrase do you catch yourself adding to outcomes that always doubles the work? (e.g. 'and also', 'plus', 'while I'm at it')"*

(Why: this is your personal banned phrase. We will reject any outcome containing it.)

### Q7 — Your dopamine pattern
> *"When you finish a day feeling 'great', is it because you (a) shipped one important thing, (b) shipped many small things, (c) avoided a fire, or (d) other?"*

(Why: pattern (b) is the AI-productivity trap. If the answer is (b), we will explicitly cap outcomes at 3 and reject 4+.)

## Step 2 — Audit the answers

Show the user a summary table:

```
ROLE         · {{q1}}
UNIT         · {{q2}}
TRAP         · {{q3}}
HARD STOP    · {{q4}}
WEEKLY WIN   · {{q5}}
BANNED PHRASE· {{q6}}
DOPAMINE     · {{q7}}
```

Ask: *"Does this look right? (y / edit X)"*

If user says edit → ask which question, re-prompt, regenerate.

## Step 3 — Write the config

Write to `008_Builds/define-done/config.md`:

```markdown
---
type: define-done-config
created: {{YYYY-MM-DD}}
user: {{user_name_if_known}}
---

# My Define Done · personal config

## Role
{{q1}}

## My unit of work
{{q2}}

## My trap pattern
{{q3}} — outcomes that look like this are rejected.

## Hard stop
{{q4}} — no exceptions.

## Weekly North Star
{{q5}}

## Banned phrases in outcomes
- {{q6}}
- "work on"
- "make progress"
- "explore"
- "think about"
- "and also"

## Dopamine pattern
{{q7}}{{ · CAP_AT_3 if (b)}}

---

The system from this config:
- All `/define-done` runs read this file first
- Outcomes that match my trap pattern get rejected
- Outcomes that contain my banned phrases get rejected
- The weekly North Star anchors every week's outcomes
- The hard stop is enforced in /verify-done
```

## Step 4 — Update the skill

Inject a marker into `.claude/skills/define-done/SKILL.md` so future runs read the config:

If the skill file already contains `<!-- USER_CONFIG_LOADED -->`, skip.
Otherwise insert at the top of the workflow section:

```
Before generating, ALWAYS read 008_Builds/define-done/config.md if it exists.
Apply the trap-pattern rejection, banned phrases, and weekly North Star to every outcome.
<!-- USER_CONFIG_LOADED -->
```

## Step 5 — Run /define-done once

Offer: *"Want me to run /define-done now with your new config? (y/n)"*

If yes → invoke /define-done with N=7. Pre-fill the North Star from Q5.

## When to re-run

- After 30 days
- After a role change
- When 3/3 days drop below 50% for 2 weeks straight (signal: outcomes are wrong-sized)
- Never on a friday afternoon — bad headspace for definition work
