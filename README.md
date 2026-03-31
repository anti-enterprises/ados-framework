# ados-framework

Cross-framework AI development skills for [Claude Code](https://claude.ai/code). One command bridges [gstack](https://github.com/garrytan/gstack) planning, [SPARC](https://en.wikipedia.org/wiki/Specification_and_Description_Language) role methodology, and [RuFlo](https://github.com/ruvnet/claude-flow) execution into a unified pipeline.

## What's in the box

- **`/execute-plan`** — Takes a Markdown implementation plan, normalizes it into a task graph, maps tasks to SPARC-enriched RuFlo agents, and executes them in dependency order with parallel scheduling
- **98 agent definitions** — Development, review, testing, security, swarm coordination, consensus, optimization
- **89 slash commands** — Analysis, automation, GitHub integration, hooks, monitoring, optimization, SPARC modes
- **39 hook handlers** — Routing, memory, learning, session management, security scanning
- **Framework map** — Canonical registry connecting task types to SPARC roles, RuFlo agents, Claude Code skills, and runtime policy

## Install

```bash
git clone https://github.com/anti-enterprises/ados-framework.git
cd ados-framework

# Minimal: owned assets only (agents, commands, helpers, pipeline)
./bin/setup

# Full: also install upstream dependencies (gstack, superpowers, claude-flow)
./bin/setup --full

# Preview: see what would be installed
./bin/setup --dry-run
```

### Requirements

- [Claude Code](https://claude.ai/code) CLI installed
- Node.js >= 20
- npm or pnpm

## Usage

### Execute a plan

```bash
# Write a plan with gstack
/writing-plans

# Run it through the pipeline
/execute-plan path/to/plan.md

# Dry run (normalize + validate + display, no execution)
/execute-plan path/to/plan.md --dry-run

# Resume a failed run
/execute-plan --resume

# Limit parallelism
/execute-plan path/to/plan.md --max-parallel=2
```

### How it works

```
Markdown plan → [Normalize] → TaskGraph JSON → [Validate] → [Framework Map] → [DAG Schedule] → [Execute]
                                                                  ↓
                                                            SPARC role prompts
                                                            RuFlo agent types
                                                            Skill attachment
                                                            Timeout/retry policy
```

1. **Normalize** — LLM-mediated Markdown-to-JSON conversion using a strict schema
2. **Validate** — Unique IDs, dependency checks, cycle detection (Kahn's algorithm)
3. **Map** — Each task type resolves to a SPARC role + RuFlo agent + skills + policy
4. **Schedule** — Topological sort into concurrency levels
5. **Execute** — RuFlo MCP (primary) or Claude Code Task tool (fallback), level by level
6. **Summarize** — Results JSON + Markdown summary with rerun advice

### Framework map

| Task Type | SPARC Role | RuFlo Agent | Skills | Timeout |
|---|---|---|---|---|
| design | architect | architect | writing-plans, careful | 15m |
| implement | coder | coder | TDD, verification | 30m |
| test | reviewer | tester | qa-only, review | 20m |
| debug | debugger | debugger | systematic-debugging | 30m |
| review | reviewer | reviewer | review, careful | 15m |
| research | architect | researcher | investigate | 15m |

## Project structure

```
.claude/
  commands/       89 slash commands by category
  agents/         98 agent definitions by role
  helpers/        39 hook handlers and utilities
  settings.template.json
scripts/
  execute-plan/   TypeScript pipeline (9 modules)
tests/
  execute-plan/   Unit tests (40 tests)
skills/           Bundled skills (SPARC methodology)
config/           Default configurations
bin/setup         Install script
manifest.json     Upstream dependency references
```

## Upstream dependencies

ados-framework bundles its own agents, commands, and pipeline. It references (but does not vendor) these upstream projects:

| Package | Source | Required | What it provides |
|---|---|---|---|
| [claude-flow](https://github.com/ruvnet/claude-flow) | npm `@claude-flow/cli` | Yes | Agent spawning, task management, swarm coordination, memory |
| [superpowers](https://github.com/obra/superpowers) | Claude Code plugin | Yes | Core workflow skills — brainstorming, TDD, debugging, verification |
| [gstack](https://github.com/garrytan/gstack) | GitHub | No | Planning and QA — /writing-plans, /ship, /review, /qa, /browse |
| [frontend-design](https://github.com/anthropics/skills) | Claude Code plugin | No | UI/UX design patterns for React/Next.js |
| [context7](https://github.com/upstash/context7) | Claude Code plugin | No | Live documentation fetching |

## Development

```bash
# Run tests
npx vitest run

# Type check
npx tsc --noEmit

# Watch mode
npx vitest
```

## License

[MIT](LICENSE) — Copyright (c) 2026 [Anti Enterprises](https://github.com/anti-enterprises)
