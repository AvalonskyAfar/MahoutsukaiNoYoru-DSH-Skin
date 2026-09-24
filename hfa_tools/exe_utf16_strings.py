"""在可执行文件里找 **UTF-16LE** 字符串 —— 上次只搜了 ASCII，漏了这条路

日文引擎常把资源名/菜单键以 UTF-16 存。重点找：
  m01 / m64 之类的资源名、mu_text、data03000、以及「楽曲」菜单相关键
"""
import re, os, collections

G = r"D:\QuickLook插件包\moye\WITCH ON THE HOLY NIGHT.7z\WITCH ON THE HOLY NIGHT"
FILES = [
    os.path.join(G, "原版备份", "WoH.exe"),
    os.path.join(G, "woh_data.dll"),
    os.path.join(G, "WoH.steam.exe"),
]

# UTF-16LE 可打印串（含日文假名/汉字范围）
u16 = re.compile((r"(?:[\x20-\x7E\u3000-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]"
                  r"|\r|\n){4,}").encode("utf-16-le"))
# 其中 ASCII-only 的
ascii_only = re.compile(r"^[\x20-\x7E]{4,}$")

KEYS = ["mu_text", "m01", "m64", "data03000", "楽曲", "サウンド", "曲名",
        "メインテーマ", "メイン・OP", "スタッフ", "bgm", "BGM", ".hw"]

for path in FILES:
    if not os.path.exists(path):
        continue
    data = open(path, "rb").read()
    hits = []
    for m in u16.finditer(data):
        try:
            s = m.group().decode("utf-16-le")
        except Exception:
            continue
        hits.append((m.start(), s))
    print(f"\n{'='*80}\n{os.path.basename(path)}  {len(data):,} B   UTF-16 串 {len(hits):,} 条\n{'='*80}")

    # 关键字命中
    for k in KEYS:
        f = [(o, s) for o, s in hits if k in s]
        if f:
            print(f"\n  ★ 关键字 {k!r}: {len(f)} 命中")
            for o, s in f[:12]:
                print(f"      @{o:<10} {s[:110]!r}")

    # 有没有含假名的（说明是日文 UI 文本）
    jp = [(o, s) for o, s in hits if any('\u3040' <= c <= '\u30ff' or '\u4e00' <= c <= '\u9fff' for c in s)]
    print(f"\n  含日文的串: {len(jp):,} 条；前 25 条：")
    for o, s in jp[:25]:
        print(f"      @{o:<10} {s[:100]!r}")
