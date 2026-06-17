# ados-framework

Cross-framework AI development skills for [Claude Code](https://claude.ai/code). One command bridges [gstack](https://github.com/garrytan/gstack) planning, [SPARC](https://en.wikipedia.org/wiki/Specification_and_Description_Language) role methodology, and [RuFlo](https://github.com/ruvnet/claude-flow) execution into a unified pipeline.

## What's in the box

- **`/execute-plan`** — Takes a Markdown implementation plan or GitHub Spec Kit `tasks.md`, normalizes it into a task graph, maps tasks to SPARC-enriched RuFlo agents, and executes them in dependency order with parallel scheduling
- **Developer skill catalog** — Curated Claude/Codex software-engineering skills in `config/developer-skills.json`
- **Spec Kit bridge** — ADOS preset and extension assets under `spec-kit/` for spec-driven development without vendoring Spec Kit core
- **99 agent definitions** — Development, review, testing, security, swarm coordination, consensus, optimization
- **92 slash commands** — Analysis, automation, GitHub integration, hooks, monitoring, optimization, SPARC modes, Define Done
- **39 hook handlers** — Routing, memory, learning, session management, security scanning
- **Framework map** — Canonical registry connecting task types to SPARC roles, RuFlo agents, Claude Code skills, and runtime policy

## Install

```bash
git clone https://github.com/anti-enterprises/ados-framework.git
cd ados-framework

# Minimal: owned assets only (agents, commands, helpers, pipeline, bundled skills)
./bin/setup

# Full: also install upstream dependencies (gstack, superpowers, claude-flow)
./bin/setup --full

# Install both Claude Code and Codex assets
./bin/setup --full --agents=both

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

# Or run GitHub Spec Kit tasks through ADOS
/execute-plan --from-speckit specs/001-feature/tasks.md

# Dry run (normalize + validate + display, no execution)
/execute-plan path/to/plan.md --dry-run
/execute-plan --from-speckit specs/001-feature/tasks.md --dry-run

# Resume a failed run
/execute-plan --resume

# Limit parallelism
/execute-plan path/to/plan.md --max-parallel=2
```

### How it works

```
Markdown plan ───────→ [Normalize] ──┐
Spec Kit tasks.md ───→ [Parse] ──────┼→ TaskGraph JSON → [Validate] → [Framework Map] → [DAG Schedule] → [Execute]
                                      │                         ↓
                                      └─────────────── curated developer skill catalog
```

1. **Normalize Markdown** — LLM-mediated Markdown-to-JSON conversion using a strict schema
2. **Parse Spec Kit** — `tasks.md` rows convert deterministically with `[P]`, `[US1]`, file paths, and dependency barriers preserved
3. **Validate** — Unique IDs, skill IDs, dependency checks, cycle detection (Kahn's algorithm)
4. **Map** — Each task type resolves to a SPARC role + RuFlo agent + curated skill IDs + policy
5. **Schedule** — Topological sort into concurrency levels
6. **Execute** — RuFlo MCP (primary) or Claude Code Task tool (fallback), level by level
7. **Summarize** — Results JSON + Markdown summary with rerun advice

### Framework map

| Task Type | SPARC Role | RuFlo Agent | Skills | Timeout |
|---|---|---|---|---|
| design | architect | architect | writing-plans, plan-eng-review, careful | 15m |
| implement | coder | coder | test-driven-development, verification-before-completion, careful | 30m |
| test | reviewer | tester | qa-only, verification-before-completion | 20m |
| debug | debugger | debugger | systematic-debugging, investigate, careful | 30m |
| review | reviewer | reviewer | review, requesting-code-review, security-review, careful | 15m |
| research | architect | researcher | investigate, context7, graphify | 15m |

### GitHub Spec Kit workflow

ADOS does not vendor GitHub Spec Kit. Initialize Spec Kit in the target project, install the ADOS preset/extension, then hand the generated tasks to `/execute-plan`:

```bash
specify init --here --integration claude
# or
specify init --here --integration codex --integration-options="--skills"

specify preset add --dev /path/to/ados-framework/spec-kit/presets/ados
specify extension add --dev /path/to/ados-framework/spec-kit/extensions/ados-execute-plan
```

Recommended flow:

```
/speckit.constitution -> /speckit.specify -> /speckit.clarify -> /speckit.checklist -> /speckit.plan -> /speckit.tasks -> /speckit.analyze -> /execute-plan --from-speckit ...
```

## Project structure

```
.claude/
  commands/       92 slash commands by category
  agents/         99 agent definitions by role
  helpers/        39 hook handlers and utilities
  settings.template.json
.agents/
  skills/         Codex wrappers for ADOS execution and Spec Kit bridge
scripts/
  execute-plan/   TypeScript pipeline (11 modules)
tests/
  execute-plan/   Unit tests (48 tests)
skills/           Bundled skills (SPARC, Define Done, anti-ai-slop, pin-guard, Karpathy guidelines)
config/           Default configurations and developer skill catalog
spec-kit/         ADOS Spec Kit preset and extension assets
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
| [Spec Kit](https://github.com/github/spec-kit) | GitHub | No | Spec-driven development CLI, templates, commands, and integrations |

## Bundled skills

These skills are vendored in `skills/`, registered in `config/developer-skills.json`, and installed into `.claude/skills` and `.agents/skills` by default:

| Skill | Source | What it provides |
|---|---|---|
| `sparc-methodology` | ados-framework | SPARC workflow and helper scripts |
| `define-done` | [walidboulanouar/define-done](https://github.com/walidboulanouar/define-done) | Binary daily outcome planning and HTML tracker generation |
| `anti-ai-slop` | [walidboulanouar/anti-ai-slop](https://github.com/walidboulanouar/anti-ai-slop) | Writing audit/rewrite rules and deterministic Python scanners |
| `pin-guard` | [walidboulanouar/pin-guard](https://github.com/walidboulanouar/pin-guard) | JS/TS dependency pinning and npm supply-chain scanning |
| `karpathy-guidelines` | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | Simplicity, surgical-change, and verification guidelines |

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
