---
name: execute-plan
description: Cross-framework execution pipeline — gstack plans + SPARC roles + RuFlo execution
---

# /execute-plan

Execute a gstack implementation plan through the cross-framework pipeline:
gstack (planning) -> TaskGraph (normalization) -> SPARC (roles) -> RuFlo (execution).

## Arguments

`$ARGUMENTS` — plan file path and optional flags.

**Flags:**
- `--dry-run` — normalize, validate, and display the execution graph without running
- `--plan-only` — alias for --dry-run
- `--from-speckit <feature-or-tasks-path>` — parse a GitHub Spec Kit `tasks.md` file directly
- `--resume` — skip already-succeeded tasks from a previous run
- `--max-parallel=N` — max concurrent tasks per level (default: 4)
- `--phase=NAME` — only execute tasks in the named phase

## Execution Steps

Follow these steps exactly, in order. Do not skip steps.

### Step 1: Parse Arguments

Parse `$ARGUMENTS` to extract:
- `planPath`: first non-flag argument (file path to a Markdown plan)
- `dryRun`: true if `--dry-run` or `--plan-only` present
- `fromSpecKit`: value from `--from-speckit <path>` or `--from-speckit=<path>`, or undefined
- `resume`: true if `--resume` present
- `maxParallel`: integer from `--max-parallel=N`, default 4
- `phase`: string from `--phase=NAME`, or undefined

If `fromSpecKit` is set, `planPath` is optional.
If neither `fromSpecKit` nor `planPath` is provided, look for the most recent `.md` file in `~/.claude/plans/`.
If no plan file is found, tell the user and stop.

### Step 2: Read Plan

If `fromSpecKit` is set:
- Resolve it as a direct `tasks.md` path, a feature directory containing `tasks.md`, or `specs/<feature>/tasks.md`
- Read that `tasks.md`
- Store the full Markdown content
- Continue to Step 3B

Otherwise:
Use the Read tool to read the plan file at `planPath`.
Store the full Markdown content.

### Step 3A: Normalize Markdown Plan to TaskGraph

Read the normalization prompt template from `scripts/execute-plan/plan-normalizer.ts` — specifically the `getNormalizationPrompt` function. It documents the JSON schema and normalization rules.

Convert the Markdown plan into a JSON TaskGraph following these rules:

**Type normalization (case-insensitive):**
- design -> "design"
- implement, code, build -> "implement"
- test, qa, validate -> "test"
- debug, fix -> "debug"
- review -> "review"
- research, investigate -> "research"
- Default to "implement" if unclear from context

**ID generation:**
- Use provided ID if the plan includes one
- Otherwise generate: `<phase>-<phaseIndex>-<taskIndex>` (0-indexed)

**Dependency inference:**
- Tasks within a phase: sequential by default (each depends on previous)
- Cross-phase: first task of phase N+1 depends on last task of phase N
- Mark tasks as independent (`parallelizable: true`, no deps) only if they clearly share no files or data flow

**Extract from plan Markdown:**
- `files.create` / `files.modify` from `**Files:**` lines
- `steps` from `- [ ]` checkbox items
- `acceptance` from acceptance criteria text
- `desc` from the full task description

Output a JSON object matching the `TaskGraph` interface in `scripts/execute-plan/types.ts`.

### Step 3B: Parse Spec Kit tasks.md to TaskGraph

If `fromSpecKit` is set, do not use LLM normalization. Use the deterministic parser in `scripts/execute-plan/speckit-parser.ts`.

Parsing rules:
- Task rows must look like `- [ ] T001 ...`
- `[P]` marks a task as parallelizable
- `[US1]`, `[US2]`, etc. populate `story`
- `##` and `###` headings populate `phase`
- Backticked file paths populate `files.create` or `files.modify`
- Non-parallel tasks after a parallel batch depend on the whole batch
- Parsed tasks set `source` to `speckit:<tasks path>`
- Parsed tasks may set `skillIds` from the curated catalog

### Step 4: Validate TaskGraph

Apply these validations to the TaskGraph:

1. **Non-empty**: at least one task
2. **Unique IDs**: no duplicate task IDs
3. **Valid types**: all types are canonical (design, implement, test, debug, review, research)
4. **Valid skill IDs**: every `skillIds` entry exists in `config/developer-skills.json`
5. **Dependencies exist**: every `dependsOn` entry points to a real task ID
6. **No self-deps**: no task depends on itself
7. **No cycles**: Kahn's algorithm — if topological sort doesn't consume all nodes, there's a cycle

If validation fails, report the specific errors and stop. Do not proceed with an invalid graph.

### Step 5: Apply Framework Map

For each task, look up its `type` in the framework map (`scripts/execute-plan/framework-map.ts`):

| Type | SPARC Role | RuFlo Agent | Skills | Timeout | Retries |
|------|-----------|-------------|--------|---------|---------|
| design | architect | architect | writing-plans, plan-eng-review, careful | 900s | 0 |
| implement | coder | coder | test-driven-development, verification-before-completion, careful | 1800s | 1 |
| test | reviewer | tester | qa-only, verification-before-completion | 1200s | 0 |
| debug | debugger | debugger | systematic-debugging, investigate, careful | 1800s | 1 |
| review | reviewer | reviewer | review, requesting-code-review, security-review, careful | 900s | 0 |
| research | architect | researcher | investigate, context7, graphify | 900s | 0 |

