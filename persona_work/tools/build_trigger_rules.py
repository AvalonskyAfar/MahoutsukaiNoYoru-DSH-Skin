#!/usr/bin/env python3
"""Step 7: derive table 2 (trigger rules) from the extraction records.

A trigger rule is a *semantic action class* -> emotion slot, backed by real
narration lines.  Raw phrasing is far too sparse to cluster directly (the
author rarely repeats a phrase verbatim), so each record's `act` is normalised
into an action class, then classes are ranked by support.

Output:
  persona_work/agg/trigger_rules.txt    ranked, with supporting line numbers
  persona_work/agg/trigger_rules.json   machine readable
  persona_work/agg/slot_evidence.json   slot -> {char: [lines]}
"""
import json
import os
import re
from collections import Counter, defaultdict

AGG = r"D:\QuickLook插件包\moye\persona_work\agg"
LEADS = ["aok", "ari", "kin"]
NAME = {"aok": "蒼崎青子", "ari": "久遠寺有珠", "kin": "久万梨金鹿"}

# act -> action class; first match wins, so put the sharpest keys first
CLASSES = [
    ("嗤う・嘲笑",   ["嗤", "嘲笑", "冷笑", "せせら", "見下す"]),
    ("睨む・横目",   ["睨", "横目", "じろり", "にら", "半眼", "値踏み", "凝視", "見据",
                    "視線を刺", "睨み"]),
    ("微笑む",      ["微笑", "笑み", "ほほえ", "微笑う"]),
    ("笑う（声）",   ["失笑", "笑い声", "笑い出す", "大笑", "呵", "くすくす", "笑う"]),
    ("笑顔",        ["笑顔", "笑いかけ", "満面", "顔を輝", "破顔"]),
    ("苦笑",        ["苦笑"]),
    ("呆れる",      ["呆れ", "あきれ", "唖然", "呆然"]),
    ("怒る・不機嫌", ["怒", "不機嫌", "苛立", "ムッ", "イラ", "凶悪", "刺々", "険", "カチン",
                    "かちん", "拗ね", "悪態", "舌打ち", "膨れ"]),
    ("叫ぶ・怒鳴る", ["叫", "怒鳴", "どな", "絶叫", "喚", "声を荒"]),
    ("眉をしかめる", ["眉をひそ", "眉を寄", "眉間", "顔をしかめ", "眉をしかめ", "しかめ面"]),
    ("顔を曇らせる", ["顔を曇", "表情を曇", "眉を曇", "曇らせ", "曇っ", "沈痛", "神妙",
                    "暗い表情"]),
    ("驚く",        ["驚", "仰天", "目を丸", "はっと", "ぎょっ", "息を呑", "息をの",
                    "目を見開", "目を見張", "瞠", "凍りつ", "息を止"]),
    ("瞬く・しばたく", ["瞬い", "まばた", "しばた"]),
    ("照れる",      ["照れ", "赤面", "赤ら", "顔を赤", "羞", "気恥ず"]),
    ("俯く・涙",     ["涙", "俯", "うつむ", "泣", "瞳を伏せ", "目を伏せ", "目を伏す",
                    "うなだれ", "顔を伏"]),
    ("困る・戸惑う", ["戸惑", "当惑", "たじろ", "困惑", "申し訳", "恐縮", "気まず",
                    "ばつが悪", "ばつの悪", "困"]),
    ("ため息",      ["ため息", "溜息", "嘆息", "息をつ", "息を吐", "深呼吸"]),
    ("気を抜く・脱力", ["肩を落", "肩をすく", "肩の力を抜", "脱力", "肩を竦"]),
    ("疲れる・眠い", ["疲", "眠", "だる", "瞼", "目をこす", "欠伸", "あくび", "寝ぼ"]),
    ("考える",      ["思案", "考え", "思索", "首をかしげ", "首を傾", "首をひね"]),
    ("首を振る・頷く", ["頷", "うなず", "首を振", "首を縦", "首を横"]),
    ("見る・視線",   ["見つめ", "見詰", "眺め", "視線", "目を向", "見や", "見上",
                    "見下", "観察", "見渡", "盗み見", "流し見", "目を細め", "瞳を細め",
                    "見る", "目をや", "振り向", "見回"]),
    ("口元・唇",     ["唇", "口元", "舌なめ", "歯噛"]),
    ("頭を掻く",     ["頭を掻", "頭をか"]),
    ("平静・無表情", ["平静", "表情を変え", "表情ひとつ", "無表情", "淡々", "素知らぬ",
                    "平然", "冷静", "表情を消", "無感情"]),
    ("緊張・警戒",   ["緊張", "震え", "震える", "硬直", "身構", "警戒", "身を強張",
                    "身を縮", "固ま"]),
    ("安堵・満足",   ["安堵", "ほっと", "満足", "得意", "誇ら", "納得", "安心", "感心",
                    "満ち足"]),
    ("口を閉ざす",   ["口を閉", "黙り", "黙り込", "沈黙", "口をつぐ", "何も言わ", "押し黙"]),
    ("背を向ける・移動", ["踵を返", "背を向", "肩を並", "歩き出", "走り出", "立ち上が",
                    "腰を下ろ", "顔を背", "顔を逸ら", "飛び出", "後退", "足を止",
                    "体を起こ", "倒れ"]),
    ("手・体の所作",  ["手を", "指を", "腕を", "胸を張", "頬を", "拳", "腕組"]),
    ("話す・告げる", ["言う", "言い", "告げ", "呟", "つぶや", "応え", "答え", "語り",
                    "訊", "尋ね", "問い", "漏ら", "囁", "ささや", "口に", "呼びかけ",
                    "聞き返", "語りかけ", "呟く"]),
]
NOISE = re.compile(r"^(自覚|気づかない|我に返る|知る|確信)")


