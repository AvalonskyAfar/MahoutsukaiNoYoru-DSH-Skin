"""按**最终站位规格（bbox 版）**渲染六景成品预览。

规格：
  立绘 = alpha bbox 裁切 → **缩放 k** → **内容中心**对齐画面 (50%, 50%)
  理由：特写立绘的内容 bbox 中心就在脸中部，对齐后各表情完全一致、不跳位；
        k 决定"脸占屏幕多大"，实测 0.62 时青子脸高约 630px（占屏 58%），观感接近原作特写。

用法: python stage_final.py [景id...] [--k 0.55,0.62,0.7]
"""
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
STAGE = r"D:\QuickLook插件包\moye\persona_work\stage"
OUTDIR = os.path.join(STAGE, "final")
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


def bg_cover(rel):
    im = Image.open(os.path.join(ROOT, rel)).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())
    s = max(W / im.width, H / im.height)
    im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    bg = Image.new("RGB", (W, H), (10, 10, 14))
    bg.paste(im, ((W - im.width) // 2, (H - im.height) // 2), im)
    return bg


def render(scene, fid, k, cx=0.5, cy=0.5):
    bg = bg_cover(scene["background"])
    p = find(fid)
    if p:
        im = Image.open(p).convert("RGBA")
        im = im.crop(im.getchannel("A").getbbox())
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        px = int(cx * W - im.width / 2)
        py = int(cy * H - im.height / 2)
        bg.paste(im, (px, py), im)
    d = ImageDraw.Draw(bg)
    d.rectangle([0, DIALOG_TOP, W, H], fill=(28, 38, 46))
    d.text((36, DIALOG_TOP + 16), f"{scene['scene_id']} {scene['name']}   k={k}   中心({cx},{cy})",
           fill=(190, 225, 235), font=FONT)
    d.text((36, DIALOG_TOP + 44), f"{fid}", fill=(140, 175, 185), font=FONT)
    return bg


def main():
    argv = sys.argv[1:]
    ks = [0.62]
    if "--k" in argv:
        i = argv.index("--k")
        ks = [float(x) for x in argv[i + 1].split(",")]
        del argv[i:i + 2]
    scenes = json.load(open(os.path.join(STAGE, "scenes.json"), encoding="utf-8"))["scenes"]
    exp = json.load(open(os.path.join(STAGE, "expressions.json"), encoding="utf-8"))["scenes"]
    want = [a for a in argv if a in scenes] or [s for s in scenes if scenes[s].get("character")]
    os.makedirs(OUTDIR, exist_ok=True)

    panels = []
    for sid in want:
        sc = dict(scenes[sid])
        sc["scene_id"] = sid
        e = exp.get(sid, {})
        if not e.get("character"):
            panels.append(bg_cover(sc["background"]))
            continue
        fid = None
        for slot in ("neutral", "smile", "angry", "surprised", "troubled", "serious"):
            lst = e.get("slots", {}).get(slot)
            if lst:
                fid = lst[0]["file"]
                break
        panels.append(render(sc, fid, ks[0]))

    cols = 2
    rows = (len(panels) + cols - 1) // cols
    tw, th = W // cols, H // rows
    sheet = Image.new("RGB", (tw * cols, th * rows), (8, 8, 10))
    for n, img in enumerate(panels):
        r, c = divmod(n, cols)
        sheet.paste(img.resize((tw, th), Image.LANCZOS), (c * tw, r * th))
    out = os.path.join(OUTDIR, f"stage_final_k{ks[0]}.jpg")
    sheet.save(out, quality=88)
    print(out, sheet.size, f"{len(panels)} 景  k={ks[0]}")


if __name__ == "__main__":
    main()
