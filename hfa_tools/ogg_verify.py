"""独立验证 bgm/*.ogg 是否为完整、可播放的 OGG Vorbis

不依赖任何第三方库：自己走完整的 Ogg 页链（page chain），
逐页校验 CRC32、序列号一致性、granule 单调性、BOS/EOS 标志，
并从 vorbis 三个头（identification / comment / setup）里取出
采样率、声道、bitrate，最后用末页 granule 算出真实时长。

输出：
    bgm_verify.json   —— 每个文件的机器可读结果
    （stdout）        —— 人类可读表格
"""
import os, sys, json, struct

BGM = r"D:\QuickLook插件包\moye\bgm"
OUT_JSON = r"D:\QuickLook插件包\moye\bgm\bgm_verify.json"


# ------------------------------------------------------- Ogg 专用 CRC-32
# ⚠️ 关键区别：Ogg 用的**不是** zlib.crc32！
#   Ogg framing 规范规定：CRC-32，多项式 0x04C11DB7，**非反射(MSB-first)**，
#   初值 0，结果不取反。而 zlib.crc32 是反射型(LSB-first, poly 0xEDB88320,
#   init=0xFFFFFFFF, xorout=0xFFFFFFFF)。两者算出的值完全不同。
#   实测：对每页用下面的算法算出的 CRC 与 .hw 里存的 CRC 逐页完全一致。
#   （用 zlib.crc32 会把 64/64 全部误判为"CRC 损坏"——已踩过，勿重蹈。）
_POLY = 0x04C11DB7
_TABLE = []
for _i in range(256):
    _c = _i << 24
    for _ in range(8):
        _c = ((_c << 1) ^ _POLY) & 0xFFFFFFFF if _c & 0x80000000 else (_c << 1) & 0xFFFFFFFF
    _TABLE.append(_c)


def ogg_crc(page: bytes) -> int:
    """Ogg 页 CRC：非反射 CRC-32 / poly 0x04C11DB7 / init 0 / 不取反。"""
    c = 0
    for b in page:
        c = ((c << 8) & 0xFFFFFFFF) ^ _TABLE[((c >> 24) & 0xFF) ^ b]
    return c


# ---------------------------------------------------------------- Ogg 页解析
class Page:
    __slots__ = ('offset', 'version', 'header_type', 'granule', 'serial',
                 'seq', 'crc', 'crc_ok', 'segments', 'body', 'nsegs')


def iter_pages(buf):
    """按 Ogg 规范逐页遍历；返回 (page, error)。遇到结构性错误即停。"""
    pos, n = 0, len(buf)
    while pos < n:
        if buf[pos:pos + 4] != b'OggS':
            yield None, f"offset {pos}: 期望 OggS，实得 {buf[pos:pos+4]!r}"
            return
        if pos + 27 > n:
            yield None, f"offset {pos}: 页头被截断"
            return
        ver = buf[pos + 4]
        if ver != 0:
            yield None, f"offset {pos}: 版本 {ver} != 0"
            return
        htype = buf[pos + 5]
        granule, serial, seq, crc = struct.unpack_from('<QIIi', buf, pos + 6)
        nsegs = buf[pos + 26]
        seg_table_end = pos + 27 + nsegs
        if seg_table_end > n:
            yield None, f"offset {pos}: segment table 越界"
            return
        segs = buf[pos + 27:seg_table_end]
        body_len = sum(segs)
        body_end = seg_table_end + body_len
        if body_end > n:
            yield None, (f"offset {pos}: 页体越界 "
                         f"(需要 {body_len}B，只剩 {n - seg_table_end}B)")
            return

        p = Page()
        p.offset, p.version, p.header_type = pos, ver, htype
        p.granule, p.serial, p.seq, p.crc = granule, serial, seq, crc
        p.segments, p.nsegs = segs, nsegs
        p.body = buf[seg_table_end:body_end]

        # CRC 校验：把 CRC 字段清零后对整页算 Ogg 版 CRC-32（非 zlib.crc32！）
        page = bytearray(buf[pos:body_end])
        page[22:26] = b'\x00\x00\x00\x00'
        p.crc_ok = ogg_crc(bytes(page)) == (crc & 0xFFFFFFFF)

        yield p, None
        pos = body_end


def parse_vorbis_id(body):
    """0x01 'vorbis' 头 -> 采样率 / 声道 / bitrate"""
    if len(body) < 30 or body[0] != 0x01 or body[1:7] != b'vorbis':
        return None
    ver, ch, rate, br_max, br_nom, br_min = struct.unpack_from('<IBIiii', body, 7)
    bs = body[28]
    return dict(version=ver, channels=ch, sample_rate=rate,
                bitrate_max=br_max, bitrate_nominal=br_nom, bitrate_min=br_min,
                blocksize=f"{1 << (bs & 0x0F)}/{1 << (bs >> 4)}")


