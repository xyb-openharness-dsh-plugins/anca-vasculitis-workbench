# 实施任务与当前交接

规格版本：SPEC M1 定稿（2026-10-26，G1 已签认）· 原型 hash：未产生（M2）· 当前分支 `main` · 包版本 `0.1.0`

> 当前阶段：**M2 原型完成（v0.2.0），待 G2 签认**。判据与进度以 [DEV-PLAN](DEV-PLAN.md) 为准；本表只列实施任务。

| ID | 业务单元 | 前置依赖 | 拥有文件/模块 | 实现/检查要求 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | 接入基线 | BRIEF/SPEC + G1 | package/patch/entry | 实际包可被目标宿主加载（V2） | 待填 | 未开始（M5/M6） |
| T02 | 数据/API | T01 + G3 冻结 | store/migrations/api | 旧库兼容与读写闭环；无判读列 | 待填 | 未开始（M5） |
| T03 | 共享 UI | 原型冻结（G2）/API 合同 | components / public | 翻面/图表/弹窗/三态 | 待填 | 未开始（M2/M5） |
| T04 | 完整 Tab | T02/T03 | 按页面分配（10 线） | 输入→操作→结果→回顾 | 待填 | 未开始（M5） |
| T05 | 跨页/安装验收 | T04 | 集成/发布记录 | 官方自测、实际包/版本 | 待填 | 未开始（M6） |
| T06 | 发布与市场（按授权） | T05 | docs/RELEASE.md、发行仓库 | GitHub tag/Release；市场投稿**不适用** | 待填 | 未开始/不适用（M7） |
| T07 | 原生 Agent 面板 | T01 + Desktop 合同 + UI 状态稿 | 全局入口、面板状态、布局偏好 | 按 ACC-28–31 实现拉起/隐藏/调宽/窄窗/会话复用；不仿制聊天 UI | 待填 | 未开始（M5/M6） |

## 当前失败 / 复现

- `npm run audit`：22/30，6 项 fail（`lib/version.js`、`lib/layout.js` + `customFrame`、检查链缺单测/文案红线）。均为 M5/发布期脚手架，不阻塞 M1；`docs/DEV-PLAN.md` 已于 2026-10-26 补齐。
- `npm run check`：✅ 通过；`npm test`：4/4 ✅。

## 未验证项

- Desktop 真加载（V2）、实机核心业务（V3）未执行。
- NMPA 批准文件、2021 AAGN 指南卷期页码、2018 EGPA 共识页码未取得（见 `research-notes/medical-constraints.md` §五）。
- 用户线 0 访谈；S01 滴度焦虑、S04 激素副作用、生育/心理为证据缺口。

## 下一步具体动作 / 命令

1. 用户做 **G2 签认**：预览 `prototypes/v0.2/index.html`（file:// 可开），对照 [PROTOTYPE-REVIEW](PROTOTYPE-REVIEW.md) 版本 + SHA-256 确认范围；确认后填入签认列。
2. 签认后进 M3：schema/0001 冻结（sha256 + 判读列断言）→ G3。
3. 命令：`npm run check`（含 probe-router 路由覆盖）、`npm test`（8 用例含 path-walk X1/X4）、`python3 scripts/probe-router.py --self-test`（必须 FAIL）、浏览器走查 `docs/PROTOTYPE-REVIEW.md` 预览方式。

## 用户已确认的偏好与授权

- **G1 签认**：2026-10-26，DESIGN-01–11 全部确认（原话留痕见 DESIGN-SESSION §二）。
- **G4 新增**：2026-10-26，手工 + AI 数据维护更新检查与通过（M5 出口执行）。
- 服务主体：患者 + 家属双主体（DEV-REQUIREMENTS §五默认值）。
- 病程：全病程（确诊起）。
- MinerU：启用。
- 品牌占位：小脉宝 VasPal。
- 布局：business-first。
- 发布：GitHub tag/Release 可以；市场/awesome 目录投稿**不需要**（2026-10-25 用户确认）。
