#!/usr/bin/env python3
"""Step 7: emit the linked-image notes (three tables) in all three shapes.

Outputs (into D:\\QuickLook插件包\\moye\\image_notes\\):
  expression-notes.md     human-readable, the main deliverable
  expression-notes.json   structured, for the skin to read programmatically
  expression-notes.yaml   same content as YAML
"""
import json
import os
from collections import Counter, defaultdict

BASE = r"D:\QuickLook插件包\moye\persona_work\agg"
OUT = r"D:\QuickLook插件包\moye\image_notes"
os.makedirs(OUT, exist_ok=True)

SLOTS = [
    # id, 中文, 日文, 素材判据（来自 hfa_png 实际差分）
    ("neutral", "平静", "平静", "默认态。三人全服装均有。"),
    ("smile", "微笑", "微笑", "三人全服装均有。"),
    ("laugh", "大笑", "笑い", "有珠基本缺失，见 §表3 回退。"),
    ("angry", "生气", "怒り", "有珠缺失，见 §表3 回退。"),
    ("glare", "瞪视/横目", "睨み", "叙述高频，三人全服装均有（有珠为「冷眼斜视」）。"),
    ("surprised", "惊讶", "驚き", "三人全服装均有。"),
    ("troubled", "困惑/为难", "戸惑い", "三人全服装均有（有珠为「手掩口」）。"),
    ("sad", "失落", "悲しみ", "仅青子有专属差分，见 §表3 回退。"),
    ("serious", "认真", "真剣", "三人全服装均有。"),
    ("think", "思考", "考え", "青子/有珠有，金鹿缺失，见 §表3 回退。"),
    ("tired", "疲惫", "疲れ", "仅青子有专属差分，见 §表3 回退。"),
    ("shy", "害羞", "照れ", "青子/有珠有，金鹿缺失，见 §表3 回退。"),
]
SLOT_IDS = [s[0] for s in SLOTS]

FALLBACK = {
    # 该角色在 hfa_png 里没有这个槽位的专属差分，回退到语义最近的槽位。
    # 依据：逐格视觉编目（catalog/ 下 6 份编目文件，953+ 行判定）。
    # ★ 金鹿（koj）全库只有 2 种表情（i4=01 睁眼平静 / i4=07 闭眼微笑），
    #   所以除 neutral / smile 外的 10 个槽位全部走回退 —— 这是原作素材事实，不是推断。
    "ari": {"laugh": "smile", "angry": "glare", "sad": "troubled",
            "tired": "troubled", "shy": "troubled"},
    "koj": {s: ("smile" if s in ("laugh", "shy") else "neutral")
            for s in ("laugh", "angry", "glare", "surprised", "troubled",
                      "sad", "serious", "think", "tired", "shy")},
    "aok": {"shy": "troubled"},
}
OUTFIT_PRIORITY = ["uniform", "casual_a", "cap_jacket", "casual_l", "casual_m", "suit"]


def load(p):
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


sprites = load(os.path.join(BASE, "slot_sprites.json"))
trig = load(os.path.join(BASE, "trigger_rules.json"))
slot_lines = load(os.path.join(BASE, "slot_evidence.json"))
records = load(os.path.join(BASE, "records.json"))

NAME = {"aok": "蒼崎青子", "ari": "久遠寺有珠", "koj": "久万梨金鹿",
        "kanomi": "木乃美芳助"}
# ★ 资源键用立绘文件的真实前缀。koj = 久万梨金鹿（Kojika Kumari）；
#   kin = 木乃美芳助（Kinomi），不是金鹿 —— 这是执行期修正过的重大误标。
LEADS = ["aok", "ari", "koj"]

# ---------- table 1 ----------
seen = set()
exp = []
for r in records["E"]:
    k = (r["line"], r["subject"], r["raw"])
    if k in seen:
        continue
    seen.add(k)
    exp.append(r)

slot_total = Counter(r["slot"] for r in exp)
slot_by_char = defaultdict(Counter)
for r in exp:
    slot_by_char[r["subject"]][r["slot"]] += 1

# ---------- table 3 assembly ----------
table3 = {}
for ch in LEADS:
    table3[ch] = {}
    for sid in SLOT_IDS:
        entries = []
        for of in OUTFIT_PRIORITY:
            files = sprites.get(ch, {}).get(of, {}).get(sid, [])
            if files:
                entries.append({"outfit": of, "count": len(files), "files": files})
        table3[ch][sid] = {
            "available": bool(entries),
            "outfits": entries,
            "fallback": None if entries else FALLBACK.get(ch, {}).get(sid),
        }