def scan(path):
    buf = open(path, 'rb').read()
    r = dict(file=os.path.basename(path), bytes=len(buf),
             pages=0, crc_bad=0, errors=[], serials=set(),
             seq_ok=True, granule_monotonic=True,
             bos=False, eos=False, id_header=None,
             vendor=None, comments=0, last_granule=0, duration=None,
             actual_rate=None, actual_channels=None)

    prev_granule = -1
    first_data_page = None
    id_pkt_body = None
    packet_buf = b''

    for p, err in iter_pages(buf):
        if err:
            r['errors'].append(err)
            break
        r['pages'] += 1
        if not p.crc_ok:
            r['crc_bad'] += 1
        r['serials'].add(p.serial)
        if p.seq != r['pages'] - 1 and p.serial == min(r['serials']):
            # 同一逻辑流内 seq 应连续递增
            r['seq_ok'] = r['seq_ok'] and (p.seq == r['pages'] - 1)
        if p.header_type & 0x02:
            r['bos'] = True
        if p.header_type & 0x04:
            r['eos'] = True
        if p.granule != 0xFFFFFFFFFFFFFFFF:
            if p.granule < prev_granule:
                r['granule_monotonic'] = False
            prev_granule = p.granule
            r['last_granule'] = p.granule

        # 组包：segment < 255 表示包结束
        off = 0
        for s in p.segments:
            packet_buf += p.body[off:off + s]
            off += s
            if s < 255:
                if id_pkt_body is None and packet_buf[:1] == b'\x01':
                    id_pkt_body = packet_buf
                    r['id_header'] = parse_vorbis_id(packet_buf)
                elif packet_buf[:1] == b'\x03' and r['vendor'] is None:
                    # comment 头
                    try:
                        vlen = struct.unpack_from('<I', packet_buf, 7)[0]
                        r['vendor'] = packet_buf[11:11 + vlen].decode('utf-8', 'replace')
                        ncom = struct.unpack_from('<I', packet_buf, 11 + vlen)[0]
                        r['comments'] = ncom
                    except Exception:
                        pass
                packet_buf = b''

    r['serials'] = len(r['serials'])

    # 时长 = 末页 granule / 采样率
    if r['id_header'] and r['id_header']['sample_rate']:
        r['actual_rate'] = r['id_header']['sample_rate']
        r['actual_channels'] = r['id_header']['channels']
        r['duration'] = r['last_granule'] / r['actual_rate']

    r['ok'] = (not r['errors'] and r['crc_bad'] == 0 and r['bos'] and r['eos']
               and r['id_header'] is not None and r['seq_ok']
               and r['granule_monotonic'] and r['serials'] == 1)
    return r


def main():
    files = sorted(f for f in os.listdir(BGM) if f.lower().endswith('.ogg'))
    print(f"### OGG VERIFY ###  {len(files)} 个文件\n")
    hdr = f"{'文件':<10}{'字节':>10}{'页':>7}{'CRC错':>6}{'声道':>5}{'采样率':>8}{'时长':>9}  {'BOS/EOS':<8}{'状态'}"
    print(hdr)
    print("-" * len(hdr))

    results, bad = [], []
    for fn in files:
        r = scan(os.path.join(BGM, fn))
        results.append(r)
        d = r['duration']
        dur = f"{int(d // 60)}:{d % 60:05.2f}" if d else "?"
        st = "OK" if r['ok'] else "!! " + (";".join(r['errors'][:1]) or "校验失败")
        if not r['ok']:
            bad.append(r)
        print(f"{fn:<10}{r['bytes']:>10,}{r['pages']:>7}{r['crc_bad']:>6}"
              f"{str(r['actual_channels'] or '?'):>5}{str(r['actual_rate'] or '?'):>8}"
              f"{dur:>9}  "
              f"{('B' if r['bos'] else '-') + ('E' if r['eos'] else '-') + '/' + str(r['serials']):<8}{st}")

    print(f"\n=== 汇总：{len(files)} 个文件，OK {len(files) - len(bad)}，异常 {len(bad)} ===")
    for r in bad:
        print(f"  !! {r['file']}: {r['errors']} crc_bad={r['crc_bad']} "
              f"bos={r['bos']} eos={r['eos']} serials={r['serials']}")

    tot = sum(r['duration'] or 0 for r in results)
    print(f"总时长 {int(tot // 60)} 分 {tot % 60:.1f} 秒")

    json.dump(results, open(OUT_JSON, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f"-> {OUT_JSON}")
    print("### END ###")
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
