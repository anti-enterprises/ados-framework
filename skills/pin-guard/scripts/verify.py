#!/usr/bin/env python3
"""pin-guard verify -- pre-install gate for a single package.

Usage:
    python3 verify.py <package>[@version]

Checks BEFORE you ever npm-install or npx a package:
  1. Known-compromised versions (iocs.json)
  2. Release age of the target version (takeover payloads are usually caught within days)
  3. Gap since previous release (sudden release after long silence = takeover pattern)
  4. Install scripts (preinstall/install/postinstall = code execution at install time)
  5. Maintainer count and repo link presence

Exit codes: 0 = pass, 1 = warnings, 2 = BLOCK (known compromised), 3 = usage/registry error.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

COOLDOWN_DAYS = 7
SILENCE_DAYS = 180
# npm package naming rules -- reject anything that could be smuggled as an npm flag
VALID_PKG_RE = re.compile(r"^(@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$")
EXACT_RE = re.compile(r"^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$")


def safe_name(name):
    """Block argument injection: a dep name like '--registry=evil' must never reach npm."""
    return bool(VALID_PKG_RE.match(name)) and not name.startswith("-")


def npm_view(name, field=None):
    if not safe_name(name):
        return None
    # '--json' before '--' so npm keeps JSON output; '--' forces name to be positional, never a flag
    cmd = ["npm", "view", "--json", "--", name] + ([field] if field else [])
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if out.returncode != 0 or not out.stdout.strip():
            return None
        return json.loads(out.stdout)
    except FileNotFoundError:
        return "NO_NPM"
    except Exception:
        return None


def parse_iso(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(3)
    token = sys.argv[1]
    at = token.rfind("@")
    if at > 0:
        name, want = token[:at], token[at + 1:]
    else:
        name, want = token, None

    if not safe_name(name):
        print(f"BLOCK? '{name}' is not a valid npm package name "
              "(possible argument-injection attempt). Refusing to query npm.")
        sys.exit(3)

    iocs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "iocs.json")
    iocs = json.loads(open(iocs_path, encoding="utf-8").read())

    meta = npm_view(name)
    if meta == "NO_NPM":
        print("ERROR: npm is not installed / not on PATH. Install Node.js from https://nodejs.org")
        sys.exit(3)
    if meta is None:
        print(f"BLOCK? could not fetch registry metadata for '{name}'. "
              "Package may not exist (typosquat check!) or registry unreachable.")
        sys.exit(3)

    dist_tags = meta.get("dist-tags", {}) or {}
    # Resolve dist-tags (latest/beta/canary) to a concrete version -- a tag is NOT a version.
    if want is None:
        version = dist_tags.get("latest") or meta.get("version")
    elif EXACT_RE.match(want):
        version = want
    elif want in dist_tags:
        version = dist_tags[want]
    else:
        version = want  # validated below against the real version list

    times = meta.get("time", {})
    issues, blocks = [], []

    # 1. known compromised -- authoritative even if the registry has since yanked the version
    bad = iocs["compromised_packages"].get(name)
    if bad and version in bad["bad_versions"]:
        print(f"  [BLOCK] {name}@{version} is a KNOWN COMPROMISED version. {bad['detail']}")
        print("\nDO NOT INSTALL.")
        sys.exit(2)

    # Reject nonexistent versions instead of silently passing them.
    known_versions = [v for v in times if v not in ("created", "modified")]
    if version not in known_versions:
        print(f"BLOCK? {name}@{version} does not exist in the registry "
              f"(latest is {dist_tags.get('latest', '?')}). Typo or supply-chain bait.")
        sys.exit(3)

    if bad:
        if version in bad["bad_versions"]:
            blocks.append(f"{name}@{version} is a KNOWN COMPROMISED version. {bad['detail']}")
        else:
            issues.append(f"package '{name}' had compromised versions "
                          f"({', '.join(bad['bad_versions'])}) -- {version} is not one of them, "
                          "but treat with extra care.")

    # 2. release age
    published = parse_iso(times.get(version, ""))
    now = datetime.now(timezone.utc)
    if published:
        age = (now - published).days
        if age < COOLDOWN_DAYS:
            issues.append(f"{name}@{version} published {age} day(s) ago "
                          f"(< {COOLDOWN_DAYS}d cooldown). Hijacked versions are usually "
                          "caught within days -- wait or pin the previous version.")
    # 3. silence gap before this release
    releases = sorted((parse_iso(t), v) for v, t in times.items()
                      if v not in ("created", "modified") and parse_iso(t))
    versions_sorted = [v for _, v in releases]
    if version in versions_sorted:
        idx = versions_sorted.index(version)
        if idx > 0:
            gap = (releases[idx][0] - releases[idx - 1][0]).days
            if gap > SILENCE_DAYS:
                issues.append(f"{version} came after {gap} days of silence "
                              f"(previous: {versions_sorted[idx - 1]}). "
                              "Sudden release after long inactivity is a takeover pattern.")

    # 4. install scripts
    scripts = meta.get("scripts") or {}
    hooks = [k for k in ("preinstall", "install", "postinstall") if k in scripts]
    if hooks:
        issues.append(f"declares install-time script(s): {', '.join(hooks)} -- "
                      "code executes on install. Read them before installing, "
                      "or install with --ignore-scripts.")

    # 5. metadata sanity
    if not meta.get("repository"):
        issues.append("no repository link in package metadata.")
    maintainers = meta.get("maintainers") or []
    if len(maintainers) == 1:
        issues.append("single maintainer -- account takeover affects all versions at once.")

    print(f"pin-guard verify: {name}@{version}")
    if published:
        print(f"  published : {times.get(version)}  ({(now - published).days}d ago)")
    print(f"  releases  : {len(versions_sorted)} total, maintainers: {len(maintainers)}")
    print()
    if blocks:
        for b in blocks:
            print(f"  [BLOCK] {b}")
        print("\nDO NOT INSTALL.")
        sys.exit(2)
    if issues:
        for i in issues:
            print(f"  [WARN]  {i}")
        print(f"\nReview warnings, then pin exactly:  npm install --save-exact {name}@{version}")
        sys.exit(1)
    print(f"  PASS. Pin exactly:  npm install --save-exact {name}@{version}")
    sys.exit(0)


if __name__ == "__main__":
    main()
