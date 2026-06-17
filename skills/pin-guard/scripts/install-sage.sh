#!/usr/bin/env bash
# pin-guard companion: install Sage (Gen Digital's Agent Detection & Response plugin).
# Sage is the RUNTIME layer: it intercepts tool calls (shell, URL fetches, file ops)
# before execution -- URL reputation, 300+ local threat patterns, prompt-injection
# defense, and npm/PyPI supply-chain checks (registry, file reputation, age analysis).
# pin-guard is the STATIC layer: pinned versions + IOC scan. You want both.
set -euo pipefail

# Requires Node.js -- install from https://nodejs.org if needed
node --version

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI not found. Install Claude Code first: https://claude.com/claude-code" >&2
  exit 1
fi

claude plugin marketplace add https://github.com/gendigitalinc/sage.git
claude plugin install sage@sage

echo
echo "Sage installed. Restart Claude Code to activate (it scans plugins at session start)."
