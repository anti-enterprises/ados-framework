# Prompting Principles — applied to Define Done outcomes

Outcomes follow the same rules as good Claude Code prompts. Both fail for the same reasons: vagueness, hidden dependencies, and "and."

## The 6 rules

### 1. Name the artifact
- Bad: "work on the Acme proposal"
- Good: "send Acme proposal pdf to sarah@acme.com"
- Why: Claude Code works best when you name the file. Outcomes work best when you name the artifact that gets shipped.

### 2. Verb-first, one sentence
- Bad: "I need to think about the onboarding flow and maybe ship something"
- Good: "ship onboarding screen 1 to prod"
- Why: Same as a tool call. Verb + object + target.

### 3. Binary done/not-done
- Bad: "make progress on AYn8n"
- Good: "publish 5 AYn8n workflows with screenshots and INDEX entries"
- Why: If you cannot answer "did you do it?" with yes or no at 5pm, the outcome is bad.

### 4. No "and"
- Bad: "ship the proposal and follow up with 3 prospects"
- Good (split): "send Acme proposal" + "follow up with 3 prospects"
- Why: Same as prompts. One intent = one outcome. "and" is two outcomes wearing a trench coat.

### 5. No internal dependencies inside a day
- Bad day: outcome 1 = "build the script" → outcome 2 = "use the script to send 50 dms" → outcome 3 = "review responses"
- Good day: outcome 1 = "send 50 dms via existing script" → outcome 2 = "publish ep.04" → outcome 3 = "review Pierre's proposal"
- Why: If outcome 2 needs outcome 1 to ship first, one slip kills the day. Independence = resilience.

### 6. External ship beats internal review
- Bad: "review the codebase"
- Good: "merge PR #47 to main"
- Bad: "think about pricing"
- Good: "send updated pricing pdf to Adel"
- Why: Internal verbs (review, think, plan, explore) expand to fill the day. External verbs (send, merge, publish, deploy) end.

## Outcome quality test

For each outcome, ask:
1. Can I name the file/artifact/recipient? (artifact)
2. Is it one sentence, verb-first? (form)
3. Can I answer yes/no at 5pm? (binary)
4. Does it contain "and"? (split it)
5. Does it depend on outcome 1 or 2 of today? (move to tomorrow)
6. Is the verb internal or external? (prefer external)

If 4 or more pass → ship the outcome.
If fewer → rewrite.

## Examples by category

### Client work
- ✓ send Acme proposal pdf to sarah@acme.com
- ✓ deploy Pierre's onboarding flow to prod
- ✓ ship handoff doc to Wickey team via gmail
- ✗ review Pierre's project (no ship)
- ✗ work on Acme (no artifact)

### Sales / outreach
- ✓ send 30 dms from CEO SAAS campaign
- ✓ book 2 discovery calls in this week's calendar
- ✓ publish use-case-3 to /use-cases
- ✗ outreach (no number)
- ✗ follow up with leads (no count, no channel)

### Content
- ✓ publish bwr ep.04 on linkedin before 9am
- ✓ ship one carousel from clean-build-run to 008_Builds
- ✓ send linkedin daily comment batch (5 comments) to slack
- ✗ post on linkedin (no episode, no time)
- ✗ engage with people (no count, no channel)

### Building / engineering
- ✓ merge PR #23 to main
- ✓ ship AYn8n batch-08 (5 workflows + INDEX update)
- ✓ deploy ay-pilot v0.4 to prod
- ✗ work on AYn8n (no number, no ship)
- ✗ debug the pipeline (no end state)

### Personal / health
- ✓ run 5km before 8am
- ✓ close laptop at 5pm and walk 30 min
- ✓ no screen after 10pm
- ✗ exercise more (no metric)
- ✗ rest (no signal)

## How this maps to Claude Code prompts

| Claude Code prompt rule | Define Done outcome rule |
|---|---|
| Name the file | Name the artifact |
| One intent per tool call | One ship per outcome |
| Specify the destination | Specify the recipient |
| No "and also" | No "and" |
| Independent tool calls | Independent outcomes |
| External verbs (Edit, Write, Bash) | External verbs (send, ship, publish, merge) |

The same brain that writes good prompts writes good outcomes. The skill is one skill.
