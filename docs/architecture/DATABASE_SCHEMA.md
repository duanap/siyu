# 数据库设计

数据库：PostgreSQL
ORM：Prisma
金额：`BIGINT`，单位为分
主键：UUID
系统时间：`TIMESTAMPTZ`
业务日期：`DATE`
删除：`deleted_at` 软删除

## 核心表

### users

`id, qq_open_id, nickname, avatar_url, timezone, status, created_at, updated_at, deleted_at`

### ledgers

`id, type, name, owner_user_id, status, created_at, updated_at, deleted_at`

- `type`：PERSONAL / COUPLE
- 每位用户仅一个有效个人账本。
- 情侣人数通过后端事务和成员约束保证。

### ledger_members

`id, ledger_id, user_id, role, status, joined_at, left_at`

- 唯一：`ledger_id + user_id`
- `role`：OWNER / MEMBER

### ledger_invitations

`id, ledger_id, inviter_user_id, token_hash, status, expires_at, accepted_by_user_id, accepted_at`

- `token_hash` 唯一
- 不明文保存邀请码凭证

### categories

`id, owner_user_id, type, name, icon, sort_order, is_system, is_enabled`

### entries

`id, ledger_id, creator_user_id, type, amount_cent, category_id, business_date, note, payment_method, source_type, source_id, idempotency_key, created_at, updated_at, deleted_at`

索引：

- `(ledger_id, business_date)`
- `(ledger_id, type, business_date)`
- `(ledger_id, category_id, business_date)`
- `(ledger_id, creator_user_id, business_date)`

唯一：

- `creator_user_id + idempotency_key`
- 来源业务非空时 `source_type + source_id`（PostgreSQL 部分唯一索引）

### debts

`id, user_id, direction, counterparty_name, principal_cent, processed_cent, remaining_cent, start_date, due_date, status, note, reminder_enabled, created_at, updated_at, deleted_at`

### debt_transactions

`id, debt_id, user_id, amount_cent, business_date, sync_entry, entry_id, idempotency_key, note, created_at, deleted_at`

### recurring_rules

`id, owner_user_id, ledger_id, name, entry_type, amount_cent, category_id, frequency, interval_value, start_date, end_date, total_occurrences, completed_occurrences, next_run_date, generation_mode, status, reminder_days_before, created_at, updated_at, deleted_at`

### recurring_runs

`id, rule_id, scheduled_date, amount_cent, status, entry_id, attempts, last_error, confirmed_at, created_at, updated_at`

- 唯一：`rule_id + scheduled_date`

### salary_profiles

`id, user_id, name, employer_name, pay_day, default_sync_entry, status, created_at, updated_at, deleted_at`

### salary_records

`id, user_id, profile_id, salary_month, gross_cent, deduction_cent, net_cent, payment_status, paid_date, entry_id, created_at, updated_at, deleted_at`

- 有效记录唯一：未软删除时 `profile_id + salary_month`（PostgreSQL 部分唯一索引）

### salary_items

`id, salary_record_id, item_type, item_code, item_name, amount_cent, sort_order`

### saving_goals

`id, ledger_id, creator_user_id, name, target_cent, initial_cent, saved_cent, target_date, status, cover_url, note, created_at, updated_at, deleted_at`

### saving_contributions

`id, goal_id, user_id, amount_cent, business_date, note, idempotency_key, created_at, updated_at, deleted_at`

### notifications

`id, user_id, type, title, content, related_type, related_id, read_at, created_at`

### audit_logs

`id, actor_user_id, actor_type, action, target_type, target_id, request_id, before_json, after_json, ip_hash, created_at`

## 事务边界

必须使用事务：

- 首次用户和个人账本初始化
- 接受情侣邀请
- 借贷处理及可选生成账目
- 周期实例与自动账目
- 工资到账与收入账目
- 存入记录与目标汇总
- 删除来源业务与关联账目策略

## PostgreSQL 特殊约束

Prisma 不能直接表达的约束由 SQL migration 补充：

- 每位用户仅一个未删除的 PERSONAL 账本的部分唯一索引
- `source_id IS NOT NULL` 时的来源部分唯一索引
- 金额大于零的 CHECK
- `remaining_cent >= 0`
- `pay_day BETWEEN 1 AND 31`
- 情侣有效成员不超过两名需事务锁与服务校验

## 工程基线

- Prisma 事实文件：`apps/api/prisma/schema.prisma`
- 架构镜像：`docs/architecture/schema.prisma`，文档检查时必须保持同内容
- 初始迁移：`apps/api/prisma/migrations/20260711000000_init/migration.sql`
- 用户默认时区暂按已批准 ExecPlan 使用 `Asia/Shanghai`；若负责人否决，后续迁移移除数据库默认值
- Prisma 无法直接表达的部分唯一索引、复合归属外键与 CHECK 由人工审查的 migration SQL 固化
- 借贷处理和周期实例引用的账目禁止硬删除；必须先按业务规则解除关联，避免与来源一致性 CHECK 冲突

所有金额 CHECK 同时限制非负/正数业务边界与 JavaScript 安全整数上限。工资月份强制为月首；
工资应发、扣除和实发满足汇总等式；借贷本金、已处理和剩余金额满足汇总等式。

幂等唯一约束按业务操作分表并带用户作用域：`entries`、`debt_transactions`、
`saving_contributions` 均使用 `user_id + idempotency_key`（账目字段名为 `creator_user_id`）。