# ---------- write markdown ----------
L = []
W = L.append
W("# 关联图像笔记 —— 「说/听到什么话 → 什么表情」")
W("")
W("> 本文件是《魔法使之夜》人格蒸馏任务的产出物之二。")
W("> **规则不是发明的，是从原文叙述行提取的**：本作叙述承担了「演出指示」职能，")
W("> 17,050 行叙述中有 2,000+ 处表情/情绪标注，这些标注就是原作写好的差分切换指令。")
W("")
W("## 数据来源与方法")
W("")
W("| 项 | 值 |")
W("|---|---|")
W("| 语料 | `game_scripts/ctd/data00200.hfa/script_text_ja.ctd`（24,134 行，全文） |")
W("| 读取方式 | 32 片重叠分片，每片一个子 agent 通读，无采样无跳读 |")
W("| 提取出的表情/演出指示 | **%d 条**（去重后） |")
W("| 提取出的心理描写 | %d 条 |" % len(records["P"]))
W("| 提取出的说话人归属 | %d 条 |" % len(records["A"]))
W("| 素材来源 | `hfa_png/out/` 下 23,747 张已解出的 PNG |")
W("| 素材编目 | 逐格视觉判定 %d 格（人眼/视觉模型），**未使用任何推测的编号表** |" %
  sum(len(v) for ch in sprites.values() for of in ch.values() for v in of.values()))
W("")
W("⚠️ **重要发现**：立绘文件名的 `i4` 字段**不是全局表情编号**。")
W("同一 `i4` 在不同 `i3`（姿势家族）行、不同服装下含义不同；")
W("**同一 `i3` 行内的不同 `i4` 才是「同一张脸的多个表情」**。")
W("因此表 3 是按**逐格视觉判定**得到的，不存在可复用的 `i4 → 槽位` 查表。")
W("")
W("---")
W("")
W("## 表 1 · 情绪槽位定义")
W("")
W("| 槽位 id | 中文 | 日文 | 叙述支持条数 | 青子 | 有珠 | 金鹿 | 素材判据 |")
W("|---|---|---|---|---|---|---|---|")
for sid, zh, ja, note in SLOTS:
    a = slot_by_char["aok"].get(sid, 0)
    b = slot_by_char["ari"].get(sid, 0)
    c = slot_by_char["kin"].get(sid, 0)
    W("| `%s` | %s | %s | %d | %s | %s | %s | %s |" %
      (sid, zh, ja, slot_total.get(sid, 0),
       "有" if table3["aok"][sid]["available"] else "**无**",
       "有" if table3["ari"][sid]["available"] else "**无**",
       "有" if table3["koj"][sid]["available"] else "**无**",
       note))
W("")
W("**槽位集是 12 个**，与 `hfa_png` 里实际存在的差分一一对应（见验收：不允许有槽位无素材）。")
W("三人素材覆盖不同：**青子 12/12、有珠 8/12、金鹿 2/12** 有专属差分；")
W("差额一律走 §表 3 的 `fallback`（回退到语义最近的槽位），")
W("所以**不存在「有槽位却没有任何可用图」的情况**。")
W("")
W("> 覆盖率的差异本身就是角色特征，不是素材缺失：")
W("> 有珠全篇 `neutral` 79 次对 `smile` 7 次、`laugh` 1 次，原作根本没给她配大笑或大怒的差分；")
W("> 金鹿更极端——**全库只有 2 种表情**（`i4=01` 睁眼平静 / `i4=07` 闭眼微笑），")
W("> 5 套服装一致，所以除 `neutral`/`smile` 外 10 个槽位全部走回退。")
W("")
W("### 槽位的判定阈值（供皮肤侧分类器对齐）")
W("")
W("| 槽位 | 触发视觉特征 |")
W("|---|---|")
W("| `neutral` | 眉眼平、嘴闭合、无张力 |")
W("| `smile` | 嘴角上扬（可闭眼），眉眼放松 |")
W("| `laugh` | 张口露齿/闭眼仰头，笑肌明显 |")
W("| `angry` | 眉压低皱起、嘴角下压，可伴张口喊叫 |")
W("| `glare` | 眼睑压低、半眼凌厉、视线锁定（「横目」「睨む」） |")
W("| `surprised` | 睁大眼、眉上扬、口微张 |")
W("| `troubled` | 眉眼下垂、苦笑、手掩口、视线游移 |")
W("| `sad` | 眼睑下垂、嘴角下压、可闭眼 |")
W("| `serious` | 眼神坚定直视、眉平、唇紧 |")
W("| `think` | 视线偏移（侧目/上视）、眉微动 |")
W("| `tired` | 半闭眼、眼下阴影、张口叹气状 |")
W("| `shy` | 脸红、视线游移、可含手部动作 |")
W("")
W("---")
W("")
W("## 表 2 · 触发规则")

