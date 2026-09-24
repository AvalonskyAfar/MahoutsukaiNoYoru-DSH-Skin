"""data03000（BGM 归档）全貌 + .hw 头部是否有内嵌元数据"""
import sys, os, struct
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

print("### BGM-LIST-START ###")
a = Hfa(os.path.join(GAME, "data03000.hfa"))
print(f"data03000.hfa  条目数 {a.count}")
ents = sorted(a.entries, key=lambda e: e.name)
for e in ents:
    print(f"  {e.name:<16} {e.length:>10,} B  ({e.length/1048576:.2f} MB)")

print("\n=== 头部字节（前 3 个）===")
for e in ents[:3]:
    d = a.read(e)[:80]
    print(f"  {e.name}: {d[:64].hex(' ')}")
    txt = ''.join(chr(c) if 32 <= c < 127 else '.' for c in d[:64])
    print(f"      ascii: {txt}")

print("\n=== 是否所有 m* 都是裸 PCM？（看头 4 字节是否 = 64）===")
bad = []
for e in ents:
    d = a.read(e)[:8]
    hdr = struct.unpack("<I", d[:4])[0]
    if hdr != 64:
        bad.append((e.name, hdr, d[:8].hex(' ')))
print(f"  头部 = 64 的: {len(ents)-len(bad)} / {len(ents)}")
for b in bad[:10]:
    print(f"    ⚠ {b[0]}: 头={b[1]}  bytes={b[2]}")
print("### BGM-LIST-END ###")
