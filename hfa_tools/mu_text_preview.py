"""把 mu_text*.cbg.png 拼成可读的检视图

这些是 RGBA（透明底 + 白/黑字），直接看会看不见，统一合成到灰底上。
另做一个「列切分」视图：因为 1072 = 2 x 536，怀疑是**两列**各自独立的贴图。
"""
import os
from PIL import Image

D = r"D:\QuickLook插件包\moye\hfa_png\out\data00000"
OUT = r"D:\QuickLook插件包\moye\image_notes\mu_text_preview"
os.makedirs(OUT, exist_ok=True)


def flatten(im, bg=(128, 128, 128, 255)):
    base = Image.new("RGBA", im.size, bg)
    base.alpha_composite(im)
    return base.convert("RGB")


for n in sorted(os.listdir(D)):
    if not n.startswith("mu_text") or not n.endswith(".png"):
        continue
    im = Image.open(os.path.join(D, n)).convert("RGBA")
    w, h = im.size

    # alpha 包围盒 -> 内容实际用到的区域
    bbox = im.getchannel("A").getbbox()

    flat = flatten(im)
    flat.save(os.path.join(OUT, n.replace(".cbg.png", "_flat.png")))

    print(f"{n:<44} size={w}x{h} alpha_bbox={bbox}")

print("\n-> ", OUT)
