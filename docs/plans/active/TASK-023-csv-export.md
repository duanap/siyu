# TASK-023：CSV 导出

## 状态

本地交付候选

## 目标

- 交付当前用户可访问账本的账目 CSV 和本人工资 CSV。
- 在手机端提供可发现的导出入口、范围选择、下载中和失败状态。
- 保证权限、金额精度、CSV 注入防护、同步响应上限、限流和审计闭环。

## 非目标

- 不实现异步导出队列、导出任务表、对象存储或邮件通知。
- 不导出借贷、攒钱、通知、审计、凭据、Token 或其他成员的私有工资。
- 不新增生产依赖，不改变 Entry、Salary 或数据库 Schema。

## 相关规则与验收

- BR-ENTRY-005、BR-EXPORT-001 至 006、BR-AUDIT-001。
- AC-ENTRY-005、AC-EXPORT-001 至 004、AC-QUALITY-001。
- ADR-018、ADR-027 至 029、ADR-032。

## 冻结口径

- 账目导出必须指定账本；起止日期要么同时缺省为用户时区当前自然年，要么同时提供且闭区间不超过 366 天。
- 账目只包含当前用户仍是有效成员的有效账本和未软删除 Entry，按业务日期、创建时间、ID 稳定正序。
- 工资导出只按当前用户 `userId` 查询未删除记录；年份缺省为用户时区当前年，每个工资项目一行。
- CSV 使用 UTF-8 BOM、CRLF、标准双引号转义；金额从整数分精确输出两位元字符串。
- 用户可控文本去除 CSV 公式执行风险；每次成功导出只审计类型、范围和行数，不记录财务内容。
- 每种导出最多 10000 个数据行，超限返回 413 且不返回截断文件；每用户每 10 分钟最多 10 次导出。

## 依赖与风险

- 情侣账本导出必须复用当前成员关系和账本状态，不能只按 `ledgerId` 裸查。
- 工资档案和项目名属于本人敏感数据，查询必须固定 `userId`，审计不得包含名称或金额。
- CSV 双引号并不能阻止表格公式执行，必须在编码前识别去除前导空白后的 `= + - @`。
- 同步导出必须硬性限制日期跨度和数据行数，避免大响应占用 API 内存。

## 实施步骤

- [x] 强制预检、建立分支与 ExecPlan
- [x] 冻结导出规则、验收、ADR、API 和安全契约
- [x] 实现 Export API、权限查询、CSV 编码、限流和审计
- [x] 实现手机端导出页、范围选择和下载交互
- [x] 补齐单元、组件和真实数据库 E2E
- [x] 完成全仓质量门、文档、项目记忆和清单
- [ ] 提交、PR、CI、合并、main CI 与正式关闭

## 数据迁移与回滚

- 本任务无数据库 Schema 或迁移变化。
- 回滚只需移除 ExportModule、手机端路由和契约扩展；既有 Entry、Salary 与审计表不变。

## 验证命令

```bash
pnpm --filter @siyu/api test
pnpm --filter @siyu/mobile-web test
pnpm --filter @siyu/api prisma:validate
pnpm verify
pnpm test:e2e
pnpm build
pnpm docs:check
pnpm manifest:check
pnpm audit --audit-level moderate
git diff --check
```

## 进度日志

- 2026-07-23：从已正式关闭的 TASK-022 基线创建 `task/TASK-023-csv-export`，完成产品、权限、安全、API、设计和质量预检。
- 2026-07-23：完成同步 CSV API、移动端下载、单元/组件测试和完整 PostgreSQL/Redis E2E；真实 Chrome
  覆盖三种宽度、双主题、网络错误和实际文件下载，未发现横向溢出、小点击区或运行时错误。
- 2026-07-23：Node.js 24.18.0 全仓 `pnpm verify` 与 172 项测试通过；format、lint、typecheck、Prisma、
  OpenAPI 81/81、Compose、完整 E2E、生产构建、文档、清单和差异检查通过，依赖审计无已知漏洞。

## 决策记录

- ADR-032：MVP 使用有范围和行数硬上限的同步 CSV，不启用尚未批准的异步导出数据模型。

## 完成结果

功能与全仓本地验收完成；待提交、PR、远程 CI、合并和 main CI 后正式关闭。