# ---- 2a narration ----
W("")
W("### 2a. 叙述触发（**主表**——叙事文本里的演出指示）")
W("")
W("每条规则 = 一个动作类 → 槽位，并附**支持条数与原文行号**。")
W("行号对应 `script_text_ja.ctd` 全局行号，可直接溯源。")
W("")
trig_rows = []
for ch in LEADS:
    for cls, d in sorted(trig.get(ch, {}).items(), key=lambda kv: -kv[1]["support"]):
        if d["support"] < 3:
            continue
        trig_rows.append((ch, cls, d))
W("| 角色 | 动作类（叙述原文措辞） | → 槽位 | 强度 | 支持 | 原文示例（叙述） | 行号 |")
W("|---|---|---|---|---|---|---|")
for ch, cls, d in sorted(trig_rows, key=lambda t: (LEADS.index(t[0]), -t[2]["support"])):
    ex = d["examples"][0]
    inten = Counter(x["intensity"] for x in d["examples"]).most_common(1)[0][0]
    W("| %s | %s | `%s` | %s | %d | 「%s」 | %s |" %
      (NAME[ch], cls, d["slot"], inten, d["support"],
       ex["raw"].replace("|", "/"),
       ", ".join(str(x) for x in d["lines"][:6]) + ("…" if len(d["lines"]) > 6 else "")))
W("")
W("> 表中每条都能追溯到一条叙述原文：`原文示例` 列就是该规则在语料里真实出现的句子，")
W("> `行号` 列给出全部支持位置（截断显示前 6 个）。")
W("")

# ---- 2b dialogue / topic ----
W("### 2b. 台词触发（内容/话题 → 槽位）")
W("")
W("以下规则来自「台词条目 + 场景线」的交叉归纳，每条同样给出行号锚点。")
W("")
DIALOG = [
    ("青子", "被说教 / 被当成小孩 / 被质疑能力", "angry", "アンタ、私を誰だと思ってるの 系；不機嫌・刺々しい叙述", "300, 416, 483, 605, 12926"),
    ("青子", "涉及钱 / 生活费 / 打工收入", "serious", "穷困梗：学費と生活費を自分で、という話題で表情が引き締まる", "626, 627, 754, 12338"),
    ("青子", "提到妹妹橙子 / 苍崎家继承", "serious", "「後継ぎ」関連の叙述でトーンが落ちる", "3172, 3211, 18783"),
    ("青子", "被人认真夸奖 / 被感谢", "shy", "照れ系 47 条中青子占多数；「顔を赤らめる」系", "14304, 16204"),
    ("青子", "草十郎做出超乎常识的举动", "surprised", "「呆然」「目を丸く」「ぱちりと開く」系", "110, 365, 511, 673"),
    ("青子", "熬夜 / 被吵醒 / 做学生会杂务", "tired", "ため息 38 条、欠伸、瞼が重い系", "99, 125, 456, 491, 764"),
    ("有珠", "涉及魔术 / 结界 / プラント（使い魔）", "serious", "魔术相关叙述里她的表情最紧", "3243, 5993, 13561"),
    ("有珠", "被问及自己的过去 / 久遠寺家", "troubled", "手掩口・目を伏せる系", "9926, 10023, 14304"),
    ("有珠", "草十郎做出无防备的善意举动", "smile", "閉眼微笑（i4=19 系）", "424, 10086, 11999"),
    ("有珠", "青子做出越界/吵闹的行为", "glare", "冷眼斜视（i4=03 系）", "7544, 7549, 11999"),
    ("有珠", "被当成小孩子 / 被摸头", "troubled", "困惑・不機嫌の混在", "10024, 10435"),
    ("金鹿", "被起绰号 / 被调侃（青子叫她「クマ」）", "troubled", "绰号系调侃；L10487/10492/10495 一带；素材上只能落到 neutral/闭眼笑", "9559, 10487, 10492, 10495"),
    ("金鹿", "打工场合的闲聊 / 八卦", "smile", "她与草十郎是打工同事兼同年级（L10093~L10098）；闭眼微笑（i4=07）", "8800, 8893, 10131"),
    ("金鹿", "讲自己着迷的话题（鸟类绝灭史等）", "smile", "L10131~L10260 长篇讲给草十郎听；情绪外放靠台词而非表情", "10131, 10260"),
    ("金鹿", "被草十郎的迟钝气到 / 说重话", "serious", "L10103「都会育ちの久万梨にとって…すべてが癪に障る」；素材落到 neutral", "10099, 10103, 10112"),
    ("金鹿", "学生会正事 / 被交付任务", "serious", "L11363 起生徒会室段落，金鹿担任青子的实务", "11363, 11365, 11370"),
    ("金鹿", "发现异常 / 追查证据", "serious", "L12569~12694 集名单、发现伪造 JIS 标记；她的现实主义在这里最明显", "12569, 12694, 21870"),
    ("金鹿", "番外篇的恐怖场面 / 独自遇险", "surprised", "L21447~21551、L21774~21878；回退到 neutral", "21447, 21774, 22083"),
    ("全員", "战斗 / 魔术行使", "serious", "术式叙述里三人均为「凛とした」系", "6016, 6020, 6051, 6840"),
    ("全員", "意外事件发生", "surprised", "「驚く」类 29 条证据", "110, 365, 511, 12055"),
    ("全員", "被对方的话戳中", "troubled", "「顔を曇らせる」23 条 + 「眉をひそめる」20 条", "198, 575, 583, 11999"),
    ("全員", "疲惫 / 收工 / 深夜", "tired", "「ため息」38 条 + 「肩をすくめる」", "456, 491, 689, 764"),
]
W("| 角色 | 说话人/话题条件 | → 槽位 | 叙述依据 | 行号锚点 |")
W("|---|---|---|---|---|")
for who, cond, slot, why, lines in DIALOG:
    W("| %s | %s | `%s` | %s | %s |" % (who, cond, slot, why, lines))
