# Case Study — npm Whitespace-Injector / Blockchain Dead-Drop RAT

A real-world supply-chain compromise, anonymized. Use this as a reference for
what the attack looks like and how to respond.

**Severity:** HIGH — credential-stealing remote-access malware that executed in
a production build.

## What it was

A malicious payload was hidden inside a build config file (`postcss.config.mjs`).
The visible line read `export default config;`, but it was padded with ~10,000
spaces, after which obfuscated code began — invisible in editors and in `git
diff` unless you scroll right. When the project builds, the code runs as the
user with full Node.js privileges.

- Campaign markers: `global['!']='9-343'` (and a second stacked variant
  `'8-2914-2'`).
- Mechanism: rebuilds `require` and the `Function` constructor from scrambled
  strings, so it executes without a visible `require()` call and evades static
  scanners.

## What it actually does (reverse-engineered, statically)

After decoding every obfuscation layer, the stage-2 payload is **not** a fixed
stealer — it is a **blockchain dead-drop RAT loader**:

1. Queries a TRON wallet's latest outbound transaction, reads its `data` field,
   and **reverses the string** to obtain a Binance Smart Chain (BSC) transaction
   hash.
2. Calls `eth_getTransactionByHash` on BSC for that tx, reads its `input`. An
   Aptos full-node endpoint is a fallback channel.
3. Hex-decodes the result into a command and runs it via
   `child_process.spawn('node', ['-e', cmd])`, stdio ignored (silent).

Implication: full remote code execution as the user, on demand, controlled
through crypto transactions that cannot be taken down. You **cannot bound the
damage from the code** — it runs whatever the operator posts on-chain. Treat any
machine that built the project as fully compromised.

Capability is unlimited: read any file the user can (`.env`, `~/.npmrc`,
`~/.aws`, `~/.ssh`, git credential stores, browser-saved passwords/cookies,
crypto-wallet vaults), exfiltrate over the network, and drop files.

## How it typically gets in

An unpinned dependency or an `npx <pkg>@latest` run pulls a hijacked package
version. The malicious version drops the payload into a build config. The poison
then rides into the main branch inside an otherwise-normal feature commit, so
the diff looks benign.

## Detection signatures

See [`KNOWLEDGE-BASE.md`](KNOWLEDGE-BASE.md) section 2 and `../iocs.json`. The
quick tells:
- A `*.config.{js,mjs,ts}` file far larger than normal (>4 KB vs ~80-200 bytes).
- A single line with 200+ consecutive spaces/tabs followed by code.
- Markers `global['!']`, `_$_1e42`, `_$_ccfc`, `_$af163278`.
- Blockchain-C2 references (`api.trongrid.io`, `bsc-dataseed`,
  `eth_getTransactionByHash`) or `child_process` + `node -e` inside a config.
- `setup.cjs` at a repo root; `.bat` entries in `.gitignore`.

## Remediation (recommended response)

1. Quarantine the infected files for forensics before changing anything.
2. Trace the first infected commit (`git log -- <file>`, find the last clean
   version) to identify the introducing change and the machine that ran it.
3. Restore the config to a clean minimal version; remove the malicious
   `.gitignore` entries; delete build output (`.next/`, `dist/`, `build/`) since
   it contains the compiled payload.
4. Re-scan to confirm clean.
5. **Rotate every credential** reachable on the affected build machine — see
   [`ROTATION-PLAN.md`](ROTATION-PLAN.md).
6. Identify and clean every machine that built the project; rotate their
   OS-level credentials too.

## Prevention going forward

- Pin every dependency to an exact version; never `npx pkg@latest`.
- Verify any new package before installing (`scripts/verify.py`).
- Install the pre-commit guard (`scripts/install-hook.sh`).
- Add a pre-flight scan to `CLAUDE.md` / CI so every build is scanned first.
- Install a runtime interception layer (Sage).
