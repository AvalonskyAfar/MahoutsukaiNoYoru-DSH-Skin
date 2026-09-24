"""把同一个 i3_i4 家族的全部帧拼成一张条带图 —— 用来判断"变体"是不是动画帧序列。

用法: python family_strip.py koj_a_01_01 [每行帧数]
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\expressions"

font = None
for p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(p):
        font = ImageFont.truetype(p, 18)
        break


def main():
    fam = sys.argv[1]
    per = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    items = []
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        for f in sorted(os.listdir(dp)):
            n = f.replace(".mzp.png", "")
            if re.match(rf"^{re.escape(fam)}_\d+$", n):
                items.append((int(n.rsplit("_", 1)[1]), arch, f))
    if not items:
        print("无", fam)
        return
    items.sort()
    cell = 220
    lab = 24
    rows = (len(items) + per - 1) // per
    sheet = Image.new("RGB", (per * cell, rows * (cell + lab) + 30), (235, 235, 240))
    dr = ImageDraw.Draw(sheet)
    dr.text((6, 6), f"{fam}  共 {len(items)} 帧", fill=(150, 0, 0), font=font)
    for n, (v, arch, f) in enumerate(items):
        r, c = divmod(n, per)
        x, y = c * cell, 30 + r * (cell + lab)
        im = Image.open(os.path.join(ROOT, arch, f)).convert("RGBA")
        im.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
        bg = Image.new("RGB", im.size, (18, 18, 22))
        bg.paste(im, (0, 0), im)
        sheet.paste(bg, (x + (cell - bg.width) // 2, y + lab + (cell - bg.height) // 2))
        dr.text((x + 3, y + 3), f"v{v:02d} {arch[-5:]}", fill=(20, 20, 90), font=font)
    out = os.path.join(OUT, f"fam_{fam}.jpg")
    sheet.save(out, quality=90)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
