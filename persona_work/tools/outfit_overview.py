"""全服装总览表：每个 (服装字母, i3姿态行) 取一个代表立绘，拼成一张大图。
用于快速锁定"羽绒服/外套"是哪一行，以及各行的表情数量。

用法: python outfit_overview.py [角色前缀] [每格宽]
输出: persona_work/scene/outfit_<角色>.jpg
"""
import os, re, sys
from PIL import Image, ImageDraw

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUT = r"D:\QuickLook插件包\moye\persona_work\scene"
CH = sys.argv[1] if len(sys.argv) > 1 else "aok"
CELL = int(sys.argv[2]) if len(sys.argv) > 2 else 300
COLS = 8

groups = {}
for arch in sorted(os.listdir(ROOT)):
    dp = os.path.join(ROOT, arch)
    if not os.path.isdir(dp):
        continue
    for f in os.listdir(dp):
        n = f.replace(".mzp.png", "")
        m = re.match(rf"^{CH}_([a-z])_(\d+)_(\d+)_(\d+)$", n)
        if not m:
            continue
        of, i3, i4, _ = m.groups()
        k = (of, int(i3))
        cur = groups.get(k)
        # 优先取 i4 最小（通常是平静表情），保证稳定可复现
        if cur is None or int(i4) < cur[0]:
            groups[k] = (int(i4), os.path.join(dp, f))

keys = sorted(groups)
skip = int(sys.argv[3]) if len(sys.argv) > 3 else 0
take = int(sys.argv[4]) if len(sys.argv) > 4 else 9999
keys = keys[skip:skip + take]
rows = (len(keys) + COLS - 1) // COLS
LAB = max(24, CELL // 5)
W, H = COLS * CELL, rows * (CELL + LAB + 6)
sheet = Image.new("RGB", (W, H), (246, 246, 250))
d = ImageDraw.Draw(sheet)
FONT = None
for p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\consola.ttf"):
    if os.path.exists(p):
        try:
            from PIL import ImageFont
            FONT = ImageFont.truetype(p, LAB - 6)
            break
        except Exception:
            pass
for n, k in enumerate(keys):
    r, c = divmod(n, COLS)
    x, y = c * CELL, r * (CELL + LAB + 6)
    d.text((x + 4, y + 4), f"{k[0]}{k[1]:02d}", fill=(180, 0, 0), font=FONT)
    try:
        im = Image.open(groups[k][1]).convert("RGBA")
        im.thumbnail((CELL - 6, CELL - LAB - 10), Image.LANCZOS)
        bg = Image.new("RGB", im.size, (246, 246, 250))
        bg.paste(im, (0, 0), im)
        sheet.paste(bg, (x + (CELL - im.width) // 2, y + LAB + 6 + (CELL - LAB - 6 - im.height) // 2))
    except Exception as e:
        d.text((x + 4, y + LAB), f"ERR {e}"[:30], fill=(255, 0, 0))
out = os.path.join(OUT, f"outfit_{CH}_{skip}.jpg")
sheet.save(out, quality=88)
print(f"{out}  ({len(keys)} 格, {W}x{H})")
