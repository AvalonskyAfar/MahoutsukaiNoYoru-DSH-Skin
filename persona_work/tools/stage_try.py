"""站位方案对比（修正版）：背景铺满 1920x1080，立绘按不同缩放/锚点叠加，
下方画出对话框占位带，用来最终拍定站位参数。

用法: python stage_try.py aok_n_12_02_00 data02050/img0231_01_01.mzp.png out_name k1,k2,k3 x1,x2,x3
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\stage"
W, H = 1920, 1080
DIALOG_TOP = 770
FONT = None
for _p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(_p):
        FONT = ImageFont.truetype(_p, 20)
        break


def find(sid):
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if os.path.isdir(dp) and os.path.exists(os.path.join(dp, sid + ".mzp.png")):
            return os.path.join(dp, sid + ".mzp.png")
    return None


def bg_image(bgp):
    im = Image.open(os.path.join(ROOT, bgp)).convert("RGBA")
    box = im.getchannel("A").getbbox()
    im = im.crop(box)
    s = max(W / im.width, H / im.height)
    im2 = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    bg = Image.new("RGB", (W, H), (10, 10, 14))
    bg.paste(im2, ((W - im2.width) // 2, (H - im2.height) // 2), im2)
    return bg


def main():
    sid, bgp, name = sys.argv[1], sys.argv[2], sys.argv[3]
    scales = [float(x) for x in (sys.argv[4].split(",") if len(sys.argv) > 4 else [0.5, 0.6, 0.7])]
    xs = [float(x) for x in (sys.argv[5].split(",") if len(sys.argv) > 5 else [0.5, 0.62, 0.72])]
    anchors_y = [float(x) for x in (sys.argv[6].split(",") if len(sys.argv) > 6 else [1.0])]
    crop_bbox = "--bbox" in sys.argv
    import math
    p = find(sid)
    im = Image.open(p).convert("RGBA")
    if crop_bbox:
        im = im.crop(im.getchannel("A").getbbox())
    n = 0
    cells = [(k, yb, x) for k in scales for yb in anchors_y for x in xs]
    cols = 3
    rows = (len(cells) + cols - 1) // cols
    tw, th = W // cols, H // rows
    sheet = Image.new("RGB", (tw * cols, th * rows), (8, 8, 10))
    for k, yb, x in cells:
        bg = bg_image(bgp)
        s2 = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        px = int(x * W - s2.width / 2)
        py = int(yb * H - s2.height)
        bg.paste(s2, (px, py), s2)
        d = ImageDraw.Draw(bg)
        d.rectangle([0, DIALOG_TOP, W, H], fill=(28, 38, 46))
        d.text((36, DIALOG_TOP + 18), f"scale={k}  x={x}  y_bottom={yb}",
               fill=(190, 225, 235), font=FONT)
        d.text((36, DIALOG_TOP + 46), f"{sid}", fill=(140, 175, 185), font=FONT)
        r, c = divmod(n, cols)
        sheet.paste(bg.resize((tw, th), Image.LANCZOS), (c * tw, r * th))
        n += 1
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f"try_{name}.jpg")
    sheet.save(out, quality=90)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
