"""从可读的 .ctd 剧本文本库里挖 BGM 线索

script_text_ja.ctd 是**纯 UTF-8 日文**（不再是字节码！），716K 字符。
里面出现了 魔法使いの夜 / 蒼崎青子 / 久遠寺有珠 / 静希草十郎 / スタッフ。
→ 重点找：片尾名单(staffroll) 文本、任何曲名、任何 BGM 指示。
"""
import os, re, json

CTD = r"D:\QuickLook插件包\moye\game_scripts\ctd\data00200.hfa"
JA = open(os.path.join(CTD, "script_text_ja.ctd"), "rb").read().decode("utf-8")
EN = open(os.path.join(CTD, "script_text_en.ctd"), "rb").read().decode("utf-8")

print(f"日文文本 {len(JA):,} 字符 / 英文 {len(EN):,} 字符")

# ---- 1) staffroll 相关 ----
print("\n" + "=" * 76)
print("=== 含「スタッフ」的上下文 ===")
for m in re.finditer("スタッフ", JA):
    a, b = max(0, m.start() - 300), min(len(JA), m.end() + 900)
    print(f"\n--- @{m.start()} ---")
    print(JA[a:b].replace("\r\n", "\n"))

# ---- 2) 已知曲名 全量反查 ----
KNOWN = ["魔法使いの夜", "メインテーマ", "蒼崎青子", "imbalance", "First star",
         "久遠寺有珠", "静希草十郎", "innocence", "対峙", "輪舞", "顕現", "金狼",
         "鏡の国の騒動", "お伽の国の狂騒", "FLAT SNARK", "久遠寺邸で朝食を",
         "午後の眠り", "鍵盤は躍る", "メイン・OP", "目を覚ます", "その隙間",
         "騒ぎ出す", "笑いあう", "待ち焦がれる", "街から離れて", "ひかるランチ",
         "日はまた沈む", "誰かと二人で", "密談", "遠い疵", "甘い痛み", "時計はまわる",
         "天はたしかに", "夜への誘い", "thames troll", "WORKING", "窮地", "omen",
         "いつまでも君と", "エレガント", "家路", "帰り道", "herald",
         "turbulence overdrive", "メインテーマ/日常", "予感", "眠り", "idyllic",
         "nostalgia", "extra magic number", "see you again", "Five",
         "one-on-one", "finality", "Judicare", "きみのはなし", "魔法使いの歓談"]

print("\n" + "=" * 76)
print("=== 曲名关键字在日文/英文文本库里出现次数 ===")
for k in KNOWN:
    cj, ce = JA.count(k), EN.count(k)
    if cj or ce:
        print(f"  {k:<26} ja={cj:<4} en={ce}")

# ---- 3) 找 "楽曲"/"サウンド"/"BGM"/"曲" 相关 ----
print("\n" + "=" * 76)
print("=== 菜单词 ===")
for k in ("楽曲", "サウンド", "サウンドトラック", "BGM", "曲名", "選曲", "音楽"):
    idx = [m.start() for m in re.finditer(re.escape(k), JA)]
    print(f"  {k:<18} ja={len(idx)}  en={EN.count(k)}")
    for i in idx[:3]:
        print(f"      ...{JA[max(0,i-60):i+90]!r}")

# ---- 4) 片尾名单：找连续的人名/职位排版 ----
print("\n" + "=" * 76)
print("=== 疑似片尾名单（含 監督/脚本/音楽/CAST 等）===")
for k in ("監督", "脚本", "音楽", "キャスト", "CAST", "Staff", "STAFF", "企画", "原作"):
    idx = [m.start() for m in re.finditer(re.escape(k), JA)]
    if idx:
        print(f"\n  【{k}】{len(idx)} 处")
        for i in idx[:4]:
            print(f"      ...{JA[max(0,i-80):i+160]!r}")

# 落盘全文，便于后续 grep
out = r"D:\QuickLook插件包\moye\game_scripts\ctd\script_text_ja.txt"
open(out, "w", encoding="utf-8").write(JA)
print(f"\n-> 全文已写出 {out}")
