"""修正 kin/koj 缺陷 —— 把「久万梨金鹿」的立绘映射从错误的 kin_*（=木乃美芳助）改为正确的 koj_*

同时修正命名（kinu → kumari / Kinu Kumari → Kumari Kojika）。

依据（均为实测）：
  · 官方英文剧本 L23996："you're exactly the same as Kojika Kumari"
  · 日文原文注音   L10093：<久万梨|くまり><金鹿|こじか>
    → 久万梨 = くまり(Kumari，姓) / 金鹿 = こじか(Kojika，名)
  · 全库立绘前缀实测：kin = 木乃美芳助（红发男生）/ koj = 久万梨金鹿
  · koj 的表情经逐格视觉判定：i4=01 平静 / i4=07 认真·锐利 / i3=26 特殊造型·挑衅
"""
import json, os, re, shutil, glob, sys, collections

W = r"D:\QuickLook插件包\moye"
ROOT = os.path.join(W, "hfa_png", "out")
LOG = []


def log(s):
    print(s)
    LOG.append(s)


# ── 1. 枚举 koj 的实际素材 ────────────────────────────────────────────────
def scan_koj():
    pat = re.compile(r"^koj_([a-z])_(\d{2})_(\d{2})_(\d{2})(?:_(\d+)_(\d+))?(_b)?\.mzp\.png$")
    close = collections.defaultdict(list)   # (i3,i4) -> [path]
    for d in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, d)
        if not os.path.isdir(dp):
            continue
        for fn in sorted(os.listdir(dp)):
            m = pat.match(fn)
            if not m:
                continue
            b, i3, i4, var, x, y, bflag = m.groups()
            if not bflag:                    # 只收特写版做映射（全身版另列）
                close[(i3, i4)].append(f"{d}/{fn}")
    return close


# ── 2. 视觉判定结果（人工，依据 persona_work/scene/koj_faces_compare.jpg） ──
#   i4=01 → 平静（眼睛大睁、眉毛平）
#   i4=07 → 认真·锐利（眉毛压低、眼神偏侧）
#   i3=26 i4=00 → 挑衅·得意（压眉＋嘴角上扬）—— 特殊造型，六个景均不使用
JUDGE = {
    ("00", "01"): ("neutral", "平静：眼睛大睁、眉毛平"),
    ("00", "07"): ("serious", "认真·锐利：眉毛压低、眼神偏侧"),
    ("01", "01"): ("neutral", "平静：眼睛大睁、眉毛平"),
    ("01", "07"): ("serious", "认真·锐利：眉毛压低、头部倾斜"),
    ("26", "00"): ("smirk",   "挑衅·得意：压眉＋嘴角上扬（非标准槽位；特殊造型专用）"),
}
# i3 → 服装名（依据选景结果表的服装对照）
OUTFIT = {
    "00": ("uniform", "三咲高校制服（棕西装外套＋红领结＋百褶裙＋黑裤袜）"),
    "01": ("winter",  "冬季便服（格子围巾＋青绿色上衣）"),
    "26": ("special", "特殊造型（黄领＋红项圈）"),
}


def build_koj(close):
    out = {}
    for (i3, i4), files in sorted(close.items()):
        if (i3, i4) not in JUDGE:
            continue
        slot, _ = JUDGE[(i3, i4)]
        oname, _ = OUTFIT[i3]
        out.setdefault(oname, {}).setdefault(slot, []).extend(files)
    return out


