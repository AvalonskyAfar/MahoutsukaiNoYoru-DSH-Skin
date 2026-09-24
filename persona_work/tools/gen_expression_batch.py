"""批量生成表情对比表 + 切片 + 清单（供视觉子代理逐张识别）。

用法:
    python gen_expression_batch.py 12 03          # 青子这两个服装行
    python gen_expression_batch.py 01 00 --who koj
输出:
    persona_work/expressions/expr_<who>_<i3>.jpg   总表
    persona_work/expressions/expr_<who>_<i3>_pN.jpg 切片
    persona_work/expressions/manifest.json          清单（含每个切片覆盖的立绘标识）
"""
import os, re, sys, json
from collections import defaultdict
from PIL import Image

sys.path.insert(0, r"D:\QuickLook插件包\moye\persona_work\tools")
from expression_sheets import collect, build  # noqa: E402

OUTDIR = r"D:\QuickLook插件包\moye\persona_work\expressions"
CELL, LAB = 300, 30
ROWS_PER = 4


def slices_for(who, i3, batches=None, maxvar=4):
    """返回 [(切片路径, [立绘标识...])]"""
    d = collect(who, i3, batches)
    keys = sorted(d, key=lambda k: (k[1], int(k[0])))
    n = len(keys)
    out = []
    idx = 0
    part = 1
    while idx < n:
        ids = []
        for k in keys[idx:idx + ROWS_PER]:
            e, bflag = k
            ids.append((k, [f"{who}_{b}_{i3}_{e}{'_b' if bflag else ''}" for b, v, _ in d[k]]))
        out.append((f"expr_{who}_{i3}_p{part}.jpg", ids))
        idx += ROWS_PER
        part += 1
    return out


def main():
    argv = list(sys.argv[1:])
    who = "aok"
    if "--who" in argv:
        k = argv.index("--who")
        who = argv[k + 1]
        del argv[k:k + 2]
    os.makedirs(OUTDIR, exist_ok=True)
    manifest = {}
    mpath = os.path.join(OUTDIR, "manifest.json")
    if os.path.exists(mpath):
        manifest = json.load(open(mpath, encoding="utf-8"))

    for i3 in argv:
        big = build(who, i3, None, 4)
        if not big:
            continue
        im = Image.open(big)
        step = CELL + LAB
        parts = slices_for(who, i3)
        y = 44
        for name, ids in parts:
            y2 = min(im.height, y + ROWS_PER * step)
            crop = im.crop((0, y, im.width, y2))
            p = os.path.join(OUTDIR, name)
            crop.save(p, quality=90)
            manifest[name] = {
                "who": who, "i3": i3,
                "rows": [{"expr": f"{who}_*_{i3}_{k[0]}" + ("_b" if k[1] else ""),
                          "ids": v} for k, v in ids],
            }
            y = y2
        print(f"  {who} i3={i3}: {len(parts)} 切片")

    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print("manifest:", mpath, len(manifest), "切片（累计）")


if __name__ == "__main__":
    main()
