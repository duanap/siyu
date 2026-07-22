# TASK-021：站内通知

## 状态

进行中

## 模型与推理

- 推荐模型：Terra
- 推理：Medium
- 是否使用子代理：否

## 目标

- 实现本人站内通知的稳定分页、未读总数和批量已读 API。
- 实现 `/notifications` 手机端消息中心、账号入口、未读状态与全部已读操作。
- 复用 TASK-013 已生成的周期待确认通知事实，保持接收人私有、防枚举和重复操作幂等。

## 非目标

- 不新增情侣、借贷、工资、攒钱或系统公告等通知生产链路。
- 不实现邮件、短信、Push、通知偏好、定时提醒、后台公告或人工任务重试。
- 不修改 Notification 数据模型、数据库迁移、周期 Worker 或其他业务模块。
- 不新增生产依赖，不实现 CSV 导出和最小管理后台。

## 相关规则

- BR-NOTIFY-001 至 006、BR-RECUR-017。
- AC-NOTIFY-001 至 004、AC-THEME-001 至 002、AC-QUALITY-001。
- ADR-003、ADR-013、ADR-026、ADR-030。

## 允许修改

- `apps/api` 内通知 Controller、DTO、Service、Repository、Module 和测试。
- `apps/mobile-web` 内通知客户端、组件、页面、路由、账号入口、样式和测试。
- 通知相关产品、API、权限、安全、设计、质量和项目记忆文档。
- OpenAPI、共享生成类型、`MANIFEST.md` 与 `VALIDATION_REPORT.md`。

## 禁止修改

- Prisma Schema、既有迁移和 TASK-013 通知生成逻辑。
- 情侣、借贷、周期、工资、攒钱、普通账目和统计业务行为。
- 管理后台、导出、生产凭据、品牌命名和生产依赖。

## 当前状态与依赖

- 基线：`main@8a7e86a27ef8bd386623b541ef38d2fc62ee7c8d`；TASK-020 closeout 最终 main CI Run
  `29938775856` 的 `quality`、`database`、`secret-scan` 全部通过。
- `notifications` 已有 `userId/type/title/content/relatedType/relatedId/readAt/createdAt`，并有
  `(userId, readAt, createdAt)` 查询索引。
- TASK-013 已在周期领域事务中生成 `RECURRING_CONFIRMATION_DUE + RECURRING_RUN + runId`，并由条件
  唯一索引保证每个接收人每个实例最多一条。
- OpenAPI 已预留 `GET /notifications` 与 `POST /notifications/read`，但列表仍使用通用响应且缺少精确分页、
  未读计数、关联字段和已读结果契约；API 与移动页面尚未实现。

## 冻结口径

- 列表只查询当前认证用户的通知，按 `createdAt DESC, id DESC` 稳定分页；响应返回 `items/page/pageSize/total/hasNext/unreadCount`。
- `Notification` 返回 `relatedType/relatedId/readAt`；关联事实仅用于展示和导航提示，不替代目标业务接口授权。
- 已读接口每次接受 1 至 100 个唯一 UUID；只更新当前用户且 `readAt IS NULL` 的记录，未知、他人或已读 ID
  均不泄露存在性，重复提交幂等。
- `readAt` 使用服务端 UTC 时间，首次写入后不覆盖；返回本次新标记数和事务完成后的本人未读总数。
- 手机端完整读取本人通知分页；“全部已读”只提交本人未读 ID，并按 100 条分批，提交中禁止重复点击。
- 当前仅为 `RECURRING_CONFIRMATION_DUE` 提供周期列表入口；未知类型安全回退为通用通知展示。

## 风险

- 按 ID 批量更新若不同时限定 `userId` 会产生越权；Repository 必须在单条更新条件中固定当前用户。
- 返回外部 ID 命中情况会形成枚举侧信道；接口只返回实际新标记数与本人剩余未读数，不区分未知/他人/已读。
- 全部已读超过 100 条需要客户端分批；任一批失败时重新拉取服务端事实，不能假设本地全部成功。
- 分页期间可能产生新通知；响应未读数是每次请求时的快照，刷新后以服务端最新值为准。
- 关联周期资源可能因退出、删除或状态变化不可访问；通知页面不绕过周期 API 权限，也不承诺关联入口必然可用。

## 实施步骤

- [x] 强制预检、同步 `main`、建立任务分支
- [x] 建立 ExecPlan 并冻结分页、未读、已读幂等和隐私边界
- [x] 补充业务规则、验收条件、ADR 和精确 OpenAPI/共享类型
- [x] 实现通知 API 模块与定向单元测试
- [x] 扩充真实 PostgreSQL E2E 的通知私有性、分页和已读覆盖
- [x] 实现通知客户端、`NotificationItem`、消息中心页面、路由和账号入口
- [x] 完成移动端交互测试及 320px、375px、480px 日夜与异常态浏览器验收
- [x] 更新架构、设计、质量、项目记忆、清单与验证报告
- [ ] 运行全仓质量门、提交、PR、CI、合并、main CI 与正式关闭

## 数据迁移与回滚

- 本任务不修改数据库 Schema 或迁移；使用既有通知表和查询索引。
- 回滚应用代码时保留 TASK-013 已生成的通知和既有条件唯一索引，不删除通知事实。
- API/页面回滚只移除读取与已读入口，不影响周期实例、账目或 Worker 幂等。

## 验证命令

```bash
pnpm --filter @siyu/api test
pnpm --filter @siyu/mobile-web test
pnpm --filter @siyu/api prisma:validate
pnpm prisma:migrate:test
pnpm verify
pnpm test:e2e
pnpm build
pnpm docs:check
pnpm manifest:check
pnpm audit --audit-level moderate
git diff --check
```

## 进度日志

- 2026-07-22：TASK-020 feature 与 closeout PR 均已合入，最终
  `main@8a7e86a27ef8bd386623b541ef38d2fc62ee7c8d` 的 CI Run `29938775856` 全绿；创建
  `task/TASK-021-notifications`。
- 2026-07-22：完成根/API/移动端指令、通知产品规则、现有 OpenAPI/数据库、权限、安全、TASK-013 生成事实、
  18 号低保真设计和质量策略预检；确认无数据库迁移和新通知生产类型。
- 2026-07-22：完成通知 API、精确 OpenAPI/共享类型、本人隔离与防枚举 E2E、消息中心页面、账号入口及 7 项
  移动端测试；Chrome Headless/CDP 11 个三尺寸、双主题和异常态场景全部通过。
- 2026-07-22：Node.js 24.18.0 标准 `pnpm verify`、164 项测试、11 迁移与数据库约束、隔离
  PostgreSQL/Redis 完整 API/Worker E2E、生产构建、OpenAPI 74/74、文档、清单和依赖审计通过；等待远程交付。

## 决策记录

- ADR-030 冻结通知按接收人私有、首次已读时间不可覆盖、未知/他人 ID 防枚举和客户端分批全部已读。

## 完成结果

站内通知已完成本地交付候选；待提交、PR、远程 CI、合并和 main CI 后正式关闭，再进入 TASK-022。
