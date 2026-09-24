"""交付前自检：JSON 可解析、文件都存在、槽位覆盖、规模统计。"""
import json, os, re, sys
from collections import Counter

STAGE = r"D:\QuickLook插件包\moye\persona_work\stage"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
AGG = r"D:\QuickLook插件包\moye\persona_work\agg"
FILES = ["scenes.json", "expressions.json", "expressions_extended.json",
         "cn_predicates.json", "cn_predicates.md", "outfit_index.json",
         "eye_anchor.json", "slots_manual_main.json", "spec-staging.md",
         "spec-switching.md", "tech-notes.md", "OPEN-QUESTIONS.md",
         "README.md", "expression-matrix.md", "scene_data.md"]
SLOTS = ["neutral", "smile", "laugh", "angry", "glare", "surprised",
         "troubled", "sad", "serious", "think", "tired", "shy"]

ok = True
print("== 交付文件存在性 ==")
for f in FILES:
    p = os.path.join(STAGE, f)
    e = os.path.exists(p)
    ok &= e
    print(f"   {'✔' if e else '✘'} {f:32} {os.path.getsize(p) if e else 0:>9} B")
for f in ("sprite_sequence.json",):
    p = os.path.join(AGG, f)
    print(f"   {'✔' if os.path.exists(p) else '✘'} agg/{f}")

print("\n== JSON 可解析性 ==")
for f in FILES:
    if not f.endswith(".json"):
        continue
    try:
        json.load(open(os.path.join(STAGE, f), encoding="utf-8"))
        print(f"   ✔ {f}")
    except Exception as e:
        ok = False
        print(f"   ✘ {f}: {e}")

exp = json.load(open(os.path.join(STAGE, "expressions.json"), encoding="utf-8"))
sc = json.load(open(os.path.join(STAGE, "scenes.json"), encoding="utf-8"))["scenes"]
idx = json.load(open(os.path.join(STAGE, "outfit_index.json"), encoding="utf-8"))

print("\n== 景 → 槽位覆盖 / 立绘文件存在性 ==")
tot_files = 0
missing = []
for sid, v in exp["scenes"].items():
    if not v.get("character"):
        print(f"   {sid:5} 无角色")
        continue
    have = [s for s in SLOTS if v["slots"].get(s)]
    n = sum(len(x) for x in v["slots"].values())
    tot_files += n
    bad = []
    for s in SLOTS:
        for it in v["slots"].get(s, []):
            fid = it["file"]
            if not any(os.path.exists(os.path.join(ROOT, a, fid + ".mzp.png"))
                       for a in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, a))):
                bad.append(fid)
    missing += bad
    print(f"   {sid:5} {v['character']} i3={v['outfit_i3']}  {len(have):2}/12 槽位  "
          f"{n:3} 个文件  缺文件 {len(bad)}")

print(f"\n   立绘文件合计 {tot_files} 条引用，缺文件 {len(missing)} 条")
if missing:
    ok = False
    print("   缺:", missing[:10])

print("\n== 服装行全量清单 ==")
for k, v in idx.items():
    print(f"   {k}: {len(v['channels'])} 通道 / {v['frames_total']} 帧")

cn = json.load(open(os.path.join(STAGE, "cn_predicates.json"), encoding="utf-8"))
print(f"\n== 中文谓词表 ==\n   叙述 {len(cn['narration'])} 条 / 台词 {len(cn['dialogue'])} 条 "
      f"/ 运行时 {len(cn['runtime'])} 条")

print(f"\n== 总判定：{'通过 ✔' if ok else '有问题 ✘'} ==")
