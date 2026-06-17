---
title: "npm Supply-Chain Defense — Complete Knowledge Base"
type: reference
author: pin-guard
created: 2026-06-12
description: "Attack mechanics, IOC catalog, 2026 campaign list, detection signatures, prevention playbook, and lessons on building security tooling. Reference + training material."
tags:
  - security
  - supply-chain
  - npm
  - malware
  - reference
  - training
---

# npm Supply-Chain Defense — Complete Knowledge Base

Compiled from a real-world infection plus an adversarial stress test of the
pin-guard tool. Use it to recognize the attack, feed it to agents, and triage
the next incident.

## 1. The attack class: whitespace-injector credential stealer

A malicious npm package (or an unpinned `npx pkg@latest`) drops a payload into
a build config file. The signature trick: the payload is pushed far to the
right of a normal line using ~200-10,000 spaces, so it's invisible in editors
and git diffs unless you scroll right.

**Anatomy (real sample):**
```
export default config;<~10,000 spaces>global['!']='9-343';var _$_1e42=(...)
```
1. `var _$_1e42 = (decoder)("rmcej%otb%", 2857687)` — a seeded string-shuffle
   that decodes to `['require','object','module', ...]`.
2. `global[_$_1e42[0]] = require` — rebuilds `require` so the payload has full
   Node capability WITHOUT a visible `require()` call (evades static scanners).
3. `sfL['constructor']` — grabs the `Function` constructor (eval by another
   name) and builds executable code from more scrambled strings.
4. At build time the code runs as the user and harvests secrets.

**Capability — NOT limited to .env.** Once it has `require`, it runs as the
user account and can read anything that user can:
- `.env` / `.env.local` (loaded into the build env directly = highest-confidence theft)
- `~/.npmrc` (npm tokens), `~/.aws/credentials`, `~/.ssh/` keys
- git credential stores
- browser profile files: saved passwords, cookies, session tokens
- crypto wallet extension vaults (MetaMask etc.)
It can also make outbound network calls (exfiltration) and write files (droppers).

## 1b. Stage-2: blockchain dead-drop RAT loader (reverse-engineered)

The payload was fully decoded statically (no execution). Under the
obfuscation it is NOT a fixed stealer — it is a remote loader controlled via
crypto transactions:

1. GET the latest outbound tx of a TRON wallet
   (`api.trongrid.io/v1/accounts/<wallet>/transactions?only_confirmed=true&only_from=true&limit=1`),
   read its `data` field, **reverse the string** -> a BSC tx hash.
2. `eth_getTransactionByHash` on BSC (`bsc-dataseed.binance.org`) for that tx,
   read `input`. Aptos (`fullnode.mainnet.aptoslabs.com`) is the fallback.
3. Hex-decode -> a command -> run via `child_process.spawn('node',['-e',cmd])`,
   stdio ignored.

Why it matters: the C2 lives on-chain (untakedownable), and the capability is
unbounded — whatever the operator posts runs as the user. So "what did it
steal" is unanswerable from the binary; the correct posture is **full machine
compromise**. Attacker wallets: `TMfKQEd7TJJa5xNZJZ2Lep838vrzrs7mAP`,
`TXfxHUet9pJVU1BgVkBAbrES4YUc1nGzcG`. To check if a sample's C2 is live, query
the wallet's last outbound tx timestamp.

## 2. IOC catalog (detection signatures)

| Signature | What to grep | Why |
|---|---|---|
| Campaign markers | `global['!']`, `_$_1e42`, `A4-1928`, `9-343`, `_$_` | structural to this family |
| Oversized config | `*.config.{js,mjs,ts}` > 4KB | normal is 80-200 bytes |
| Whitespace run | `[ \t]{200,}\S` on one line | the actual injection signature (size alone = false positives) |
| Rebuilt require | `createRequire` added to a config that never needed it | attack scaffolding |
| Dropper files | `setup.cjs` at repo root | RAT dropper |
| Hidden droppers | `.bat` lines in `.gitignore` (`config.bat`, `temp_auto_push.bat`, `temp_interactive_push.bat`) | conceals dropped Windows payloads |
| Compromised pkgs | see campaign list below | known-bad versions |

**One-line machine sweep:**
```bash
grep -rlI "9-343\|A4-1928\|_\$_1e42\|global\['\!'\]" ~/Apps ~/Documents 2>/dev/null | grep -v node_modules
grep -rlE "[ ]{200,}\S" ~/Apps --include="*.config.*" 2>/dev/null | grep -v node_modules
```

## 3. Known 2026 npm supply-chain campaigns

