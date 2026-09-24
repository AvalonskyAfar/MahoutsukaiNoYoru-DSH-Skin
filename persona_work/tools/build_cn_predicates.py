"""★ 生成中文谓词表：把 74 条触发规则（原为日文行号）映射成中文原句。

依据（实测）：`script_text_ja.ctd` 与 `script_text_zc.ctd`（官方简中）**行对行完全对齐**
（都是 24135 行、空行位置一致），所以「日文行号」可以直接取同行的中文。

用法: python build_cn_predicates.py
产出: persona_work/stage/cn_predicates.json + cn_predicates.md
"""
import json, os, re, sys
from collections import Counter, defaultdict

CTD = r"D:\QuickLook插件包\moye\game_scripts\ctd\data00200.hfa"
NOTES = r"D:\QuickLook插件包\moye\image_notes\expression-notes.json"
STAGE = r"D:\QuickLook插件包\moye\persona_work\stage"
SLOTS = ["neutral", "smile", "laugh", "angry", "glare", "surprised",
         "troubled", "sad", "serious", "think", "tired", "shy"]

# 日文「动作类」→ 中文动作类（既有笔记的 action_class 是日文短语）
CLASS_ZH = {
    "その他": "其他 / 一般动作",
    "見る・視線": "看 / 视线",
    "睨む・横目": "瞪视 / 横目",
    "手・体の所作": "手部与身体动作",
    "背を向ける・移動": "转身 / 移动",
    "怒る・不機嫌": "发怒 / 不高兴",
    "話す・告げる": "说话 / 告知",
    "微笑む": "微笑",
    "ため息": "叹气",
    "驚く": "吃惊",
    "呆れる": "愕然 / 无语",
    "気を抜く・脱力": "放松 / 脱力",
    "眉をしかめる": "皱眉",
    "首を振る・頷く": "摇头 / 点头",
    "安堵・満足": "安心 / 满足",
    "笑顔": "笑容",
    "笑う（声）": "笑（出声）",
    "俯く・涙": "低头 / 流泪",
    "疲れる・眠い": "疲惫 / 困",
    "考える": "思考",
    "緊張・警戒": "紧张 / 戒备",
    "照れる": "害羞",
    "口元・唇": "嘴角 / 嘴唇",
    "叫ぶ・怒鳴る": "喊叫 / 怒吼",
    "瞬く・しばたく": "眨眼",
    "顔を曇らせる": "面露阴霾",
    "平静・無表情": "平静 / 无表情",
}


def strip_ruby(s):
    """去掉 <汉字|注音> 标记，只留汉字"""
    s = re.sub(r"<([^|>]+)\|[^>]*>", r"\1", s)
    return s.strip()


def main():
    ja = open(os.path.join(CTD, "script_text_ja.ctd"), encoding="utf-8").read().split("\n")
    zc = open(os.path.join(CTD, "script_text_zc.ctd"), encoding="utf-8").read().split("\n")
    assert len(ja) == len(zc)
    notes = json.load(open(NOTES, encoding="utf-8"))
    t2 = notes["table2_triggers"]

    out = {
        "_note": "中文谓词表：由日文行号直取官方简中同行原句（两份剧本行对行对齐）。",
        "_source": {
            "ja": "game_scripts/ctd/data00200.hfa/script_text_ja.ctd",
            "zh": "game_scripts/ctd/data00200.hfa/script_text_zc.ctd",
            "rules": "image_notes/expression-notes.json 的 table2_triggers",
            "alignment": "两份均 24135 行，空行位置一致（实测）",
        },
        "slot_hints_zh": notes["slot_classifier_hints"],
        "narration": [],
        "dialogue": [],
        "runtime": t2.get("runtime", []),
    }

    for r in t2["narration"]:
        lines = r.get("lines", [])[:12]
        samples = []
        for ln in lines:
            if 0 <= ln < len(zc):
                s = strip_ruby(zc[ln])
                if s:
                    samples.append({"line": ln, "zh": s[:80], "ja": strip_ruby(ja[ln])[:80]})
        out["narration"].append({
            "character": r["character"],
            "action_class_ja": r["action_class"],
            "action_class_zh": CLASS_ZH.get(r["action_class"], r["action_class"]),
            "slot": r["slot"],
            "support": r.get("support", 0),
            "zh_samples": samples,
        })

    for r in t2["dialogue"]:
        anchors = r.get("anchor_lines", [])[:8]
        samples = []
        for ln in anchors:
            if 0 <= ln < len(zc):
                s = strip_ruby(zc[ln])
                if s:
                    samples.append({"line": ln, "zh": s[:80]})
        out["dialogue"].append({
            "character": r["character"],
            "condition_zh": r["condition"],
            "slot": r["slot"],
            "narration_basis_ja": r.get("narration_basis", ""),
            "zh_samples": samples,
        })

    os.makedirs(STAGE, exist_ok=True)
    p = os.path.join(STAGE, "cn_predicates.json")
    json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("写出", p, f"（叙述规则 {len(out['narration'])} 条 / 台词规则 {len(out['dialogue'])} 条）")

    md = ["# 中文谓词表（供表情分类器使用）", "",
          "> **不需要翻译。** 官方简中剧本 `script_text_zc.ctd` 与日文原文 `script_text_ja.ctd`",
          "> **行对行完全对齐**（均 24135 行、空行位置一致，实测），所以既有笔记里带日文行号的",
          "> 74 条触发规则，可以直接取同行的**中文原句**。", "",
          "## 槽位判定要点（中文）", ""]
    for k in SLOTS:
        md.append(f"- `{k}` — {out['slot_hints_zh'].get(k, '')}")
    md += ["", "## 叙述触发（中文动作类 → 槽位）", "",
           "| 角色 | 动作类 | 槽位 | 支持数 | 中文例句（官方简中） |", "|---|---|---|---|---|"]
    for r in out["narration"]:
        ex = r["zh_samples"][0]["zh"] if r["zh_samples"] else ""
        md.append(f"| {r['character']} | {r['action_class_zh']} | `{r['slot']}` | "
                  f"{r['support']} | {ex} |")
    md += ["", "## 台词触发（话题 → 槽位）", "", "| 角色 | 条件 | 槽位 | 中文例句 |", "|---|---|---|---|"]
    for r in out["dialogue"]:
        ex = r["zh_samples"][0]["zh"] if r["zh_samples"] else ""
        md.append(f"| {r['character']} | {r['condition_zh']} | `{r['slot']}` | {ex} |")
    md += ["", "## 运行时触发（agent 状态 → 槽位）", "", "| 条件 | 槽位 |", "|---|---|"]
    for r in out["runtime"]:
        md.append(f"| {r.get('condition','')} | `{r.get('slot','')}` |")
    p2 = os.path.join(STAGE, "cn_predicates.md")
    open(p2, "w", encoding="utf-8").write("\n".join(md))
    print("写出", p2)


if __name__ == "__main__":
    main()
