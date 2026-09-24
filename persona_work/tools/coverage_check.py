# -*- coding: utf-8 -*-
"""
coverage_check.py —— 皮肤现在用的 157 张立绘，各自有没有**本家合成图**、有没有配对的 `_b` 身体层。

角色 -> 目录对：
  aok: 2100/2105   ari: 2110/2115   koj: 2150/2155   sou: 2180/2185  ...
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")

PAIRS = {
    "aok": ("data02100", "data02105"),
    "ari": ("data02110", "data02115"),
    "beo": ("data02120", "data02125"),
    "eir": ("data02130", "data02135"),
    "kin": ("data02140", "data02145"),
    "koj": ("data02150", "data02155"),
    "rid": ("data02160", "data02165"),
    "rit": ("data02170", "data02175"),
    "sou": ("data02180", "data02185"),
    "tob": ("data02190", "data02195"),
    "tou": ("data02210", "data02215"),
    "yam": ("data02220", "data02225"),
    "yui": ("data02230", "data02235"),
}
INDEX = {}
for ch, (parts, comp) in PAIRS.items():
    pd, cd = os.path.join(OUT, parts), os.path.join(OUT, comp)
    INDEX[ch] = {
        "faces": set(os.listdir(pd)) if os.path.isdir(pd) else set(),
        "comps": set(os.listdir(cd)) if os.path.isdir(cd) else set(),
    }

mani = json.load(open(os.path.join(ROOT, "skin", "data", "manifest.json"), encoding="utf-8"))
sprite_dir = os.path.join(ROOT, "skin", "assets", "sprite")
shipped = sorted(os.listdir(sprite_dir))
print(f"皮肤随包立绘: {len(shipped)} 张\n")

rows = []
for f in shipped:
    stem = f[:-len(".mzp.png")] if f.endswith(".mzp.png") else f
    ch = stem.split("_")[0]
    info = INDEX.get(ch)
    if not info:
        rows.append((f, "?", "?", "?"))
        continue
    face = stem + ".mzp.png"
    has_face = face in info["faces"]
    comp = sorted(c for c in info["comps"] if c.startswith(stem + "_"))
    parts = stem.split("_")
    body_name = "_".join(parts[:4] + ["00", "b"]) + ".mzp.png"
    has_body = body_name in info["faces"]
    rows.append((f, "有脸" if has_face else "缺脸", f"{len(comp)}张合成",
                 ("有身体 " + body_name) if has_body else "缺身体 " + body_name))

n_comp = sum(1 for r in rows if not r[2].startswith("0"))
n_body = sum(1 for r in rows if r[3].startswith("有身体"))
print(f"有本家合成图: {n_comp}/{len(rows)}    有同通道身体层: {n_body}/{len(rows)}\n")
print(f"{'文件':<28}{'脸':<6}{'合成图':<10}身体层")
for r in rows:
    print(f"{r[0]:<28}{r[1]:<6}{r[2]:<10}{r[3]}")
