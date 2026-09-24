"""Ogg Vorbis 注释头（comment header）里到底有没有曲名？

交接文档说「.hw 头部没有内嵌曲名」——但那只看了 64 字节的 .hw 头，
没人检查过 Ogg 的 **comment header**（vendor string + user comments）。
很多游戏 BGM 会在这里写 TITLE= 之类。顺手也把 bitrate 取出来。
"""
import os, glob, struct, json

BGM = r"D:\QuickLook插件包\moye\bgm"
out = {}

for p in sorted(glob.glob(os.path.join(BGM, "*.ogg"))):
    name = os.path.basename(p)[:-4]
    buf = open(p, "rb").read()

    # 逐页走，收集头三个包（id / comment / setup）
    pos, packets, cur = 0, [], b""
    while pos < len(buf) and len(packets) < 3:
        if buf[pos:pos + 4] != b"OggS":
            break
        nsegs = buf[pos + 26]
        segs = buf[pos + 27:pos + 27 + nsegs]
        blen = sum(segs)
        body = buf[pos + 27 + nsegs: pos + 27 + nsegs + blen]
        off = 0
        for s in segs:
            cur += body[off:off + s]
            off += s
            if s < 255:
                packets.append(cur)
                cur = b""
        pos += 27 + nsegs + blen

    info = {"vendor": None, "comments": [], "raw_comment_bytes": 0}
    if len(packets) >= 2 and packets[1][:1] == b"\x03":
        c = packets[1]
        vlen = struct.unpack_from("<I", c, 7)[0]
        info["vendor"] = c[11:11 + vlen].decode("utf-8", "replace")
        q = 11 + vlen
        ncom = struct.unpack_from("<I", c, q)[0]
        q += 4
        for _ in range(ncom):
            if q + 4 > len(c):
                break
            l = struct.unpack_from("<I", c, q)[0]
            q += 4
            raw = c[q:q + l]
            q += l
            try:
                info["comments"].append(raw.decode("utf-8"))
            except UnicodeDecodeError:
                info["comments"].append("<非UTF8> " + raw.hex(" ")[:120])
        info["raw_comment_bytes"] = len(c)
    if len(packets) >= 3:
        info["setup_bytes"] = len(packets[2])
    out[name] = info

# 汇总
vendors = {}
for k, v in out.items():
    vendors.setdefault(v["vendor"], []).append(k)
print("=== vendor string 分布 ===")
for vend, ks in vendors.items():
    print(f"  {vend!r}  -> {len(ks)} 个")

print("\n=== 每个文件的 user comments ===")
anyc = False
for k, v in out.items():
    if v["comments"]:
        anyc = True
        print(f"  {k}: {v['comments']}")
if not anyc:
    print("  （全部为空——comment header 里没有曲名/注释）")

json.dump(out, open(os.path.join(BGM, "ogg_comments.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print(f"\n-> {os.path.join(BGM, 'ogg_comments.json')}")
