#!/usr/bin/env node
/**
 * 离线预览用的极简静态服务器。
 * ------------------------------------------------------------------
 * `preview/index.html` 用 `fetch('../data/manifest.json')` 读清单，
 * 而 `fetch` 在 `file://` 下会被浏览器拒绝，所以必须走 HTTP。
 *
 * 只服务 skin/ 目录，只监听回环地址，只允许 GET/HEAD。
 *
 * 用法：
 *   node skin/tools/preview-server.mjs            # 默认 8123
 *   node skin/tools/preview-server.mjs 9000       # 指定端口
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.argv[2] || 8123)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    return res.end('method not allowed')
  }
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    res.writeHead(400); return res.end('bad path')
  }
  if (pathname === '/') pathname = '/preview/index.html'

  const abs = path.resolve(ROOT, '.' + pathname)
  if (!abs.startsWith(path.resolve(ROOT) + path.sep)) {
    res.writeHead(403); return res.end('forbidden')
  }
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found') }
    res.writeHead(200, {
      'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'content-length': String(st.size),
      'cache-control': 'no-store',
    })
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(abs).pipe(res)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('魔法使之夜皮肤 · 离线预览')
  console.log('  http://127.0.0.1:' + PORT + '/preview/index.html')
  console.log('  服务根目录：' + ROOT)
  console.log('  Ctrl+C 停止')
})
