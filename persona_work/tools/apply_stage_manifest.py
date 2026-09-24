# -*- coding: utf-8 -*-
"""
apply_stage_manifest.py —— 把 stage_sprites.json 的槽位映射写进 skin/data/manifest.json。

只改 `expressions[<景>].slots`（其余原样保留），并先备份成 manifest.json.bak。
旧的 157 张"只有脸"的立绘**不删**，等用户验收后再说。

用法:
  python persona_work/tools/apply_stage_manifest.py
  python persona_work/tools/apply_stage_manifest.py --revert     # 从备份还原
"""
import json
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
MANI = os.path.join(ROOT, "skin", "data", "manifest.json")
BAK = MANI + ".bak"
STAGE = os.path.join(ROOT, "persona_work", "stage", "stage_sprites.json")
SPRITE_DIR = os.path.join(ROOT, "skin", "assets", "sprite")


def main():
    if "--revert" in sys.argv:
        shutil.copyfile(BAK, MANI)
        print(f"已从备份还原 {MANI}")
        return
    mapping = json.load(open(STAGE, encoding="utf-8"))
    m = json.load(open(MANI, encoding="utf-8"))
    if not os.path.isfile(BAK):
        shutil.copyfile(MANI, BAK)
        print(f"已备份 -> {os.path.basename(BAK)}")
    exp = m.setdefault("expressions", {})
    for scene, d in mapping.items():
        missing = [f for names in d["slots"].values() for f in names
                   if not os.path.isfile(os.path.join(SPRITE_DIR, f))]
        if missing:
            print(f"  !! {scene} 缺文件 {missing[:3]}…，跳过")
            continue
        node = exp.setdefault(scene, {})
        node["slots"] = {slot: ["sprite/" + f for f in names]
                         for slot, names in d["slots"].items()}
        node["stageSource"] = d["source"]
        src = d["source"]
        chans = src.get("channels") or ([src["channel"]] if src.get("channel") else [])
        print(f"  {scene}: 写入 {len(node['slots'])} 个槽位 "
              f"（{src.get('char')} batch={src.get('batch')} i3={src.get('i3')} "
              f"通道 {' '.join(chans)}）")
    # spriteBases：记成 (角色_批次_i3) —— 多通道之后"一个景一个通道"不再成立，
    # 真正的取材口径写在每个景的 stageSource.channels 里。
    srcs = sorted({f"{d['source'].get('char')}_{d['source'].get('batch')}_"
                   f"{d['source'].get('i3')}"
                   for d in mapping.values()})
    m["spriteBases"] = srcs
    m["note"] = (m.get("note") or "") + \
        " ｜ 立绘自 2026-09-19 起改为「身体层+脸层」多通道合成（见 docs/17）"
    json.dump(m, open(MANI, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n已写入 {MANI}")
    print(f"spriteBases -> {srcs}")

if __name__ == "__main__":
    main()
