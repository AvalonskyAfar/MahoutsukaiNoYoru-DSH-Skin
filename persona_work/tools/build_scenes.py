"""生成六个景的配置（scenes.json）。

每个景一条：背景 / 角色 / 服装行 / 可用帧（从 sprite_sequence.json 机械推导）/
站位（来自 spec-staging.md 的规则）/ 备选背景。

用法: python build_scenes.py
"""
import json, os, re, sys
from collections import defaultdict

AGG = r"D:\QuickLook插件包\moye\persona_work\agg\sprite_sequence.json"
OUT = r"D:\QuickLook插件包\moye\persona_work\stage\scenes.json"
ASSET_ROOT = "hfa_png/out"

SCENES = {
    "A1": {
        "name": "洋房客厅·白天", "role": "dialogue", "tone": "light",
        "background": "data02010/img3008.mzp.png",
        "bg_alt": {"same_shot_night": "data02010/img3006.mzp.png",
                   "dusk": "data02010/img3003.mzp.png"},
        "character": "ari", "outfit_i3": "01",
        "outfit_name": "黑色连衣裙（久远寺洋房日常）",
        "chapters": ["4_2", "4_3", "9_3", "9_7", "wik_b_1_b", "wik_e",
                     "wik_g_a", "wik_h_a", "wik_k", "wik_l_2"],
        "outfit_evidence": "有珠在洋馆戏所属的 10 个 .chs 里无一例外只引用 ari i3=01",
    },
    "A2": {
        "name": "洋房客厅·夜晚", "role": "dialogue", "tone": "dark",
        "background": "data02010/img3006.mzp.png",
        "bg_alt": {"same_shot_day": "data02010/img3008.mzp.png"},
        "character": "ari", "outfit_i3": "01",
        "outfit_name": "黑色连衣裙（久远寺洋房日常）",
        "same_as": "A1",
    },
    "A3": {
        "name": "教室·白天", "role": "dialogue", "tone": "light",
        "background": "data02050/img0231_01_01.mzp.png",
        "bg_alt": {"same_shot_night": "data02050/img0231_02_02.mzp.png",
                   "same_shot_night2": "data02050/img0231_03_03.mzp.png"},
        "character": "aok", "outfit_i3": "12",
        "outfit_name": "三咲高校制服（棕外套＋红领结＋百褶裙＋黑长袜）",
        "chapters": ["2_1", "2_2", "2_3", "2_4", "2_5"],
        "outfit_evidence": "2_3/2_4 只引用 aok_{a,l,m,n}12",
    },
    "A4": {
        "name": "夜·灯饰通学路", "role": "dialogue", "tone": "dark",
        "background": "data02000/img0296.mzp.png",
        "bg_alt": {"warning": "绝不能用 img0295（同机位但属第10章，那章青子穿浅蓝高领毛衣）"},
        "character": "aok", "outfit_i3": "03",
        "outfit_name": "白色羽绒服（毛领）＋酒红短裙＋黑裤袜＋黑长靴",
        "chapters": ["d_8"],
        "outfit_evidence": "img0296 被 d_8 引用；d_8 只引用 aok_{a,l,m,n,s}03",
    },
    "A5": {
        "name": "公园步道·秋", "role": "dialogue", "tone": "light",
        "background": "data02000/img0349.mzp.png",
        "bg_alt": {"same_shot_night": "data02000/img0345.mzp.png",
                   "snowy_night": "data02000/img0344.mzp.png",
                   "square_day": "data02000/img0347.mzp.png"},
        "character": "koj", "outfit_i3": "00",
        "outfit_name": "三咲高校制服（第7章）；若走 8dot5 线则为冬季便服 i3=01",
        "chapters": ["7_1", "8dot5"],
        "outfit_evidence": "7_1 引用 koj_{a,l,n,s}00；8dot5 引用 koj_n01",
        "outfit_variants": {"7_1": "00", "8dot5": "01"},
    },
    "A6": {
        "name": "洋馆客室·夜", "role": "dialogue", "tone": "dark",
        "background": "data02000/img0222.mzp.png",
        "bg_alt": {"same_shot_ref": "data02000/img0221.mzp.png",
                   "daytime": "data02000/img0135.mzp.png"},
        "character": "koj", "outfit_i3": "01",
        "outfit_name": "冬季便服（青绿色上衣＋格子围巾）",
        "chapters": ["wik_nap", "wik_wakeup", "wik_noroom", "wik_room"],
        "outfit_evidence": "wik_nap 引用 koj_a01",
    },
    "B1": {"name": "洋房正面全景·晴", "role": "shell", "tone": "light",
           "background": "data02010/img3000.mzp.png", "character": None},
    "B2": {"name": "洋房正面全景·雪夜", "role": "shell", "tone": "dark",
           "background": "data02010/img3002.mzp.png", "character": None},
    "B3": {"name": "标题画面·清晨云海", "role": "shell", "tone": "light",
           "background": "data00000/title_bg1.cbg.png", "character": None},
    "B4": {"name": "标题画面·星空雪原", "role": "shell", "tone": "dark",
           "background": "data00000/title_bg2.cbg.png", "character": None},
    "B5": {"name": "山路俯瞰城区·昼", "role": "shell", "tone": "light",
           "background": "data02000/img0292.mzp.png", "character": None},
    "B6": {"name": "繁华街·夜霓虹", "role": "shell", "tone": "dark",
           "background": "data02000/img0315.mzp.png", "character": None},
}

