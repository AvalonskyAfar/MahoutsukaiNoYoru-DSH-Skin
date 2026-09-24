"""全对全相似度（用已有的 50ms RMS 包络，Python 快速版）

目的：找出"互为版本/同一旋律家族"的曲目，帮助判定四项选曲。
用降采样包络 + 有限滞后搜索，避开 node 版全扫描太慢的问题。
"""
import json, os, itertools

BGM = r"D:\QuickLook插件包\moye\bgm"
A = json.load(open(os.path.join(BGM, "bgm_analysis.json"), encoding="utf-8"))

names = sorted(A)
envs = {}
for n in names:
    e = A[n]["env"]
    # 降采样到 ~400 点，并归一化（去均值/除标准差）
    m = 400
    if len(e) >= m:
        step = len(e) / m
        r = [e[min(int(i * step), len(e) - 1)] for i in range(m)]
    else:
        r = list(e) + [e[-1]] * (m - len(e))
    mu = sum(r) / len(r)
    sd = (sum((x - mu) ** 2 for x in r) / len(r)) ** 0.5 or 1.0
    envs[n] = [(x - mu) / sd for x in r]


def corr(a, b, lag):
    """b 相对 a 滞后 lag（正= b 靠后）"""
    if lag >= 0:
        x, y = a[lag:], b[:len(b) - lag]
    else:
        x, y = a[:len(a) + lag], b[-lag:]
    n = min(len(x), len(y))
    if n < 40:
        return -2
    x, y = x[:n], y[:n]
    return sum(x[i] * y[i] for i in range(n)) / n


def best_corr(a, b, maxlag=120):
    return max(corr(a, b, l) for l in range(-maxlag, maxlag + 1))


print("=== 全对全最佳包络相关（前 40 对，>0.55 才算有戏）===")
pairs = []
for i, j in itertools.combinations(range(len(names)), 2):
    a, b = names[i], names[j]
    c = best_corr(envs[a], envs[b])
    pairs.append((c, a, b))
pairs.sort(reverse=True)

for c, a, b in pairs[:40]:
    da, db = A[a]["duration"], A[b]["duration"]
    tag = ""
    if c > 0.90:
        tag = "  ★★★ 几乎确定是同曲的不同版本"
    elif c > 0.75:
        tag = "  ★★ 高度相似"
    elif c > 0.60:
        tag = "  ★ 可能相关"
    print(f"  {c:+.4f}  {a:<8}({da:6.1f}s)  {b:<8}({db:6.1f}s){tag}")

print("\n\n=== 每首曲子的「最像对象」===")
for n in names:
    others = [(best_corr(envs[n], envs[o]), o) for o in names if o != n]
    others.sort(reverse=True)
    c, o = others[0]
    if c > 0.60:
        print(f"  {n:<8} 最像 {o:<8} ({c:+.3f})")
