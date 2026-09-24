#!/usr/bin/env python3
"""Step 7: resolve verified slot labels into concrete sprite files (table 3).

Input:
  persona_work/catalog/slots_vision_B.txt   aok_casual_a/l/m, aok_suit, ari_casual_a
  persona_work/catalog/slots_kin.txt        kin_casual_a/l/m, kin_suit
  persona_work/catalog/slots_aok_casual.txt (optional, produced in parallel)
  persona_work/catalog/slots_ari.txt         (optional)
  plus a hand-written ground-truth block for aok_uniform / ari_uniform /
  kin_uniform / ari_casual_l / ari_casual_m / ari_suit kept in
  persona_work/catalog/slots_manual.txt

Output:
  persona_work/agg/slot_sprites.json   {char: {outfit: {slot: [paths]}}}
  persona_work/agg/slot_sprites.txt    human-readable
"""
import json
import os
import re
from collections import defaultdict

BASE = r"D:\QuickLook插件包\moye\persona_work"
CAT = os.path.join(BASE, "catalog")
AGG = os.path.join(BASE, "agg")
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTFIT = {"uniform": "n", "cap_jacket": "a", "casual_long": "l",
          "casual_mid": "m", "suit": "s",
          # short aliases used in the hand-written catalog
          "casual_a": "a", "casual_l": "l", "casual_m": "m"}
LEADS = ["aok", "ari", "koj", "kin", "kanomi"]

# ---------- 1. index every sprite ----------
idx = defaultdict(list)
for dirpath, _d, files in os.walk(ROOT):
    rel = os.path.relpath(dirpath, ROOT).replace("\\", "/")
    for fn in files:
        if not fn.endswith(".mzp.png") or fn.endswith("_b.mzp.png"):
            continue
        p = fn[: -len(".mzp.png")].split("_")
        if len(p) != 5 or p[0] not in LEADS:
            continue
        ch, of, i3, i4, var = p
        if not (i3.isdigit() and i4.isdigit() and var.isdigit()):
            continue
        idx[(ch, of, int(i3), int(i4))].append(rel + "/" + fn)
for k in idx:
    idx[k].sort()

# ---------- 2. parse the catalogs ----------
rows = []          # (sheet, i3, i4, slot, note)
for fn in ("slots_vision_B.txt", "slots_kin.txt", "slots_aok_casual.txt",
           "slots_ari.txt", "slots_manual.txt"):
    p = os.path.join(CAT, fn)
    if not os.path.exists(p):
        continue
    with open(p, encoding="utf-8") as fh:
        for ln in fh:
            ln = ln.strip()
            if not re.match(r"^#(X|\d+)\|", ln):
                continue
            f = ln.split("|")
            d = {}
            for part in f[1:]:
                if "=" in part:
                    k, v = part.split("=", 1)
                    d[k.strip()] = v.strip()
            if not all(k in d for k in ("sheet", "i3", "i4", "slot")):
                continue
            rows.append((d["sheet"], int(d["i3"]), int(d["i4"]), d["slot"],
                         d.get("備考", "")))
print("catalog rows parsed:", len(rows))

# ---------- 3. resolve ----------
res = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
unresolved = []
for sheet, i3, i4, slot, note in rows:
    m = re.match(r"^(aok|ari|koj|kanomi|kin)_(.+)$", sheet)
    if not m:
        unresolved.append((sheet, i3, i4, slot, "bad sheet name"))
        continue
    ch, ofname = m.group(1), m.group(2)
    of = OUTFIT.get(ofname, ofname)
    prim = slot.split("/")[0].strip().strip("?")
    if not prim or prim == "":
        continue
    files = idx.get((ch, of, i3, i4), [])
    if not files:
        unresolved.append((sheet, i3, i4, slot, "no files"))
        continue
    res[ch][ofname][prim].extend(files)

report = []
for ch in LEADS:
    if ch not in res:
        continue
    report.append("=" * 60)
    report.append("CHAR %s" % ch)
    for of in sorted(res[ch]):
        report.append("  -- outfit %s --" % of)
        for slot in sorted(res[ch][of]):
            files = sorted(set(res[ch][of][slot]))
            report.append("     %-10s x%-3d  e.g. %s" % (slot, len(files), files[0]))
out = {ch: {of: {s: sorted(set(v)) for s, v in slots.items()}
            for of, slots in ofs.items()} for ch, ofs in res.items()}
with open(os.path.join(AGG, "slot_sprites.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
with open(os.path.join(AGG, "slot_sprites.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(report) + "\n")
print("\n".join(report))
if unresolved:
    print("\nUNRESOLVED (%d):" % len(unresolved))
    for u in unresolved[:20]:
        print("  ", u)
