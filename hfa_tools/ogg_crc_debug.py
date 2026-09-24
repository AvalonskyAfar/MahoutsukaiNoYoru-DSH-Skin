"""CRC 自检：拿一个 ogg 的第一页做最小化验证，把中间量全打出来。

目的：区分「文件真的坏了」与「我的 CRC 算法/字段偏移写错了」。
若整批 64 个文件 100% CRC 失败，几乎必然是工具 bug。
"""
import struct, zlib, os

P = r"D:\QuickLook插件包\moye\bgm\m01.ogg"
buf = open(P, 'rb').read()

print("file:", P, "size:", len(buf))
print("head 16B:", buf[:16].hex(' '))

# 第 1 页页头（Ogg 规范 27 字节）
seg0 = buf[26]                     # 页 0 的 segment 数
body0 = sum(buf[27:27 + seg0])
len0 = 27 + seg0 + body0
page0 = bytearray(buf[:len0])
print(f"page0: nsegs={seg0} body={body0} total={len0}")
print("page0 header:", page0[:27].hex(' '))

stored = struct.unpack_from('<I', page0, 22)[0]
print(f"stored CRC (le u32 @22) = 0x{stored:08X}")

z = bytearray(page0)
z[22:26] = b'\x00\x00\x00\x00'
mine = zlib.crc32(bytes(z)) & 0xFFFFFFFF
print(f"zlib.crc32(zeroed)      = 0x{mine:08X}   match={mine == stored}")

# 对照：如果 CRC 字段不是第 22..25 字节，试几个可能的偏移
for off in range(18, 28):
    z2 = bytearray(page0)
    z2[off:off + 4] = b'\x00\x00\x00\x00'
    c = zlib.crc32(bytes(z2)) & 0xFFFFFFFF
    if c == stored:
        print(f"  !! 真正的 CRC 字段偏移是 {off}")

# 页 1 也验一遍：确认不是只有首页特殊
off1 = len0
seg1 = buf[off1 + 26]
body1 = sum(buf[off1 + 27:off1 + 27 + seg1])
len1 = 27 + seg1 + body1
page1 = bytearray(buf[off1:off1 + len1])
s1 = struct.unpack_from('<I', page1, 22)[0]
z1 = bytearray(page1)
z1[22:26] = b'\x00\x00\x00\x00'
m1 = zlib.crc32(bytes(z1)) & 0xFFFFFFFF
print(f"page1: stored=0x{s1:08X} mine=0x{m1:08X} match={m1 == s1}")

# granule of page0 应为 0
print("page0 granule =", struct.unpack_from('<Q', page0, 6)[0],
      " serial =", struct.unpack_from('<I', page0, 14)[0],
      " seq =", struct.unpack_from('<I', page0, 18)[0],
      " htype =", page0[5])
print("page0 body starts with:", bytes(page0[27:27 + 40]))
