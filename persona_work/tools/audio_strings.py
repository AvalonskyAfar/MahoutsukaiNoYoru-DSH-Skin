"""汇总全部 .chs 里的非图像字符串，按前缀归类 —— 用来找 BGM 的引用形式。

已知：图像 = imgNNNN；立绘 = xxx_a_NN_NN_NN；音效 = SEnnnnn；语音 = A30_2_1_0002 这类；
      标签 = $NNNNNN；其余前缀（如 BGM / MUS / MAIN 等）就是我们要找的。
"""
import os, re
from collections import Counter, defaultdict

CHS = r"D:\QuickLook插件包\moye\game_scripts\chs"
PAT = re.compile(rb"[ -~]{3,}")
IMG = re.compile(r"img\d", re.I)
SPRITE = re.compile(r"^[a-z]{3}_[a-z]_\d\d_\d\d_\d\d")
LABEL = re.compile(r"^\$[0-9A-Fa-f]{5,6}$")

c = Counter()
where = defaultdict(set)
for dp, _, fs in os.walk(CHS):
    for f in fs:
        if not f.lower().endswith(".chs"):
            continue
        d = open(os.path.join(dp, f), "rb").read()
        for m in PAT.finditer(d):
            s = m.group().decode("ascii", "replace")
            if IMG.search(s) or SPRITE.match(s) or LABEL.match(s):
                continue
            c[s] += 1
            where[s].add(f[:-4].lower())

pref = Counter()
for s in c:
    m = re.match(r"^([A-Za-z_]+)", s)
    pref[m.group(1) if m else "(数字/其他)"] += 1

print("非 img/立绘/标签 的字符串，按前缀归类（种类数）：")
for p, n in pref.most_common(50):
    print(f"   {p:30} {n}")

print()
print("=== 候选：疑似 BGM 的（含 bgm/mus/main/title/song 等）===")
KEY = re.compile(r"bgm|music|mus_|main|title|song|sound|bg_", re.I)
hit = [s for s in c if KEY.search(s)]
for s in sorted(hit)[:60]:
    print(f"   {s!r:34} x{c[s]:<4} 章节例: {sorted(where[s])[:4]}")
print(f"   （共 {len(hit)} 种）")
