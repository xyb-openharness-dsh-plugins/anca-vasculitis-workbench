# DSH Desktop 空白页调试记录

## 元信息
- 模块：DSH 客户端 iframe 入口 / 前端启动
- 创建/更新：2026-10-27
- 相关文件：`src/client.js`、`scripts/build-client.mjs`、`dsh/routes.js`、`lib/client.js`
- 运行环境：macOS 本机，DSH Desktop Harness（活动 profile `profiles/web`）
- 验证方式：本地 `npm run check` / `npm test`；装机副本 `check-install.mjs` + 静态文件/API 冒烟；用户重启后 Desktop 实机确认

## 上下文关系
- `dsh/routes.js` 唯一导出 `API_PREFIX` 与 `UI_PREFIX`。
- `scripts/build-client.mjs` 将 `UI_PREFIX` 注入 `src/client.js` 的 `__UI_ENTRY__`，生成 `lib/client.js`。
- `lib/client.js` 的 `UI_ENTRY` 用作 customFrame iframe `src`。
- iframe 请求 `/api/anca-vasculitis/ui/`，由 `dsh/index.js` prefix handler → `routes.js` → `servePublic()` → `public/index.html`。
- `public/index.html` 加载 `public/app.js`；`app.js` 再请求 `/bootstrap` 并渲染。

## 2026-10-27 · 已安装包页面空白
- 现象：用户反馈 DSH Desktop 中工作台未显示。
- 根因：`scripts/build-client.mjs` 从 `dsh/routes.js` import `{ API_PREFIX, UI_PREFIX }`，但 `routes.js` 只 export `API_PREFIX`。ESM 未导出绑定得到 `undefined`；字符串替换把 `__UI_ENTRY__/` 变成 `,/`。所以 iframe `src=,/`，UI 与 `app.js` 没有机会加载。
- 修复：`routes.js` 增 `export const UI_PREFIX = `${API_PREFIX}/ui``；`build-client.mjs` 增强构建期断言（UI_PREFIX 必须以 `${API_PREFIX}/ui` 开头）；`npm run check` 加 `build-client --check`；新增 `test/client-entry.test.mjs` 3 项回归测试。
- 升版：0.2.6，重新 build-client/build-public。
- Checkfix：`npm run check` 通过；`npm test` 60/60；`npm run audit` 37/37。
- 安装：待重新打包并安装；Desktop 当前运行中，本轮不自动杀进程/重启。

## 待完成
- 0.2.6 tgz 装进 Desktop profile `web`，`check-install.mjs` 通过。
- 用户重启 DSH Desktop 后实机确认 UI iframe、bootstrap、AI 会话入口；若还空白，采集重启后的 renderer/harness 错误与请求 URL。
