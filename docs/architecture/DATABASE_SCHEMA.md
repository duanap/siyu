# 数据库设计

数据库：PostgreSQL
ORM：Prisma
金额：`BIGINT`，单位为分
主键：UUID
系统时间：`TIMESTAMPTZ`
业务日期：`DATE`
删除：`deleted_at` 软删除

## 核心表

### user_credentials

邮箱密码凭据：`id, user_id, email_normalized, password_hash, password_changed_at, created_at, updated_at`。
用户和规范化邮箱分别唯一，密码仅保存 Argon2id 哈希。

### auth_sessions / refresh_tokens

会话记录用户、状态、到期与撤销原因；Refresh Token 记录不可逆摘要、使用/撤销时间和唯一后继关系。
并发消费通过条件更新保证只有一个后继，重放撤销所属会话。

### password_reset_tokens

`id, user_id, token_hash, expires_at, used_at, created_at`。摘要唯一，令牌短时有效且只能使用一次。

### roles / permissions / user_roles / role_permissions

最小关联表 RBAC。复合主键阻止重复授权；所有关联外键使用 RESTRICT。内置 USER、ADMIN 及
`profile:read`、`profile:write`、`admin:access`。

### users

`id, qq_open_id, nickname, avatar_url, timezone, status, created_at, updated_at, deleted_at`

### ledgers

`id, type, name, owner_user_id, idempotency_key, status, created_at, updated_at, deleted_at`

- `type`：PERSONAL / COUPLE
- 每位用户仅一个有效个人账本。
- 情侣人数通过后端事务和成员约束保证。

### ledger_members

`id, ledger_id, user_id, role, status, joined_at, left_at`

- 唯一：`ledger_id + user_id`
- `role`：OWNER / MEMBER

### ledger_invitations

`id, ledger_id, inviter_user_id, token_hash, idempotency_key, status, expires_at, accepted_by_user_id, accepted_at`

- `token_hash` 唯一
- 不明文保存邀请码凭证
- `inviter_user_id + idempotency_key` 在幂等键非空时唯一
- 每个账本最多一个 `PENDING` 邀请

### categories

`id, ledger_id, creator_user_id, type, name, icon, color, sort_order, is_system, is_enabled, template_key, template_version, idempotency_key, created_at, updated_at`

- 每条分类属于一个账本；系统分类无创建者且必须有模板键，自定义分类必须有创建者且无模板键。
- `(ledger_id, template_key)` 保证默认初始化幂等；`(creator_user_id, idempotency_key)` 保证创建请求幂等。
- 启用名称在 `ledger_id + type + lower(name)` 内唯一；查询使用 `(ledger_id, type, is_enabled, sort_order, id)`。
- 名称、排序、颜色、图标和系统/自定义形态由 CHECK 固化；系统和自定义分类均不物理删除。
- Entry、RecurringRule 的插入或分类/账本/类型变更由触发器校验分类归属、类型和启用状态；停用不回写历史引用。

### entries

`id, ledger_id, creator_user_id, type, amount_cent, category_id, business_date, note, payment_method, source_type, source_id, idempotency_key, create_request_hash, version, created_at, updated_at, deleted_at`

- `payment_method` 是 `CASH / WECHAT / ALIPAY / BANK_CARD / OTHER` 受控枚举或 NULL。
- `create_request_hash` 保存版本化规范创建载荷的 SHA-256，数据库触发器禁止后续修改；历史记录使用
  `legacy:<entry-id>` 保留命名空间且不参与成功重放。
- `version >= 1`，PATCH 和 DELETE 以预期版本原子递增；备注和幂等键由 CHECK 固化裁剪、长度和格式。
- `(ledger_id, creator_user_id)` 复合外键保证创建人可追溯到成员记录；新写入触发器同时要求有效账本、
  有效成员和未禁用创建人。迁移仅修复可证明合法的 OWNER 缺失关系，其他异常历史归属失败退出。

索引：

- `(ledger_id, business_date DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`
- `(ledger_id, type, business_date DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`
- `(ledger_id, category_id, business_date DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`
- `(ledger_id, creator_user_id, business_date DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`

唯一：

- `creator_user_id + idempotency_key`
- 来源业务非空时 `source_type + source_id`（PostgreSQL 部分唯一索引）

TASK-007 正式增量迁移为 `20260714040000_entry_api`；上述 CHECK、触发器和部分索引按 ADR-010 由受审 SQL 固化。

### debts

`id, user_id, direction, counterparty_name, principal_cent, processed_cent, remaining_cent, start_date, due_date, status, note, reminder_enabled, idempotency_key, create_request_hash, created_at, updated_at, deleted_at`

