#!/usr/bin/env python3
"""pin-guard pin -- rewrite unpinned specs to exact versions.

Usage:
    python3 pin.py [repo_path]                  # dry-run: show every change
    python3 pin.py [repo_path] --write          # apply changes
    python3 pin.py [repo_path] --min-age-days 7 # warn threshold for registry-resolved versions

Resolution order:
  1. lockfile version (what the team actually runs today)
  2. npm registry 'latest' (fallback, with release-age warning)

After --write, run:  npm install --package-lock-only && npm ci
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", ".turbo", "coverage", ".cache"}
EXACT_RE = re.compile(r"^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$")
VALID_PKG_RE = re.compile(r"^(@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$")
NPX_RE = re.compile(r"(\bnpx\s+(?:-{1,2}[\w-]+(?:=\S+)?\s+)*)((?:@[\w.-]+/)?[A-Za-z0-9][\w.-]*(?:@[\w.^~*<>=-]+)?)")
DEP_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"]
MCP_CONFIG_NAMES = {".mcp.json", "mcp.json", "claude_desktop_config.json"}

changes = []        # (file, description)
warnings = []
_registry_cache = {}


def is_exact(spec):
    return bool(EXACT_RE.match(spec.strip()))


def load_lockfile_versions(root):
    """name -> exact version from package-lock.json (v2/v3 or v1)."""
    versions = {}
    lock_path = os.path.join(root, "package-lock.json")
    if not os.path.exists(lock_path):
        return versions
    try:
        lock = json.loads(open(lock_path, encoding="utf-8").read())
    except Exception:
        return versions
    for pkg_path, meta in (lock.get("packages") or {}).items():
        if pkg_path.startswith("node_modules/") and pkg_path.count("node_modules/") == 1:
            versions[pkg_path[len("node_modules/"):]] = meta.get("version")
    for name, meta in (lock.get("dependencies") or {}).items():  # v1 fallback
        versions.setdefault(name, meta.get("version"))
    return versions


def npm_view(name, field):
    # Block argument injection: a dep name like '--registry=evil' must never reach npm.
    if not VALID_PKG_RE.match(name) or name.startswith("-"):
        return None
    key = (name, field)
    if key in _registry_cache:
        return _registry_cache[key]
    try:
        # '--json' before '--' so npm keeps JSON output; '--' forces name to be positional
        out = subprocess.run(["npm", "view", "--json", "--", name, field],
                             capture_output=True, text=True, timeout=30)
        val = json.loads(out.stdout) if out.returncode == 0 and out.stdout.strip() else None
    except Exception:
        val = None
    _registry_cache[key] = val
    return val


def resolve_version(name, lock_versions, min_age_days):
    """lockfile first, registry latest as fallback (with age check)."""
    v = lock_versions.get(name)
    if v and is_exact(v):
        return v, "lockfile"
    latest = npm_view(name, "version")
    if not latest:
        return None, None
    times = npm_view(name, "time") or {}
    published = times.get(latest)
    if published:
        try:
            dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - dt).days
            if age < min_age_days:
                warnings.append(
                    f"{name}@{latest} was published only {age} day(s) ago "
                    f"(< {min_age_days}d cooldown). Verify before trusting: "
                    f"python3 verify.py {name}@{latest}")
        except ValueError:
            pass
    return latest, "registry-latest"


def pin_token(token, lock_versions, min_age_days):
    """name or name@latest -> name@x.y.z (None if already pinned/unresolvable)."""
    at = token.rfind("@")
    if at > 0:
        name, spec = token[:at], token[at + 1:]
        if is_exact(spec):
            return None
    else:
        name = token
    version, source = resolve_version(name, lock_versions, min_age_days)
    return (f"{name}@{version}", source) if version else None


def pin_package_json(path, root, lock_versions, min_age_days, write):
    raw = open(path, encoding="utf-8").read()
    data = json.loads(raw)
    relpath = os.path.relpath(path, root)
    dirty = False
    for section in DEP_SECTIONS:
        for name, spec in list((data.get(section) or {}).items()):
            if not isinstance(spec, str) or is_exact(spec):
                continue
            if spec.startswith(("file:", "link:", "workspace:", "git", "http", "github:")):
                continue  # not pinnable from registry; scan.py reports these
            version, source = resolve_version(name, lock_versions, min_age_days)
            if version:
                changes.append((relpath, f"{section}.{name}: '{spec}' -> '{version}' ({source})"))
                data[section][name] = version
                dirty = True
            else:
                warnings.append(f"{relpath}: could not resolve {name} ('{spec}') -- left unchanged")
    for script_name, cmd in list((data.get("scripts") or {}).items()):
        if not isinstance(cmd, str):
            continue
        new_cmd, n = pin_npx_in_text(cmd, lock_versions, min_age_days)
        if n:
            changes.append((relpath, f"scripts.{script_name}: pinned {n} npx call(s)"))
            data["scripts"][script_name] = new_cmd
            dirty = True
    if dirty and write:
        indent = 2 if '\n  "' in raw else 4
        open(path, "w", encoding="utf-8").write(json.dumps(data, indent=indent) + "\n")


def pin_npx_in_text(text, lock_versions, min_age_days):
    count = 0

    def repl(m):
        nonlocal count
        result = pin_token(m.group(2), lock_versions, min_age_days)
        if result:
            count += 1
            return m.group(1) + result[0]
        return m.group(0)

    return NPX_RE.sub(repl, text), count


def pin_mcp_config(path, root, lock_versions, min_age_days, write):
    try:
        data = json.loads(open(path, encoding="utf-8").read())
    except Exception:
        return
    relpath = os.path.relpath(path, root)
    servers = data.get("mcpServers") or {}
    dirty = False
    for name, cfg in servers.items():
        if not isinstance(cfg, dict):
            continue
        args = cfg.get("args", []) or []
        if "npx" not in os.path.basename(str(cfg.get("command", ""))) and "npx" not in args[:1]:
            continue
        for i, a in enumerate(args):
            if isinstance(a, str) and not a.startswith("-") and a != "npx":
                result = pin_token(a, lock_versions, min_age_days)
                if result:
                    changes.append((relpath, f"MCP '{name}': '{a}' -> '{result[0]}' ({result[1]})"))
                    args[i] = result[0]
                    dirty = True
                break  # only the package token
    if dirty and write:
        open(path, "w", encoding="utf-8").write(json.dumps(data, indent=2) + "\n")


def harden_npmrc(root, write):
    path = os.path.join(root, ".npmrc")
    content = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    if "save-exact" not in content:
        changes.append((".npmrc", "add 'save-exact=true'"))
        if write:
            open(path, "a", encoding="utf-8").write(
                ("" if content.endswith("\n") or not content else "\n") + "save-exact=true\n")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    write = "--write" in sys.argv
    min_age_days = 7
    if "--min-age-days" in sys.argv:
        min_age_days = int(sys.argv[sys.argv.index("--min-age-days") + 1])
    root = os.path.abspath(args[0] if args else ".")

    lock_versions = load_lockfile_versions(root)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            path = os.path.join(dirpath, fname)
            if fname == "package.json":
                pin_package_json(path, root, lock_versions, min_age_days, write)
            elif fname in MCP_CONFIG_NAMES or (fname == "settings.json" and ".claude" in dirpath) \
                    or (fname == "mcp.json" and ".cursor" in dirpath):
                pin_mcp_config(path, root, lock_versions, min_age_days, write)
    harden_npmrc(root, write)

    mode = "APPLIED" if write else "DRY-RUN (use --write to apply)"
    print(f"pin-guard pin -- {mode}\n")
    if not changes:
        print("Nothing to pin. All specs already exact.")
    for f, desc in changes:
        print(f"  {f}: {desc}")
    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(f"  ! {w}")
    if write and changes:
        print("\nNow run:  npm install --package-lock-only && npm ci")
        print("If MCP configs changed: restart Claude Code / Cursor (running agents keep the old command).")


if __name__ == "__main__":
    main()
