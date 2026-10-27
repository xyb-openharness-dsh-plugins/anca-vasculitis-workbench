# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.2.0 — 2026-10-26

- 数据层写入面（用户指令「编辑↔schema↔AI 写入」）：
  - `schema/0001_initial.sql` 14 表初始迁移（G3 冻结候选，sha256 见 `schema/freeze-contract.md`）；
  - `dsh/write-schema.js`：12 种 kind → 表 → 列的写入契约面（列名与 schema 逐列一致）；
  - `dsh/store.js`：SQLite 主力（node:sqlite）+ JSON 文件存储回退（同一接口、同一更正链），
    capabilities 如实上报存储模式；
  - `dsh/routes.js` + `dsh/index.js`：`POST/GET /api/anca-vasculitis/records/:kind` 全族、
    `/records/:kind/:id/correct` 更正链、`POST/GET/DELETE /saved-trials`（35 号收藏/取消零副作用）、
    `GET /bootstrap`（capabilities = AI 经同一写接口入库的契约面）、`GET /health`（旧健康路径兼容保留）；
  - 新检查器 `scripts/check-write-schema.mjs`（写映射列名必须存在于冻结 schema + deny 列断言）
    与 `scripts/check-wording.mjs`（文案红线静态层），接入 `npm run check`；单测并入 check 链。
- 0.1.0 — 2026-10-25：由社区脚手架 dsh-wb-cli@1.5.8 (c811e4f) 初始化，仅有注册骨架与健康接口，无业务功能。