# ── 3. 修 slot_sprites.json ─────────────────────────────────────────────
def fix_slot_sprites(koj):
    p = os.path.join(W, "persona_work", "agg", "slot_sprites.json")
    d = json.load(open(p, encoding="utf-8"))
    log(f"slot_sprites.json 原键: {list(d)}")
    if "kin" in d:
        d["kanomi"] = d.pop("kin")
        d["_note_kanomi"] = "kin = 木乃美芳助（红发男生，棕外套＋蓝领带）。原误标为久万梨金鹿，已更正键名。"
        log("  kin → kanomi（木乃美芳助）")
    d["koj"] = koj
    d["_note_koj"] = ("koj = 久万梨金鹿（くまり こじか / Kumari Kojika）。"
                      "按服装行(i3)分组；该角色全库仅有 3 种表情，其余槽位无差分需 fallback。")
    d["_corrections"] = {
        "date": "2026-09-16",
        "issue": "kin 被误标为久万梨金鹿，实为木乃美芳助",
        "evidence": ["script_text_en.ctd L23996 'Kojika Kumari'",
                     "script_text_ja.ctd L10093 <久万梨|くまり><金鹿|こじか>"],
        "fix": "kin→kanomi；新增 koj",
    }
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    log(f"  写入 {p}；新键: {[k for k in d if not k.startswith('_')]}")


# ── 4. 修 expression-notes.json ─────────────────────────────────────────
SLOTS = ["neutral", "smile", "laugh", "angry", "glare", "surprised",
         "troubled", "sad", "serious", "think", "tired", "shy"]
FALLBACK = {"smile": "neutral", "laugh": "smile", "angry": "serious", "glare": "serious",
            "surprised": "neutral", "troubled": "serious", "sad": "serious",
            "think": "serious", "tired": "serious", "shy": "neutral"}


def resource_entry(koj, slot):
    outs = []
    for oname, slots in koj.items():
        if slot in slots:
            outs.append({"outfit": oname, "count": len(slots[slot]), "files": slots[slot]})
    if outs:
        return {"available": True, "fallback": None, "outfits": outs}
    # 无差分 → 走 fallback
    fb = FALLBACK.get(slot)
    if fb and any(fb in s for s in koj.values()):
        return {"available": False, "fallback": fb, "outfits": []}
    return {"available": False, "fallback": "neutral", "outfits": []}


def fix_expression_notes(koj):
    p = os.path.join(W, "image_notes", "expression-notes.json")
    d = json.load(open(p, encoding="utf-8"))
    t3 = d["table3_resources"]
    log(f"expression-notes.json 表3 原键: {list(t3)}")
    if "kin" in t3:
        t3["kanomi"] = t3.pop("kin")
        log("  table3.kin → kanomi（木乃美芳助）")
    t3["koj"] = {s: resource_entry(koj, s) for s in SLOTS}
    d["meta"]["corrections"] = [
        "2026-09-16 修正：table3 的 kin 实为木乃美芳助（男性），已改名 kanomi；"
        "新增 koj = 久万梨金鹿（くまり こじか / Kumari Kojika）。",
        "koj 全库仅 3 种表情（i4=01 平静 / i4=07 认真 / i3=26 挑衅），"
        "故 12 槽位中只有 neutral 与 serious 有小鹿自身差分，其余全部 fallback。",
    ]
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    log(f"  写入 {p}；表3 新键: {list(t3)}")
    return d


def main():
    log("=== 扫描 koj 素材 ===")
    close = scan_koj()
    log(f"  (i3,i4) 组合 {len(close)} 个: {sorted(close)}")
    koj = build_koj(close)
    log("=== 重建后的 koj 映射 ===")
    for oname, slots in koj.items():
        for s, fs in slots.items():
            log(f"  {oname:<8} {s:<8} {len(fs)} 张   例 {fs[0]}")
    log("")
    fix_slot_sprites(koj)
    log("")
    d = fix_expression_notes(koj)
    log("")
    log("=== koj 的 12 槽位状态 ===")
    for s in SLOTS:
        e = d["table3_resources"]["koj"][s]
        st = f"✅ {sum(o['count'] for o in e['outfits'])} 张" if e["available"] else f"➡️ fallback → {e['fallback']}"
        log(f"  {s:<10} {st}")
    open(os.path.join(W, "persona_work", "agg", "fix_kin_koj.log"), "w", encoding="utf-8").write("\n".join(LOG))


if __name__ == "__main__":
    main()
