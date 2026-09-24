"""生成最终对照表（按用户确认结果）

用户确认：
  - 初始界面：浅色 = m01s，深色 = m56（**两首**，皮肤按明暗主题分别用）
  - 日常对话：浅色循环 8 首 + 深色循环 5 首（共 13 首）
  - ED：m53
  - 主题曲：用户明确「不用那个了」→ 不单列主题曲
  - 个人收藏：m01 / m03 / m41（不属于四项选曲，单列备注）
  - 未标注的 45 首 → 统一标「未采用」
"""
import json, os, csv

BGM = r"D:\QuickLook插件包\moye\bgm"
A = json.load(open(os.path.join(BGM, "bgm_analysis.json"), encoding="utf-8"))

INIT_LIGHT = ["m01s"]
INIT_DARK = ["m56"]
DAILY_LIGHT = ["m02", "m08", "m09", "m17", "m27", "m29", "m37", "m49"]
DAILY_DARK = ["m06", "m18", "m46", "m47", "m63"]
ED = ["m53"]
FAVORITE = ["m01", "m03", "m41"]


def role(n):
    t = []
    if n in INIT_LIGHT: t.append("初始界面·浅色")
    if n in INIT_DARK: t.append("初始界面·深色")
    if n in DAILY_LIGHT: t.append("日常·浅色")
    if n in DAILY_DARK: t.append("日常·深色")
    if n in ED: t.append("ED")
    if n in FAVORITE: t.append("【个人收藏】")
    return " + ".join(t) if t else "未采用"


def facts(d):
    f = []
    if d["duration"] < 75: f.append("短")
    if d["rms"] < 0.05: f.append("极安静")
    elif d["rms"] < 0.07: f.append("安静")
    elif d["rms"] > 0.14: f.append("响亮")
    if d["peak"] < 0.30: f.append("电平很低")
    if d["leadInSeconds"] > 1.5: f.append("长前奏")
    if d["tailOutSeconds"] > 8: f.append("长淡出")
    elif d["tailOutSeconds"] < 0.5: f.append("无淡出")
    if d["loopCorr"] > 0.7: f.append(f"强循环~{d['loopSeconds']:.0f}s")
    return ", ".join(f)


names = sorted(A)
rows = []
for n in names:
    d = A[n]
    rows.append({
        "编号": n,
        "时长": f"{int(d['duration']//60)}:{d['duration']%60:04.1f}",
        "时长s": round(d["duration"], 2),
        "MB": round(os.path.getsize(os.path.join(BGM, n + ".ogg")) / 1048576, 2),
        "用途": role(n),
        "RMS": round(d["rms"], 5),
        "峰值": round(d["peak"], 4),
        "前导s": round(d["leadInSeconds"], 2),
        "尾出s": round(d["tailOutSeconds"], 2),
        "确认状态": "用户已确认" if role(n) != "未采用" else "未采用",
        "客观特征": facts(d),
    })

out = os.path.join(BGM, "bgm_mapping.tsv")
with open(out, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter="\t")
    w.writeheader()
    w.writerows(rows)
print("->", out)

# ---- 统计 ----
from collections import Counter
c = Counter(r["用途"] for r in rows)
print(f"\n{'用途':<26}{'首数'}")
print("-" * 40)
for k, v in c.most_common():
    print(f"{k:<26}{v}")
print(f"{'合计':<26}{sum(c.values())}")

print(f"\n初始界面·浅色 : {' '.join(INIT_LIGHT)}")
print(f"初始界面·深色 : {' '.join(INIT_DARK)}")
print(f"日常·浅色     : {' '.join(DAILY_LIGHT)}  ({len(DAILY_LIGHT)} 首)")
print(f"日常·深色     : {' '.join(DAILY_DARK)}  ({len(DAILY_DARK)} 首)")
print(f"ED           : {' '.join(ED)}")
print(f"个人收藏      : {' '.join(FAVORITE)}")
