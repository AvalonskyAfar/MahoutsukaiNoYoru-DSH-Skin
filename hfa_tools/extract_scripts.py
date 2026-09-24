import sys, os, re, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hfa import Hfa, GAME
import lenzu

OUT = r"D:\QuickLook插件包\moye\game_scripts"
os.makedirs(OUT, exist_ok=True)

archives = [Hfa(os.path.join(GAME, n))
            for n in sorted(os.listdir(GAME)) if n.lower().endswith('.hfa')]

targets = [(a, e) for a in archives for e in a.entries if e.ext in ('.chs', '.ctd')]
print(f"目标: {len(targets)} 个 ({sum(1 for _,e in targets if e.ext=='.chs')} chs, "
      f"{sum(1 for _,e in targets if e.ext=='.ctd')} ctd)")

ok = fail = 0
for a, e in targets:
    dst = os.path.join(OUT, e.ext.lstrip('.'), e.archive, e.name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst):
        ok += 1
        continue
    try:
        dec = lenzu.decompress(a.read(e))
        with open(dst, 'wb') as f:
            f.write(dec)
        ok += 1
    except Exception as ex:
        fail += 1
        print(f"  FAIL {e.archive}:{e.name} -> {type(ex).__name__}: {ex}")

print(f"完成: {ok} ok, {fail} fail  ->  {OUT}")

# 预览 ctd
ctd = os.path.join(OUT, 'ctd', 'data00200.hfa', 'script_text_ja.ctd')
if os.path.exists(ctd):
    d = open(ctd, 'rb').read()
    print(f"\n=== script_text_ja.ctd  {len(d):,} 字节 ===")
    print("开头 512 字节 repr:")
    print(repr(d[:512]))
    # 尝试 UTF-16LE
    try:
        s16 = d.decode('utf-16-le', 'replace')
        print("\nUTF-16LE 前 400 字符:")
        print(repr(s16[:400]))
    except Exception as ex:
        print("utf-16 失败", ex)
    # 统计换行
    print("\n0x0A 个数:", d.count(b'\n'), " 0x00 个数:", d.count(b'\x00'))
