#!/usr/bin/env python3
"""Step 5: per-character REDUCE input.

Produces one compact text file per lead, keeping every piece of evidence but
stripping markdown table padding so the token cost stays low.

Output: persona_work/agg/reduce_<code>.txt
"""
import json
import os
from collections import Counter, defaultdict

AGG = r"D:\QuickLook插件包\moye\persona_work\agg"
LEADS = ["aok", "ari", "kin"]
NAME = {"aok": "蒼崎青子", "ari": "久遠寺有珠", "kin": "久万梨金鹿"}
KANA = {"aok": "あおこ", "ari": "ありす", "kin": "かな"}
ROLE = {
    "aok": "三咲高校生徒会長・蒼崎家の後継者・魔術師",
    "ari": "久遠寺邸の主・魔女・プラント(使い魔)使い",
    "kin": "三咲高校生徒会の友人・一般人",
}

with open(os.path.join(AGG, "records.json"), encoding="utf-8") as fh:
    rec = json.load(fh)

# normalize MAP-pass spelling variants so the counts are honest
INTENSITY = {"強": "强", "強め": "强", "強烈": "强", "弱め": "弱", "中程度": "中"}
SLOT_FIX = {"angry": "angry", "anger": "angry", "glare ": "glare"}


def norm_int(v):
    v = (v or "").strip()
    return INTENSITY.get(v, v)


def norm_slot(v):
    v = (v or "").strip()
    return SLOT_FIX.get(v, v)


for r in rec["E"]:
    r["intensity"] = norm_int(r["intensity"])
    r["slot"] = norm_slot(r["slot"])


def by_subject(items, key):
    d = defaultdict(list)
    for r in items:
        d[r.get(key)].append(r)
    return d


E = by_subject(rec["E"], "subject")
P = by_subject(rec["P"], "subject")
A = by_subject(rec["A"], "speaker")
V = defaultdict(list)
for r in rec["V"]:
    V[r["speaker"]].append(r)

scenes_self = defaultdict(list)
for s in rec["S"]:
    for who in (s["who"] or "").split(","):
        scenes_self[who.strip()].append(s)

for code in LEADS:
    L = []
    W = L.append
    ex = sorted(E.get(code, []), key=lambda r: r["line"] or 0)
    ps = sorted(P.get(code, []), key=lambda r: r["line"] or 0)
    at = sorted(A.get(code, []), key=lambda r: r["line"] or 0)
    vs = V.get(code, [])

    W("# REDUCE 输入：%s（%s / %s）" % (NAME[code], code, KANA[code]))
    W("")
    W("角色定位提示：%s" % ROLE[code])
    W("")
    W("本文件是 32 个 MAP 子 agent 通读《魔法使之夜》日文全文 24,134 行后，")
    W("筛出的**全部**与 %s 相关的结构化记录。行号 = script_text_ja.ctd 全局行号。" % NAME[code])
    W("")
    W("## 数量概览")
    W("- 表情/动作标注: %d" % len(ex))
    W("- 心理描写: %d" % len(ps))
    W("- 该角色台词条目: %d" % len(at))
    W("- 语癖样本: %d" % len(vs))
    W("- 槽位分布: %s" % ", ".join("%s=%d" % kv for kv in Counter(r["slot"] for r in ex).most_common()))
    W("- 强度分布: %s" % ", ".join("%s=%d" % kv for kv in Counter(r["intensity"] for r in ex).most_common()))
    W("- 指向对象: %s" % ", ".join("%s=%d" % kv for kv in
                                  Counter(r["target"] for r in ex
                                          if r.get("target") not in (None, "", "-")).most_common(10)))
    W("")
    W("## 1. 表情·动作·演出指示（叙述原文 → 槽位）")
    W("格式: line | raw原作叙述 | act | slot | 强度 | 对象")
    for r in ex:
        W("%s | %s | %s | %s | %s | %s" % (r["line"], r["raw"], r["act"], r["slot"],
                                           r["intensity"], r.get("target") or "-"))
    W("")
    W("## 2. 心理描写·内心·性格证据")
    W("格式: line | inner原作 | trait_hint")
    for r in ps:
        W("%s | %s | %s" % (r["line"], r["inner"], r["traits"]))
    W("")
    W("## 3. 该角色的台词条目（说话人归属证据）")
    W("格式: line | confidence | evidence原作引导句")
    for r in at:
        W("%s | %s | %s" % (r["line"], r["conf"], r["ev"]))
    W("")
    W("## 4. 语癖样本（短语式，含出现次数）")
    W("格式: kind | pattern | 次数")
    for (kind, pat), c in Counter((r["kind"], r["pattern"]) for r in vs).most_common():
        W("%s | %s | %d" % (kind, pat, c))
    W("")
    W("## 5. 全部场景线（按行号，标注该角色是否在场）")
    W("格式: lines | 在场者 | 概要   ← ★ 标记 = 本角色在场")
    for s in sorted(rec["S"], key=lambda r: r["start"] or 0):
        who = s["who"] or ""
        mark = "★" if code in who else " "
        W("%s %s-%s | %s | %s" % (mark, s["start"], s["end"], who, s["what"]))
    W("")
    p = os.path.join(AGG, "reduce_%s.txt" % code)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print("%s -> %s (%d bytes, %d lines)" % (code, p, os.path.getsize(p), len(L)))
