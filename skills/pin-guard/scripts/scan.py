#!/usr/bin/env python3
"""pin-guard scan -- read-only audit of unpinned package versions + supply-chain IOCs.

Usage:
    python3 scan.py [repo_path] [--json] [--no-ioc]

Exit codes: 0 = clean, 1 = findings, 2 = usage error.
Zero dependencies (stdlib only) -- a supply-chain tool should not have a supply chain.
"""

import json
import os
import re
import sys

SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", ".turbo", "coverage", ".cache"}
EXACT_RE = re.compile(r"^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$")
# npx invocation: capture the package token after flags (flag values only via '=')
NPX_RE = re.compile(r"\bnpx\s+((?:-{1,2}[\w-]+(?:=\S+)?\s+)*)((?:@[\w.-]+/)?[A-Za-z0-9][\w.-]*(?:@[\w.^~*<>=-]+)?)")
NPM_GLOBAL_RE = re.compile(r"\bnpm\s+(?:install|i|add)\s+(?:-g|--global)\s+([@A-Za-z0-9._/=-]+)")
DEP_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "overrides", "resolutions"]
MCP_CONFIG_NAMES = {".mcp.json", "mcp.json", "claude_desktop_config.json"}

findings = []


def add(severity, category, path, detail, line=None):
    findings.append({
        "severity": severity, "category": category,
        "file": path, "line": line, "detail": detail,
    })


def is_pinned_spec(spec):
    """Exact semver only. Ranges, tags, wildcards, urls are unpinned."""
    return bool(EXACT_RE.match(spec.strip()))


def pkg_token_pinned(token):
    """npx token like name@1.2.3 / @scope/name@1.2.3 is pinned; bare name or @latest is not."""
    at = token.rfind("@")
    if at <= 0:  # no version part (rfind 0 means scoped pkg with no version)
        return False
    return is_pinned_spec(token[at + 1:])


def rel(path, root):
    return os.path.relpath(path, root)


def scan_package_json(path, root):
    try:
        data = json.loads(open(path, encoding="utf-8").read())
    except Exception as e:
        add("warn", "parse", rel(path, root), f"could not parse: {e}")
        return
    if not isinstance(data, dict):
        add("warn", "parse", rel(path, root), "package.json root is not an object")
        return
    for section in DEP_SECTIONS:
        sec = data.get(section)
        if not isinstance(sec, dict):
            continue
        for name, spec in sec.items():
            if not isinstance(spec, str):
                continue
            if spec.startswith(("file:", "link:", "workspace:")):
                continue  # local/workspace refs, not registry risk
            if spec.startswith(("git", "http", "github:")):
                add("high", "unpinned-dep", rel(path, root),
                    f"{section}.{name} = '{spec}' (git/url dependency, not auditable)")
            elif not is_pinned_spec(spec):
                add("high", "unpinned-dep", rel(path, root),
                    f"{section}.{name} = '{spec}' (not an exact version)")
    scripts = data.get("scripts")
    if not isinstance(scripts, dict):
        scripts = {}
    for script_name, cmd in scripts.items():
        if not isinstance(cmd, str):
            continue
        for m in NPX_RE.finditer(cmd):
            token = m.group(2)
            if not pkg_token_pinned(token):
                add("high", "unpinned-npx", rel(path, root),
                    f"scripts.{script_name}: npx {token} (no exact version)")
        for m in NPM_GLOBAL_RE.finditer(cmd):
            if not pkg_token_pinned(m.group(1)):
                add("high", "unpinned-global", rel(path, root),
                    f"scripts.{script_name}: npm -g {m.group(1)} (no exact version)")


def scan_mcp_config(path, root):
    try:
        data = json.loads(open(path, encoding="utf-8").read())
    except Exception:
        return
    if not isinstance(data, dict):
        return
    mcp = data.get("mcp") if isinstance(data.get("mcp"), dict) else {}
    servers = data.get("mcpServers") or mcp.get("servers") or {}
    if not isinstance(servers, dict):
        return
    for name, cfg in servers.items():
        if not isinstance(cfg, dict):
            continue
        cmd = cfg.get("command", "")
        args = cfg.get("args") if isinstance(cfg.get("args"), list) else []
        if "npx" not in os.path.basename(str(cmd)) and "npx" not in args[:1]:
            continue
        pkg = next((a for a in args if isinstance(a, str) and not a.startswith("-")), None)
        if pkg and not pkg_token_pinned(pkg):
            add("critical", "unpinned-mcp", rel(path, root),
                f"MCP server '{name}': npx {pkg} -- re-resolves on EVERY agent start. "
                f"This was the suspected entry point of the June 2026 incident.")


