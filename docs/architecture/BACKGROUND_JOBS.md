# 后台任务

技术：Redis + BullMQ
原则：API 与 Worker 共用领域服务；任务必须幂等、可重试、可观测。

## 队列

### siyu-password-reset

- API 在创建密码重置摘要后投递邮件任务，Job ID 使用重置记录 ID 防止重复投递。
- Worker 最多重试三次且不得记录邮件中的一次性令牌。
- 测试环境使用隔离传输适配器；未配置生产邮件提供方时明确失败为 `MAIL_PROVIDER_UNCONFIGURED`。

- `siyu-recurring-due`
- `debt-reminder`
- `salary-reminder`
- `notification-delivery`
- `export-generation`

## 周期记账任务

1. 按用户时区扫描 `next_run_date <= today` 的有效规则。
2. 用 `(rule_id, scheduled_date)` 创建唯一实例。
3. 已存在实例则视为幂等成功。
4. AUTO 模式调用统一账目服务创建来源账目。
5. CONFIRM 模式创建待确认通知。
6. 原子更新完成期数和下一执行日期。
7. 达到结束条件则完成规则。
8. 记录 attempts、last_error 和时间。

TASK-012 提供步骤 2、4、6、7 的同一事务领域入口：计划日按规则开始日期锚定，首次成功物化实例时才推进
完成期数；`CONFIRM` 实例进入 `PENDING`，`AUTO` 实例与来源账目同时提交。失败实例不推进规则，保存错误后
由 TASK-013 Worker 重试。TASK-013 负责按时区扫描、BullMQ Job、退避、通知和可观测编排，不复制领域写入。

TASK-013 的队列同时承载 `scan` 和 `materialize`：Job Scheduler 默认每 60 秒触发扫描，Worker 启动时额外投递
按分钟去重的启动扫描。扫描使用 UUID 游标分页，先以 UTC 日期加一天收窄候选，再按规则创建人当前 IANA 时区
判断业务日。物化 Job ID 固定为 `recurring-v1-<rule-id>-<YYYYMMDD>`；消费时在规则 advisory lock 内复核
`scheduledDate` 仍等于当前 `next_run_date`，因此旧任务安全跳过。停机积压由后续扫描逐期推进，不跳过到期账期。

临时基础设施错误默认最多 5 次指数退避；分类停用、创建人失效和非法任务等业务状态使用不可恢复失败，避免
无效重试。`CONFIRM` 实例在同一领域事务中通知当前规则创建人和情侣账本 OWNER，数据库条件唯一索引防止重试
重复通知。日志只记录安全事件码、任务/规则 ID、计划日、计数和耗时，不记录金额、规则名称或底层错误正文。

可调环境变量：`SIYU_RECURRING_SCAN_INTERVAL_MS`、`SIYU_RECURRING_SCAN_BATCH_SIZE`、
`SIYU_RECURRING_WORKER_CONCURRENCY`、`SIYU_RECURRING_JOB_ATTEMPTS`、
`SIYU_RECURRING_BACKOFF_DELAY_MS`；默认分别为 60000、200、8、5、1000。

## 借贷提醒

- 到期前 N 天
- 到期当天
- 逾期状态扫描
- 同一用户、借贷和提醒日期去重

## 工资提醒

- 发薪日前提示录入或确认
- 到账后不再发送未到账提醒
- 工资数据仅用于本人通知

## 重试

- 网络或临时数据库错误：指数退避
- 业务冲突和验证错误：不重试
- 达到最大次数：FAILED + 后台可见 + 运维通知
- 手工重试写审计日志

业务状态失败直接进入最终失败；人工重试入口和对应审计由 TASK-022 管理后台实现。

## 监控

- 等待、运行、失败和延迟任务数
- 最老等待任务时间
- 每日周期实例生成数量
- 重复冲突数量
- 重试和最终失败数量
