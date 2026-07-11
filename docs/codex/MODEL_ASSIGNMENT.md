# Codex 模型与推理分配

基线日期：2026-07-11。执行时应确认 Codex 当前可用模型。

## 模型定位

- **GPT-5.6 Sol**：复杂、开放、高价值、需要判断和质量的任务。
- **GPT-5.6 Terra**：日常开发、明确 CRUD、页面和常规测试。
- **GPT-5.6 Luna**：清晰、重复、批量、格式转换和低风险修改。

## 推理级别

- Light/Low：快速且边界清楚
- Medium：日常开发默认
- High：复杂多步骤、数据库、业务规则
- Extra High：权限、并发、幂等、迁移、安全
- Max：最困难的单一问题
- Ultra：可拆成多个独立子任务的大型审查或全链路工作

## 分配

| 工作 | 模型 | 推理 |
|---|---|---|
| 文档格式、命名、简单文案 | Luna | Light |
| 简单 UI 微调 | Terra | Light/Medium |
| 常规 CRUD 和页面 | Terra | Medium |
| 数据模型与迁移 | Sol | High |
| 情侣权限 | Sol | Extra High |
| 借贷事务 | Sol | High |
| 周期任务和幂等 | Sol | Extra High |
| 工资到账和余额计算 | Sol | High/Extra High |
| 安全审计 | Sol | Extra High |
| 全项目最终验收 | Sol | Ultra |
| 单一极难生产 Bug | Sol | Max |

## 默认建议

```toml
model = "gpt-5.6-sol"
model_reasoning_effort = "medium"
plan_mode_reasoning_effort = "high"
```

对边界明确的日常任务可切换 Terra。Luna 不用于权限、数据库迁移和财务计算核心逻辑。

## Ultra 子代理建议

- 产品规则和完成度
- 后端权限和安全
- 数据库和迁移
- Worker 幂等
- 前端交互和主题
- 测试和发布

由主线程汇总、去重并按严重度排序。

## 官方参考

- https://developers.openai.com/codex/models
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/config-sample
- https://developers.openai.com/codex/concepts/customization