Merge task-level `skillIds` into the mapped skill list, preserving order and removing duplicates.

### Step 6: Build Execution Graph

Compute concurrency levels via topological sort:
- **Level 0**: tasks with no dependencies
- **Level 1**: tasks whose deps are all in Level 0
- **Level N**: tasks whose deps are all in levels < N

If `--phase` is set, filter to only tasks in that phase.

### Step 7: Display Execution Plan

Show the user:
- Total task count, level count
- For each level: task IDs, titles, SPARC roles, RuFlo agents, dependencies
- The framework map entries being used

If `--dry-run` is set, save the normalized plan and execution graph to `.claude/runs/`, display the plan, and **stop here**.

### Step 8: Confirm Execution

Use AskUserQuestion to confirm:
- Question: "Ready to execute N tasks across M levels?"
- Options: ["Execute", "Execute with changes", "Cancel"]

If "Cancel", stop.
If "Execute with changes", ask what to change, adjust, and re-confirm.

### Step 9: Create Run Directory

Create `.claude/runs/<timestamp>-<runId>/` with a `results/` subdirectory.
Save `raw-plan.json` (original Markdown as string), `normalized-plan.json` (TaskGraph), and `execution-graph.json` (mapped tasks with levels).

### Step 10: Execute DAG

For each concurrency level, in order:

1. **Identify ready tasks** at this level (not blocked by failed deps)
2. **Mark blocked tasks**: if any dependency failed or is blocked, mark task as blocked
3. **Batch tasks** into groups of `maxParallel`
4. **For each batch**, spawn agents IN PARALLEL (one message, all tool calls):

**Primary executor — RuFlo MCP:**
For each task in the batch, call these tools:

```
mcp__ruflo__agent_spawn:
  agentType: <rufloAgent from framework map>
  task: <composed SPARC prompt + task description + acceptance criteria + file list>
  model: "sonnet"
  agentId: "exec-<taskId>"
  domain: <phase>

mcp__ruflo__task_create:
  type: <mapped type>
  description: <same composed prompt>
  priority: <task priority>
  assignTo: ["exec-<taskId>"]
  tags: [<sparcRole>, <phase>, <skills...>]
```

**Fallback — Claude Code Task tool:**
If RuFlo spawn fails, use the Agent tool instead:

```
Agent:
  description: "<sparcRole>: <title>"
  prompt: <same composed SPARC prompt>
  subagent_type: <mapped subagent type>
  run_in_background: true
  mode: "bypassPermissions"
```

5. **Wait for all agents** in the batch to complete
6. **Collect results**: status, artifacts, errors
7. **If any task failed** and has retries > 0, retry once
8. **Move to next level**

### Step 11: Summarize Results

After all levels complete:

1. Write `execution.results.json` — array of all task results
2. Write `execution.summary.md` with:
   - Run ID, timestamp, totals (success/failed/blocked/skipped)
   - Task table with status, agent, executor, summary
   - Failed task details with errors
   - Blocked task list
   - Next actions: fix commands, rerun advice

3. Display the summary to the user

### Step 12: Post-execution Hooks

Run post-execution hooks:
```bash
npx @claude-flow/cli@latest hooks post-task --task-id "execute-plan-<runId>" --success "<true|false>"
```

## Composed Prompt Template

When building the prompt for each task, compose these sections:

```
## Role
<SPARC role prompt template from framework map>

## Task
**<title>**
<description>

## Provenance
Source: <source if provided>
Story: <story if provided>

## Files
Create: <files to create>
Modify: <files to modify>

## Steps
1. <step 1>
2. <step 2>
...

## Acceptance Criteria
- <criterion 1>
- <criterion 2>

## Skills to Use
Invoke these skills during execution: <skill1>, <skill2>
```

## Resume Support

When `--resume` is set:
1. Look for the most recent run directory in `.claude/runs/`
2. Read `execution.results.json` from that run
3. Skip tasks that already have status "success"
4. Re-run failed and blocked tasks

## Reference Files

- Types: `scripts/execute-plan/types.ts`
- Normalizer: `scripts/execute-plan/plan-normalizer.ts`
- Validator: `scripts/execute-plan/validate-taskgraph.ts`
- Framework map: `scripts/execute-plan/framework-map.ts`
- Developer skill catalog: `config/developer-skills.json`
- Spec Kit parser: `scripts/execute-plan/speckit-parser.ts`
- Execution graph: `scripts/execute-plan/build-execution-graph.ts`
- RuFlo adapter: `scripts/execute-plan/run-ruflo.ts`
- DAG runner: `scripts/execute-plan/dag-runner.ts`
- Summarizer: `scripts/execute-plan/summarize-results.ts`
- I/O utilities: `scripts/execute-plan/io.ts`
