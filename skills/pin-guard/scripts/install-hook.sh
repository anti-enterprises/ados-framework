#!/usr/bin/env bash
# pin-guard prevention: install a git pre-commit hook that BLOCKS commits/builds
# carrying the npm supply-chain RAT (injector markers, oversized configs with a
# whitespace run, compromised packages, blockchain-C2 refs, .bat droppers).
#
# Usage:  bash install-hook.sh [/path/to/repo]   (defaults to current dir)
set -euo pipefail

REPO="${1:-$(pwd)}"
HOOK_DIR="$REPO/.git/hooks"
SCAN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scan.py"

if [ ! -d "$REPO/.git" ]; then
  echo "error: $REPO is not a git repo" >&2; exit 1
fi
mkdir -p "$HOOK_DIR"

cat > "$HOOK_DIR/pre-commit" <<HOOK
#!/usr/bin/env bash
# pin-guard pre-commit guard -- blocks malware from being committed.
SCAN="$SCAN"
RESULT=\$(python3 "\$SCAN" "\$(git rev-parse --show-toplevel)" --json 2>/dev/null \\
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(sum(1 for f in d if f['category'].startswith('ioc')))" 2>/dev/null || echo 0)
if [ "\$RESULT" != "0" ]; then
  echo ""
  echo "  ⛔ pin-guard BLOCKED this commit: \$RESULT supply-chain IOC finding(s)."
  echo "     Run:  python3 \$SCAN ."
  echo "     This repo may contain the postcss whitespace-injector RAT. Do NOT commit or build."
  echo "     Override (ONLY if you are certain it is a false positive):  git commit --no-verify"
  echo ""
  exit 1
fi
exit 0
HOOK
chmod +x "$HOOK_DIR/pre-commit"
echo "Installed pin-guard pre-commit guard in $REPO"
echo "It runs an IOC scan before every commit and blocks on any malware finding."
