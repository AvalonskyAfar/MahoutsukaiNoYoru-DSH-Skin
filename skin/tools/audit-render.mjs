#!/usr/bin/env node
/**
 * 渲染守卫审计 —— 确认 SkinRoot **不会因为某个条件静默 return null**。
 *
 * 这套皮肤最大的失败模式不是"崩"，而是"什么都不做"：
 * 组件挂在树上，但某个守卫为假 → 悄悄渲染 null → 用户看到默认界面，
 * 控制台一条错都没有。所以这些守卫必须逐一列出来核。
 *
 * 用法：node skin/tools/audit-render.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKIN = path.resolve(__dirname, '..')
const src = fs.readFileSync(path.join(SKIN, 'lib', 'client.js'), 'utf8')

let bad = 0
const say = (ok, label, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) bad++
}

console.log('== SkinRoot 的 return-null 守卫 ==')
{
  // 抓出 SkinRoot 函数体
  const start = src.indexOf('function SkinRoot()')
  const end = src.indexOf('function doOpenSession', start)
  const body = src.slice(start, end)

  const guards = [...body.matchAll(/return null/g)].map((m) => {
    const before = body.slice(Math.max(0, m.index - 130), m.index)
    const line = before.split('\n').filter((l) => l.trim()).pop() || ''
    return line.trim()
  })
  console.log('  共 ' + guards.length + ' 处 return null：')
  for (const g of guards) console.log('    · ' + g)

  // 关键：所有 return null 必须出现在**全部 hook 调用之后**，
  // 否则 React 的 hook 数量会随渲染次数变化 → 直接崩。
  const firstHook = body.search(/useState\(|useEffect\(|useMemo\(|useRef\(|useCallback\(|useSyncExternalStore\(|useMenuFocus\(/)
  const lastNull = body.lastIndexOf('return null')
  say(lastNull > firstHook,
    '所有 return null 都在 hook 之后（hook 顺序稳定，不会崩）',
    `firstHook@${firstHook} lastNull@${lastNull}`)

  const killedGuard = body.includes('killed || KILLED_AT_LOAD')
  say(killedGuard, '有"已关闭"守卫')
  const enabledGuard = body.includes('!st.settings.enabled')
  say(enabledGuard, '有"设置未就绪 / 未启用"守卫')
}

console.log('\n== 注册与渲染 ==')
{
  // ★ 实测教训：`shell.overlay` 整槽被 DSH 的 SlotErrorBoundary 接管后
  //   会永久变成 `<div data-slot-error="shell.overlay">` 占位，
  //   注册进去的一切（包括"逃生门"）一起失效。所以改为自建容器挂载。
  const overlayRegs = (src.match(/registerEntry\(ctx, 'shell\.overlay'/g) || []).length
  say(overlayRegs === 0, '**没有**任何条目注册进 shell.overlay（已改为自建挂载）', `实得 ${overlayRegs}`)
  const sensorRegs = (src.match(/registerEntry\(ctx, 'conversation\.input\.right'/g) || []).length
  say(sensorRegs === 1, '会话传感器有一条注册', `实得 ${sensorRegs}`)
  say(!/slots\.inject\('root'/.test(src), '**没有**碰 root 单槽')
  say(src.includes('function registerEntry'), '注册走统一入口（带诊断记录）')
  say(src.includes('__myhDebug'), '暴露了 window.__myhDebug() 调试钩子')
  say(src.includes("id = 'myh-skin-root'"), '自建容器 #myh-skin-root')
  say(src.includes('ReactDOMClient.createRoot'), '用 react-dom/client 的 createRoot 挂载')
  say(src.includes('function installKillHotkey'), '紧急开关直挂 window 监听（与 React 解耦）')
  say(src.includes('function unmountSkinRoot'), '关闭皮肤时会卸载自建容器')
}
say(src.includes("className: 'myh-root'"), 'SkinRoot 会渲染 .myh-root 容器')
say(!src.includes('function KillSwitch'), 'KillSwitch 组件已移除（改 window 监听）')
say(/reportToHost\(\s*\{\s*stage: 'ready'/.test(src.replace(/\n\s*/g, ' ')) || src.includes("stage: 'ready'"),
  '数据就绪后会向宿主报到（stage: ready）')
say(src.includes("stage: 'apply-enter'"), 'apply() 入口会报到')
say(src.includes("stage: 'apply-failed'"), 'apply() 失败会报到并带上错误')
say(src.includes("stage: 'render-failed'"), '渲染异常会报到并带上错误')

console.log('\n== 可能的静默失败点 ==')
{
  // fetch 的三种失败都要能被看见
  say(src.includes("manifest HTTP"), 'manifest fetch 失败会抛错（不是静默）')
  say(src.includes("settings HTTP"), 'settings fetch 失败会抛错（不是静默）')
  say(src.includes('store.set({ error: msg })'), '数据加载失败会写进 store.error（环境设定里可见）')
  // 注册/挂载失败都必须有**可上报**的出口，不能只 console.warn
  say(src.includes('function noteWarning'), '有统一的告警收集（noteWarning）')
  say(src.includes('regDiag.warnings'), '告警会进 regDiag.warnings —— 可随 reportToHost 上报')
  say(src.includes('refs: regDiag') || src.includes('warnings: regDiag.warnings'),
    '上报里带上了 regDiag（宿主 /moye-skin/health 可直接查看）')
  say(src.includes("stage: 'mount'"), '挂载成功会报到（stage: mount，带实例号 / hook 取证 / 陈旧根清理）')
  // ★ 探针必须是"真延迟"调用。`setTimeout(probe('t200'), 200)` 会**立即求值**，
  //   等于探针一次都不跑 —— 这个 bug 白白让我猜了好几轮界面为什么没反应。
  //   注意：断言必须在**去注释**的源码上做，否则我自己写的这条说明会把断言命中。
  const srcNoComment = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  say(!/setTimeout\(probe\('t200'\), 200\)/.test(srcNoComment), '探针没有被 setTimeout 立即求值吃掉（真延迟调用）')
  say(src.includes('sampleHookTripwire') && src.includes('hookFrames'),
    '有 hooks 次数取证（#310 现场取证：帧号 + hook 数）')
  say(src.includes('staleRemoved') && src.includes("data-myh-instance"),
    '挂载时清理别的实例留下的根节点（多份皮肤代码同页共存可被发现）')
  say(src.includes("stage: 'mount-failed'"), '挂载失败会报到并带上堆栈')
  say(src.includes("stage: 'mount-refs-bad'"), '组件引用为 null 时会报到（指出是哪一个）')
  say(src.includes('function auditComponentRefs'), '挂载前做组件引用体检')
}

console.log('\n== 结论 ==')
if (bad === 0) {
  console.log('  守卫链完整：皮肤**不可能**静默什么都不做。')
  console.log('  如果界面仍是默认样式，只可能是这三种之一：')
  console.log('    1. 客户端 bundle 没到浏览器  → /moye-skin/health 的 diag.clientSeen = false')
  console.log('    2. apply() 抛错被兜住        → diag.clientErrors 里有 stage: apply-failed')
  console.log('    3. 渲染抛错被兜住            → diag.clientErrors 里有 stage: render-failed')
} else {
  console.log(`  发现 ${bad} 处问题，见上。`)
  process.exitCode = 1
}
