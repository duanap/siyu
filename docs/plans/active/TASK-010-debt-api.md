# TASK-010：借贷数据和 API

## 状态

阻塞（实现完成；数据库迁移与隔离 E2E 等待 Docker/PostgreSQL/Redis 环境）

## 模型与推理

- 推荐模型：Sol
- 推理：High
- 是否使用子代理：否

## 目标

- 实现本人私有借贷的列表、创建、详情、更新、软删除 API。
- 实现多次部分还款/收款、结清、逾期天数、处理幂等和可选普通账目联动。
- 固化借贷汇总、来源账目、权限、事务、审计和数据库约束。

## 非目标

- 不实现 TASK-011 借贷页面和统计卡片。
- 不实现借贷提醒 Worker、通知、导出或管理后台。
- 不实现 TASK-012/015/019；仅记录负责人已批准的周期恢复、短月发薪和目标归属规则。

## 相关规则

- BR-DEBT-001 至 BR-DEBT-010、BR-ENTRY-010
- AC-DEBT-001 至 AC-DEBT-009、AC-ENTRY-012
- ADR-003、ADR-004、ADR-010、ADR-011、ADR-018、ADR-020

## 允许修改

- `apps/api/src/debts/`、`apps/api/src/app.module.ts`
- Prisma Schema、增量 migration、数据库约束测试和 API E2E
- OpenAPI、生成共享类型、借贷相关产品/架构文档与项目记忆

## 禁止修改

- 不修改认证、情侣账本、分类和普通 Entry 的公开行为。
- 不增加未批准路径、生产依赖或前端页面。
- 不删除或解绑借贷已同步生成的普通账目。

## 当前状态与依赖

- TASK-007 已提供只读来源账目边界、来源唯一键、个人账本与默认分类。
- Debt/DebtTransaction 基础模型已存在，但没有业务模块、创建请求哈希、借贷创建幂等和完整来源一致性触发器。
- 负责人于 2026-07-16 批准 `1A 2A 3A 4A`；TASK-010 的 KI-006 阻塞已解除。
- 当前源码快照没有 `.git`，无法取得未提交 diff 或形成分支/提交/远端 CI 证据。

## 风险

- 并发处理可能重复扣减或超过剩余金额；使用事务级锁、数据库唯一键和条件更新兜底。
- 同步账目可能与处理记录部分成功；两者必须在同一数据库事务内创建。
- 借贷为本人私有，查询必须包含 `userId`，不可通过情侣账本或可猜测 ID 读取。
- 来源账目依赖个人账本的启用“其他收入/其他支出”系统分类；不可用时明确拒绝同步。
- 历史占位数据无法还原原请求载荷；迁移使用 `legacy:` 命名空间，不伪装可重放。

## 实施步骤

- [x] 预检
- [x] 设计或数据契约
- [x] 实现
- [x] 单元测试
- [ ] 集成/E2E
- [x] 文档和项目记忆
- [ ] 最终审查

## 数据迁移与回滚

- 新增 Debt 创建幂等键/请求哈希和 DebtTransaction 请求哈希。
- 增加文本、状态、幂等和借贷来源账目一致性约束；不重写历史财务金额。
- 迁移进入共享环境后不回滚；问题通过新的向前迁移修复。应用版本回滚不得删除新列或来源账目。

## 验证命令

```bash
pnpm prisma:validate
pnpm prisma:migrate:test
pnpm openapi:lint
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm verify
```

## 进度日志

- 2026-07-16：读取项目记忆、产品规则、API/数据库/权限/安全契约和现有 Entry 实现；确认源码快照无 `.git`。
- 2026-07-16：负责人选择 `1A 2A 3A 4A`；冻结来源借贷删除、周期恢复、短月发薪和目标归属规则。
- 2026-07-16：完成 Debts 分层 API、第六迁移、OpenAPI/共享类型、数据库约束脚本、单元测试与黑盒 E2E 用例。
- 2026-07-16：加入原生运行回归后全仓 61 项测试、lint、typecheck、Prisma validate、OpenAPI lint/74 覆盖、Compose 静态检查和 build 通过。
- 2026-07-16：本机无 Docker/PostgreSQL/Redis；`pnpm test:e2e` 在 Redis `ECONNREFUSED` 停止，迁移回放和数据库黑盒验收待环境恢复。
- 2026-07-16：新增不依赖 Docker 的原生运行模式，可连接本机或云 PostgreSQL/Redis，并直接启动 API、Worker、Vite 或生产静态网关；当前机器仍未安装数据库服务。

## 完成结果

借贷实现和非数据库质量门已完成。由于当前机器没有 Docker CLI、PostgreSQL、Redis 或 psql，尚未执行第六迁移
回放、数据库约束及隔离 E2E；在这些门通过前 TASK-010 不标记完成。当前源码快照无 `.git`，也无法形成提交、
远端 CI 或 `git diff --check` 证据。
