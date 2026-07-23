# 任务清单

| 编号 | 任务 | 阶段 | 模型 | 推理 | 前置 |
|---|---|---|---|---|---|
| TASK-000 | 项目接管、工程初始化、工具链和 CI | M1 | Sol | High | 无 |
| TASK-001 | 已吸收进 TASK-000（不再单独执行） | M1 | — | — | TASK-000 |
| TASK-002 | 已吸收进 TASK-000（设计 Token、主题和基础组件基线已验收） | M1 | — | — | TASK-000 |
| TASK-003 | 已吸收进 TASK-000（PostgreSQL/Prisma 模型、迁移和约束基线已验收） | M1 | — | — | TASK-000 |
| TASK-004 | 邮箱密码与 QQ 认证、用户和个人账本初始化 | M2 | Sol | High | TASK-000 |
| TASK-005 | 情侣账本邀请和权限 | M2 | Sol | Extra High | TASK-004 |
| TASK-006 | 分类模块（已合并并正式关闭） | M3 | Terra | Medium | TASK-003 |
| TASK-007 | 普通账目 API（已合并并正式关闭） | M3 | Sol | High | TASK-005,TASK-006 |
| TASK-008 | 记账页面与明细列表（已合并并正式关闭） | M3 | Terra | Medium | TASK-002,TASK-007 |
| TASK-009 | 首页与基础统计（已合并并正式关闭） | M3 | Terra | Medium | TASK-007,TASK-008 |
| TASK-010 | 借贷数据和 API（已合并、CI 通过并正式关闭） | M4 | Sol | High | TASK-007 |
| TASK-011 | 借贷页面和统计（已合并、CI 通过并正式关闭） | M4 | Terra | Medium | TASK-010 |
| TASK-012 | 周期规则和实例（已合并、CI 通过并正式关闭） | M5 | Sol | Extra High | TASK-007 |
| TASK-013 | BullMQ Worker 与幂等（已合并、CI 通过并正式关闭） | M5 | Sol | Extra High | TASK-012 |
| TASK-014 | 周期记账页面（已合并、CI 通过并正式关闭） | M5 | Terra | Medium | TASK-012 |
| TASK-015 | 工资档案和月度记录（已合并、CI 通过并正式关闭） | M6 | Sol | High | TASK-007 |
| TASK-016 | 工资到账与收入联动（已合并、CI 通过并正式关闭） | M6 | Sol | Extra High | TASK-015 |
| TASK-017 | 工资余额和年度统计（已合并、CI 通过并正式关闭） | M6 | Sol | High | TASK-016 |
| TASK-018 | 工资页面（已合并、CI 通过并正式关闭） | M6 | Terra | Medium | TASK-015,TASK-017 |
| TASK-019 | 攒钱目标 API（已合并、CI 通过并正式关闭） | M7 | Sol | High | TASK-005 |
| TASK-020 | 攒钱目标页面（已合并、CI 通过并正式关闭） | M7 | Terra | Medium | TASK-019 |
| TASK-021 | 站内通知（已合并、CI 通过并正式关闭） | M8 | Terra | Medium | TASK-005,TASK-013 |
| TASK-022 | 最小管理后台（已合并、CI 通过并正式关闭） | M8 | Terra | Medium | TASK-021 |
| TASK-023 | CSV 导出（本地交付候选，待 PR/CI 正式关闭） | M8 | Terra | Medium | TASK-007,TASK-017 |
| TASK-024 | 权限与安全审计 | M8 | Sol | Extra High | TASK-005,TASK-016,TASK-019 |
| TASK-025 | 全链路 E2E 和发布验收 | M8 | Sol | Ultra | TASK-022,TASK-024 |

模型与推理是建议值，执行前按 Codex 当前可用模型确认。
