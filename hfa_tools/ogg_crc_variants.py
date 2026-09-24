"""CRC 变体差分测试

对同一页分别用几种 CRC-32 变体去算，看哪一种能对上文件里存的 CRC：
  1. zlib.crc32            —— 反射型 CRC-32（== Ogg 规范要求的算法）
  2. 非反射 CRC-32          —— 多项式 0x04C11DB7 正向移位
  3. 反射但初值 0 / 末值不取反 等组合
再额外检查：页体是否与 Ogg 页边界完全吻合（有没有多余字节）。
"""
import struct

P = r"D:\QuickLook插件包\moye\bgm\m01.ogg"
buf = open(P, 'rb').read()

seg0 = buf[26]
body0 = sum(buf[27:27 + seg0])
len0 = 27 + seg0 + body0
page0 = bytearray(buf[:len0])
stored = struct.unpack_from('<I', page0, 22)[0]


def crc_nonreflected(data, poly=0x04C11DB7, init=0x00000000, xorout=0x00000000):
    c = init
    for b in data:
        c ^= b << 24
        for _ in range(8):
            c = ((c << 1) ^ poly) & 0xFFFFFFFF if c & 0x80000000 else (c << 1) & 0xFFFFFFFF
    return c ^ xorout


def crc_reflected(data, poly=0xEDB88320, init=0xFFFFFFFF, xorout=0xFFFFFFFF):
    c = init
    for b in data:
        c ^= b
        for _ in range(8):
            c = (c >> 1) ^ poly if c & 1 else c >> 1
    return c ^ xorout


z = bytearray(page0)
z[22:26] = b'\x00\x00\x00\x00'

print(f"stored                  = 0x{stored:08X}")
import zlib
print(f"zlib.crc32              = 0x{zlib.crc32(bytes(z)) & 0xFFFFFFFF:08X}")
print(f"reflected init=0 noxor  = 0x{crc_reflected(bytes(z), init=0, xorout=0):08X}")
print(f"nonreflected init=0     = 0x{crc_nonreflected(bytes(z), init=0):08X}")
print(f"nonreflected init=~0,xor= 0x{crc_nonreflected(bytes(z), init=0xFFFFFFFF, xorout=0xFFFFFFFF):08X}")

# 不置零 CRC 字段直接算
print(f"nonreflected (CRC not zeroed) = 0x{crc_nonreflected(bytes(page0), init=0):08X}")
print(f"zlib (CRC not zeroed)         = 0x{zlib.crc32(bytes(page0)) & 0xFFFFFFFF:08X}")

# 只对页头 27B 算
print(f"header27 nonref init=0  = 0x{crc_nonreflected(bytes(page0[:27]), init=0):08X}")

# 页边界完整性：整文件能被页链完整吃掉吗
pos, n, pages = 0, len(buf), 0
while pos < n:
    if buf[pos:pos + 4] != b'OggS':
        print(f"!! offset {pos} 不是 OggS: {buf[pos:pos+8]!r}")
        break
    ns = buf[pos + 26]
    bl = sum(buf[pos + 27:pos + 27 + ns])
    pos = pos + 27 + ns + bl
    pages += 1
print(f"页链消耗: pages={pages} 结束位置={pos} 文件长={n} 完全吻合={pos == n}")

# 统计每个 OggS 的出现位置间距，确认没有嵌套/重复
idxs = []
i = buf.find(b'OggS')
while i >= 0:
    idxs.append(i)
    i = buf.find(b'OggS', i + 1)
print(f"'OggS' 字面量出现 {len(idxs)} 次（页链实际页数 {pages}）")

# 检查 CRC 字段本身是否可能被某种固定变换过：看 stored XOR mine 是否恒定
import zlib as _z
diffs = []
pos = 0
for k in range(min(50, pages)):
    ns = buf[pos + 26]
    bl = sum(buf[pos + 27:pos + 27 + ns])
    ln = 27 + ns + bl
    pg = bytearray(buf[pos:pos + ln])
    s = struct.unpack_from('<I', pg, 22)[0]
    zz = bytearray(pg)
    zz[22:26] = b'\x00\x00\x00\x00'
    m = _z.crc32(bytes(zz)) & 0xFFFFFFFF
    diffs.append(s ^ m)
    pos += ln
uniq = set(diffs)
print(f"前 {len(diffs)} 页 (stored XOR zlibcrc) 的不同取值数 = {len(uniq)}"
      f"  -> {'恒定，说明是固定变换/密钥' if len(uniq) == 1 else '各不相同，说明是随机化 CRC 或算法不符'}")
print("  样例:", [f"{d:08X}" for d in diffs[:6]])
