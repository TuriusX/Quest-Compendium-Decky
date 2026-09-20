#!/usr/bin/env python3
"""Build the install-ready plugin zip that Decky's "Install Plugin from URL/ZIP" expects.

Run after `pnpm run build` (or just `pnpm run package`, which does both).
Output: out/quest-compendium-decky.zip  ->  "Quest Compendium/{dist/index.js, main.py, plugin.json, package.json, LICENSE, README.md}"
The filename is fixed (no version) so GitHub's  releases/latest/download/quest-compendium-decky.zip  URL never changes.
"""
import json, os, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ["dist/index.js", "main.py", "plugin.json", "package.json", "LICENSE", "README.md"]
FOLDER = "Quest Compendium"

missing = [f for f in FILES if not os.path.isfile(os.path.join(ROOT, f))]
if missing:
    sys.exit(f"Missing files: {missing}. Run `pnpm run build` first.")

version = json.load(open(os.path.join(ROOT, "package.json")))["version"]
os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
target = os.path.join(ROOT, "out", "quest-compendium-decky.zip")
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
    for rel in FILES:
        z.write(os.path.join(ROOT, rel), f"{FOLDER}/{rel}")
print(f"Built {target} (v{version}, {os.path.getsize(target)} bytes)")
