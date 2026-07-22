# TASK-013：BullMQ Worker 与幂等

## 状态

进行中

## 模型与推理

- 推荐模型：Sol
- 推理：Extra High
- 是否使用子代理：否

## 目标

- 按规则创建人时区扫描已到期的有效周期规则，并通过 BullMQ 投递每个计划账期的稳定任务。
- Worker 复用 `RecurringService` 的事务领域入口物化周期实例、自动账目和确认模式通知。
- 用稳定 Job ID、数据库唯一约束和领域锁保证重复扫描、重试及多 Worker 并发不重复实例、账目或通知。
- 区分可重试基础设施失败与不可重试业务状态，提供指数退避、失败留存和不含敏感财务明细的结构化日志。
- 保持 Docker Compose 与原生 Node 的同一 Worker 入口、配置和优雅关闭行为。

## 非目标

- 不新增或修改公开 REST API，不实现周期记账手机页面。
- 不实现通知列表/已读 API、管理后台任务页面或人工重试入口；分别属于 TASK-021、TASK-022。
- 不实现借贷、工资、导出等其他后台任务。
- 不改变周期日期、期数、权限和来源账目规则。

## 相关规则与验收条件

- BR-DATE-001 至 002、BR-ENTRY-004、BR-RECUR-001 至 016、BR-NOTIFY-001、BR-AUDIT-001。
- AC-RECUR-002 至 009、AC-RECUR-014、AC-QUALITY-001。
- ADR-001、ADR-004、ADR-005、ADR-010、ADR-021、ADR-025。

## 允许修改

- `apps/api/src/worker.ts`、周期模块内部服务/仓储及对应测试。
- 周期待确认通知所需的 Prisma 模型镜像和 create-only 增量迁移。
- Worker 环境样例、Compose/原生运行配置检查和相关测试。
- 后台任务、数据库、部署、质量文档、项目记忆和 `MANIFEST.md`。

## 禁止修改

- 已发布迁移和公开 OpenAPI 操作。
- TASK-014 手机端页面、TASK-021 通知 API、TASK-022 管理后台。
- 工资、攒钱、导出和生产凭据。

## 当前状态与依赖

- 基线：`main@1aa6ac2cab745a0454ab574bcb02bdc684e8afdf`。
- TASK-012 已提供带事务、advisory lock、失败实例和来源唯一键的 `materializeDueRule` 领域入口。
- 当前 Worker 只消费空的 bootstrap 队列和密码重置邮件队列，没有 Nest 应用上下文、周期扫描或周期消费者。
- `notifications` 已有归属和关联字段，但没有防止周期实例重复通知的数据库唯一约束。

## 关键设计

- 队列固定为 `siyu-recurring-due`，包含 `scan` 与 `materialize` 两类任务；Job Scheduler 使用固定调度器 ID。
- 物化任务 Job ID 由版本、规则 ID 和 `scheduledDate` 构成且不使用 BullMQ 禁止的冒号，重复扫描只得到同一任务。
- 扫描先按 UTC 日期加一天收窄候选，再按创建人当前 IANA 时区计算业务日期；游标分页避免全表载入。
- 物化任务携带预期计划日；领域入口在锁内复核该日期仍是当前 `nextRunDate` 且在创建人当前时区已到期，过期任务安全跳过。
- Worker 每次只物化一个计划日；下一轮扫描为仍积压的规则生成下一个稳定任务，停机恢复不会跳过历史到期账期。
- BullMQ 对未知基础设施错误指数退避；已停用分类、失效归属等业务状态使用不可恢复错误停止无效重试，失败事实仍由领域服务记录。
- `PENDING` 实例在同一数据库事务中向当前具备管理权限的活跃成员创建待确认通知；部分唯一索引保证每个接收人每个实例最多一条。
- 结构化日志只记录事件、任务/规则/实例 ID、耗时、计数和安全错误码，不记录金额、规则名称、令牌或数据库错误正文。

## 风险

- 只按服务器日期扫描会在 UTC 边界漏掉东十二区至东十四区用户。
- 延迟任务若不校验计划日，可能在规则恢复或修改后错误执行新的账期。
- 删除成功任务后若稳定 ID 立即复用，重复扫描可能再次运行；数据库唯一约束和当前计划日复核必须作为最终幂等边界。
- 将未知数据库错误原文写入日志或用户可见 `lastError` 可能泄露内部信息。
- Worker 关闭顺序不当可能中断在途任务或先断开领域数据库连接。

## 实施步骤

- [x] 预检、同步 `main`、建立任务分支
- [x] 建立 ExecPlan 并冻结 Worker/通知幂等边界
- [x] Worker 配置、稳定任务契约、扫描分页与计划日复核
- [x] BullMQ Scheduler/消费者、退避分类、可观测日志与优雅关闭
- [x] 待确认通知事务和数据库唯一约束
- [x] 单元、真实 Redis/PostgreSQL Worker E2E 和并发/时区验证
- [x] 全仓质量门、文档、项目记忆和最终审查
- [ ] 提交、PR、远程 CI、合并和 main CI

## 数据迁移与回滚

- 新增 create-only 增量迁移，为周期待确认通知增加条件唯一索引；不修改既有迁移。
- 迁移前检查并清理不了历史数据；当前尚无通知写入实现，若发现重复历史记录则迁移必须明确失败并人工处理。
- 应用回滚时保留唯一索引和通知记录；不得删除已生成周期实例、账目或通知。

## 验证命令

```bash
pnpm --filter @siyu/api test
pnpm prisma:validate
pnpm prisma:migrate:test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm compose:check
pnpm native:check:config
pnpm openapi:lint
pnpm openapi:generate
pnpm docs:check
pnpm manifest:check
git diff --check
```

另使用真实 Redis 7.4 与 PostgreSQL 17 验证重复扫描、多 Worker 并发、稳定 Job ID、指数退避、不可重试
业务失败、UTC 日期边界、积压账期、确认通知唯一、Worker 重启和优雅关闭。

## 进度日志

- 2026-07-22：从 `main@1aa6ac2` 创建 `task/TASK-013-recurring-worker`，完成规则、架构、质量、运行时与现有实现预检。
- 2026-07-22：确认公开 API 不变；确定稳定计划日任务、执行时二次复核和通知条件唯一索引方案。
- 2026-07-22：完成按时区游标扫描、Scheduler/启动扫描、稳定 Job ID、多 Worker 消费、指数退避、业务最终
  失败、安全日志和优雅关闭。
- 2026-07-22：完成第八迁移；确认模式通知当前规则创建人与情侣账本 OWNER，同接收人/实例数据库唯一。
- 2026-07-22：Node 24 下 113 项全仓测试、八迁移/约束、隔离 PostgreSQL 17 + Redis 7.4 Worker E2E、
  OpenAPI 74/74、Compose、原生配置、生产构建和依赖审计通过。
- 2026-07-22：审查发现并修复 GitHub quality 缺少 PostgreSQL 导致 E2E 保护性跳过的既有缺口；PR CI 将先
  部署八迁移再运行完整 API/Worker E2E。

## 决策记录

- ADR-026 已固化上述通知接收人以及稳定账期 Job ID、消费时计划日复核边界。
- Worker 负责编排，所有周期财务写入继续由 `RecurringService` 完成。

## 完成结果

本地交付候选完成：周期 Worker 已具备按时区扫描、稳定任务、指数退避、多 Worker 并发幂等、待确认通知、
脱敏可观测日志和优雅关闭；公开 API 不变。八迁移/约束、真实 Worker E2E 与全仓质量门均通过。

待提交、PR、远程 CI、合并和 main CI 后正式关闭。
