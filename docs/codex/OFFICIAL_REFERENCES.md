# Codex 官方参考

基线日期：2026-07-11

- AGENTS.md：`https://developers.openai.com/codex/guides/agents-md`
- 自定义与分层指令：`https://developers.openai.com/codex/concepts/customization`
- 模型选择：`https://developers.openai.com/codex/models`
- 配置示例：`https://developers.openai.com/codex/config-sample`
- Codex CLI：`https://developers.openai.com/codex/cli`
- Subagents：`https://developers.openai.com/codex/concepts/subagents`

本仓库采用的原则：

- 根目录 `AGENTS.md` 保持短小，详细知识放入 `docs/`。
- 子目录通过自己的 `AGENTS.md` 增加局部约束。
- 默认使用中等推理；复杂任务提高到 High/Extra High。
- Ultra 仅用于能被拆成独立子任务的大型审查。
