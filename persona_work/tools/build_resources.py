#!/usr/bin/env python3
"""Step 7 support: build the resource-mapping table (table 3) from hfa_png/out.

Sprite name shape:  [s_]<char>_<outfit>_<i3>_<i4>_<variant>[.mzp].png
  char    aok / ari / kin / (sou, tou, tob, ...)
  outfit  n=uniform  a=cap'n'jacket  l=long casual  m=casual  s=suit
  i3      body / framing / prop index
  i4      EXPRESSION index  -> shared slot vocabulary
  variant pose micro-variation (several candidates per expression)

i4 -> slot mapping distilled from the visual catalog (see catalog/*.md).
"""
import json
import os
import re
from collections import defaultdict

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTD = r"D:\QuickLook插件包\moye\persona_work\agg"
os.makedirs(OUTD, exist_ok=True)

I4_SLOT = {
    1: "neutral", 2: "neutral", 3: "smile", 4: "smile", 5: "laugh", 6: "laugh",
    7: "angry", 8: "serious", 9: "glare", 10: "surprised", 11: "surprised",
    12: "neutral", 13: "think", 14: "smile", 15: "smile", 16: "shy",
    17: "smile", 18: "serious", 19: "troubled", 20: "troubled", 21: "neutral",
    22: "sad", 23: "sad", 24: "think", 25: "think", 26: "neutral",
    27: "troubled", 28: "serious",
}
OUTFIT_NAME = {"n": "uniform", "a": "cap_jacket", "l": "casual_long",
               "m": "casual_mid", "s": "suit"}
CHARS = ["aok", "ari", "kin", "koj", "sou", "tou", "tob", "rit", "beo", "eir",
         "yui", "rid"]


def scan():
    """-> {char: {outfit: {i3: {i4: [relpath, ...]}}}}"""
    tree = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list))))
    exts = {}
    for dirpath, _dirs, files in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT).replace("\\", "/")
        for fn in files:
            if not fn.endswith(".mzp.png"):
                continue
            stem = fn[: -len(".mzp.png")]
            if stem.endswith("_b"):
                continue
            p = stem.split("_")
            if len(p) != 5:
                continue
            ch, of, i3, i4, var = p
            if ch not in CHARS or not (i3.isdigit() and i4.isdigit() and var.isdigit()):
                continue
            tree[ch][of][int(i3)][int(i4)].append(rel + "/" + fn)
            exts.setdefault((ch, of, int(i4)), set()).add(int(var))
    return tree


def main():
    tree = scan()
    out = {}
    for ch in CHARS:
        if ch not in tree:
            continue
        out[ch] = {}
        for of in sorted(tree[ch]):
            out[ch][OUTFIT_NAME.get(of, of)] = {}
            for i3 in sorted(tree[ch][of]):
                slots = defaultdict(list)
                for i4 in sorted(tree[ch][of][i3]):
                    slot = I4_SLOT.get(i4, "unknown")
                    slots[slot].extend(sorted(tree[ch][of][i3][i4]))
                out[ch][OUTFIT_NAME.get(of, of)][str(i3)] = {
                    "i4_seen": sorted(tree[ch][of][i3]),
                    "slots": {k: v for k, v in sorted(slots.items())},
                }
    with open(os.path.join(OUTD, "resource_map.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)

    L = ["=== per-character slot coverage ==="]
    for ch in ["aok", "ari", "kin"]:
        if ch not in out:
            continue
        cov = defaultdict(lambda: defaultdict(int))
        for of, poses in out[ch].items():
            for i3, d in poses.items():
                for slot, files in d["slots"].items():
                    cov[slot][of] += len(files)
        L.append("--- %s ---" % ch)
        for slot in sorted(cov):
            L.append("   %-10s %s" % (slot, dict(cov[slot])))
    rep = "\n".join(L)
    with open(os.path.join(OUTD, "resource_report.txt"), "w", encoding="utf-8") as fh:
        fh.write(rep + "\n")
    print(rep)


if __name__ == "__main__":
    main()