STAGE_CLOSEUP = {
    "kind": "closeup",
    "source_suffix": "",
    "preprocess": ["alpha_bbox_crop"],
    "scale": 0.70,                   # ★ 见 spec-staging.md §2.5.2（faceheight ≈ 66% 屏高）
    "anchor": "bbox-center",         # 内容 bbox 中心对齐画面锚点
    "x": "50%",                      # 单角色居中（用户已定：只做单角色）
    "y": "50%",
    "overflow": {"top": "visible", "bottom": "behind_dialog"},
    "dialog_safe_top": 770,
    "alternates": {"scale_compact": 0.55},
}


def build():
    data = json.load(open(AGG, encoding="utf-8"))
    out = {"generated_by": "persona_work/tools/build_scenes.py",
           "staging": "persona_work/stage/spec-staging.md",
           "switching": "persona_work/stage/spec-switching.md",
           "canvas": {"w": 1920, "h": 1080},
           "dialog_safe_top": 770,
           "scenes": {}}

    for sid, cfg in SCENES.items():
        s = dict(cfg)
        s["scene_id"] = sid
        if not s.get("character"):
            s["stage"] = {"kind": "none"}
            out["scenes"][sid] = s
            continue

        chs = s.get("chapters") or SCENES[s.get("same_as", sid)]["chapters"]
        s["chapters"] = chs
        who, i3 = s["character"], s["outfit_i3"]

        # 该景下原作引用过的 (帧, i4)，按帧号归并
        frames = defaultdict(lambda: {"i4": [], "n": 0, "example": None})
        for ch in chs:
            for sp in data.get(ch, {}).get("sprites", []):
                if sp["who"] == who and sp["i3"] == i3 and sp["closeup"]:
                    f = frames[sp["variant"]]
                    if sp["i4"] not in f["i4"]:
                        f["i4"].append(sp["i4"])
                    f["n"] += 1
                    f["example"] = f["example"] or sp["file"]
        s["frames_referenced"] = {
            f"v{k}": {"i4_channels": sorted(v["i4"]), "count": v["n"],
                      "example_file": v["example"]}
            for k, v in sorted(frames.items(), key=lambda x: int(x[0]))
        }
        s["frames_referenced_count"] = len(frames)
        s["stage"] = dict(STAGE_CLOSEUP)
        s["stage"]["asset_root"] = "hfa_png/out（交付时由皮肤侧指定实际根目录）"
        out["scenes"][sid] = s

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("写出", OUT)
    for sid, s in out["scenes"].items():
        if s.get("character"):
            print(f"  {sid} {s['name']}: {s['character']} i3={s['outfit_i3']}  "
                  f"引用帧 {s['frames_referenced_count']} 个")
        else:
            print(f"  {sid} {s['name']}: character=none")


if __name__ == "__main__":
    build()
