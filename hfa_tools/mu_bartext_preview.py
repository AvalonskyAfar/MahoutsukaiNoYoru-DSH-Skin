"""看楽曲菜单的"作曲者栏"mu_bartext* —— 可能含曲目元数据

mu_bartext_composer_* 说明菜单会给每首曲子显示作曲者。
mu_bartext1/2/3 可能与 mu_text1/2/3 页对应。
"""
import os
from PIL import Image

D = r"D:\QuickLook插件包\moye\hfa_png\out\data00000"
OUT = r"D:\QuickLook插件包\moye\image_notes\mu_text_preview"
os.makedirs(OUT, exist_ok=True)

names = ["mu_title_ja", "mu_bartext1_ja", "mu_bartext2_ja", "mu_bartext3_ja",
         "mu_bartext_composer_ja", "mu_text0"]

for n in names:
    p = os.path.join(D, n + ".cbg.png")
    if not os.path.exists(p):
        print(f"!! 缺 {n}")
        continue
    im = Image.open(p).convert("RGBA")
    base = Image.new("RGBA", im.size, (128, 128, 128, 255))
    base.alpha_composite(im)
    out = os.path.join(OUT, n + "_flat.png")
    base.convert("RGB").save(out)
    print(f"{n:<28} {im.size}  bbox={im.getchannel('A').getbbox()}  -> {out}")
