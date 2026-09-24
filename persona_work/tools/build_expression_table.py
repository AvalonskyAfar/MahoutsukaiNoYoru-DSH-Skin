"""生成「帧号对照表」骨架：每个景、每个服装行、每个被引用过的帧号一行，
槽位列留空（由视觉判定填入）。同时把判定结果写回 JSON。

用法:
    python build_expression_table.py --skeleton   # 打印待填表
    python build_expression_table.py --build      # 读 slots.json 生成表达式总表
"""
import json, os, re, sys
from collections import defaultdict

AGG = r"D:\QuickLook插件包\moye\persona_work\agg\sprite_sequence.json"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\stage"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

SCENES = {
    "A1": {"name": "洋房客厅·白天", "chars": [("ari", "01")],
           "chapters": ["4_2", "4_3", "9_3", "9_7", "wik_b_1_b", "wik_e", "wik_g_a", "wik_h_a", "wik_k", "wik_l_2"]},
    "A2": {"name": "洋房客厅·夜晚", "chars": [("ari", "01")], "same_as": "A1"},
    "A3": {"name": "教室·白天", "chars": [("aok", "12")],
           "chapters": ["2_1", "2_2", "2_3", "2_4", "2_5"]},
    "A4": {"name": "夜·灯饰通学路", "chars": [("aok", "03")], "chapters": ["d_8"]},
    "A5": {"name": "公园步道·秋", "chars": [("koj", "00"), ("koj", "01")],
           "chapters": ["7_1", "8dot5"]},
    "A6": {"name": "洋馆客室·夜", "chars": [("koj", "01")],
           "chapters": ["wik_nap", "wik_wakeup", "wik_noroom", "wik_room"]},
}


def load():
    return json.load(open(AGG, encoding="utf-8"))


def refs_for(data, chs, who, i3):
    """(帧号, i4) -> 引用次数 + 首个完整标识"""
    out = defaultdict(lambda: {"n": 0, "id": None})
    for ch in chs:
        for s in data.get(ch, {}).get("sprites", []):
            if s["who"] == who and s["i3"] == i3 and s["closeup"]:
                k = (s["variant"], s["i4"])
                out[k]["n"] += 1
                out[k]["id"] = out[k]["id"] or s["id"]
    return out


def skeleton():
    data = load()
    for scene, cfg in SCENES.items():
        if cfg.get("same_as"):
            print(f"\n## {scene} {cfg['name']}（与 {cfg['same_as']} 同）")
            continue
        print(f"\n## {scene} {cfg['name']}   章节 {'+'.join(cfg['chapters'])}")
        for who, i3 in cfg["chars"]:
            r = refs_for(data, cfg["chapters"], who, i3)
            if not r:
                print(f"  ({who} i3={i3} 无引用)")
                continue
            print(f"\n  ### {who} i3={i3}  引用 {len(r)} 个 (帧,i4) 组合")
            print("  | 帧号 | i4 | 引用次数 | 代表标识 | 槽位（待填） | 描述（待填） |")
            print("  |---|---|---|---|---|---|")
            for (v, e) in sorted(r, key=lambda k: (int(k[0]), k[1])):
                print(f"  | v{v} | {e} | {r[(v,e)]['n']} | {r[(v,e)]['id']} |  |  |")


def main():
    if "--skeleton" in sys.argv or len(sys.argv) == 1:
        skeleton()


if __name__ == "__main__":
    main()
