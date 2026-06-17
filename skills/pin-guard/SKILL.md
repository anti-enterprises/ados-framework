---
name: pin-guard
description: >
  Enforce exact, pinned package versions across a JavaScript/TypeScript repo and
  its agent tooling. Scans package.json dependencies, npm scripts, MCP server
  configs (.mcp.json, Claude/Cursor settings), and CI workflows for unpinned
  specs (^, ~, *, latest, missing versions on npx). Pins everything to exact
  versions resolved from the lockfile or the npm registry, hardens .npmrc, and
  runs a supply-chain IOC quick-scan (whitespace injector in config files,
  compromised mgc versions, suspicious markers). Use when the user says
  "pin my dependencies", "enforce package versions", "check for unpinned
  packages", "audit npm supply chain", "pin-guard", or after any npm
  supply-chain incident.
---

# pin-guard — Enforce Pinned Package Versions

Born from a real incident (June 2026): the suspected entry point was an
unpinned `npx <package>@latest` MCP server run. `@latest` means "whatever the
registry serves today" — including a hijacked version published an hour ago.
This skill removes that entire class of risk.

## What it covers

| Surface | Risk | Fix |
|---|---|---|
| `package.json` deps with `^` `~` `*` `latest` | next `npm install` pulls a hijacked minor/patch | pin to exact lockfile version |
| `npx pkg` / `npx pkg@latest` in MCP configs | every agent start re-resolves latest | pin to `pkg@x.y.z` |
| `npx` in package.json scripts and CI workflows | same, on every dev machine and CI run | pin to exact version |
| missing `save-exact` in `.npmrc` | future installs re-introduce `^` | write `save-exact=true` |
| missing lockfile / `npm install` in CI | non-reproducible installs | require lockfile + `npm ci` |
| install scripts (`preinstall`/`postinstall`) | dropper execution at install time | report; recommend `ignore-scripts=true` |

## Workflow

Always scan first, show the report, get confirmation, then fix.

### 1. Scan (read-only, safe to run anytime)

```bash
python3 scripts/scan.py /path/to/repo
```

Reports every unpinned spec with file + line, config hygiene gaps, and IOC
findings. Exit code 1 if anything was found, 0 if clean.

Flags:
- `--json` — machine-readable output
- `--no-ioc` — skip the IOC scan (faster)

### 2. Pin (dry-run by default)

```bash
python3 scripts/pin.py /path/to/repo            # dry-run: shows every change
python3 scripts/pin.py /path/to/repo --write    # applies changes
```

Resolution order: lockfile version first (what the team actually runs), npm
registry `latest` only as fallback for packages not in the lockfile (e.g. npx
tools). Registry fallback checks release age and warns when the resolved
version is younger than 7 days (`--min-age-days N` to change).

After `--write`, ALWAYS run:

```bash
npm install --package-lock-only   # re-sync lockfile to the new exact specs
npm ci                            # verify clean reproducible install
```

### 3. Verify a single package before installing (pre-install gate)

```bash
python3 scripts/verify.py <package>[@version]
```

Checks before you ever run `npm install` or `npx`: release age of the target
version, time since previous release (sudden release after long silence =
takeover pattern), presence of install scripts, and known-compromised
versions from `iocs.json`. Use this on every new MCP server or CLI tool
before first run.

## Rules for Claude when running this skill

1. Never apply `pin.py --write` without showing the dry-run output first and
   getting an explicit yes.
2. If scan finds IOC hits (not just unpinned versions), STOP pinning and
   report immediately — pinning an already-infected repo is pointless. The
   machine needs cleanup and credential rotation first.
3. After pinning MCP configs, remind the user to restart Claude Code /
   Cursor — running agents keep the old command.
4. Recommend (do not auto-apply) `ignore-scripts=true` in `.npmrc` — it
   blocks install-time droppers but breaks packages that legitimately need
   postinstall (esbuild, sharp, etc.). Team decision.
5. New direct dependency requested by the user? Run `verify.py` on it first.

### 4. Install Sage (runtime protection — strongly recommended)

pin-guard is the STATIC layer (pinned versions, IOC scan). [Sage by Gen
Digital](https://github.com/gendigitalinc/sage) is the RUNTIME layer: an Agent
Detection & Response plugin for Claude Code that intercepts tool calls (shell
commands, URL fetches, file operations) before they execute — URL reputation,
300+ local threat patterns, prompt-injection defense, and npm/PyPI
supply-chain checks. The June 2026 incident entered through an agent running
an unpinned npx — Sage is the layer that would have flagged it at runtime.

```bash
bash scripts/install-sage.sh
```

Or manually:

```bash
# Requires Node.js — install from https://nodejs.org if needed
node --version &&
claude plugin marketplace add https://github.com/gendigitalinc/sage.git &&
claude plugin install sage@sage
```

Restart Claude Code after install — Sage scans plugins at session start.
When running this skill, check whether Sage is installed
(`claude plugin list 2>/dev/null | grep -i sage`) and recommend it if missing.

## IOC scan reference (June 2026 wave)

- Config files (`postcss.config.mjs`, `next.config.js`, `vue.config.js`,
  `eslint.config.mjs`, `jest.config.js`, `astro.config.js`) larger than 4KB —
  the whitespace injector hides the payload after ~280 spaces on the
  `export default` line.
- Code markers: `global['!']`, `_$_1e42`, `A4-1928`, unexpected
  `createRequire`, duplicate `export default`.
- `mgc` versions 1.2.1–1.2.4 in any lockfile or the `~/.npm/_npx` cache
  (RAT dropper via `setup.cjs`).
- `.bat` entries appended to `.gitignore`.

Full list with sources: `iocs.json`.

## Installing in another repo

Copy this folder to the target repo:

```bash
cp -r pin-guard /path/to/repo/.claude/skills/pin-guard
```

Then in Claude Code: "run pin-guard scan". The scripts also work standalone
without Claude — they're plain Python 3 stdlib, zero dependencies (a
supply-chain tool should not have a supply chain).