def scan_workflows(root):
    wf_dir = os.path.join(root, ".github", "workflows")
    if not os.path.isdir(wf_dir):
        return
    for fname in os.listdir(wf_dir):
        if not fname.endswith((".yml", ".yaml")):
            continue
        path = os.path.join(wf_dir, fname)
        try:
            lines = open(path, encoding="utf-8", errors="replace").read().splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            for m in NPX_RE.finditer(line):
                if not pkg_token_pinned(m.group(2)):
                    add("high", "unpinned-ci", rel(path, root),
                        f"npx {m.group(2)} (no exact version)", line=i)
            if re.search(r"\bnpm\s+install\b(?!.*--package-lock-only)", line) and "ci" not in line:
                add("warn", "ci-npm-install", rel(path, root),
                    "uses 'npm install' in CI -- use 'npm ci' for reproducible installs", line=i)


def scan_hygiene(root):
    npmrc = os.path.join(root, ".npmrc")
    content = open(npmrc, encoding="utf-8").read() if os.path.isfile(npmrc) else ""
    if "save-exact" not in content:
        add("warn", "npmrc", ".npmrc", "missing 'save-exact=true' -- future installs will add '^' ranges")
    if "ignore-scripts" not in content:
        add("info", "npmrc", ".npmrc",
            "consider 'ignore-scripts=true' (blocks install-time droppers; may break esbuild/sharp -- team decision)")
    if not any(os.path.exists(os.path.join(root, f)) for f in
               ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock")):
        if os.path.exists(os.path.join(root, "package.json")):
            add("critical", "no-lockfile", ".", "no lockfile found -- installs are completely non-reproducible")


def scan_iocs(root, iocs):
    cfg = iocs["config_injection"]
    markers = iocs["code_markers"]
    bad_pkgs = iocs["compromised_packages"]
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            path = os.path.join(dirpath, fname)
            # 1. oversized config files (whitespace injector) -- size is a hint, the long
            #    whitespace run is the real signature. Critical only when both are present.
            if fname in cfg["files"]:
                try:
                    size = os.path.getsize(path)
                except OSError:
                    continue
                if size > cfg["max_normal_bytes"]:
                    try:
                        text = open(path, encoding="utf-8", errors="replace").read()
                    except OSError:
                        text = ""
                    has_ws_run = bool(re.search(r"[ \t]{200,}\S", text))
                    if has_ws_run:
                        add("critical", "ioc-config-size", rel(path, root),
                            f"{size} bytes with a 200+ char whitespace run before code -- "
                            "whitespace-injector signature. Scroll right on the export line.")
                    else:
                        add("warn", "large-config", rel(path, root),
                            f"{size} bytes (normal ~80-200B) but no whitespace-run signature -- "
                            "likely a legit large config; confirm manually.")
            # 2. code markers + blockchain-C2 loader refs in js/mjs/cjs/ts
            if fname.endswith((".js", ".mjs", ".cjs", ".ts")):
                try:
                    text = open(path, encoding="utf-8", errors="replace").read()
                except OSError:
                    continue
                for marker in markers:
                    if marker in text:
                        add("critical", "ioc-marker", rel(path, root),
                            f"contains injector marker {marker!r}")
                # blockchain dead-drop loader: C2 host or attacker wallet in a non-blockchain file
                for host in iocs.get("c2_blockchain_hosts", []):
                    if host in text:
                        add("critical", "ioc-c2-host", rel(path, root),
                            f"references blockchain-C2 host {host!r} -- RAT loader signature")
                for w in iocs.get("wallets_tron", []):
                    if w in text:
                        add("critical", "ioc-c2-wallet", rel(path, root),
                            f"contains attacker C2 wallet {w!r}")
            # 3. dropper files
            if fname in iocs["dropper_files"] and "node_modules" not in path:
                add("critical", "ioc-dropper", rel(path, root),
                    "dropper filename match (setup.cjs at repo level)")
            # 4. compromised versions in lockfiles -- npm v2/v3, npm v1, AND pnpm/yarn/bun (text scan)
            if fname == "package-lock.json":
                try:
                    lock = json.loads(open(path, encoding="utf-8").read())
                except Exception:
                    continue
                entries = []
                for pkg_path, meta in (lock.get("packages") or {}).items():  # v2/v3
                    nm = pkg_path.split("node_modules/")[-1] if pkg_path else lock.get("name", "")
                    if isinstance(meta, dict):
                        entries.append((nm, meta.get("version")))
                for nm, meta in (lock.get("dependencies") or {}).items():     # v1
                    if isinstance(meta, dict):
                        entries.append((nm, meta.get("version")))
                for nm, ver in entries:
                    if nm in bad_pkgs and ver in bad_pkgs[nm]["bad_versions"]:
                        add("critical", "ioc-compromised-pkg", rel(path, root),
                            f"{nm}@{ver} is a KNOWN COMPROMISED version. {bad_pkgs[nm]['detail']}")
            elif fname in ("pnpm-lock.yaml", "yarn.lock", "bun.lock"):
                # non-JSON lockfiles: text-match each compromised name@version pair
                try:
                    text = open(path, encoding="utf-8", errors="replace").read()
                except OSError:
                    continue
                for nm, info in bad_pkgs.items():
                    for badver in info["bad_versions"]:
                        # match "name@1.2.3" (pnpm/yarn) or "name:\n  version: 1.2.3" loosely
                        if f"{nm}@{badver}" in text or re.search(
                                rf"(^|[/\s\"']){re.escape(nm)}[\"']?:\s*\n\s+version:?\s*[\"']?{re.escape(badver)}",
                                text, re.M):
                            add("critical", "ioc-compromised-pkg", rel(path, root),
                                f"{nm}@{badver} is a KNOWN COMPROMISED version. {info['detail']}")
    # 5. .gitignore markers
    gi = os.path.join(root, ".gitignore")
    if os.path.isfile(gi):
        for i, line in enumerate(open(gi, encoding="utf-8", errors="replace"), 1):
            if line.strip() in iocs["gitignore_markers"]:
                add("critical", "ioc-gitignore", ".gitignore",
                    f"'{line.strip()}' entry -- matches infection commit pattern (hides dropped .bat files)",
                    line=i)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    root = os.path.abspath(args[0] if args else ".")
    if not os.path.isdir(root):
        print(f"error: {root} is not a directory", file=sys.stderr)
        sys.exit(2)

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            path = os.path.join(dirpath, fname)
            if fname == "package.json":
                scan_package_json(path, root)
            elif fname in MCP_CONFIG_NAMES or (fname == "settings.json" and ".claude" in dirpath) \
                    or (fname == "mcp.json" and ".cursor" in dirpath):
                scan_mcp_config(path, root)
    scan_workflows(root)
    scan_hygiene(root)
    if "--no-ioc" not in flags:
        iocs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "iocs.json")
        scan_iocs(root, json.loads(open(iocs_path, encoding="utf-8").read()))

    if "--json" in flags:
        print(json.dumps(findings, indent=2))
    else:
        if not findings:
            print(f"pin-guard: CLEAN -- no unpinned versions or IOCs found in {root}")
        else:
            order = {"critical": 0, "high": 1, "warn": 2, "info": 3}
            findings.sort(key=lambda f: order.get(f["severity"], 9))
            print(f"pin-guard scan of {root} -- {len(findings)} finding(s)\n")
            for f in findings:
                loc = f["file"] + (f":{f['line']}" if f["line"] else "")
                print(f"[{f['severity'].upper():8}] {f['category']:22} {loc}")
                print(f"           {f['detail']}\n")
            crit = sum(1 for f in findings if f["severity"] == "critical")
            if crit:
                print(f"!! {crit} CRITICAL finding(s). If any are ioc-* : STOP, do not pin, "
                      "clean the machine and rotate credentials first.")
    # info-level findings are advisory only -- don't fail CI gates on them
    sys.exit(1 if any(f["severity"] != "info" for f in findings) else 0)


if __name__ == "__main__":
    main()
