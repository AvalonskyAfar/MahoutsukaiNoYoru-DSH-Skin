"""按用户确认结果生成对照表

用户的标注体系比交接文档更细：
  - 初始界面分**浅色/深色**（交接文档只要求"统一一首"）
  - 日常分**浅色/深色**，共 12 首（交接文档建议 2~3 首）
  - 多了一档「个人收藏」（不属于四项选曲）
  - ED = m53
  - **主题曲未标注**
"""
import json, os, csv

BGM = r"D:\QuickLook插件包\moye\bgm"
A = json.load(open(os.path.join(BGM, "bgm_analysis.json"), encoding="utf-8"))

# ===== 用户确认结果 =====
INIT_LIGHT = ["m01s"]
INIT_DARK  = ["m56"]
DAILY_LIGHT = ["m02", "m08", "m09", "m17", "m27", "m29", "m37", "m49"]
DAILY_DARK  = ["m06", "m18", "m46", "m47", "m63"]
THEME = []            # ← 未标注
ED = ["m53"]
FAVORITE = ["m01", "m03", "m41"]

def role(n):
    tags = []
    if n in INIT_LIGHT: tags.append("初始界面(浅色)")
    if n in INIT_DARK:  tags.append("初始界面(深色)")
    if n in DAILY_LIGHT: tags.append("日常(浅色)")
    if n in DAILY_DARK:  tags.append("日常(深色)")
    if n in THEME: tags.append("主题曲")
    if n in ED: tags.append("ED")
    if n in FAVORITE: tags.append("个人收藏")
    return " + ".join(tags) if tags else "（未标注）"


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
    rows.append(dict(
        id=n,
        时长=f"{int(d['duration']//60)}:{d['duration']%60:04.1f}",
        时长s=round(d["duration"], 2),
        MB=round(os.path.getsize(os.path.join(BGM, n + ".ogg")) / 1048576, 2),
        用途=role(n),
        RMS=round(d["rms"], 5), 峰值=round(d["peak"], 4),
        前导s=round(d["leadInSeconds"], 2), 尾出s=round(d["tailOutSeconds"], 2),
        客观特征=facts(d),
    ))

# 写 TSV
out = os.path.join(BGM, "bgm_mapping.tsv")
with open(out, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter="\t")
    w.writeheader()
    w.writerows(rows)
print("->", out)

# 汇总
print(f"\n{'类别':<18}{'首数':<6}编号")
print("-" * 72)
for label, lst in (("初始界面(浅色)", INIT_LIGHT), ("初始界面(深色)", INIT_DARK),
                   ("日常(浅色)", DAILY_LIGHT), ("日常(深色)", DAILY_DARK),
                   ("主题曲", THEME), ("ED", ED), ("个人收藏", FAVORITE)):
    print(f"{label:<18}{len(lst):<6}{' '.join(lst) if lst else '—— 未标注 ——'}")

labeled = set(INIT_LIGHT + INIT_DARK + DAILY_LIGHT + DAILY_DARK + THEME + ED + FAVORITE)
unlabeled = [n for n in names if n not in labeled]
print(f"\n已标注 {len(labeled)} / 64 首，未标注 {len(unlabeled)} 首：")
print("  ", " ".join(unlabeled))
