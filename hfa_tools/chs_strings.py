"""正确地从 .chs 编译脚本里抽字符串

.chs = "HunexCompiledScriptVer1.00" 字节码，字符串以 **UTF-16LE** 存储。
交接文档之前用 ASCII 正则搜 m01/bgm 当然是 0 命中——方向就错了。
现在把每个脚本的字符串表完整抽出来，找：
  1. 与「楽曲 / サウンド / 曲名 / スタッフ」等菜单相关的脚本
  2. 任何 mNN / .hw / data03000 形态的引用
  3. 曲名（用已从图像读到的曲名去反查）
"""
import os, re, glob, json, collections

CHS = r"D:\QuickLook插件包\moye\game_scripts\chs"
OUT = r"D:\QuickLook插件包\moye\game_scripts\chs_strings"
os.makedirs(OUT, exist_ok=True)

# UTF-16LE 可打印串（含日文）
U16 = re.compile((r"[\x20-\x7E\u3000-\u30FF\u4E00-\u9FFF\uFF01-\uFF60"
                  r"\u2018-\u201F\u2026\u00A0-\u00FF]{2,}").encode("utf-16-le"))


def strings_of(d):
    out = []
    for m in U16.finditer(d):
        # 必须按 2 字节对齐，否则是巧合
        if m.start() % 2 != 0:
            continue
        try:
            s = m.group().decode("utf-16-le")
        except Exception:
            continue
        if len(s.strip()) >= 2:
            out.append((m.start(), s))
    return out


# 已从 mu_text 图像读到的曲名（用于反查）
KNOWN = [
    "魔法使いの夜～メインテーマ～", "メインテーマ/冬", "蒼崎青子", "imbalance/blue",
    "First star", "久遠寺有珠", "imbalance/Alice", "静希草十郎", "innocence",
    "対峙/out border", "輪舞/witch Tale", "顕現/great three", "金狼/ELEMENTS",
    "鏡の国の騒動", "お伽の国の狂騒", "FLAT SNARK", "久遠寺邸で朝食を",
    "午後の眠り", "鍵盤は躍る", "メイン・OP", "目を覚ます", "～その隙間～",
    "騒ぎ出す", "笑いあう", "待ち焦がれる", "街から離れて", "ひかるランチ",
    "日はまた沈む", "誰かと二人で", "密談", "遠い疵", "甘い痛み", "時計はまわる",
    "天はたしかに", "夜への誘い", "thames troll(wood)", "WORKING!!", "窮地/omen",
    "いつまでも君と", "エレガント", "家路", "帰り道", "窮地/herald",
    "決着/turbulence overdrive", "メインテーマ/日常", "メインテーマ/予感",
    "メインテーマ/眠り", "idyllic/blue",
    "nostalgia", "extra magic number?", "see you again, miss blue!", "Five",
    "決闘/one-on-one", "絢爛/finality", "Judicare tibi", "きみのはなし", "魔法使いの歓談",
]
KEYS = ["楽曲", "サウンド", "曲名", "スタッフ", "スタッフロール", "メインテーマ",
        "選曲", "おまけ", "ギャラリー", "タイトル", "タイトル画面"]

index = {}
allstr = collections.Counter()
key_files = collections.defaultdict(list)
name_hits = collections.defaultdict(list)

files = sorted(glob.glob(os.path.join(CHS, "**", "*.chs"), recursive=True))
print(f"扫描 {len(files)} 个 .chs ...\n")

for p in files:
    d = open(p, "rb").read()
    ss = strings_of(d)
    rel = os.path.relpath(p, CHS)
    index[rel] = [s for _, s in ss]
    for _, s in ss:
        allstr[s] += 1
        for k in KEYS:
            if k in s:
                key_files[k].append((rel, s))
        for n in KNOWN:
            if n in s:
                name_hits[n].append((rel, s))
        if re.search(r"\bm\d{2}\b|x_m\d{2}|\.hw\b|data0[0-9]{4}", s):
            key_files["资源名形态"].append((rel, s))

print("=== 关键字命中 ===")
for k in KEYS + ["资源名形态"]:
    v = key_files.get(k, [])
    print(f"\n  【{k}】{len(v)} 命中")
    seen = set()
    for rel, s in v[:20]:
        if (rel, s) in seen:
            continue
        seen.add((rel, s))
        print(f"      {rel:<40} {s[:90]!r}")

print("\n\n=== 曲名反查（哪些脚本里出现了已知曲名）===")
found_any = False
for n in KNOWN:
    v = name_hits.get(n, [])
    if v:
        found_any = True
        print(f"  【{n}】")
        for rel, s in v[:6]:
            print(f"      {rel:<40} {s[:90]!r}")
if not found_any:
    print("  （没有任何脚本包含已知曲名）")

json.dump(index, open(os.path.join(OUT, "chs_strings.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# 另外dump所有含日文的串，便于人肉翻
jp = [s for s in allstr if any('\u3040' <= c <= '\u30ff' or '\u4e00' <= c <= '\u9fff' for c in s)]
print(f"\n\n=== 全库含日文的字符串 {len(jp)} 条（去重），写文件 ===")
with open(os.path.join(OUT, "all_japanese_strings.txt"), "w", encoding="utf-8") as f:
    for s in sorted(jp):
        f.write(f"{allstr[s]:>4}x  {s}\n")
print("-> ", os.path.join(OUT, "all_japanese_strings.txt"))
print("-> ", os.path.join(OUT, "chs_strings.json"))
