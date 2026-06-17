# Compromise Check

Run this if you have cloned, built, or run any JavaScript/TypeScript project
that may have carried the npm whitespace-injector / blockchain dead-drop RAT.

## What to know (30 seconds)

Malware can hide in a build config file (e.g. `postcss.config.mjs`) behind
thousands of spaces, so it's invisible in editors and git diffs. When the project
builds, it runs as your user with full privileges. It is a **blockchain dead-drop
RAT loader**: it reads commands hidden in crypto transactions (TRON -> BSC ->
Aptos fallback), decodes them, and runs them via `node -e`. It can read every
`.env`, browser passwords, SSH keys, npm/cloud tokens, and drain crypto wallets.

If you built an affected project, **assume your local secrets are exposed** and
rotate them (see `ROTATION-PLAN.md`).

## Option A — paste this prompt into Claude Code

Open Claude Code in your home directory and paste the whole block:

```
You are doing an incident-response compromise check on my machine for a known npm
supply-chain RAT (the "postcss whitespace-injector / blockchain dead-drop loader").
Be systematic, read-only unless I approve a fix. Report CLEAN or COMPROMISED per
check:

1. MARKERS: grep my code dirs (skip node_modules/.git) in .js/.mjs/.cjs/.ts for:
   global['!']   _$_1e42   _$_ccfc   _$af163278   'A4-1928'   '9-343'   '8-2914-2'
2. WHITESPACE SIGNATURE: find *.config.{js,mjs,ts} with a line of 200+ spaces/tabs
   then code: grep -rlE "[ \t]{200,}\S" ~ --include="*.config.*" | grep -v node_modules
3. OVERSIZED CONFIGS: any postcss/next/vue/eslint/jest/astro config > 4KB.
4. DROPPERS: setup.cjs at a repo root; .gitignore lines ending in .bat that look
   auto-generated (e.g. config.bat / temp_*_push.bat).
5. BLOCKCHAIN C2: grep for api.trongrid.io  bsc-dataseed  eth_getTransactionByHash
   aptoslabs.com  only_from=true  (any hit inside a config = infected).
6. RAT EXEC: grep for child_process + spawn + ('node','-e') in config files.
7. LOCKFILES: search package-lock.json / pnpm-lock.yaml / yarn.lock / bun.lock for
   mgc@1.2.1-1.2.4 and axios@1.12.3.
8. BUILD ARTIFACTS: if infected source found, check .next/ dist/ build/ for the
   same markers (proves it executed).
9. SECRET INVENTORY: list every .env and .env.local under my home (skip
   node_modules); print only KEY NAMES, never values. This is my rotation surface.
10. GIT TRACE: for any infected repo run git log --oneline -- <file> to find the
    first bad commit + author.

Then: (a) CLEAN/COMPROMISED table, (b) if compromised, exact files to clean + the
rotation list from check 9, (c) don't modify anything until I say go.
```

## Option B — run these commands yourself (no Claude needed)

```bash
# 1. injector markers
grep -rlI "global\['\!'\]\|_\$_1e42\|_\$_ccfc\|_\$af163278" ~ 2>/dev/null | grep -v node_modules

# 2. whitespace-injection signature (the real tell)
grep -rlE "[ \t]{200,}\S" ~ --include="*.config.js" --include="*.config.mjs" --include="*.config.ts" 2>/dev/null | grep -v node_modules

# 3. blockchain C2 strings in your code
grep -rlI "api.trongrid.io\|bsc-dataseed\|eth_getTransactionByHash" ~ 2>/dev/null | grep -v node_modules

# 4. every .env on the machine (your rotation surface)
find ~ \( -name ".env" -o -name ".env.local" \) 2>/dev/null | grep -v node_modules
```

Every command printing nothing = clean. Any output = follow remediation.

## Or run the scanner

```bash
git clone <this-repo-url> pin-guard
cp -r pin-guard ~/.claude/skills/pin-guard
python3 ~/.claude/skills/pin-guard/scripts/scan.py /path/to/repo
```

## If you are COMPROMISED

1. Disconnect from the network if you suspect the RAT is live.
2. Clean the repo: restore the infected config, remove the `.bat` lines from
   `.gitignore`, delete `.next/` `dist/` `build/`.
3. Rotate every credential (see `ROTATION-PLAN.md`). Assume all were read.
4. Full malware scan. If the RAT ran, consider an OS reinstall (it can install
   persistence — the loader runs arbitrary commands).
5. Re-clone affected repos from a known-good commit (before the infected commit).