| Date | Campaign | Detail |
|---|---|---|
| Mar 2026 | **axios** 1.12.3 | backdoored, WAVESHAPER.V2 RAT, North Korea cluster UNC1069 |
| Apr 2 2026 | **mgc** 1.2.1-1.2.4 | account takeover, `setup.cjs` dropper -> OS-specific RAT from GitHub Gist, UNC1069 |
| Apr 2026 | **Mini Shai-Hulud** | SAP-related packages, malicious preinstall scripts |
| May 28 2026 | **33+ typosquats** | steal cloud / CI-CD secrets |
| Jun 1 2026 | **Miasma worm** | 32 packages under `@redhat-cloud-services`, self-propagating |
| ongoing | **postcss whitespace injector** | the crypto/credential stealer in this report (markers 9-343, A4-1928) |

Attacker infra seen (this family): TRON wallets
`TMfKQEd7TJJa5xNZJZ2Lep838vrzrs7mAP`, `TXfxHUet9pJVU1BgVkBAbrES4YUc1nGzcG`;
IP `166.88.54.158`.

## 4. Anonymized incident (case study)

- **Vector:** a build config (`postcss.config.mjs`) in a production Next.js repo.
- **Timeline:** payload introduced in a routine "additional updates" commit,
  ~3 months before discovery; it reached `main` inside a normal onboarding PR,
  so the diff looked benign.
- **Confirmed executed:** the payload compiled into `.next/build/chunks/`.
- **Blast radius:** 1 repo infected; ~20 secrets in its `.env` directly exposed;
  every `.env` on the build machine reachable (conservative exposure).
- **Detection:** found by an IOC scan. An earlier manual check MISSED it because
  it grepped only one campaign id (`A4-1928`) while the sample used `9-343`.
  Lesson: match on STRUCTURE (`global['!']`, the whitespace run), not a single
  hardcoded id.

## 5. Lessons from building the defense tool (pin-guard)

A 7-agent adversarial stress test found ~20 issues in the FIRST version of our
own security tool. The meta-lesson: a security tool is itself an attack surface
and a correctness-critical artifact. What broke:

- **Argument injection (the irony bug):** a dependency named
  `--registry=evil.com` in a hostile package.json got passed to `npm view` as a
  flag. Fix: validate names against npm naming regex + use `--` separator.
- **The `@latest` bypass:** `verify.py pkg@latest` passed every check because a
  dist-TAG was treated as a literal version. A security tool that greenlights
  `@latest` is broken. Fix: resolve dist-tags to concrete versions first.
- **Crash = blind:** non-dict JSON shapes crashed the scanner; an attacker
  could plant `[1]` as package.json to abort the scan. Fix: isinstance guards.
- **Lockfile blind spot:** compromised-version check only read
  package-lock.json; pnpm/yarn/bun repos scanned clean. Fix: text-match all
  lockfile formats.
- **False positives erode trust:** flagging a legit 5KB config as "wipe your
  machine" trains users to ignore the tool. Fix: require the whitespace-run
  signature, not size alone.

## 6. Prevention playbook (the rules)

1. **Exact versions everywhere.** No `^` `~` `*`. Ranges trust future publishers.
2. **Never `npx pkg@latest`.** Pin `pkg@x.y.z`. Every agent start re-rolls the dice.
3. **Verify before install:** `verify.py <pkg>` — checks release age (<7d cooldown),
   silence-gap takeover pattern, install scripts, known-bad list.
4. **CI uses `npm ci`,** never `npm install`. Require a lockfile.
5. **Consider `ignore-scripts=true`** in `.npmrc` (blocks install droppers; breaks
   esbuild/sharp — team call).
6. **Runtime layer:** install Sage (intercepts tool calls). Static (pin-guard) +
   runtime (Sage) together.
7. **Pin Sage itself** to a commit — don't `@latest` your security tool.

## 7. Incident response checklist (next time)

1. Confirm with the structural sweep (section 2). Don't trust a single marker.
2. Quarantine infected files for forensics BEFORE cleaning.
3. Trace first infected commit (`git log -- <file>`, find last clean) + author.
4. Clean: restore config, scrub `.gitignore`, delete build output (`.next`/`dist`).
5. Verify clean with pin-guard IOC scan.
6. **Rotate credentials** — assume everything on the build machine is exposed,
   money + auth + database first.
7. Identify every machine that built the project; AV-scan + credential-reset them.
8. Pause the committing dev's git/npm access until their machine is cleared.
9. Notify the team. Redeploy production from the cleaned tree.

## Related

- `../README.md`
- `INCIDENT-REPORT.md`
- `TEAM-COMPROMISE-CHECK.md`
- `ROTATION-PLAN.md`
