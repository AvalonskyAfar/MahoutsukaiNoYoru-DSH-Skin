"""按「帧号」横向铺开：每一行一个帧号，列 = 拥有该帧号的各个姿态通道（i4）+ 批次。

用于判定「帧号 v 对应什么表情」—— 同一 v 在不同 i4 通道里应当是同一张脸，
跨通道一致就说明 v 是语义表情号。

用法: python variant_strips.py aok 12 [起始帧]
"""
import os, re, sys
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\expressions"
SINGLE = re.compile(r"^([a-z]{3})_([a-z])_(\d{2})_(\d{2})_(\d{2})(_b)?$")

FONT = None
for _p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(_p):
        FONT = ImageFont.truetype(_p, 18)
        break


def main():
    who, i3 = sys.argv[1], sys.argv[2]
    start = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    d = defaultdict(list)
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            m = SINGLE.match(f.split(".mzp.png")[0])
            if m and m.group(1) == who and m.group(3) == i3 and not m.group(6):
                d[m.group(5)].append((m.group(2), m.group(4), os.path.join(dp, f)))
    cell, lab = 170, 30
    frames = sorted(d)
    width = max(len(v) for v in d.values())
    W = 150 + width * cell
    H = 40 + len(frames) * (cell + lab)
    sheet = Image.new("RGB", (W, H), (236, 236, 241))
    dr = ImageDraw.Draw(sheet)
    dr.text((8, 8), f"{who} i3={i3}  帧号 x 通道（列内按批次排）", fill=(160, 0, 0), font=FONT)
    for r, v in enumerate(frames):
        y = 40 + r * (cell + lab)
        dr.rectangle([0, y, W, y + lab - 2], fill=(210, 210, 222))
        dr.text((8, y + 4), f"v{v}", fill=(20, 20, 90), font=FONT)
        files = sorted(d[v], key=lambda x: (x[1], x[0]))
        for c, (b, e, p) in enumerate(files):
            im = Image.open(p).convert("RGBA")
            im.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
            bg = Image.new("RGB", im.size, (18, 18, 22))
            bg.paste(im, (0, 0), im)
            sheet.paste(bg, (150 + c * cell + (cell - bg.width) // 2,
                             y + lab + (cell - bg.height) // 2))
            dr.text((150 + c * cell + 3, y + lab + 1), f"e{e}{b}", fill=(255, 220, 80), font=FONT)
    out = os.path.join(OUTDIR, f"vstrips_{who}_{i3}.jpg")
    sheet.save(out, quality=90)
    print(f"{out}  {sheet.size}  ({len(frames)} 帧)")
    # 再切成两半，便于查看
    half = (H + 1) // 2
    for i, (y0, y1) in enumerate(((0, half), (half, H))):
        c = sheet.crop((0, y0, W, y1))
        o = os.path.join(OUTDIR, f"vstrips_{who}_{i3}_{i+1}.jpg")
        c.save(o, quality=90)
        print("  ", o, c.size)


if __name__ == "__main__":
    main()