def classify(act):
    a = act or ""
    if NOISE.match(a):
        return "内面の気づき"
    for cls, keys in CLASSES:
        for k in keys:
            if k in a:
                return cls
    return "その他"


with open(os.path.join(AGG, "records.json"), encoding="utf-8") as fh:
    rec = json.load(fh)

# dedupe overlapping-shard duplicates: (line, subject, raw) is the identity
seen = set()
exp = []
for r in rec["E"]:
    k = (r["line"], r["subject"], r["raw"])
    if k in seen:
        continue
    seen.add(k)
    r["cls"] = classify(r["act"])
    exp.append(r)

cls_slot = defaultdict(Counter)
char_cls = defaultdict(lambda: defaultdict(list))
slot_lines = defaultdict(lambda: defaultdict(set))
for r in exp:
    cls_slot[r["cls"]][r["slot"]] += 1
    char_cls[r["subject"]][r["cls"]].append(r)
    slot_lines[r["subject"]][r["slot"]].add(r["line"])

out = {}
L = []
L.append("# 表 2 素材：动作类 → 情绪槽位（含支持行号）")
L.append("")
L.append("把 MAP 提取的每一条叙述表情标注，按**语义动作类**归并（作者极少逐字重复措辞，")
L.append("所以按动作归并才有统计意义），再统计该类落在哪个槽位。")
L.append("")
L.append("## 全局：动作类 → 槽位 分布")
L.append("")
L.append("| 动作类 | 主导槽位 | 支持条数 | 次主导槽位 |")
L.append("|---|---|---|---|")
for cls, c in sorted(cls_slot.items(), key=lambda kv: -sum(kv[1].values())):
    top = c.most_common(2)
    L.append("| %s | %s | %d | %s |" %
             (cls, top[0][0], top[0][1],
              ("%s(%d)" % top[1]) if len(top) > 1 else "-"))
L.append("")

for ch in LEADS:
    out[ch] = {}
    L.append("")
    L.append("=" * 72)
    L.append("## %s（%s）" % (NAME[ch], ch))
    L.append("=" * 72)
    for cls, items in sorted(char_cls[ch].items(), key=lambda kv: -len(kv[1])):
        slots = Counter(r["slot"] for r in items)
        lines = sorted({r["line"] for r in items if r["line"]})
        out[ch][cls] = {
            "support": len(items),
            "slot": slots.most_common(1)[0][0],
            "slot_dist": dict(slots),
            "lines": lines,
            "examples": [{"line": r["line"], "raw": r["raw"], "intensity": r["intensity"]}
                         for r in items[:5]],
        }
        L.append("")
        L.append("### %s / %s  ×%d  →  %s" %
                 (ch, cls, len(items), " / ".join("%s(%d)" % kv for kv in slots.most_common(3))))
        for r in items[:6]:
            L.append("   L%-6d [%s/%s] %s" % (r["line"], r["slot"], r["intensity"], r["raw"]))
        L.append("   全部行号: %s" % ",".join(str(x) for x in lines[:60]))

with open(os.path.join(AGG, "trigger_rules.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
with open(os.path.join(AGG, "trigger_rules.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(L) + "\n")
with open(os.path.join(AGG, "slot_evidence.json"), "w", encoding="utf-8") as fh:
    json.dump({ch: {s: sorted(v) for s, v in d.items()} for ch, d in slot_lines.items()},
              fh, ensure_ascii=False, indent=1)

print("\n".join(L[:46]))
print("...")
print("\nwrote trigger_rules.txt/.json and slot_evidence.json")
print("deduped expression records:", len(exp))
