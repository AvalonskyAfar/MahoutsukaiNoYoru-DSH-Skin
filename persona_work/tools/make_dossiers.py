#!/usr/bin/env python3
"""Step 5 support: split the aggregated MAP records into per-character dossiers.

The REDUCE agents must be able to see everything about one character without
reading the other two, so each dossier carries a self-contained slice:
  - every expression record where that character is the subject
  - every psych record
  - every attribution record where that character is the speaker
  - every voice sample
  - every scene tag listing that character
  - a slot histogram computed over that character's expressions
Output: persona_work/agg/dossier_<code>.md
"""
import json
import os
import re
from collections import Counter, defaultdict

AGG = r"D:\QuickLook插件包\moye\persona_work\agg"
SUBJ = ["aok", "ari", "kin"]
NAME = {"aok": "蒼崎青子", "ari": "久遠寺有珠", "kin": "久万梨金鹿",
        "sou": "静希草十郎", "tou": "蒼崎橙子", "tob": "槻司鳶丸",
        "sis": "山城老师", "oth": "其他配角", "mob": "路人", "unknown": "未定"}

with open(os.path.join(AGG, "records.json"), encoding="utf-8") as fh:
    rec = json.load(fh)


def grp(items):
    by = defaultdict(list)
    for r in items:
        by[r.get("subject") or r.get("speaker")].append(r)
    return by


E = grp(rec["E"])
P = grp(rec["P"])
A = grp(rec["A"])
V = grp(rec["V"])

for code in SUBJ:
    L = []
    L.append("# 角色档案素材：%s（%s）" % (NAME[code], code))
    L.append("")
    L.append("> 本文件是 MAP 阶段从《魔法使之夜》全文 24,134 行提取出的、**与 %s 相关的全部结构化记录**。" % NAME[code])
    L.append("> 行号为日文原文 `script_text_ja.ctd` 的全局行号，可供溯源核对。")
    L.append("> `raw` / `evidence` / `inner` 字段是原文片段（保留日文原样）；`slot` / `trait_hint` 是提取者的归纳标签。")
    L.append("")

    ex = sorted(E.get(code, []), key=lambda r: r["line"] or 0)
    ps = sorted(P.get(code, []), key=lambda r: r["line"] or 0)
    at = sorted(A.get(code, []), key=lambda r: r["line"] or 0)
    vs = V.get(code, [])
    sc = [s for s in rec["S"] if code in (s["who"] or "")]

    L.append("## 统计概览")
    L.append("- 表情标注（叙述中的演出指示）：**%d 条**" % len(ex))
    L.append("- 心理描写：**%d 条**" % len(ps))
    L.append("- 该角色为说话人的台词条目：**%d 条**" % len(at))
    L.append("- 语癖样本：**%d 条**" % len(vs))
    L.append("- 出场场景：**%d 段**" % len(sc))
    sl = Counter(r["slot"] for r in ex)
    L.append("- 表情槽位分布：%s" % ", ".join("%s=%d" % (k, v) for k, v in sl.most_common()))
    L.append("- 表情强度分布：%s" % ", ".join(
        "%s=%d" % (k, v) for k, v in Counter(r["intensity"] for r in ex).most_common()))
    tg = Counter(r["target"] for r in ex if r.get("target") not in (None, "-", ""))
    L.append("- 表情指向对象分布：%s" % ", ".join("%s=%d" % (k, v) for k, v in tg.most_common(8)))
    L.append("")

    L.append("## A. 表情与动作（叙述原文 → 槽位）")
    L.append("| line | subject | raw（原文） | act | slot | 强度 | 对象 |")
    L.append("|---|---|---|---|---|---|---|")
    for r in ex:
        L.append("| %s | %s | %s | %s | %s | %s | %s |" %
                 (r["line"], r["subject"], (r["raw"] or "").replace("|", "/"),
                  r["act"], r["slot"], r["intensity"], r.get("target") or "-"))
    L.append("")

    L.append("## B. 心理描写与性格证据")
    L.append("| line | inner（原文） | trait_hint |")
    L.append("|---|---|---|")
    for r in ps:
        L.append("| %s | %s | %s |" % (r["line"], (r["inner"] or "").replace("|", "/"),
                                        r["traits"]))
    L.append("")

    L.append("## C. 该角色的台词条目（说话人归属证据）")
    L.append("| line | confidence | evidence（原文引导句） |")
    L.append("|---|---|---|")
    for r in at:
        L.append("| %s | %s | %s |" % (r["line"], r["conf"],
                                        (r["ev"] or "").replace("|", "/")))
    L.append("")

    L.append("## D. 语癖样本（短语式）")
    L.append("| kind | pattern | 出现次数 |")
    L.append("|---|---|---|")
    cnt = Counter((r["kind"], r["pattern"]) for r in vs)
    for (kind, pat), c in cnt.most_common():
        L.append("| %s | %s | %d |" % (kind, pat, c))
    L.append("")

    L.append("## E. 出场场景（按行号排序）")
    L.append("| lines | who | what |")
    L.append("|---|---|---|")
    for s in sorted(sc, key=lambda r: r["start"] or 0):
        L.append("| %s-%s | %s | %s |" % (s["start"], s["end"], s["who"],
                                          (s["what"] or "").replace("|", "/")))
    L.append("")

    # story-wide scene list so the reducer can see the whole arc in order
    L.append("## F. 全局剧情线（全部场景，供判断角色在故事中的位置）")
    L.append("| lines | who | what |")
    L.append("|---|---|---|")
    for s in sorted(rec["S"], key=lambda r: r["start"] or 0):
        L.append("| %s-%s | %s | %s |" % (s["start"], s["end"], s["who"],
                                          (s["what"] or "").replace("|", "/")))
    L.append("")

    p = os.path.join(AGG, "dossier_%s.md" % code)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print("%s -> %s  (%d bytes)" % (code, p, os.path.getsize(p)))
