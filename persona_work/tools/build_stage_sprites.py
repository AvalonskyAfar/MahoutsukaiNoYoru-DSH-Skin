#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_stage_sprites.py —— 按 `persona_work/stage/stage_spec.json` 烘立绘。

规格来源 = `build_stage_spec.py`（合并前序会话 slots_sub + 本会话逐帧判定）。
**一景多通道**：同一套衣服（i3）下所有姿势通道都可以用 ——
用户 2026-09-19 定案：「别的这些变换姿势的动作也要全部加上，只要是同一个服装的就没事」。

原理（已实测确认，见 docs/17）：
  · 立绘 = 身体层 `<角色>_<批次>_<i3>_<通道>_00_b`  +  脸层 `<角色>_<批次>_<i3>_<通道>_<帧>`
  · 两层**画布原点对齐**（rel≈0,0），直接 alpha 合成即可
  · 裁切窗口 = **素材自己的画布**（留白是发型余量，绝不能按内容 bbox 裁）

产物命名：`stage_<景>_c<通道>_<帧>.png`
  ★ 按**素材帧**命名，不按槽位 —— 同一帧被两个槽位用到时复用同一张图，不重复烘。
`skin/data/manifest.json` 的 `expressions[景].slots` 由 `apply_stage_manifest.py` 写入。
"""
import json
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "hfa_png", "out")
DOSSIER = os.path.join(ROOT, "persona_work", "stage")
DST = os.path.join(ROOT, "skin", "assets", "sprite")
SPEC = os.path.join(DOSSIER, "stage_spec.json")
DIRS = {"aok": "data02100", "ari": "data02110", "koj": "data02150", "sou": "data02180"}


def face_path(ch, batch, i3, chan, frame):
    return os.path.join(OUT, DIRS[ch], f"{ch}_{batch}_{i3}_{chan}_{frame}.mzp.png")


def body_path(ch, batch, i3, chan):
    return os.path.join(OUT, DIRS[ch], f"{ch}_{batch}_{i3}_{chan}_00_b.mzp.png")


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def main():
    want = [a for a in sys.argv[1:] if not a.startswith("-")]
    spec_all = json.load(open(SPEC, encoding="utf-8"))
    scenes = want or [s for s in spec_all if s not in ALIAS_KEYS]
    mapping = {}
    made = 0
    for scene in scenes:
        d = spec_all.get(scene)
        if not d:
            print(f"[{scene}] 规格里没有 —— 跳过")
            continue
        ch, batch, i3 = d["char"], d["batch"], d["i3"]
        bodies = {}
        slots, missing = {}, []
        for slot, pairs in d["slots"].items():
            names = []
            for chan, frame in pairs:
                if chan not in bodies:
                    bp = body_path(ch, batch, i3, chan)
                    if not os.path.isfile(bp):
                        bodies[chan] = None
                    else:
                        b = Image.open(bp).convert("RGBA")
                        bodies[chan] = (b, (0, 0, b.width, b.height))
                entry = bodies[chan]
                if entry is None:
                    missing.append(f"{slot}:{chan}")
                    continue
                fp = face_path(ch, batch, i3, chan, frame)
                if not os.path.isfile(fp):
                    missing.append(f"{slot}:{chan}-{frame}")
                    continue
                name = f"stage_{scene.lower()}_c{chan}_{frame}.png"
                dst = os.path.join(DST, name)
                if not os.path.isfile(dst):
                    body, win = entry
                    face = Image.open(fp).convert("RGBA")
                    comp = Image.new("RGBA", (max(body.width, face.width),
                                              max(body.height, face.height)), (0, 0, 0, 0))
                    comp.alpha_composite(body, (0, 0))
                    comp.alpha_composite(face, (0, 0))
                    comp.crop(win).save(dst)
                    made += 1
                if name not in names:
                    names.append(name)
            if names:
                slots[slot] = names
        mapping[scene] = dict(slots=slots, source=dict(
            char=ch, batch=batch, i3=i3, framing=d.get("framing", ""),
            channels=sorted({c for v in d["slots"].values() for c, _ in v})))
        chans = sorted({c for v in d["slots"].values() for c, _ in v})
        print(f"[{scene}] {ch} {batch}_{i3}  槽位 {len(slots)} 个，"
              f"图 {sum(len(v) for v in slots.values())} 张（新烘 {made}）  通道 {' '.join(chans)}")
        if missing:
            print(f"      ⚠ 缺料 {len(missing)} 条：{' '.join(missing[:8])}")
    p = os.path.join(DOSSIER, "stage_sprites.json")
    # ★ 别名景（A2 = A1 的夜景版）也要写进映射，否则 manifest 里那一景会留着**旧文件名**
    #   （旧文件已经不在磁盘上了 → 夜景切过去就是空立绘）。A1/A2 共用同一批文件。
    for alias, src in ALIAS_MAP.items():
        if src in mapping and alias not in mapping:
            mapping[alias] = mapping[src]
    json.dump(mapping, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n槽位映射 -> {p}（本次新烘 {made} 张）")
    print(f"  含景: {' '.join(sorted(mapping))}")


ALIAS_KEYS = {"A2"}
ALIAS_MAP = {"A2": "A1"}

if __name__ == "__main__":
    main()
