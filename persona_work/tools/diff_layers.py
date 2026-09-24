# -*- coding: utf-8 -*-
"""
diff_layers.py —— 把「身体层贴进合成图」的残差画出来看一眼。

红 = 身体有、合成图没有（身体露出来了 -> 位移偏了）
蓝 = 合成图有、身体没有（应正好是脸那一块）
灰 = 两边都有

输出 3 联图：候选偏移 A / B / C，直接看哪个只剩"脸"是蓝的。
"""
import os
import sys

from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
OUT = os.path.join(ROOT, "hfa_png", "out")
TMP = os.path.join(ROOT, "persona_work", "tmp")


def load(p):
    return Image.open(p).convert("RGBA")


def mask(im):
    return im.getchannel("A").point(lambda v: 255 if v > 8 else 0)


def panel(comp, body, ox, oy, scale=4):
    cw, ch = comp.size
    canvas = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    canvas.alpha_composite(body, (ox, oy))
    ca, ba = mask(comp), mask(canvas)
    red = ImageChops.subtract(ba, ca)      # 身体有、合成无
    blue = ImageChops.subtract(ca, ba)     # 合成有、身体无
    both = ImageChops.multiply(ca, ba)
    out = Image.new("RGB", comp.size, (25, 25, 30))
    out.paste((70, 70, 78), (0, 0), both)
    out.paste((220, 60, 60), (0, 0), red)
    out.paste((60, 140, 255), (0, 0), blue)
    r = sum(1 for i in range(0, len(red.tobytes()), 4) if red.tobytes()[i]) if False else None
    nr = red.histogram()[255] if False else None
    return out.resize((cw // scale, ch // scale), Image.LANCZOS)


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "aok_a_03_02_00"
    comp_p = os.path.join(OUT, "data02105", base + "_02_02.mzp.png")
    body_p = None
    for d in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, d, base + "_b.mzp.png")
        if os.path.isfile(p):
            body_p = p
            break
    comp, body = load(comp_p), load(body_p)
    print(f"comp={comp.size} body={body.size}")
    cands = [(12, 17), (12, 8), (12, 32)]
    panels = [panel(comp, body, ox, oy) for ox, oy in cands]
    w, h = panels[0].size
    sheet = Image.new("RGB", (w * len(panels) + 8 * (len(panels) - 1), h), (0, 0, 0))
    for i, p in enumerate(panels):
        sheet.paste(p, (i * (w + 8), 0))
    # 只留头部区域看得清
    head = sheet.crop((0, 0, sheet.width, min(h, 900)))
    out = os.path.join(TMP, "diff_layers.png")
    head.save(out)
    print("候选偏移:", cands, "->", out, head.size)


if __name__ == "__main__":
    main()
