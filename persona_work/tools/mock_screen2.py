# -*- coding: utf-8 -*-
"""
mock_screen2.py —— 按**真实层序**拼一张预览：背景 → 暗带(txtwindow) → 立绘 → 正文层 → 对话框。

用来在不开浏览器的情况下复现"屏幕上看起来是什么样"，
并对比"正文层有字 / 无字"两种情形 —— 判断暗带看起来像不像个方框。
"""
import json
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"D:\QuickLook插件包\moye"
TMP = os.path.join(ROOT, "persona_work", "tmp")
ASSETS = os.path.join(ROOT, "skin", "assets")
W, H = 1912, 1115


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im2 = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    return im2.crop(((im2.width - w) // 2, (im2.height - h) // 2,
                     (im2.width - w) // 2 + w, (im2.height - h) // 2 + h))


def main():
    scene = sys.argv[1] if len(sys.argv) > 1 else "A4"
    slot = sys.argv[2] if len(sys.argv) > 2 else "neutral"
    sh = float(sys.argv[sys.argv.index("--sprite-h") + 1]) if "--sprite-h" in sys.argv else 76.0
    offx = float(sys.argv[sys.argv.index("--sprite-x") + 1]) if "--sprite-x" in sys.argv else 0.0
    with_text = "--text" in sys.argv
    with_band = "--no-band" not in sys.argv

    m = json.load(open(os.path.join(ROOT, "skin", "data", "manifest.json"), encoding="utf-8"))
    BG = {"A1": "data02010/img3008.mzp.png", "A2": "data02010/img3006.mzp.png",
          "A3": "data02050/img0231_01_01.mzp.png", "A4": "data02000/img0296.mzp.png",
          "A5": "data02000/img0349.mzp.png", "A6": "data02000/img0222.mzp.png"}
    bg = cover(Image.open(os.path.join(ROOT, "hfa_png", "out", *BG[scene].split("/")))
               .convert("RGBA"), W, H)

    def draw_band(target):
        tw = Image.open(os.path.join(ASSETS, "ui", "txtwindow00.mzp.png")).convert("RGBA")
        tw = tw.resize((W, H), Image.LANCZOS)
        a = tw.getchannel("A").point(lambda v: int(v * 0.88))
        tw.putalpha(a)
        target.alpha_composite(tw)

    # 暗带：txtwindow00（原作满高羽化暗带），object-fit:fill + opacity .88
    # ★ 层序按 Q4 决议：**暗带压在立绘上面**（--band-over），否则文字读不清
    band_over = "--band-over" in sys.argv
    if with_band and not band_over:
        draw_band(bg)

    # 立绘
    cands = sorted(f for f in os.listdir(os.path.join(ASSETS, "sprite"))
                   if f.startswith(f"stage_{scene.lower()}_{slot}_"))
    sp = Image.open(os.path.join(ASSETS, "sprite", cands[0])).convert("RGBA")
    hpx = round(H * sh / 100.0)
    sp = sp.resize((max(1, round(sp.width * hpx / sp.height)), hpx), Image.LANCZOS)
    x = (W - sp.width) // 2 + round(W * offx / 100.0)
    y = H - sp.height
    bg.alpha_composite(sp, (x, y))
    if with_band and band_over:
        draw_band(bg)

    # 正文层：画一段文字示意（--text）或者什么都不画，模拟"正文层高度为 0"
    if with_text:
        from PIL import ImageDraw
        d = ImageDraw.Draw(bg)
        for i, line in enumerate(["「……ここは、どこ？」",
                                  "夜の通学路。青いイルミネーションが、",
                                  "凍った並木道を静かに照らしていた。"]):
            d.text((W // 2 - 380, 300 + i * 34), line, fill=(226, 232, 234, 255))

    # 对话框占位（真高 86 + 44*(rows-1)，这里按 1 行 86px 画）
    dlg = Image.new("RGBA", (W, 86), (60, 64, 69, 255))
    bg.alpha_composite(dlg, (0, H - 86 - 60))
    bg.convert("RGB").save(os.path.join(TMP, f"mock2_{scene}_{slot}.png"))
    print(f"-> {os.path.join(TMP, f'mock2_{scene}_{slot}.png')}  "
          f"band={with_band} text={with_text} sprite_h={sh}% x_offset={offx}%")


if __name__ == "__main__":
    main()
