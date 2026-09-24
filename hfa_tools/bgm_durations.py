"""打印 64 首 BGM 的时长表（按编号排序）"""
import json

r = json.load(open(r"D:\QuickLook插件包\moye\bgm\bgm_verify.json", encoding="utf-8"))
r.sort(key=lambda x: x["file"])

print(f"{'文件':<10}{'时长':>11}{'秒':>10}{'MB':>9}")
print("-" * 42)
for x in r:
    d = x["duration"]
    print(f"{x['file']:<10}{int(d // 60)}:{d % 60:06.3f}{d:>10.2f}{x['bytes'] / 1048576:>9.2f}")
print("-" * 42)
print(f"合计 {sum(x['duration'] for x in r) / 60:.2f} 分钟，{len(r)} 首")
