"""确认菜单图的列结构 —— 这决定「楽曲」菜单到底有多少条目

mu_text1 / mu_text2 = 1072x1024（14 行 x 64px）
mu_text3            = 536x656 （9 行 x 64px）
1072 = 2 x 536，所以 1/2 极可能是**左右两列**各 536 宽。
逐列做行投影，就能知道每列实际有几行有内容。
"""
import os
from PIL import Image

D = r"D:\QuickLook插件包\moye\hfa_png\out\data00000"


def bands_of(px, x0, x1, h, thr=6):
    bands, inb, st = [], False, 0
    for y in range(h):
        c = 0
        for x in range(x0, x1, 2):
            if px[x, y] > 40:
                c += 1
        if c > thr and not inb:
            st, inb = y, True
        elif c <= thr and inb:
            if y - st > 20:
                bands.append(st)
            inb = False
    if inb and h - st > 20:
        bands.append(st)
    return bands


for name in ("mu_text1_select_ja", "mu_text2_select_ja", "mu_text3_select_ja"):
    p = os.path.join(D, name + ".cbg.png")
    im = Image.open(p).convert("RGBA")
    w, h = im.size
    px = im.getchannel("A").load()
    print(f"\n=== {name}  {w}x{h} ===")
    if w == 1072:
        for label, x0, x1 in (("左列", 0, 536), ("右列", 536, 1072)):
            b = bands_of(px, x0, x1, h)
            print(f"  {label}(x {x0}-{x1}): {len(b)} 行  起点Y={b}")
    else:
        # w=536：先看是否单列，再扫右半是否全空
        b = bands_of(px, 0, 536, h)
        print(f"  整幅(0-536): {len(b)} 行  起点Y={b}")
        b2 = bands_of(px, 268, 536, h)
        print(f"  右半(268-536): {len(b2)} 行  起点Y={b2}   <- 与整幅相同则说明是单列")
