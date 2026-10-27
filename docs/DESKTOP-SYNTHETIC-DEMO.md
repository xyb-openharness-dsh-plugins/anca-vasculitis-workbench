# DSH Desktop 本机合成演示数据说明

> 用户明确授权：为 Desktop 生成两位典型虚拟角色与连续六个月演示数据。

## 当前 Desktop 数据（2026-10-27）

- 已安装包：`@xyb-community/anca-vasculitis-workbench@0.2.9`，profile `web`；需重启 DSH Desktop 才加载本版前端。
- 本机数据库：`~/Library/Application Support/dsh-desktop/harness/anca-vasculitis-workbench/anca-vasculitis.sqlite`。
- 内容：2 个合成示例档案（MPA/MPO-ANCA、GPA/PR3-ANCA），各 2026-05 至 2026-10 每月 7 项化验，共 84 条；另有 2 条合成说明 note。
- 页面在所有档案页顶部显示「合成示例资料」警示；姓名、亚型/血清型、每条 report_quote 都包含合成标记。
- 这些序列是虚构 UI 演示，不代表医学规律、治疗目标或任何个体建议；不得用于诊疗或患者比较。

## 安全与回滚

- 播种前确认 SQLite `profile` 行数为 0；先用 `node:sqlite backup()` 创建一致性快照，写入 sha256 文件。
- 空库首次进入修复为「建立档案 / 导入资料」引导；不会从启动程序自动播种。
- 独立脚本 `scripts/seed-synthetic-demo.mjs --db <sqlite>` 只允许空库运行；已有任意 profile 即拒绝。
- 回滚时不要直接覆盖正在使用的 SQLite DB：先正常退出 DSH Desktop，再保留当前 DB 备份，然后用
  `anca-vasculitis.sqlite.pre-synthetic-2026-10-27-final.sqlite` 恢复；该备份写入前核实为 0 profile。

## 验证记录

- 原库备份 SHA-256：`4ed8877bc214739c4ce269000c2b6ce694a4b47045abc48bf3d65b7d205e0b8e`。
- 写后：2 profile / 84 lab_reading / 2 note；两档各 42 条、6 个月。
- 装机包 0.2.9 bootstrap 读到 2 档/84 条；浏览器合成标识可见、趋势 2026.05–2026.10 可见、零 JS 错误。
