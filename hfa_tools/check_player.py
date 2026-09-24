"""校验生成的试听台 HTML：结构 + 内嵌 JS 语法

用 Node 直接解析 <script> 里的代码（用 new Function 做语法检查，不执行）。
另外核对 64 行数据、用途分布是否正确。
"""
import re, os, json, subprocess, collections

P = r"D:\QuickLook插件包\moye\docs\14a-试听-bgm-player.html"
html = open(P, encoding="utf-8").read()

print(f"文件 {len(html):,} 字符")

# 1) 基本结构
for tag in ("<html", "</html>", "<table", "</table>", "<tbody", "id=\"tb\"", "const DATA"):
    print(f"  {'OK ' if tag in html else '!! '}{tag!r}")

# 2) 抽出 DATA 数组并校验
m = re.search(r"const DATA = (\[.*?\]);", html, re.S)
data = json.loads(m.group(1))
print(f"\nDATA 条数 = {len(data)}  (应为 64)")
ids = [d["id"] for d in data]
print(f"  编号唯一 = {len(set(ids)) == len(ids)}")
print(f"  含 m01s = {'m01s' in ids}, 含 x_m64 = {'x_m64' in ids}, 含 m20 = {'m20' in ids}")

c = collections.Counter(d["role"] for d in data)
print(f"\n用途分布:")
for k, v in c.most_common():
    print(f"  {k:<16}{v}")

# 3) JS 语法检查：把 <script> 内容交给 node --check
js = re.search(r"<script>(.*?)</script>", html, re.S).group(1)
tmp = r"D:\QuickLook插件包\moye\.tmp\player_check.js"
os.makedirs(os.path.dirname(tmp), exist_ok=True)
open(tmp, "w", encoding="utf-8").write(js)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
print(f"\nnode --check 内嵌 JS: rc={r.returncode}")
if r.returncode != 0:
    print("  STDERR:", r.stderr[:800])
else:
    print("  ✅ JS 语法通过")