W("")
W("### 2c. 运行时触发（可选，皮肤侧）")
W("")
W("| 条件 | → 槽位 | 说明 |")
W("|---|---|---|")
W("| 工具调用失败 / 报错 | `tired` | 对应原作「ため息」38 条证据 |")
W("| 被用户夸奖 | `shy`（青子/有珠）、`smile`（金鹿） | 照れ系证据集中在青子与有珠 |")
W("| 检测到用户在开玩笑 | `smile` | 原作日常段落的主导槽位 |")
W("| 话题涉及金钱/成本 | `serious` | 青子穷困梗 |")
W("| 长时间无交互后重新开始 | `neutral` | 默认态 |")
W("")
W("---")
W("")
W("## 表 3 · 资源映射")
W("")
W("路径均为 `hfa_png/out/` 下的相对路径。")
W("每格给出该槽位在**某个服装**下的**全部**可用差分（同槽位多张 = SillyTavern 的")
W("「Allow multiple sprites per expression」，可以轮换避免呆板）。")
W("")

for ch in LEADS:
    W("### %s（`%s`）" % (NAME[ch], ch))
    W("")
    W("| 槽位 | 可用 | 首选服装 | 文件（示例，完整列表见 JSON） | 文件数 |")
    W("|---|---|---|---|---|")
    for sid, _zh, _ja, _n in SLOTS:
        e = table3[ch][sid]
        if e["available"]:
            first = e["outfits"][0]
            W("| `%s` | ✅ | %s | `%s` | %d |" %
              (sid, first["outfit"], first["files"][0], first["count"]))
        else:
            fb = e["fallback"] or "neutral"
            W("| `%s` | ➡️ 回退 | → `%s` | 该角色无此槽位差分，回退到 `%s` 的差分 | 0 |" %
              (sid, fb, fb))
    W("")

