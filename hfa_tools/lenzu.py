"""LenZuCompressor 解压器 —— 魔法使之夜 (Hunex 引擎)

移植自 nike4613/MahoyoHDRepack 的 LenZuCompressorFile.Managed.cs (MIT)
https://github.com/nike4613/MahoyoHDRepack

容器布局
    0x00  32 字节固定头: b"LenZuCompressor\\0" + b"1\\0\\0\\0" + b"0" + 11×\\0
    0x20  u32 解压后长度
    0x24  u32 校验和高 32 位
    0x28  u32 校验和低 32 位
    0x2C  u32 未使用
    0x30  6 字节压缩选项
    0x36  位流（MSB 优先）
"""
import struct
import heapq

HEADER_SIZE = 0x20
EXPECT_HEADER = (b"LenZuCompressor\x00"
                 + b"1\x00\x00\x00"
                 + b"0" + b"\x00" * 11)

CHECKSUM_LUT = (0xE9, 0x115, 0x137, 0x1B1)


class BitReader:
    """MSB 优先的位流读取器，等价于原实现的 Bitstream(ref struct)。"""

    __slots__ = ('data', 'pos', 'nbits')

    def __init__(self, data):
        self.data = data
        self.pos = 0
        self.nbits = len(data) * 8

    @property
    def at_end(self):
        # 对应原实现 byteOffset >= bytes.Length
        return (self.pos >> 3) >= len(self.data)

    def read_bit(self):
        p = self.pos
        if p >= self.nbits:
            raise EOFError("位流已耗尽")
        self.pos = p + 1
        return (self.data[p >> 3] >> (7 - (p & 7))) & 1

    def read_bits(self, n):
        v = 0
        for _ in range(n):
            v = (v << 1) | self.read_bit()
        return v

    def read_le_rounded(self, bits):
        """ReadLittleEndianWithRoundedBits：读 ceil(bits/8) 个整字节，按小端组合。"""
        nbytes = ((bits - 1) // 8) + 1
        v = 0
        for i in range(nbytes):
            v |= self.read_bits(8) << (i * 8)
        return v


class HuffTable:
    __slots__ = ('cv', 'c1', 'c2', 'bv', 'start', 'first_real', 'size')

    def __init__(self, size):
        self.size = size
        self.cv = [0] * size       # ConstructorValue
        self.c1 = [-1] * size      # Child1 (第二小)
        self.c2 = [-1] * size      # Child2 (最小)
        self.bv = [-1] * size      # BitValue
        self.first_real = 0
        self.start = 0


def read_compressor_options(body):
    d = body[16:22]
    if len(d) < 6:
        raise ValueError("压缩选项不足 6 字节")
    raw, mn = d[1], d[2]
    upper, low, base = d[3], d[4], d[5]
    if not (3 <= raw < 16):
        raise ValueError(f"huffTableBitCountRaw 越界: {raw}")
    if not (3 <= mn < 16):
        raise ValueError(f"huffTableBitCountMin 越界: {mn}")
    bit_count = max(raw, mn)
    if not (upper >= mn and upper < 16):
        raise ValueError(f"backrefLowBitCountXUpper 越界: {upper}")
    if not (0 <= low < upper):
        raise ValueError(f"backrefLowBitCount 越界: {low}")
    if not (bit_count >= upper - low):
        raise ValueError("huffTableBitCount < upper-low")
    if not (2 <= base <= 8):
        raise ValueError(f"backrefBaseDistance 越界: {base}")
    mask = (1 << bit_count) - 1
    return {
        'bit_count': bit_count,
        'low_bit_count': low,
        'base_distance': base,
        'max_entries': ((1 << bit_count) + 1) * (1 << bit_count) // 2,
        'mask': mask,
    }


def read_huffman_table(opts, br):
    t = HuffTable(opts['max_entries'])
    cv, c1, c2, bv = t.cv, t.c1, t.c2, t.bv
    first_real = opts['mask'] + 1
    t.first_real = first_real
    max_bytes = (opts['bit_count'] + 7) // 8

    entries_to_fill = br.read_le_rounded(max_bytes)
    if entries_to_fill == 0:
        entries_to_fill = first_real
    read_index = True
    if first_real * 4 < (max_bytes + 4) * entries_to_fill:
        read_index = False
        entries_to_fill = first_real

    for i in range(entries_to_fill):
        ti = br.read_le_rounded(max_bytes) if read_index else i
        cv[ti] = br.read_le_rounded(32)

    # 构建哈夫曼树：每轮取两个「仍活跃」的最小值
    # 活跃 = ConstructorValue != 0 且 BitValue == -1
    # 平手时按下标升序 —— 与原实现单遍扫描的严格 > 比较等价
    heap = [(cv[i], i) for i in range(first_real) if cv[i] != 0]
    heapq.heapify(heap)

    current = first_real
    while current < t.size:
        active = []
        while heap and len(active) < 2:
            v, i = heapq.heappop(heap)
            if bv[i] == -1 and cv[i] == v:
                active.append((v, i))
        if len(active) < 2:
            if active and current <= first_real:
                bv[active[0][1]] = 1
            t.start = current
            return t
        (vs, i_small), (v2, i_2nd) = active[0], active[1]
        cv[current] = cv[i_2nd] + cv[i_small]
        c2[current] = i_small     # Child2 = 最小
        c1[current] = i_2nd       # Child1 = 第二小
        bv[i_small] = 1
        bv[i_2nd] = 0
        heapq.heappush(heap, (cv[current], current))
        current += 1

    t.start = t.size - 1
    return t


def decode_huffman_sequence(br, t):
    if t.first_real < t.start:
        entry = t.start - 1
        cv, c1, c2, bv = t.cv, t.c1, t.c2, t.bv
        while entry >= t.first_real:
            bit = br.read_bit()
            a, b = c1[entry], c2[entry]
            if bv[a] == bit:
                entry = a
            elif bv[b] == bit:
                entry = b
            else:
                raise ValueError(f"哈夫曼走树失败: entry={entry} bit={bit}")
        return entry
    cv = t.cv
    for i in range(t.start - 1, -1, -1):
        if cv[i] != 0:
            br.read_bit()
            return i
    raise ValueError("哈夫曼序列解码失败")


def decompress_core(opts, out, br, t):
    off = 0
    n = len(out)
    low_bits = opts['low_bit_count']
    base = opts['base_distance']
    while off < n and not br.at_end:
        is_backref = br.read_bit()
        length = decode_huffman_sequence(br, t)
        if is_backref:
            length += base
            dist_high = decode_huffman_sequence(br, t)
            dist_low = br.read_bits(low_bits) if low_bits > 0 else 0
            distance = (dist_low | (dist_high << low_bits)) + base
            if distance <= 0 or distance > off:
                raise ValueError(f"非法回溯距离 {distance} (已输出 {off})")
            for _ in range(length):
                if off >= n:
                    break
                out[off] = out[off - distance]
                off += 1
        else:
            for _ in range(length + 1):
                if off >= n:
                    break
                out[off] = br.read_bits(8)
                off += 1
    return off


def compute_checksum(data):
    ck = 0
    lut = CHECKSUM_LUT
    for i, b in enumerate(data):
        ck = ((ck + b) * lut[i & 3]) & 0xFFFFFFFFFFFFFFFF
    return ck


def decompress(data, assert_checksum=True):
    if len(data) < 0x36:
        raise ValueError("文件过小")
    if data[:HEADER_SIZE] != EXPECT_HEADER:
        raise ValueError(f"头部不符: {data[:HEADER_SIZE]!r}")
    body = data[HEADER_SIZE:]
    length = struct.unpack_from('<I', body, 0)[0]
    ck_hi = struct.unpack_from('<I', body, 4)[0]
    ck_lo = struct.unpack_from('<I', body, 8)[0]
    expect_ck = (ck_hi << 32) | ck_lo

    opts = read_compressor_options(body)
    br = BitReader(body[22:])
    t = read_huffman_table(opts, br)

    out = bytearray(length)
    final = decompress_core(opts, out, br, t)
    if final != length:
        out = out[:final]

    if assert_checksum:
        got = compute_checksum(out)
        if got != expect_ck:
            raise ValueError(f"校验和不符: 期望 {expect_ck:016x}, 实得 {got:016x}")
    return bytes(out)
