"""按「眼锚点」方案渲染站位预览：把每张立绘的眼重心对齐到画面固定点。

方案 B（本脚本）：先对 (角色, 服装行) 求眼重心中位数 → 渲染时把该图的眼重心平移/缩放到
画面固定点 (x=50%, y=33%)，从而各表情的脸绝不跳位。

用法: python stage_eyefix.py aok 12 "data02050/img0231_01_01.mzp.png" aok12_eyefix sid1,sid2,...
"""
import os, re, sys, json, statistics
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
CACHE = r"D:\QuickLook插件包\moye\persona_work\stage\eye_anchor.json"
OUT = r"D:\QuickLook插件包\moye\persona_work\stage"
W, H = 1920, 1080
DIALOG_TOP = 770
EYE_SCREEN = (0.50, 0.33)          # 眼重心落在画面哪个比例位置
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
    im = im.crop(im.getchannel("A").getbbox())
    s = max(W / im.width, H / im.height)
    im2 = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    bg = Image.new("RGB", (W, H), (10, 10, 14))
    bg.paste(im2, ((W - im2.width) // 2, (H - im2.height) // 2), im2)
    return bg


def main():
    who, i3, bgp, name = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    sids = sys.argv[5].split(",")
    cache = json.load(open(CACHE, encoding="utf-8"))
    ex = [v["ex"] for k, v in cache.items() if k.startswith(f"{who}_") and re.match(rf"^{who}_[a-z]_{i3}_", k)]
    ey = [v["ey"] for k, v in cache.items() if k.startswith(f"{who}_") and re.match(rf"^{who}_[a-z]_{i3}_", k)]
    if not ex:
        print("该行没有眼锚点数据")
        return
    mx, my = statistics.median(ex), statistics.median(ey)
    print(f"{who} i3={i3}: 眼锚点中位 ({mx:.3f}, {my:.3f})  样本 {len(ex)}")

    cols = min(3, len(sids))
    rows = (len(sids) + cols - 1) // cols
    tw, th = W // cols, H // rows
    sheet = Image.new("RGB", (tw * cols, th * rows), (8, 8, 10))
    for n, sid in enumerate(sids):
        p = find(sid)
        if not p:
            continue
        im = Image.open(p).convert("RGBA")
        bbox = im.getchannel("A").getbbox()
        im = im.crop(bbox)
        key = sid
        c = cache.get(key)
        bg = bg_image(bgp)
        if c:
            # 把内容里的 (ex,ey) 对齐到画面 EYE_SCREEN
            tw0, th0 = im.size
            px = int(EYE_SCREEN[0] * W - c["ex"] * tw0)
            py = int(EYE_SCREEN[1] * H - c["ey"] * th0)
        else:
            px = int(0.5 * W - im.width / 2)
            py = int(0.72 * H - im.height)
        bg.paste(im, (px, py), im)
        d = ImageDraw.Draw(bg)
        d.ellipse([EYE_SCREEN[0] * W - 6, EYE_SCREEN[1] * H - 6,
                   EYE_SCREEN[0] * W + 6, EYE_SCREEN[1] * H + 6], outline=(255, 80, 80), width=3)
        d.rectangle([0, DIALOG_TOP, W, H], fill=(28, 38, 46))
        d.text((36, DIALOG_TOP + 18), f"{sid}  眼重心≈({(c or {}).get('ex', 0):.2f},{(c or {}).get('ey', 0):.2f})",
               fill=(190, 225, 235), font=FONT)
        d.text((36, DIALOG_TOP + 46), f"对齐到画面 ({EYE_SCREEN[0]}, {EYE_SCREEN[1]})",
               fill=(140, 175, 185), font=FONT)
        r, cc = divmod(n, cols)
        sheet.paste(bg.resize((tw, th), Image.LANCZOS), (cc * tw, r * th))
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f"eyefix_{name}.jpg")
    sheet.save(out, quality=90)
    print(out, sheet.size)


if __name__ == "__main__":
    main()
