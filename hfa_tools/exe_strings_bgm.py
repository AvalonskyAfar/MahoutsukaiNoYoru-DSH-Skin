"""在游戏可执行文件里搜资源引用

思路：引擎一定知道曲名菜单 -> BGM 文件的对应关系，或者至少知道
     「楽曲」菜单项对应的资源名。先在二进制里找 m01/x_m64/.hw/mu_text 之类的字面量。
"""
import re, os, collections

G = r"D:\QuickLook插件包\moye\WITCH ON THE HOLY NIGHT.7z\WITCH ON THE HOLY NIGHT"
TARGETS = [
    os.path.join(G, "原版备份", "WoH.exe"),
    os.path.join(G, "WoH.exe"),
    os.path.join(G, "WoH.steam.exe"),
    os.path.join(G, "woh_data.dll"),
]

PATTERNS = {
    "m编号(.hw)": re.compile(rb"m\d{2}s?\.hw|\bx_m\d+\.hw"),
    "m编号裸": re.compile(rb"\bm\d{2}\b"),
    "hw后缀": re.compile(rb"[\w/]{1,24}\.hw\b"),
    "mu_text": re.compile(rb"mu_text\w*"),
    "data03000": re.compile(rb"data0\d{4}"),
    "bgm大小写": re.compile(rb"[Bb][Gg][Mm]\w{0,20}"),
    "sound/ongaku": re.compile(rb"[Ss]ound\w{0,16}|[Oo]ngaku\w{0,16}|[Mm]usic\w{0,16}"),
    "staffroll": re.compile(rb"staff\w{0,16}|roll\w{0,8}"),
}

for path in TARGETS:
    if not os.path.exists(path):
        print(f"!! 不存在: {path}")
        continue
    data = open(path, "rb").read()
    print(f"\n{'='*78}\n{os.path.basename(path)}  {len(data):,} B\n{'='*78}")
    for label, pat in PATTERNS.items():
        hits = pat.findall(data)
        if not hits:
            print(f"  {label:<14} 0 命中")
            continue
        c = collections.Counter(h.decode("latin-1") for h in hits)
        uniq = len(c)
        show = list(c.most_common(12))
        print(f"  {label:<14} {len(hits):>6} 命中 / {uniq:>5} 去重   例: "
              + ", ".join(f"{k}({v})" for k, v in show[:8]))
