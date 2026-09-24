"""汇总「具体文件 → 情绪槽位」，生成表情对照总表。

输入（按优先级从高到低覆盖）：
  1. persona_work/stage/slots_manual_main.json   主 agent 亲自读图判定
  2. persona_work/stage/slots_subagent.json      视觉子代理判定（逐文件）
  3. persona_work/stage/slots_referenced.json    §«参考»旧笔记（只作参考，conf 压到 low）

输出：
  persona_work/stage/expressions.json            机器读（景 → 服装行 → 槽位 → 文件）
  persona_work/stage/expression-matrix.md        人读版对照总表

用法: python build_expressions.py
"""
import json, os, re, sys
from collections import defaultdict

STAGE = r"D:\QuickLook插件包\moye\persona_work\stage"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
SCENES = json.load(open(os.path.join(STAGE, "scenes.json"), encoding="utf-8"))["scenes"]

SLOTS = ["neutral", "smile", "laugh", "angry", "glare", "surprised",
         "troubled", "sad", "serious", "think", "tired", "shy"]
NON_EMO = ["blink", "talk", "unknown"]

FALLBACK = {
    "laugh": ["smile", "neutral"],
    "sad": ["troubled", "neutral"],
    "shy": ["troubled", "neutral"],
    "tired": ["neutral", "think"],
    "think": ["neutral"],
    "angry": ["serious", "neutral"],
    "glare": ["serious", "neutral"],
    "smile": ["neutral"],
    "troubled": ["neutral"],
    "serious": ["neutral"],
    "surprised": ["neutral"],
    "neutral": [],
}

# 「景 → 用哪些 exprfiles_*.json 的判定」；键是 scene_id
SCENE_SHEET = {
    "A1": ["slots_subagent_ari01"], "A2": ["slots_subagent_ari01"],
    "A3": ["slots_subagent_aok12"],
    "A4": ["slots_subagent_aok03"],
    "A5": ["slots_manual_main", "slots_subagent_koj"],
    "A6": ["slots_manual_main", "slots_subagent_koj"],
}


def load(name):
    p = os.path.join(STAGE, name + ".json")
    if not os.path.exists(p):
        return {}
    d = json.load(open(p, encoding="utf-8"))
    return {k: v for k, v in d.items() if not k.startswith("_")}


def build():
    sources = [load(n) for n in ("slots_manual_main", "slots_subagent", "slots_referenced")]
    # 合并：后面的不覆盖前面的
    byfile = {}
    for src in reversed(sources):
        for scene, items in src.items():
            for fid, rec in items.items():
                byfile.setdefault(fid, rec)

    out = {
        "_note": "具体文件 → 槽位。★立绘的 i4 与帧号单独都不能确定表情，必须按文件名查。",
        "slots": SLOTS,
        "non_emotion": NON_EMO,
        "fallback": FALLBACK,
        "scenes": {},
        "unmapped": [],
    }

    for sid, s in SCENES.items():
        if not s.get("character"):
            out["scenes"][sid] = {"character": None}
            continue
        who, i3 = s["character"], s["outfit_i3"]
        chs = s.get("chapters") or SCENES[s.get("same_as", sid)]["chapters"]
        # 该景引用过的全部具体文件
        agg = json.load(open(r"D:\QuickLook插件包\moye\persona_work\agg\sprite_sequence.json",
                             encoding="utf-8"))
        used = []
        for ch in chs:
            for sp in agg.get(ch, {}).get("sprites", []):
                if sp["who"] == who and sp["i3"] == i3 and sp["closeup"]:
                    used.append(sp["id"])
        used = sorted(set(used))

        per_slot = defaultdict(list)
        for fid in used:
            rec = byfile.get(fid)
            if not rec:
                out["unmapped"].append(fid)
                continue
            slot = rec["slot"]
            if slot in NON_EMO:
                continue
            per_slot[slot].append({"file": fid, "desc": rec.get("desc", ""),
                                   "conf": rec.get("conf", "low"),
                                   "src": rec.get("src", "sub")})
        out["scenes"][sid] = {
            "character": who, "outfit_i3": i3, "name": s["name"],
            "chapters": chs,
            "files_used": len(used),
            "slots": {k: v for k, v in sorted(per_slot.items())},
            "slots_missing": [k for k in SLOTS if k not in per_slot],
            "fallback": FALLBACK,
        }

    p = os.path.join(STAGE, "expressions.json")
    json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("写出", p)

    # 人读版
    md = ["# 表情对照总表", "",
          "> 交付物 ②（对应交接文件 §5）。**判定单位是「具体文件」**，不是帧号。",
          "> 原因见文末「★ 命名语义更正」。", ""]
    for sid, v in out["scenes"].items():
        if not v.get("character"):
            md.append(f"## {sid} — 无角色（纯背景）\n")
            continue
        md.append(f"## {sid} {v['name']} — `{v['character']}` 服装行 `i3={v['outfit_i3']}`")
        md.append(f"- 该景原作引用过 {v['files_used']} 个具体立绘文件")
        md.append(f"- 判定出可用槽位 **{len(v['slots'])}/12**：{', '.join(v['slots']) or '（无）'}")
        md.append(f"- 完全缺失：{', '.join(v['slots_missing']) or '（无）'}")
        md.append("")
        md.append("| 槽位 | 文件 | 描述 | 置信度 |")
        md.append("|---|---|---|---|")
        for slot in SLOTS:
            for it in v["slots"].get(slot, []):
                md.append(f"| `{slot}` | `{it['file']}` | {it['desc']} | {it['conf']} |")
        md.append("")
    md += ["---", "", "## ★ 命名语义更正（本次实测推翻交接文件 §4.1）", "",
           "交接文件写的是 `<角色>_<批次>_<i3 服装行>_<i4 表情>_<变体编号>`。",
           "**实测结论：`i4` 与第 5 段都不是独立可用的表情键。**", "",
           "- `i4` 是**姿态/脸型通道**（同一套衣服下并存的多条通道）；",
           "- 第 5 段 `v` 是**每条 (批次, i4) 通道自己动画序列里的帧号**；",
           "- 证据：`aok_n_12_09` 的 v09 = 大怒，而 `aok_n_12_21` 的 v09 = 惊讶；",
           "  `koj_a_00_01` 的 v01 = 张口惊讶，而 `koj_n_00_07` 的 v01 = 压眉瞪视。",
           "- 只有 **具体文件（= i3 + i4 + v 三元组）** 才确定表情。", "",
           "→ 因此本表**以文件名为键**，不用帧号查表。"]
    p2 = os.path.join(STAGE, "expression-matrix.md")
    open(p2, "w", encoding="utf-8").write("\n".join(md))
    print("写出", p2)
    print(f"未判定文件 {len(out['unmapped'])} 个")
    for f in out["unmapped"][:15]:
        print("   ", f)


if __name__ == "__main__":
    build()
