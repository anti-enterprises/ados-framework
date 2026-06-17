# pin-guard

Supply-chain defense for JavaScript/TypeScript repos and AI-agent tooling.
Enforces exact package versions, gates new dependencies before install, and
scans for the npm "whitespace-injector / blockchain dead-drop RAT" that hit a
production codebase in 2026.

Zero dependencies — plain Python 3 stdlib. A supply-chain tool should not have
a supply chain.

General-purpose and anonymized — safe to share with teams and clients. The
threat intel (markers, wallets, C2 hosts, compromised packages) is public IOC
data; no private/customer details are included.

## Why this exists

A dependency was hijacked and hid a payload inside `postcss.config.mjs`,
disguised behind ~10,000 spaces so it was invisible in editors and git diffs.
On build it ran as the user with full Node privileges. Under the obfuscation it
was a **blockchain dead-drop RAT loader**: it read commands hidden in TRON/BSC
crypto transactions and executed them via `node -e`. Full remote code execution,
controlled through a channel that can't be taken down.

It got in through an unpinned dependency. pin-guard removes that entire class of
risk. Full write-up: [`docs/INCIDENT-REPORT.md`](docs/INCIDENT-REPORT.md).

## Quick start

```bash
# 1. Audit any repo (read-only)
python3 scripts/scan.py /path/to/repo

# 2. Pin all dependency versions (dry-run, then apply)
python3 scripts/pin.py /path/to/repo
python3 scripts/pin.py /path/to/repo --write
npm install --package-lock-only && npm ci

# 3. Gate every new package BEFORE installing it
python3 scripts/verify.py some-package
python3 scripts/verify.py some-package@1.2.3

# 4. Install the pre-commit guard (blocks infected commits)
bash scripts/install-hook.sh /path/to/repo

# 5. Runtime layer (recommended): install Sage
bash scripts/install-sage.sh
```

## What the scanner catches

- Unpinned specs (`^` `~` `*` `latest`, missing versions) in `package.json`,
  npm scripts, MCP configs (`.mcp.json`, `.claude/settings.json`,
  `.cursor/mcp.json`), and GitHub Actions
- Injector markers (`global['!']`, `_$_1e42`, `_$_ccfc`, `_$af163278`,
  `'9-343'`, `'8-2914-2'`, `'A4-1928'`)
- Oversized config files **with** a 200+ char whitespace run (the real
  injection signature — size alone is only a warning)
- Compromised package versions in npm / pnpm / yarn / bun lockfiles
  (`mgc@1.2.1-1.2.4`, `axios@1.12.3`)
- Blockchain-C2 host / wallet references in source (the RAT loader signature)
- `setup.cjs` droppers, `.bat` entries in `.gitignore`
- Missing lockfile, `npm install` instead of `npm ci`, missing `save-exact`

## Install as a Claude Code skill

```bash
cp -r . ~/.claude/skills/pin-guard      # or into a repo's .claude/skills/
```

Then add to your `CLAUDE.md` so every session scans before building:

```
Before working in any JS/TS repo, run:
  python3 ~/.claude/skills/pin-guard/scripts/scan.py .
Stop on any ioc-* finding. Never npx @latest; pin all versions.
```

## Defense in depth

| Layer | Tool | Catches |
|---|---|---|
| Pre-flight | `CLAUDE.md` rule | Claude scans before touching a repo |
| Pre-commit | `install-hook.sh` | git blocks infected commits |
| Pre-install | `verify.py` | bad package before it lands |
| Static | `scan.py` | markers, configs, lockfiles, C2 refs |
| Pinning | `pin.py` | removes unpinned-version risk |
| Runtime | Sage | intercepts tool calls at execution |

## Layout

```
scripts/      scan.py  pin.py  verify.py  install-hook.sh  install-sage.sh
iocs.json     indicators of compromise (update as new attacks land)
SKILL.md      Claude Code skill manifest
docs/         INCIDENT-REPORT  TEAM-COMPROMISE-CHECK  ROTATION-PLAN  KNOWLEDGE-BASE
forensics/    deobfuscated-analysis.txt  (inert — analysis output, not runnable malware)
```

## For the team

If you ever built a potentially affected repo, run the self-check in
[`docs/TEAM-COMPROMISE-CHECK.md`](docs/TEAM-COMPROMISE-CHECK.md) and rotate
credentials per [`docs/ROTATION-PLAN.md`](docs/ROTATION-PLAN.md).

## Rules

1. Exact versions everywhere. Ranges trust future publishers.
2. Never `npx pkg@latest`. Pin `pkg@x.y.z`.
3. New package? `verify.py` first, then `npm install --save-exact`.
4. CI uses `npm ci`, never `npm install`.
5. Updates are deliberate, in a reviewed PR — not implicit at install time.
6. Sage installed in every Claude Code environment.
