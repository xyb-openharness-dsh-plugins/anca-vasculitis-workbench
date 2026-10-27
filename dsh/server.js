/**
 * HTTP 层（M5）：public/ 静态文件服务。
 *
 * 三件事这里说了算：
 * 1. 静态文件只在 public/ 目录内解析；`..` 一律拦掉（路径穿越）；
 * 2. 未知路径回落到 index.html（单页应用刷新不 404），但只在 public/index.html 存在时；
 * 3. 不缓存 HTML（改版本后必须立刻生效），静态资源短缓存。
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function sendFile(res, file, { cache }) {
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type, 'cache-control': cache })
  createReadStream(file).pipe(res)
}

/**
 * @param {object} req
 * @param {object} res
 * @param {string} urlPath 已去掉 API_PREFIX 的路径（如 '/ui/index.html' → '/index.html'）
 */
export function servePublic(req, res, urlPath) {
  let rel = decodeURIComponent(String(urlPath || '/').split('?')[0])
  if (rel === '/' || rel === '') rel = '/index.html'
  const file = join(PUBLIC_DIR, normalize(rel).replace(/^([/\\])+/, ''))
  /* 路径穿越：规范化后必须仍在 PUBLIC_DIR 内 */
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('forbidden')
    return
  }
  if (existsSync(file) && statSync(file).isFile()) {
    const isHtml = extname(file).toLowerCase() === '.html'
    return sendFile(res, file, { cache: isHtml ? 'no-store' : 'public, max-age=300' })
  }
  /* SPA 回落：无扩展名的路径一律回 index.html（刷新二级页不 404） */
  if (!extname(rel) && existsSync(join(PUBLIC_DIR, 'index.html'))) {
    return sendFile(res, join(PUBLIC_DIR, 'index.html'), { cache: 'no-store' })
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found')
}

export { PUBLIC_DIR }
