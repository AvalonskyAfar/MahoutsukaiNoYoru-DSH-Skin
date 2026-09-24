"""量「特写 vs 全身」在像素上的真实关系。

做法：取同一张脸的特写版与 `_b` 全身版，按同一 scale 缩放对齐后比较
脸部（眼睛行）在画面里的相对高度 —— 用来反推特写截取自全身的哪一段。

输入需人工先量出：特写里眼睛的 y 比例（eye_y_ratio_closeup），
以及全身里眼睛的 y 比例（eye_y_ratio_full）。这两个比例可由
`sprite_probe_view.py` 生成的并排图肉眼读出（或视觉模型读出）。
"""
import os, sys, json
from PIL import Image

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\expressions"


def crop(path):
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box:
        im = im.crop(box)
    return im


def side_by_side(closeup, full, out, h=1200):
    a = crop(closeup)
    b = crop(full)
    # 都按同一「内容高度」缩放，便于比较
    a = a.resize((max(1, int(a.width * h / a.height)), h), Image.LANCZOS)
    b = b.resize((max(1, int(b.width * h / b.height)), h), Image.LANCZOS)
    W = a.width + b.width + 30
    sheet = Image.new("RGB", (W, h), (30, 30, 34))
    sheet.paste(a, (0, 0), a)
    sheet.paste(b, (a.width + 30, 0), b)
    sheet.save(out, quality=90)
    print(out, sheet.size, "closeup", a.size, "full", b.size)
    return sheet


if __name__ == "__main__":
    import re
    args = sys.argv[1:]
    # 用法: probe_view.py <closeup_id> <full_id> <outname>
    cu, fu, name = args[0], args[1], args[2]
    def find(sid):
        for arch in sorted(os.listdir(ROOT)):
            dp = os.path.join(ROOT, arch)
            for f in os.listdir(dp):
                if f.startswith(sid + "."):
                    return os.path.join(dp, f)
        raise SystemExit("找不到 " + sid)
    side_by_side(find(cu), find(fu), os.path.join(OUT, name + ".jpg"))
