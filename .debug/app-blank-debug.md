# DSH Desktop 空白页调试记录

## 元信息
- 模块：DSH 客户端 iframe 入口 / 前端启动
- 创建/更新：2026-10-27（现已包含最终修复与演示数据说明）
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

## 2026-10-27 · 空库白屏 + 授权合成演示档案
- 现象：用户反馈「无数据，无内容」。
- 根因：此前空库会让 pageDashboard 访问空档案的 serologyText 抛异常；此外 Desktop 运行中的进程早于新包安装，仍缓存旧状态。
- 用户新增授权：可虚拟 2 位典型类型角色，6 个月连续数据。Desktop 活动库写入前 profile=0；使用 SQLite 在线备份；原空库快照 sha256 `4ed8877b…e0b8e`。
- 写入内容：2 合成 profile（MPA/MPO 与 GPA/PR3）+ 各 42 化验（2026-05 至 10）+ 2 合成说明 notes。script 有空库硬栅栏；当前页面全局显示合成示例警示；无自动播种。
- 修复：空库首次引导；records/profile 新建档案流程；APP_INFO 版本构建注入；empty-bootstrap.test.mjs。
- 当前已安装 0.2.9；profile web bundles 登记；数据库 2 profile / 84 labs / 2 notes；装机副本 bootstrap 读数与 UI 页面冒烟通过。
- 验证：check 全绿；tests 63/63；audit 37/37；浏览器无 JS 错误。
- Desktop 主进程启动时间仍早于 0.2.9 安装；需要用户重启 Desktop 加载新前端，未自动杀进程。

## 待完成
- 用户重启 DSH Desktop 后实机确认 UI iframe、两档合成数据与 AI 会话入口；若仍异常，采集重启后的 renderer/harness 错误与请求 URL。
- 合成演示数据说明与回滚步骤见 `docs/DESKTOP-SYNTHETIC-DEMO.md`。
