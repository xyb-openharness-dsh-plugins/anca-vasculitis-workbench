/**
 * 包的入口：DSH 插件的服务端侧。宿主加载的就是这个文件，需要
 * name / inject / Config / apply 四样（workbench-standard §3.4）。
 *
 * 这一层只做五件事：
 * 1. 打开数据：配了 root（cordis.patch.yml 已注入 config.root）就用那个资料目录下的
 *    anca-vasculitis.sqlite（SQLite 主力）；没配就退到内存库（演示，不落盘）；
 *    node:sqlite 不可用或开库失败时，dsh/store.js 自动回退 JSON 文件存储并如实上报模式；
 * 2. 过宿主鉴权（connection.requestRejection），不自己造登录；
 * 3. 把请求交给 dsh/routes.js 那张两条链路共用的路由表
 *    （/health、/bootstrap、/records/:kind 全族、/saved-trials）；
 * 4. 兼容保留初始化骨架的旧健康路径（/api/anca-vasculitis-workbench/health）一个发布周期；
 * 5. 卸载时按序关库。
 */
import Schema from '@deepseek-ai/schemastery'
import { readFileSync } from 'node:fs'
import { createStore } from './store.js'
import { createApiHandler, API_PREFIX } from './routes.js'
import { version, build } from '../lib/version.js'

export const name = 'anca-vasculitis-workbench-main'
export const inject = ['webServer', 'connection']

export { API_PREFIX }

/** Config 必须是 Schemastery schema；root 可选——不给就用内存库（演示，不落盘）。 */
export const Config = Schema.object({
  root: Schema.string(),
})

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': buf.length, 'cache-control': 'no-store' })
  res.end(buf)
}

export function apply(ctx, config = {}) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable')

  let source = null
  let failure = null
  try {
    const path = config.root
      ? `${config.root.replace(/\/+$/, '')}/anca-vasculitis.sqlite`
      : ':memory:'
    source = createStore({ path, id: manifest.name })
  } catch (error) {
    failure = error.message
  }

  const api = createApiHandler({ source, version, build, failure })

  const handler = (req, res) => {
    /* 鉴权：宿主不给结论就不放行，不自建登录态。 */
    if (typeof ctx.connection?.requestRejection !== 'function') {
      return sendJson(res, 503, { error: 'connection authentication capability unavailable' })
    }
    const rejection = ctx.connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { error: 'Authentication required' })
    return api(req, res)
  }

  ctx.effect(() => {
    const disposers = []
    const d = ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler })
    disposers.push(() => { try { d && d() } catch { /* 卸载清理失败不盖住原错误 */ } })
    /* 旧健康路径兼容（骨架期路径），一个发布周期后移除 */
    const legacy = ctx.webServer.register({
      kind: 'exact', path: '/api/anca-vasculitis-workbench/health',
      handler: (req, res) => handler({ url: `${API_PREFIX}/health`, method: req.method, headers: req.headers, on: req.on.bind(req) }, res),
    })
    disposers.push(() => { try { legacy && legacy() } catch { /* 同上 */ } })
    return () => {
      disposers.forEach((fn) => fn())
      if (source) { try { source.close() } catch { /* 同上 */ } }
    }
  }, 'anca-vasculitis-workbench api + legacy health')
}
