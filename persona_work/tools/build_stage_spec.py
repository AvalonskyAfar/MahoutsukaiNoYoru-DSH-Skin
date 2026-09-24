#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_stage_spec.py —— 生成 `persona_work/stage/stage_spec.json`：**一景一套多通道槽位表**。

用户 2026-09-19 的定案：
  「别的这些变换姿势的动作也要全部加上，**只要是同一个服装的就没事**」
  → 所以**不再锁单通道**：同一套衣服（同一个 i3）下所有姿势通道都可以用，
    姿势跟着情绪变是可以的；**不许换的是衣服**。

表怎么来的（两个来源合并，都有出处）：
  1. `persona_work/stage/slots_sub_*.json` —— 前序会话逐帧人眼判定的槽位（带描述与置信度）；
     这里只取**本皮肤发货的那个批次**（默认 n），因为跨批次会换取景/画风。
  2. 本会话我（multimodal）逐帧看对照表判定的结果 —— 补 slots_sub 没覆盖的帧，
     以及青子「撩头发」那条通道（`aok_*_0*_03`，slots_sub 里没记）。

输出 JSON 结构：
  { "<景>": { char, batch, i3, framing, slots: { "<槽位>": [["02","00"], ["03","05"], ...] } } }
帧列表 = 轮换候选（客户端同槽位连续 ≥3 句会换下一张）。
"""
import collections
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STAGE = os.path.join(ROOT, "persona_work", "stage")
OUT = os.path.join(STAGE, "stage_spec.json")

# ---------------------------------------------------------------------------
# 本会话逐帧判定（multimodal 看 scene_sheet 出的对照表）。
# 键 = (角色, 批次, i3, 通道)，值 = {槽位: [帧号...]}
# ★ = 用户点名的招牌动作
# ---------------------------------------------------------------------------
READINGS = {
    # A4 夜·通学路（白羽绒服）—— 通道 02 主、03 撩头发、16、21 表情最全
    ("aok", "n", "03", "02"): {
        "neutral": ["00", "01"], "smile": ["02", "09"], "laugh": ["04", "08"],
        "glare": ["06", "03"], "surprised": ["10"], "troubled": ["11"],
        "sad": ["13"], "think": ["07", "12"], "tired": ["05"],
    },
    ("aok", "n", "03", "03"): {   # ★ 撩头发
        "neutral": ["00", "01"], "smile": ["05", "07"], "laugh": ["06", "08", "02"],
    },
    ("aok", "n", "03", "16"): {
        "neutral": ["00"], "smile": ["01", "06"], "angry": ["02"], "glare": ["03"],
        "laugh": ["04", "07"], "shy": ["05"],
    },
    ("aok", "n", "03", "21"): {
        "neutral": ["01"], "surprised": ["04", "09", "00"], "troubled": ["08"],
        "glare": ["06"], "angry": ["02", "07"],
    },
    # A3 教室·白天（三咲高校制服）—— 通道 02 主、03 撩头发、09 怒/笑
    ("aok", "n", "12", "02"): {
        "neutral": ["00", "12"], "smile": ["01", "09", "10"], "laugh": ["04", "05"],
        "glare": ["08", "15", "18", "19"], "serious": ["12"], "surprised": ["17"],
        "troubled": ["16"], "sad": ["07"], "think": ["02"], "blink": ["03"],
    },
    ("aok", "n", "12", "03"): {   # ★ 撩头发
        "neutral": ["01"], "smile": ["06", "08", "10"], "laugh": ["03", "04", "09"],
        "surprised": ["07"],
    },
    ("aok", "n", "12", "09"): {
        "neutral": ["00", "12", "13"], "angry": ["05", "06", "10", "11", "15"],
        "glare": ["02", "03", "09"], "serious": ["01"], "smile": ["08"],
        "blink": ["04"], "sad": ["14"],
    },
    # A1/A2 洋房客厅（黑连衣裙）—— 通道 08 主、10 手掩口、03 冷眼
    ("ari", "n", "01", "08"): {
        "neutral": ["00", "02"], "troubled": ["01", "03", "04"], "smile": ["05"],
        "surprised": ["06"], "blink": ["05"],
    },
    ("ari", "n", "01", "10"): {   # ★ 手掩口
        "surprised": ["01", "00", "02"],
    },
    # A5 公园步道·秋（koj 制服）
    ("koj", "n", "00", "07"): {
        "neutral": ["00", "07"], "smile": ["01", "05"], "angry": ["09", "06"],
        "glare": ["06", "07"], "surprised": ["02", "11", "03"], "troubled": ["04", "08"],
        "sad": ["10"], "tired": ["08"],
    },
    ("koj", "n", "00", "01"): {
        "neutral": ["00", "07"], "troubled": ["01", "05", "09"], "surprised": ["02", "08"],
        "serious": ["03"], "sad": ["06"], "blink": ["04"],
    },
    # A6 洋馆客室·夜（koj 冬季便服）
    ("koj", "l", "01", "01"): {
        "neutral": ["03", "01"], "smile": ["17", "10"], "laugh": ["11"],
        "surprised": ["15", "16", "14"], "tired": ["00", "07"], "troubled": ["00", "14"],
        "blink": ["05", "08"],
    },
}

# 每景用哪套（角色, 批次, i3）—— 与 docs/17 §2.1 的取景选择一致
SCENES = {
    "A3": ("aok", "n", "12", "胸像"),
    "A4": ("aok", "n", "03", "胸像"),
    "A1": ("ari", "n", "01", "胸像"),
    "A2": ("ari", "n", "01", "胸像"),
    "A5": ("koj", "n", "00", "胸像"),
    "A6": ("koj", "l", "01", "半身"),
}
ALIAS = {"A2": "A1"}

# slots_sub 文件里可能覆盖的（角色, i3）
SUB_FILES = {
    ("aok", "03"): "slots_sub_aok03.json",
    ("aok", "12"): "slots_sub_aok12.json",
    ("ari", "01"): "slots_sub_ari01.json",
    ("koj", "00"): "slots_sub_koj00.json",
    ("koj", "01"): "slots_sub_koj01.json",
}
# slots_sub 里这些"槽位"不是情绪，别进表
SKIP_SLOTS = {"unknown", "talk"}


def load_subs(char, i3, batch):
    """读 slots_sub，只留**本批次**的条目 → {槽位: [(通道, 帧), ...]}"""
    name = SUB_FILES.get((char, i3))
    if not name:
        return {}
    p = os.path.join(STAGE, name)
    if not os.path.isfile(p):
        return {}
    out = collections.defaultdict(list)
    for e in json.load(open(p, encoding="utf-8")):
        parts = str(e.get("id", "")).split("_")
        if len(parts) < 5 or parts[1] != batch:
            continue
        slot = e.get("slot")
        if not slot or slot in SKIP_SLOTS:
            continue
        pair = (parts[3], str(e.get("v")))
        if pair not in out[slot]:
            out[slot].append(pair)
    return out


def main():
    spec = {}
    conflicted = []
    for scene, (char, batch, i3, framing) in SCENES.items():
        if scene in ALIAS:
            continue
        subs = load_subs(char, i3, batch)              # 前序会话判定（带描述）
        owned = {}                                     # (通道,帧) -> 槽位（slots_sub 优先）
        for slot, pairs in subs.items():
            for p in pairs:
                owned.setdefault(p, slot)
        slots = collections.defaultdict(list)
        for slot, pairs in subs.items():
            slots[slot].extend(pairs)
        # 本会话判定：**只补 slots_sub 没占的帧**；与 subs 冲突的记下来
        for (c, b, ii, chan), table in READINGS.items():
            if (c, b, ii) != (char, batch, i3):
                continue
            for slot, frames in table.items():
                for f in frames:
                    p = (chan, f)
                    if owned.get(p) == slot:
                        continue
                    if p in owned and owned[p] != slot:
                        conflicted.append((scene, f"{chan}-{f}", owned[p], slot))
                        continue
                    owned[p] = slot
                    slots[slot].append(p)
        spec[scene] = dict(char=char, batch=batch, i3=i3, framing=framing,
                           slots={k: v for k, v in sorted(slots.items())})
    for alias, src in ALIAS.items():
        if src in spec:
            spec[alias] = dict(spec[src])
    json.dump(spec, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    if conflicted:
        print("⚠ 两处判定打架（已按 slots_sub 优先）：")
        for scene, pair, keep, drop in conflicted:
            print(f"  {scene} {pair}: slots_sub 判为 {keep}，本会话判为 {drop} → 用 {keep}")
        print()
    print(f"-> {OUT}\n")
    for scene, d in spec.items():
        if scene in ALIAS:
            continue
        n = sum(len(v) for v in d["slots"].values())
        chans = sorted({c for v in d["slots"].values() for c, _ in v})
        print(f"{scene} {d['char']} {d['batch']}_{d['i3']}（{d['framing']}）"
              f"  槽位 {len(d['slots'])} 个 / 图 {n} 张  通道 {' '.join(chans)}")
        for slot, vs in d["slots"].items():
            print(f"    {slot:<10} " + "  ".join(f"{c}-{f}" for c, f in vs))
        print()


if __name__ == "__main__":
    main()