# ---------- json / yaml ----------
doc = {
    "meta": {
        "title": "关联图像笔记 —— 说/听到什么话 → 什么表情",
        "work": "魔法使いの夜 / 魔法使之夜 (Witch on the Holy Night)",
        "corpus": "script_text_ja.ctd",
        "corpus_lines": 24134,
        "extraction": "32-shard map-reduce over the full script",
        "expression_records": len(exp),
        "psych_records": len(records["P"]),
        "attribution_records": len(records["A"]),
        "sprite_root": "hfa_png/out/",
        "sprite_files_total": 23747,
        "catalogued_cells": sum(len(v) for c in sprites.values() for o in c.values() for v in o.values()),
        "slot_count": len(SLOTS),
        "critical_note": "i4 in sprite filenames is NOT a global expression code; "
                         "slot assignment comes from per-cell visual judgement.",
    },
    "table1_slots": [
        {
            "id": sid, "label_zh": zh, "label_ja": ja,
            "narration_support": slot_total.get(sid, 0),
            "per_character_support": {ch: slot_by_char[ch].get(sid, 0) for ch in LEADS},
            "sprite_available": {ch: table3[ch][sid]["available"] for ch in LEADS},
            "note": note,
        }
        for sid, zh, ja, note in SLOTS
    ],
    "table2_triggers": {
        "narration": [
            {
                "character": ch, "action_class": cls, "slot": d["slot"],
                "support": d["support"], "lines": d["lines"],
                "examples": d["examples"],
                "slot_distribution": d["slot_dist"],
            }
            for ch in LEADS for _c, d in sorted(trig.get(ch, {}).items())
            for cls in [_c] if d["support"] >= 2
        ],
        "dialogue": [
            {"character": w, "condition": c, "slot": s, "narration_basis": why,
             "anchor_lines": [int(x) for x in ln.replace(" ", "").split(",") if x.isdigit()]}
            for w, c, s, why, ln in DIALOG
        ],
        "runtime": [
            {"condition": "工具调用失败 / 报错", "slot": "tired"},
            {"condition": "被用户夸奖", "slot": "shy", "note": "金鹿用 smile"},
            {"condition": "用户开玩笑", "slot": "smile"},
            {"condition": "话题涉及金钱/成本", "slot": "serious"},
            {"condition": "长间隔后重新开始", "slot": "neutral"},
        ],
    },
    "table3_resources": {
        ch: {
            sid: {
                "available": table3[ch][sid]["available"],
                "fallback": table3[ch][sid]["fallback"],
                "outfits": table3[ch][sid]["outfits"],
            }
            for sid in SLOT_IDS
        }
        for ch in LEADS
    },
    "slot_classifier_hints": {
        "neutral": "眉眼平、嘴闭合、无张力",
        "smile": "嘴角上扬（可闭眼），眉眼放松",
        "laugh": "张口露齿/闭眼仰头，笑肌明显",
        "angry": "眉压低皱起、嘴角下压，可伴张口喊叫",
        "glare": "眼睑压低、半眼凌厉、视线锁定",
        "surprised": "睁大眼、眉上扬、口微张",
        "troubled": "眉眼下垂、苦笑、手掩口、视线游移",
        "sad": "眼睑下垂、嘴角下压、可闭眼",
        "serious": "眼神坚定直视、眉平、唇紧",
        "think": "视线偏移（侧目/上视）、眉微动",
        "tired": "半闭眼、眼下阴影、张口叹气状",
        "shy": "脸红、视线游移、可含手部动作",
    },
    "translate_to_english_before_classification": True,
    "allow_multiple_sprites_per_expression": True,
    "reroll_on_repeat": True,
}

with open(os.path.join(OUT, "expression-notes.json"), "w", encoding="utf-8") as fh:
    json.dump(doc, fh, ensure_ascii=False, indent=2)


# ---- minimal YAML emitter (avoids a PyYAML dependency) ----
def y(v, ind=0):
    sp = "  " * ind
    if isinstance(v, dict):
        if not v:
            return "{}"
        out = []
        for k, val in v.items():
            if isinstance(val, (dict, list)) and val:
                out.append("%s%s:\n%s" % (sp, k, y(val, ind + 1)))
            else:
                out.append("%s%s: %s" % (sp, k, y(val, ind + 1)))
        return "\n".join(out)
    if isinstance(v, list):
        if not v:
            return "[]"
        out = []
        for item in v:
            if isinstance(item, (dict, list)) and item:
                body = y(item, ind + 1)
                body = body[len("  " * (ind + 1)):]
                out.append("%s- %s" % (sp, body.lstrip()))
            else:
                out.append("%s- %s" % (sp, y(item, ind + 1)))
        return "\n".join(out)
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    if s == "" or any(c in s for c in ":#{}[],&*!|>'\"%@`\n") or s.strip() != s:
        return '"%s"' % s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
    return s


with open(os.path.join(OUT, "expression-notes.yaml"), "w", encoding="utf-8") as fh:
    fh.write("# 关联图像笔记（魔法使之夜）\n")
    fh.write("# 由 32 片 map-reduce 全文提取 + hfa_png 逐格视觉编目生成\n")
    fh.write(y(doc) + "\n")

with open(os.path.join(OUT, "expression-notes.md"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(L) + "\n")

print("wrote expression-notes.md / .json / .yaml")
print("narration trigger rows:", len(trig_rows))
print("catalogued cells:", doc["meta"]["catalogued_cells"])
for ch in LEADS:
    ok = [s for s in SLOT_IDS if table3[ch][s]["available"]]
    print("%s: %d/%d slots with sprites" % (ch, len(ok), len(SLOT_IDS)))
