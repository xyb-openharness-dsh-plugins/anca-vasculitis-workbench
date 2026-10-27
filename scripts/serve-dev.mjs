#!/usr/bin/env node
/**
 * 开发服务器（M5）：把 dsh/routes.js 那张表挂到本机 HTTP 上，浏览器直接开 /api/anca-vasculitis/ui/。
 *
 * 为什么需要它：装机前的真机走查（V2/V3）之前，必须先在浏览器里把「公开 API + public/ 前端」
 * 这条链路跑通。它和 DSH 宿主走同一份 handler（不另写一套），差别只有两点：
 * 1. 没有宿主鉴权（本机回环访问）；2. 不是 prefix 注册而是普通 http.Server 路由。
 *
 * 用法：
 *   node scripts/serve-dev.mjs [--port 5173] [--db /tmp/anca-dev.sqlite] [--seed]
 *   --seed  首次启动灌入演示档案（库里已有 profile 则跳过，不会重复播）
 */
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../dsh/store.js'
import { createApiHandler, API_PREFIX } from '../dsh/routes.js'
import { servePublic } from '../dsh/server.js'
import { seedDemo, hasDemoData } from '../dsh/demo.js'
import { version, build } from '../lib/version.js'

const args = process.argv.slice(2)
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const port = Number(argOf('--port', 5173))
const dbPath = argOf('--db', join(mkdtempSync(join(tmpdir(), 'anca-dev-')), 'dev.sqlite'))
const doSeed = args.includes('--seed')

const store = createStore({ path: dbPath })
store.migrate()
if (doSeed && !hasDemoData(store)) {
  const n = seedDemo(store)
  console.log(`✔ 已播入演示档案（${n} 条事实记录）`)
} else if (hasDemoData(store)) {
  console.log('· 库里已有档案，跳过播种')
}

const api = createApiHandler({
  source: store, version, build,
  serveUi: (req, res, urlPath) => servePublic(req, res, urlPath),
})

const server = createServer((req, res) => {
  const path = (req.url || '/').split('?')[0]
  if (path === '/' ) { res.writeHead(302, { location: `${API_PREFIX}/ui/` }).end(); return }
  if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) return api(req, res)
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: 'Not found', hint: `UI 在 ${API_PREFIX}/ui/` }))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`\n小脉宝 VasPal 开发服务器 v${version}（${build}）`)
  console.log(`  库文件：${dbPath}（${store.mode}）`)
  console.log(`  UI    ：http://127.0.0.1:${port}${API_PREFIX}/ui/`)
  console.log(`  健康  ：http://127.0.0.1:${port}${API_PREFIX}/health`)
  console.log(`  契约  ：http://127.0.0.1:${port}${API_PREFIX}/bootstrap\n`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { try { store.close() } catch { /* 幂等 */ } server.close(() => process.exit(0)) })
}
