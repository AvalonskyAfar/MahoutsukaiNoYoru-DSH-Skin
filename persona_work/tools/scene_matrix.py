"""把一个景「原作实际引用过的立绘帧」导出成对照表，供视觉判定与查表。

按修正后的语义：`<角色>_<批次>_<服装行 i3>_<姿态通道 i4>_<表情帧 v>[_b]`
—— **帧号 v 才是表情**，i4 是同一套衣服下的姿态/脸型通道。

用法:
    python scene_matrix.py A3
    python scene_matrix.py A4 --full
    python scene_matrix.py --all
"""
import json, os, re, sys
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

AGG = r"D:\QuickLook插件包\moye\persona_work\agg\sprite_sequence.json"
ROOT = r"D:\QuickLook插件包\moye\hfa_png\out"
OUTDIR = r"D:\QuickLook插件包\moye\persona_work\expressions"

SCENES = {
    "A1A2": (["4_2", "4_3", "9_3", "9_7", "wik_b_1_b", "wik_e", "wik_g_a", "wik_h_a", "wik_k", "wik_l_2"],
             [("ari", "01")]),
    "A3": (["2_1", "2_2", "2_3", "2_4", "2_5"], [("aok", "12")]),
    "A4": (["d_8"], [("aok", "03")]),
    "A5": (["7_1", "8dot5"], [("koj", "00"), ("koj", "01")]),
    "A6": (["wik_nap", "wik_wakeup", "wik_noroom", "wik_room"], [("koj", "00"), ("koj", "01")]),
    "A3sou": (["2_1", "2_2", "2_3", "2_4", "2_5"], [("sou", "12")]),
    "A3tob": (["2_1", "2_2", "2_3", "2_4", "2_5"], [("tob", "00")]),
}

FONT = None
for _p in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"):
    if os.path.exists(_p):
        try:
            FONT = ImageFont.truetype(_p, 20)
            break
        except Exception:
            pass


def path_of(sid, full):
    """立绘标识 -> 磁盘路径"""
    want = sid + ("_b" if full else "")
    for arch in sorted(os.listdir(ROOT)):
        dp = os.path.join(ROOT, arch)
        if not os.path.isdir(dp):
            continue
        f = want + ".mzp.png"
        if os.path.exists(os.path.join(dp, f)):
            return os.path.join(dp, f)
    return None


def build(scene, who, i3, full=False, cell=190):
    data = json.load(open(AGG, encoding="utf-8"))
    chs = SCENES[scene][0]
    # (帧, i4) -> [(章, id)]
    refs = defaultdict(list)
    for ch in chs:
        for s in data.get(ch, {}).get("sprites", []):
            if s["who"] == who and s["i3"] == i3 and s["closeup"] == (not full):
                refs[(s["variant"], s["i4"])].append((ch, s["id"]))
    if not refs:
        print("无引用", scene, who, i3)
        return None
    frames = sorted({k[0] for k in refs})
    chans = sorted({k[1] for k in refs})

    lab, head = 26, 50
    W = 180 + len(frames) * cell
    H = head + len(chans) * (cell + lab)
    sheet = Image.new("RGB", (W, H), (236, 236, 241))
    dr = ImageDraw.Draw(sheet)
    dr.text((8, 6), f"景 {scene} / {who} i3={i3} / {'全身 _b' if full else '特写'} / "
                    f"原作引用 {len(refs)} 格：帧 {len(frames)} 列 x 通道 {len(chans)} 行",
            fill=(160, 0, 0), font=FONT)
    for c, v in enumerate(frames):
        dr.text((180 + c * cell + 6, 28), f"v{v}", fill=(20, 20, 90), font=FONT)
    for r, e in enumerate(chans):
        y = head + r * (cell + lab)
        dr.rectangle([0, y, W, y + lab - 2], fill=(212, 212, 222))
        dr.text((8, y + 3), f"i4={e}", fill=(20, 20, 90), font=FONT)
        for c, v in enumerate(frames):
            items = refs.get((v, e))
            if not items:
                continue
            sid = sorted(items)[0][1]
            p = path_of(sid, full)
            if not p:
                dr.text((180 + c * cell, y + lab), "缺文件", fill=(255, 0, 0), font=FONT)
                continue
            im = Image.open(p).convert("RGBA")
            im.thumbnail((cell - 4, cell - 4), Image.LANCZOS)
            bg = Image.new("RGB", im.size, (18, 18, 22))
            bg.paste(im, (0, 0), im)
            sheet.paste(bg, (180 + c * cell + (cell - bg.width) // 2,
                             y + lab + (cell - bg.height) // 2))
            dr.text((180 + c * cell + 3, y + lab + 1), sid.split("_")[1], fill=(255, 220, 80), font=FONT)
    os.makedirs(OUTDIR, exist_ok=True)
    out = os.path.join(OUTDIR, f"scene_{scene}_{who}{i3}{'_b' if full else ''}.jpg")
    sheet.save(out, quality=90)
    print(f"{out}  {sheet.size}  ({len(chans)} 行 x {len(frames)} 列)")
    return out


if __name__ == "__main__":
    argv = list(sys.argv[1:])
    full = "--full" in argv
    argv = [a for a in argv if a != "--full"]
    names = [a for a in argv if a in SCENES]
    if not names or "--all" in argv:
        names = list(SCENES)
    for n in names:
        for who, i3 in SCENES[n][1]:
            build(n, who, i3, full)
