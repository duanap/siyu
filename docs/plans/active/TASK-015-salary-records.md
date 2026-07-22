# TASK-015：工资档案和月度记录

## 状态

本地交付候选；待提交、PR、远程 CI、合并与正式关闭

## 模型与推理

- 推荐模型：Sol
- 推理：High
- 是否使用子代理：否

## 目标

- 实现本人私有的工资档案列表、创建和更新；MVP 同一用户最多一个有效档案。
- 档案保存可复用的默认工资项目模板，项目覆盖已批准收入与扣除类型。
- 实现月度工资记录列表、创建、详情和未到账更新；服务端从项目精确计算应发、扣除与实发。
- 支持按显式项目创建，或原子复制同档案紧邻上月的项目；同档案、同月份保持唯一。
- 固化跨用户防枚举、事务替换、金额边界、业务日期和已到账记录不可修改。

## 非目标

- 不实现工资到账、普通收入联动和到账审计；属于 TASK-016。
- 不实现工资余额、固定/日常支出聚合和年度统计；属于 TASK-017。
- 不实现工资手机页面；属于 TASK-018。
- 不实现工资提醒、CSV 导出、后台详情或生产凭据。

## 相关规则与验收条件

- BR-MONEY-001 至 003、BR-DATE-001 至 002、BR-SALARY-001 至 004、BR-SALARY-008、BR-SALARY-012。
- 新增 BR-SALARY-013 至 018、AC-SALARY-012 至 017。
- ADR-002、ADR-003、ADR-004、ADR-010、ADR-018、ADR-022，以及新增 ADR-027。

## 允许修改

- `apps/api/src/salary`、API 模块注册与对应单元/E2E。
- Prisma Schema、新的 create-only 迁移、数据库约束脚本和架构镜像 Schema。
- 工资相关产品规则、验收、API/OpenAPI、数据库、权限、质量与项目记忆文档。
- 共享 OpenAPI 生成类型和 `MANIFEST.md`。

## 禁止修改

- 移动端、管理端、现有 Entry/借贷/周期业务行为与既有迁移。
- 工资到账、收入账目生成、余额/年度统计和后台任务。
- 生产依赖、生产凭据和未批准的工资业务范围。

## 当前状态与依赖

- 基线：`main@752d4370d5289be8a3533be5ee78096f289206ce`。
- 初始迁移已有 SalaryProfile、SalaryRecord、SalaryItem 骨架和基础金额/月份/归属约束，但没有业务模块。
- 现有 OpenAPI 预留 10 个工资操作；TASK-015 只实现其中前 7 个的档案与记录部分，到账和统计继续返回未实现。
- 现有模型缺少档案模板、创建幂等事实、文本边界与月度项目汇总一致性保护，需要向前迁移补齐。

## 决策记录

- MVP 同一用户最多一个未删除且 ACTIVE 的工资档案；保留 status 字段和一对多关系，未来可经新决策开放多档案。
- 档案默认模板使用独立 SalaryProfileItem 行，不存 JSON；模板金额允许零，月度 SalaryItem 只保存正数项目。
- 月度创建必须二选一：提交非空项目，或 `copyPreviousMonth=true`；复制严格读取紧邻上一个自然月的有效记录，
  不跨月寻找更早记录，也不把后续模板修改回写历史。
- 工资记录应发等于 EARNING 合计，扣除等于 DEDUCTION 合计，扣除不得大于应发；所有汇总由服务端计算。
- 工资档案创建和月度记录创建均保存规范载荷 SHA-256 幂等事实；相同键同载荷重放，不同载荷冲突。
- 为 TASK-017 冻结固定支出为工资周期内个人账本 `EXPENSE + RECURRING_RUN` 的有效普通账目；其余有效个人
  支出归日常支出。该口径本任务只记录，不实现统计。

## 风险

- 仅按记录 ID 查询会泄露另一用户工资事实，Repository 必须始终包含 userId。
- 替换月度项目若不在事务内，会出现明细与汇总短暂或永久不一致。
- 客户端提交汇总字段会允许篡改，DTO 不接收 gross/deduction/net。
- 复制“最近一条”会跨缺失月份产生意外模板，本任务严格限定紧邻上月。
- 已到账记录更新会破坏 TASK-016 的来源账目一致性，因此本任务先锁定为不可修改。

## 实施步骤

- [x] 强制预检、同步 `main`、建立任务分支
- [x] 创建 ExecPlan 并冻结隐私、模板、复制、幂等和汇总口径
- [x] 补充编号业务规则、验收条件和 ADR-027
- [x] 扩展 Prisma 模型并新增向前迁移、约束和迁移验证
- [x] 实现 Salary DTO、Repository、Service、Controller、Module
- [x] 补齐具体 OpenAPI 请求/响应/错误和共享类型
- [x] 单元、数据库约束、并发与完整 API E2E
- [x] 全仓质量门、文档与项目记忆
- [ ] 提交、PR、CI、合并、main CI 与正式关闭

## 数据迁移与回滚

- 新增 SalaryProfileItem、工资档案/记录创建请求哈希和幂等键、必要唯一索引、CHECK、触发器与查询索引。
- 迁移只向前创建或增加可空列；既有空业务表不需要数据回填。若已有外部数据，迁移前检查异常文本、状态和汇总。
- 生产回滚不删除迁移或工资数据；应用回滚到旧版本时新增表/列保持兼容，后续用向前修复迁移处理。

## 验证命令

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm prisma:migrate:test
pnpm openapi:lint
pnpm openapi:generate
pnpm test:e2e
pnpm build
pnpm docs:check
pnpm manifest:check
pnpm audit --audit-level moderate
git diff --check
```

## 进度日志

- 2026-07-22：确认 TASK-014 功能/closeout PR 与最终 main CI 全部通过，从 `main@752d437` 创建
  `task/TASK-015-salary-records`。
- 2026-07-22：完成产品、规则、权限、API/OpenAPI、Prisma/初始迁移、质量和现有约束预检；确认本任务需要
  SalaryModule、向前迁移和具体契约，不进入到账、统计或页面范围。
- 2026-07-22：新增第九迁移和工资档案模板；工资档案、月度记录、相邻月份复制、服务端汇总、幂等、本人
  隔离和已到账不可修改均已实现。
- 2026-07-22：九迁移空库部署、status/零 diff、26 模型 introspection、43 个关键索引、62 个自定义约束、
  14 个删除策略和数据库约束脚本通过；隔离 PostgreSQL 完整黑盒 E2E 通过。宿主 Redis 6.0.16 仅产生
  BullMQ 最低版本提示，Compose/CI 基线继续使用 Redis 7.4。
- 2026-07-22：Node.js 24.18.0 全仓 `pnpm verify`、123 项测试、真实 PostgreSQL E2E、生产构建、文档、
  清单、差异检查和依赖审计通过；九迁移完整回放复验通过。

## 完成结果

本地实现与完整质量门已完成；提交、PR、远程 CI、合并和 main CI 尚待执行，因此 TASK-015 尚未正式关闭。
