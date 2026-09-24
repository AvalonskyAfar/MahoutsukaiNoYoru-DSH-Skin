# -*- coding: utf-8 -*-
"""
frame_inventory.py —— 清点每个景的 (批次, 通道) 各有多少帧（帧=表情），挑最富的通道。

用法:
  python persona_work/tools/frame_inventory.py [角色 i3]
"""
import collections
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
DIRS = {"aok": "data02100", "ari": "data02110", "koj": "data02150", "sou": "data02180"}

SCENES = [("A3 教室·白天", "aok", "12"), ("A4 夜·通学路", "aok", "03"),
          ("A1/A2 洋房客厅", "ari", "01"), ("A5 公园步道·秋", "koj", "00"),
          ("A6 洋馆客室·夜", "koj", "01")]


def inv(ch, i3):
    d = os.path.join(OUT, DIRS[ch])
    by = collections.defaultdict(list)
    for f in sorted(os.listdir(d)):
        if not f.endswith(".mzp.png") or f.endswith("_b.mzp.png"):
            continue
        parts = f[:-len(".mzp.png")].split("_")
        # <char>_<batch>_<i3>_<channel>_<frame>  (合成图多两段，排除)
        if len(parts) != 5 or parts[0] != ch or parts[2] != i3:
            continue
        by[(parts[1], parts[3])].append(parts[4])
    return by


for label, ch, i3 in SCENES:
    by = inv(ch, i3)
    print(f"===== {label}  ({ch}, i3={i3}) =====")
    rows = []
    for (batch, chan), frames in by.items():
        d = os.path.join(OUT, DIRS[ch])
        has_body = os.path.isfile(os.path.join(d, f"{ch}_{batch}_{i3}_{chan}_00_b.mzp.png"))
        rows.append((len(frames), batch, chan, sorted(frames), has_body))
    rows.sort(key=lambda r: (-r[0], r[1], r[2]))
    for n, batch, chan, frames, hb in rows[:14]:
        flag = "有身体" if hb else "×无身体"
        print(f"  batch={batch} 通道={chan:<3} 帧数={n:<3} {flag}  帧号: {' '.join(frames)}")
    print()
