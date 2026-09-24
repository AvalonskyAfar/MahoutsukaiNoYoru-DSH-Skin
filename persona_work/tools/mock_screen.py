# -*- coding: utf-8 -*-
"""
mock_screen.py —— 用真素材摆一张"屏幕预览"，检查站位对不对（不装 DSH 也能看）。

合成：背景（cover 到 1912x1115）+ 立绘（按给定高度/底边偏移摆放）+ 底部对话框占位带。
用来在交给用户之前，自己先看一眼站位。

用法:
  python persona_work/tools/mock_screen.py A4 neutral --sprite-h 118 --sprite-bottom -8
"""
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
TMP = os.path.join(ROOT, "persona_work", "tmp")
SPRITE = os.path.join(ROOT, "skin", "assets", "sprite")
BG = {
    "A1": "data02010/img3008.mzp.png", "A2": "data02010/img3006.mzp.png",
    "A3": "data02050/img0231_01_01.mzp.png", "A4": "data02000/img0296.mzp.png",
    "A5": "data02000/img0349.mzp.png", "A6": "data02000/img0222.mzp.png",
}
W, H = 1912, 1115


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im2 = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))),
                    Image.LANCZOS)
    x = (im2.width - w) // 2
    y = (im2.height - h) // 2
    return im2.crop((x, y, x + w, y + h))


def main():
    scene = sys.argv[1] if len(sys.argv) > 1 else "A4"
    slot = sys.argv[2] if len(sys.argv) > 2 else "neutral"
    sh = 118.0
    sb = -8.0
    if "--sprite-h" in sys.argv:
        sh = float(sys.argv[sys.argv.index("--sprite-h") + 1])
    if "--sprite-bottom" in sys.argv:
        sb = float(sys.argv[sys.argv.index("--sprite-bottom") + 1])

    bgp = os.path.join(ROOT, "hfa_png", "out", *BG[scene].split("/"))
    bg = cover(Image.open(bgp).convert("RGBA"), W, H).convert("RGB")

    cands = sorted(f for f in os.listdir(SPRITE)
                   if f.startswith(f"stage_{scene.lower()}_{slot}_"))
    if not cands:
        print(f"没有 {scene}/{slot} 的立绘；现有：",
              sorted({f.split("_")[1] for f in os.listdir(SPRITE) if f.startswith("stage_")}))
        return
    sp = Image.open(os.path.join(SPRITE, cands[0])).convert("RGBA")
    hpx = round(H * sh / 100.0)
    sp = sp.resize((max(1, round(sp.width * hpx / sp.height)), hpx), Image.LANCZOS)
    canvas = bg.copy()
    x = (W - sp.width) // 2
    y = H - sp.height - round(H * sb / 100.0)
    canvas.paste(sp, (x, y), sp)
    # 底部对话框占位带（高度按现有规格）
    band = Image.new("RGB", (W, 150), (54, 64, 69))
    canvas.paste(band, (0, H - 150))
    out = os.path.join(TMP, f"mock_{scene}_{slot}.png")
    canvas.save(out)
    print(f"{cands[0]} -> {out} {canvas.size}  立绘 {sp.size} @({x},{y})")


if __name__ == "__main__":
    main()
