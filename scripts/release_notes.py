#!/usr/bin/env python3
"""Print the GitHub release notes for a version: its section of CHANGELOG.md, with the wrapped lines joined (GitHub
keeps line breaks in release notes), and a "Full Changelog" link from the previous release tag.

    python3 scripts/release_notes.py 0.15.2 > out/release-notes.md

Exits with an error when CHANGELOG.md has no "## <version>" section, so a release never goes out without its notes.
Used by .github/workflows/release.yml.
"""
import os, re, subprocess, sys

# The checkout being released: the current folder (the workflow can run this script from elsewhere), else this repo.
ROOT = os.getcwd() if os.path.exists("CHANGELOG.md") else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = "https://github.com/TuriusX/Quest-Compendium-Decky"


def version_tuple(v):
    m = re.match(r"^v?(\d+)\.(\d+)(?:\.(\d+))?$", v.strip())
    return tuple(int(x or 0) for x in m.groups()) if m else None


def section(version):
    lines = open(os.path.join(ROOT, "CHANGELOG.md"), encoding="utf-8").read().splitlines()
    out, on = [], False
    for line in lines:
        if line.startswith("## "):
            if on:
                break
            on = line[3:].strip() == version
            continue
        if on:
            # A wrapped line (indented) belongs to the line before it.
            if re.match(r"^  \S", line) and out and out[-1].strip():
                out[-1] += " " + line.strip()
            else:
                out.append(line)
    while out and not out[-1].strip():
        out.pop()
    while out and not out[0].strip():
        out.pop(0)
    return out if on or out else None


def previous_tag(version):
    """The newest v* tag older than this version (for the compare link), or None."""
    try:
        tags = subprocess.run(["git", "tag", "--list", "v*"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    except Exception:
        return None
    me = version_tuple(version)
    older = [t for t in tags if version_tuple(t) and me and version_tuple(t) < me]
    return max(older, key=version_tuple) if older else None


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: release_notes.py <version>")
    version = sys.argv[1].lstrip("v")
    body = section(version)
    if not body:
        sys.exit(f"CHANGELOG.md has no '## {version}' section: add the release notes there first.")
    prev = previous_tag(version)
    if prev:
        body += ["", f"**Full Changelog**: {REPO}/compare/{prev}...v{version}"]
    print("\n".join(body))


if __name__ == "__main__":
    main()
