# TASK-017：工资余额与年度统计

## 状态

本地交付候选

## 模型与推理

- 推荐模型：Sol
- 推理：High
- 是否使用子代理：否

## 目标

- 实现本人私有的 `GET /salary/summary/:year`，按工资月份返回年度累计、月均实发和完整 12 个月趋势。
- 实现本人私有的 `GET /salary/balance`，以最近一次已到账工资为起点计算当前工资周期余额。
- 工资余额只聚合本人个人账本中的有效支出，并按周期来源与其他来源拆分固定支出和日常支出。
- 固化用户时区、短月份、跨年、无到账记录、周期过期、负余额和零剩余天数边界。

## 非目标

- 不实现工资移动端页面；属于 TASK-018。
- 不修改工资档案、月度记录或到账写入行为，不新增取消到账或统计缓存。
- 不把情侣账本支出、情侣成员工资、个人借贷或攒钱目标纳入工资余额。
- 不实现 CSV 导出、管理后台、通知或官方社保/医保/公积金账户余额查询。

## 相关规则与验收条件

- BR-MONEY-001 至 003、BR-DATE-001 至 002、BR-SALARY-008 至 012、BR-SALARY-018。
- AC-SALARY-007 至 011，以及本任务补充的年度分组、当前周期、空结果和私有性验收条件。
- ADR-002、ADR-003、ADR-007、ADR-019、ADR-022、ADR-027，以及本任务新增的统计口径决策。

## 允许修改

- `apps/api/src/salary` 及工资相关单元/E2E 测试。
- 工资相关产品规则、验收、API/OpenAPI、权限、安全、质量和项目记忆文档。
- 共享 OpenAPI 生成类型与 `MANIFEST.md`。

## 禁止修改

- 移动端、管理端、基础 StatisticsModule、工资写接口、Worker 和既有迁移。
- 情侣账本统计口径、非工资 Entry 行为、生产依赖、生产凭据和未批准业务范围。

## 当前状态与依赖

- 基线：`main@00f02b92f6d38a8ad00c409ed325e71142bfae29`。
- TASK-015 已提供本人私有工资档案、月度记录、服务端汇总和稳定项目代码；TASK-016 已提供不可变到账日期。
- OpenAPI 已预留年度汇总与工资余额两个操作，但仍使用未细化 `StatisticsOk`，API 尚未实现。
- Entry 已有个人账本、业务日期、来源类型和软删除条件；现有索引覆盖账本与业务日期查询，无需新增持久化事实。

## 决策记录

- 年度汇总按 `salaryMonth` 归年，包含本人所有未软删除工资记录，不以到账状态过滤；返回完整 12 个月零值趋势。
- 年度月均实发以存在工资记录的月份数为分母，空年度为 0；所有金额仍使用整数分并在返回前检查安全整数范围。
- 奖金、养老、医疗、失业、公积金和个税按稳定项目代码 `bonus`、`pension_insurance`、
  `medical_insurance`、`unemployment_insurance`、`housing_provident_fund`、`income_tax` 聚合；其他项目仍计入
  应发、扣除和实发总额，但不冒充这些专项累计。
- 工资余额选择到账日不晚于用户时区今天的最近一条已到账记录；没有符合记录时返回明确的不可用空态而非 404。
- 下一预计发薪日取到账日所在月份的下一个自然月，并按当前档案 `payDay` 计算；目标月缺少该日时取月末。
  统计周期为到账日（含）至下一预计发薪日（不含）。
- 余额只统计本人有效个人账本内、周期业务日期范围内、未软删除的 `EXPENSE` Entry；`RECURRING_RUN` 为固定
  支出，其他来源为日常支出。剩余金额允许为负；剩余天数为用户时区今天到下一发薪日的非负日期差，零天时
  `dailyAvailableCent=null`，避免除零和伪造可用金额。

## 风险

- 服务器 UTC 日期不能替代用户本地日期；必须基于用户时区生成今天的业务日期。
- 只按最近工资月份而非到账日选择记录会在补录、延迟到账或未来到账日下选错周期。
- 余额查询若只按用户创建人过滤，可能误含情侣账本；必须先锁定本人有效 PERSONAL 账本。
- 年度专项若按显示名称匹配会受改名和语言影响，必须按稳定项目代码聚合。
- BigInt 转 Number、负余额除法和零剩余天数可能产生溢出或错误舍入，需要显式保护和测试。

## 实施步骤

- [x] 强制预检、同步 `main`、建立任务分支
- [x] 创建 ExecPlan 并冻结年度与工资周期统计口径
- [x] 补充编号业务规则、验收条件和架构决策
- [x] 实现 DTO、Repository、Service 与 Controller
- [x] 将两个 OpenAPI 操作细化为具体响应并生成共享类型
- [x] 补齐单元测试和完整 API E2E
- [x] 全仓质量门、文档、项目记忆和清单
- [ ] 提交、PR、CI、合并、main CI 与正式关闭

## 数据迁移与回滚

- 本任务只读聚合既有 `salary_records`、`salary_items`、`ledgers` 和 `entries`，不新增表、列、索引或持久化汇总。
- 回滚只需回滚应用与契约提交；既有工资和账目数据不变，无数据迁移或清理步骤。
- 仍执行十次迁移完整回放与数据库约束脚本，确保聚合实现未破坏既有约束。

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

- 2026-07-22：TASK-016 功能与关闭 PR 均已合并，最终 main CI Run `29913756362` 全部通过；从
  `main@00f02b92f6d38a8ad00c409ed325e71142bfae29` 创建 `task/TASK-017-salary-statistics`。
- 2026-07-22：完成产品、规则、API/OpenAPI、数据库、权限、安全、质量、工资与基础统计实现预检；确认本任务
  只读聚合既有事实，不新增迁移、不进入工资页面或情侣账本统计范围。
- 2026-07-22：新增 BR-SALARY-021 至 023、AC-SALARY-020 至 022 和 ADR-029；实现年度 12 月汇总、专项
  代码累计、最近到账工资周期、PERSONAL 账本固定/日常支出拆分和无工资空态，并细化两个 OpenAPI 响应。
- 2026-07-22：Node.js 24.18.0 下工资单元 11 项、API 单元 40 项、移动端 72 项和全仓 130 项测试通过；
  十迁移部署与隔离 PostgreSQL 完整 API/Worker E2E 通过。本机 Redis 6.0.16 仅有最低 6.2 非阻断提示，
  Compose/CI 基线仍为 Redis 7.4。
- 2026-07-22：format、lint、typecheck、Prisma validate/migrate test、OpenAPI 74/74、Compose、生产构建、
  依赖审计和差异检查通过；最终 E2E 首次因隔离 PostgreSQL 未运行在注册阶段失败，恢复容器并部署十次迁移后
  无代码改动即完整通过，确认不是实现回归。

## 完成结果

TASK-017 已完成本地交付候选与全部质量门；待提交、PR、远程 CI、合并和 main CI，尚未正式关闭。
