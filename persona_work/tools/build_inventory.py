#!/usr/bin/env python3
"""Step 7 support: exact sprite inventory for the three leads.

Sprite name shape:  <char>_<outfit>_<i3>_<i4>_<variant>.mzp.png
  i3 = pose / framing / prop family
  i4 = expression family **within that pose** (NOT a global code -- verified
       visually; e.g. aok_n_02_02 is neutral while aok_n_02_09 is glare)
  variant = micro-variation; several candidates per expression

Emits one row per (char, outfit, i3, i4) with the full file list, plus a
per-expression count, so the slot assignment can be done per pose family.
Output: persona_work/agg/sprite_inventory.txt
"""
import os
from collections import defaultdict

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\agg\sprite_inventory.txt"
LEADS = ["aok", "ari", "kin"]

tree = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list))))
for dirpath, _d, files in os.walk(ROOT):
    rel = os.path.relpath(dirpath, ROOT).replace("\\", "/")
    for fn in files:
        if not fn.endswith(".mzp.png"):
            continue
        stem = fn[: -len(".mzp.png")]
        if stem.endswith("_b"):
            continue
        p = stem.split("_")
        if len(p) != 5 or p[0] not in LEADS:
            continue
        ch, of, i3, i4, var = p
        if not (i3.isdigit() and i4.isdigit() and var.isdigit()):
            continue
        tree[ch][of][int(i3)][int(i4)].append((int(var), rel + "/" + fn))

L = []
for ch in LEADS:
    L.append("=" * 72)
    L.append("CHAR %s" % ch)
    L.append("=" * 72)
    for of in sorted(tree[ch]):
        L.append("")
        L.append("--- outfit %s ---" % of)
        for i3 in sorted(tree[ch][of]):
            L.append("  i3=%02d   families=%s" % (
                i3, ",".join("%02d(%d)" % (k, len(v))
                             for k, v in sorted(tree[ch][of][i3].items()))))
            for i4 in sorted(tree[ch][of][i3]):
                files = [f for _v, f in sorted(tree[ch][of][i3][i4])]
                L.append("      i4=%02d x%-2d  %s" % (i4, len(files), files[0]))
                for f in files[1:]:
                    L.append("                 %s" % f)
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(L) + "\n")
print("\n".join(L[:120]))
print("...")
print("wrote", OUT, os.path.getsize(OUT), "bytes")
