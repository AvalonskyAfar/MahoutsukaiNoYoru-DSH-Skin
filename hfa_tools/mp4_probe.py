"""看 opening mp4 的容器结构，判断音轨编码能否无 ffmpeg 提取"""
import sys, os, struct, re
sys.path.insert(0, r"D:\QuickLook插件包\moye\hfa_tools")
from hfa import Hfa, GAME

print("### MP4-PROBE ###")
a = Hfa(os.path.join(GAME, "data02900.hfa"))
e = next(x for x in a.entries if x.name == "opening_ja.mp4")
print(f"opening_ja.mp4  {e.length:,} B ({e.length/1048576:.1f} MB)")
# 只读头部与前 256KB
with open(a.path, "rb") as f:
    f.seek(a.base + e.offset)
    head = f.read(262144)
print(f"头部 256KB 前 64 字节: {head[:64].hex(' ')}")
print(f"ascii: {''.join(chr(c) if 32<=c<127 else '.' for c in head[:64])}")

print("\n=== 顶层 box ===")
off = 0
while off < len(head) - 8:
    sz = struct.unpack(">I", head[off:off+4])[0]
    typ = head[off+4:off+8]
    try: t = typ.decode("ascii")
    except Exception: break
    if not re.fullmatch(r"[a-zA-Z0-9 ]{4}", t): break
    print(f"  @{off:<8} size={sz:<10,} {t!r}")
    if sz == 0: break
    if sz == 1:
        sz = struct.unpack(">Q", head[off+8:off+16])[0]
    off += sz
    if off > len(head): break

print("\n=== 编码标识符出现情况（前 256KB）===")
for tag, label in [(b"mp4a", "AAC 音频"), (b"avc1", "H.264 视频"), (b"Opus", "Opus"),
                   (b"vorbis", "Vorbis"), (b"alac", "ALAC"), (b"moov", "moov"),
                   (b"mdat", "mdat(媒体数据)"), (b"ftyp", "ftyp")]:
    idx = head.find(tag)
    print(f"  {label:<14} {tag!r:<12} {'@'+str(idx) if idx>=0 else '未见'}")

print("\n=== ftyp 品牌 ===")
i = head.find(b"ftyp")
if i >= 0:
    print(f"  {head[i-4:i+24]!r}")
print("### END ###")