- `(user_id, idempotency_key)` 唯一；创建请求哈希不可变，历史记录使用 `legacy:<debt-id>` 命名空间。
- 本金等于已处理加剩余；零剩余必须为 `SETTLED`，软删除必须为 `CANCELLED`。

### debt_transactions

`id, debt_id, user_id, amount_cent, business_date, sync_entry, entry_id, idempotency_key, request_hash, note, created_at, deleted_at`

- `(user_id, idempotency_key)` 唯一；不可变请求哈希区分安全重放与冲突。
- 同步账目必须位于本人有效个人账本，类型、金额、业务日期、创建人及 `DEBT_TRANSACTION + transaction_id`
  来源键必须一致；约束在事务提交前延迟校验。

### recurring_rules

`id, owner_user_id, ledger_id, name, entry_type, amount_cent, category_id, frequency, interval_value, start_date, end_date, total_occurrences, completed_occurrences, next_run_date, generation_mode, status, reminder_days_before, idempotency_key, create_request_hash, created_at, updated_at, deleted_at`

- `(owner_user_id, idempotency_key)` 唯一；创建请求哈希与规则归属不可变。
- `(ledger_id, owner_user_id)` 复合外键保证规则创建人可追溯到账本成员记录，执行时仍需校验有效成员和用户状态。
- 活动规则必须有下一执行日；暂停、完成和取消规则下一执行日为空。结束日期与总期数互斥。
- 月/年计划日以开始日期为锚，短月取月末；已有任意实例（含失败实例）后，服务与数据库触发器共同锁定收支类型、分类、频率、间隔、开始日期和生成方式。

### recurring_runs

`id, rule_id, scheduled_date, amount_cent, status, entry_id, attempts, last_error, last_attempt_at, confirmed_at, confirmation_user_id, confirmation_idempotency_key, confirmation_request_hash, created_at, updated_at`

- 唯一：`rule_id + scheduled_date`
- 确认幂等按 `(confirmation_user_id, confirmation_idempotency_key)` 唯一；只有 `CONFIRMED` 保存完整确认事实。
- `GENERATED` / `CONFIRMED` 必须关联一笔金额、日期、账本、创建人、分类和来源均一致且未软删除的普通账目；双向约束延迟到事务提交检查，即时防篡改触发器禁止修改或软删除周期来源账目。
- `FAILED` 必须保存正数尝试次数、最后错误和最后尝试时间；已生成、已确认和已跳过的金额、状态、账目、尝试信息及确认事实不可修改。

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
- 创建账本与默认分类初始化
- 分类创建、排序、启停与审计
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
- 情侣账本每个用户最多一个有效关系、每个账本最多两名有效成员，由事务级 advisory lock、服务复查和数据库触发器共同保证
- 每个账本最多一个有效 OWNER 成员，由部分唯一索引保证；所有权转移在同一事务内更新成员角色和 `owner_user_id`
- 分类模板键、创建幂等键和启用名称唯一；名称、颜色、图标、排序及模板形态 CHECK
- 分类初始化、创建和排序使用 `ledger_id + type` advisory transaction lock，排序按 100 间隔规范化

## 工程基线

- Prisma 事实文件：`apps/api/prisma/schema.prisma`
- 架构镜像：`docs/architecture/schema.prisma`，文档检查时必须保持同内容
- 初始迁移：`apps/api/prisma/migrations/20260711000000_init/migration.sql`
- 分类增量迁移：`apps/api/prisma/migrations/20260714020000_category_module/migration.sql`
- 借贷 API 增量迁移：`apps/api/prisma/migrations/20260716000000_debt_api/migration.sql`
- 周期规则与实例增量迁移：`apps/api/prisma/migrations/20260722040000_recurring_rules/migration.sql`
- 用户默认时区暂按已批准 ExecPlan 使用 `Asia/Shanghai`；若负责人否决，后续迁移移除数据库默认值
- Prisma 无法直接表达的部分唯一索引、复合归属外键与 CHECK 由人工审查的 migration SQL 固化
- 借贷处理和周期实例引用的账目禁止硬删除；必须先按业务规则解除关联，避免与来源一致性 CHECK 冲突

所有金额 CHECK 同时限制非负/正数业务边界与 JavaScript 安全整数上限。工资月份强制为月首；
工资应发、扣除和实发满足汇总等式；借贷本金、已处理和剩余金额满足汇总等式。

幂等唯一约束按业务操作分表并带用户作用域：`entries`、`debt_transactions`、
`saving_contributions` 均使用 `user_id + idempotency_key`（账目字段名为 `creator_user_id`）。
