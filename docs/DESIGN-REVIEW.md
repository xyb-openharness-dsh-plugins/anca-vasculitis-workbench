# 设计独立审查记录

状态：M2 原型独立评审已完成（2026-10-26）；P0=0，12 项 P1 全部修复并复测。自测（check/test/探针/浏览器走查）与独立代理审查分开执行，证据见下表与 `docs/PROTOTYPE-REVIEW.md`。

| 轮次 | 阶段/文档版本或hash | 实际模型/推理档位/审查Agent | 时间与输入范围 | 发现及优先级 | 建议/讨论项 | 用户决定与修改证据 | 未解决项 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | M2 原型 v0.2.0（prototypes/v0.2/ 7 文件）；合同=INTERACTION-DESIGN（G1 签认 v1）+ DEV-REQUIREMENTS T1–T7 + SPEC §四/五/九 + 30/34/35 号 | GLM 独立评审代理（独立上下文，与实现者隔离） | 2026-10-26；输入=原型全部源码 + 5 份合同文档 | **P0=0**；P1×12（private 未折叠、toast 无回看板 CTA、trend 跨轨混画、急症卡过详、状态短语无出处、8 处手工入口缺失、同日重复无提示、35 号缺通道/终态与收藏、对比度、CTA 可达性、翻面语义嵌套）；P2×10 | 5 项建议 G2 走查前必修（P1-1/2/3/6/7）；P2-4 更正入口建议 M5 一并做；P2-7 VERSION 同步留 M5 | 评审建议全部采纳（P2-4/5/7/9 除外，理由见 DESIGN-REVIEW.md §二）；12 项 P1 修复后 Chrome 无头复测全 PASS | P2-9 主体切换位置（侧栏 vs 合同"顶部"）留 G2 走查判定 |

R1 修复证据（详见 [DESIGN-REVIEW.md 详版](DESIGN-REVIEW.md) 同文件上表与本仓提交记录）：
- `prototypes/v0.2/app.js`：toast CTA button 化、trend 锁滴度轨、8 处「⋯ 更多」恢复、private 折叠、急症卡通用化、35 号通道/终态+收藏、同日重复与缺日期拦截、候选指标白名单映射、菜单点击收起。
- `prototypes/v0.2/style.css`：对比度三处加深、toast-cta 样式。
- `prototypes/v0.2/demo-data.js`：档案二状态短语改为原文口径。
- 复测：`npm run check` 全绿、`npm test` 8/8、probe-router（含 --self-test 必 FAIL 校验）、浏览器 32 页 + 场景流 + 四档窄宽全 PASS。

评审重点：用户任务证据、专业视角偏差、场景取舍、完整闭环、AI解释价值、分期、来源时效和主体/隐私。记录高优先级问题，而非只给"通过"。

本表只审设计方案，不代表发布已授权、包已安装、Desktop已加载或市场已收录。发布决策与证据分别记录在 `docs/RELEASE.md`、`docs/ACCEPTANCE.md`；市场流程见 `docs/10-MARKET-PUBLISHING.md`。
