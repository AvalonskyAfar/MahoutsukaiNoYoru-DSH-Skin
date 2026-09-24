"""量出「楽曲」菜单每张图里到底有几个条目（行投影，纯 PIL）"""
import os, glob
from PIL import Image

D = r"D:\QuickLook插件包\moye\hfa_png\out\data00000"

for p in sorted(glob.glob(os.path.join(D, "mu_text*_ja*.png"))) + \
         sorted(glob.glob(os.path.join(D, "mu_text*_select_ja*.png"))):
    im = Image.open(p).convert("RGBA")
    w, h = im.size
    alpha = im.getchannel("A")
    px = alpha.load()

    # 行投影：该行非透明像素数
    rowsum = []
    for y in range(h):
        c = 0
        for x in range(0, w, 2):          # 横向隔点采样，够用
            if px[x, y] > 40:
                c += 1
        rowsum.append(c)

    thr = 8
    bands, inb, st = [], False, 0
    for y, v in enumerate(rowsum):
        if v > thr and not inb:
            st, inb = y, True
        elif v <= thr and inb:
            if y - st > 20:
                bands.append((st, y - st))
            inb = False
    if inb and h - st > 20:
        bands.append((st, h - st))

    print(f"{os.path.basename(p):<42} {w}x{h}  条目带 {len(bands)}")
    print(f"     高度: {[b[1] for b in bands]}")
    print(f"     起点Y: {[b[0] for b in bands]}")
