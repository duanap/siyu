# REST API 契约

前缀：`/api/v1`
金额：整数分
日期：`YYYY-MM-DD`
时间：ISO 8601 UTC
认证：Bearer Access Token；Refresh Token 使用 HttpOnly Cookie

认证成功响应返回 15 分钟 Access Token 和当前用户；Refresh Token 不出现在 JSON 中，只通过
`siyu_refresh_token` HttpOnly Cookie 传递。刷新必须轮换 Cookie，退出清除 Cookie 并幂等撤销会话。
密码重置请求始终返回一致的受理结果。

金额最小值与各业务规则一致，最大值不得超过 `Number.MAX_SAFE_INTEGER`（9007199254740991）。
客户端幂等键按“用户 + 操作 + Key”隔离：相同载荷重放已保存结果，不同载荷返回
`409 IDEMPOTENCY_CONFLICT`。

## 统一响应

```json
{
  "success": true,
  "data": {},
  "requestId": "req_01..."
}
```

```json
{
  "success": false,
  "code": "LEDGER_PERMISSION_DENIED",
  "message": "无权访问该账本",
  "details": {},
  "requestId": "req_01..."
}
```

分页：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "hasNext": false
}
```

## 主要错误码

- `AUTH_REQUIRED`
- `AUTH_DISABLED`
- `VALIDATION_FAILED`
- `RESOURCE_NOT_FOUND`
- `LEDGER_PERMISSION_DENIED`
- `COUPLE_LEDGER_FULL`
- `COUPLE_ALREADY_JOINED`
- `INVITATION_INVALID`
- `INVITATION_EXPIRED`
- `ENTRY_NOT_FOUND`
- `ENTRY_PERMISSION_DENIED`
- `ENTRY_DUPLICATE_SOURCE`
- `ENTRY_VERSION_CONFLICT`
- `ENTRY_SOURCE_MANAGED`
- `ENTRY_CATEGORY_INVALID`
- `CATEGORY_DISABLED`
- `DEBT_AMOUNT_EXCEEDS_REMAINING`
- `DEBT_HAS_SYNCED_ENTRY`
- `DEBT_SYNC_LEDGER_UNAVAILABLE`
- `DEBT_SYNC_CATEGORY_UNAVAILABLE`
- `RECURRING_RUN_DUPLICATE`
- `SALARY_MONTH_DUPLICATE`
- `SALARY_ALREADY_PAID`
- `IDEMPOTENCY_CONFLICT`

## 接口清单

### 认证和用户

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/qq/authorize`
- `GET /auth/qq/callback`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/password/forgot`
- `POST /auth/password/reset`
- `POST /auth/password/change`
- `GET /users/me`
- `PATCH /users/me`
- `GET /admin/auth/check`

### 账本和情侣关系

- `GET /ledgers`
- `GET /ledgers/:id`
- `POST /couple-ledgers`
- `PATCH /couple-ledgers/:id`
- `POST /couple-ledgers/:id/invitations`
- `POST /couple-invitations/accept`
- `POST /couple-ledgers/:id/leave`
- `POST /couple-ledgers/:id/transfer-ownership`
- `DELETE /couple-ledgers/:id`

创建情侣账本和邀请必须携带 `idempotencyKey`。邀请创建响应返回邀请元数据和一次性明文 `token`；
数据库、日志和审计只保存摘要或非敏感元数据。邀请默认 7 天有效，同一账本新邀请会撤销旧待处理邀请。
所有权转移请求使用 `targetUserId`，目标必须是同一账本的另一名有效普通成员。

### 分类和账目

- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `PUT /categories/reorder`
- `POST /categories/:id/enable`
- `POST /categories/:id/disable`
- `GET /entries`
- `POST /entries`
- `GET /entries/:id`
- `PATCH /entries/:id`
- `DELETE /entries/:id`

分类查询必须携带 `ledgerId`，可选 `type` 和 `includeDisabled`。列表中的每个分类返回
`canEdit`、`canToggle`，集合返回 `canCreate`、`canReorder`，客户端不得复制服务端权限规则。
创建分类必须携带 `ledgerId`、`type`、`name`、固定 `icon`、`#RRGGBB` `color` 和
`idempotencyKey`。系统分类不可修改内容；账本 OWNER 可排序和启停，情侣 MEMBER 仅可创建、
修改和启停自己创建的自定义分类。非成员和失效关系返回 404。

新增账目：

```json
{
  "ledgerId": "uuid",
  "type": "EXPENSE",
  "amountCent": 2850,
  "categoryId": "uuid",
  "businessDate": "2026-07-11",
  "note": "早餐",
  "paymentMethod": "WECHAT",
  "idempotencyKey": "client-generated-key"
}
```

普通账目列表必须携带 `ledgerId`，可选 `month/type/categoryId/creatorUserId/keyword/page/pageSize`；
month 缺省为用户时区当前月，page/pageSize 缺省 1/20 且 pageSize 最大 100。结果排除软删除记录，按
`businessDate DESC, createdAt DESC, id DESC` 排序，返回 `items/page/pageSize/total/hasNext`。

每条账目返回最小 creator、category、`version`、`canEdit` 和 `canDelete`。创建接口只生成 MANUAL，
内部以不可变创建请求哈希判断幂等，不接受客户端创建人或来源字段。PATCH 必须携带 `expectedVersion`；
DELETE 使用 `?expectedVersion=`。非 MANUAL 普通修改/删除返回 `ENTRY_SOURCE_MANAGED`，版本冲突返回
`ENTRY_VERSION_CONFLICT`。非成员、退出成员和解散账本按资源不可见处理。

### 借贷

- `GET /debts`
- `POST /debts`
- `GET /debts/:id`
- `PATCH /debts/:id`
- `DELETE /debts/:id`
- `POST /debts/:id/transactions`

借贷创建必须携带 `idempotencyKey`。列表按创建时间稳定倒序分页；详情返回未删除的处理记录、逾期天数和
`canEdit/canDelete`，其中存在任何同步账目的处理记录时 `canDelete=false`。更新仅允许对方名称、到期日、
备注和提醒设置，不允许重写方向、本金、开始日期或处理汇总。

处理请求必须携带 `amountCent/businessDate/syncEntry/idempotencyKey`。`BORROWED` 的同步处理生成个人账本
支出，`LENT` 生成个人账本收入，使用对应启用的系统“其他”分类；处理记录、汇总更新和来源账目必须在同一
事务内完成。相同幂等键和相同规范载荷重放原结果，不同载荷返回 `IDEMPOTENCY_CONFLICT`。存在同步账目的
借贷删除返回 `DEBT_HAS_SYNCED_ENTRY`；否则借贷与未同步处理记录一起软删除。

### 周期记账

- `GET /recurring-rules`
- `POST /recurring-rules`
- `GET /recurring-rules/:id`
- `PATCH /recurring-rules/:id`
- `POST /recurring-rules/:id/pause`
- `POST /recurring-rules/:id/resume`
- `DELETE /recurring-rules/:id`
- `GET /recurring-runs`
- `POST /recurring-runs/:id/confirm`
- `POST /recurring-runs/:id/skip`

规则创建必须携带 `idempotencyKey`；相同创建者、幂等键和规范载荷重放原规则，不同载荷或已删除原规则返回
`IDEMPOTENCY_CONFLICT`。列表可按可见账本筛选，规则响应返回分类摘要、计划/完成期数、下一执行日和服务端
`canEdit/canPause/canResume/canDelete`。

个人或情侣有效成员可创建所属账本规则；情侣双方可见，创建人和账本 OWNER 可写。更新不改写既有实例，
结束日期与总期数互斥，总期数不得小于已物化期数。暂停清空下一执行日，恢复按当天或之后的锚定计划日继续。

实例列表只返回当前用户仍有权访问的有效账本数据。只有确认模式的 `PENDING` 实例可确认或跳过；确认必须
携带正整数分 `amountCent` 和 `idempotencyKey`，金额只作用于当前实例。相同确认重放原结果，跳过重放原终态；
确认与跳过均消费服务端 `canConfirm/canSkip` 权限，且不能重复生成来源账目。

### 工资

TASK-015 已实现以下本人工资私有接口：

- `GET /salary/profiles`
- `POST /salary/profiles`
- `PATCH /salary/profiles/:id`
- `GET /salary/records`
- `POST /salary/records`
- `GET /salary/records/:id`
- `PATCH /salary/records/:id`
- `POST /salary/records/:id/mark-paid`

MVP 每名用户只允许一个未删除的 `ACTIVE` 工资档案。档案创建必须提交 `defaultItems` 和
`idempotencyKey`；模板项目允许金额为 0，项目代码在档案内唯一。相同用户、幂等键和规范载荷重放原档案，
不同载荷返回 `IDEMPOTENCY_CONFLICT`。

月度记录创建必须在 `items` 与 `copyPreviousMonth=true` 中二选一并携带 `idempotencyKey`。复制只读取同一档案
紧邻的上一个自然月，不跨月回退；月度项目金额必须为正、代码在记录内唯一且至少含一项收入。`grossCent`、
`deductionCent` 和 `netCent` 均由服务端按明细计算，并在同一事务受数据库延迟约束校验。一个档案同一月份只能
存在一条有效记录；已到账记录不可通过更新接口修改。工资档案和记录只按当前用户查询，越权详情统一返回 404。

确认到账必须提交 `paidDate`、`syncEntry` 和到账专用 `idempotencyKey`。相同键同载荷重放到账结果；键对应
不同载荷返回 `IDEMPOTENCY_CONFLICT`，已由其他键确认返回 `SALARY_ALREADY_PAID`。`syncEntry=false` 时只写
到账状态；`syncEntry=true` 时在本人有效个人账本的 `income.salary` 分类下原子生成金额等于 `netCent`、业务日期
等于 `paidDate` 的唯一 `SALARY` 来源收入。个人账本或工资分类不可用时分别返回
`SALARY_SYNC_LEDGER_UNAVAILABLE`、`SALARY_SYNC_CATEGORY_UNAVAILABLE`，所有越权记录 ID 仍统一返回 404。

本任务实现：

- `GET /salary/summary/:year`
- `GET /salary/balance`

年度汇总按工资月份聚合本人未删除记录，返回完整 12 个月趋势、应发/扣除/实发、
月均实发，以及奖金、养老、医疗、失业、公积金和个税专项累计。专项按稳定项目代码匹配；响应中的
`officialBalanceDisclaimer=true` 要求客户端提示数据来自用户录入，不代表官方账户余额。

工资余额以用户时区今天之前最近到账记录为当前周期，从到账日（含）至下个自然月的
预计发薪日（不含）聚合本人有效 PERSONAL 账本支出。`RECURRING_RUN` 为固定支出，其他来源为日常支出；
无到账记录返回 `available=false` 空态，周期过期时 `remainingDays=0`、`dailyAvailableCent=null`。

工资接口使用 `SALARY_NOT_FOUND`、`SALARY_PERMISSION_DENIED`、`SALARY_PROFILE_EXISTS`、
`SALARY_MONTH_DUPLICATE`、`SALARY_PREVIOUS_MONTH_NOT_FOUND`、`SALARY_ITEM_SOURCE_INVALID`、
`SALARY_ITEM_DUPLICATE`、`SALARY_EARNING_REQUIRED`、`SALARY_DEDUCTION_EXCEEDS_GROSS`、
`SALARY_ALREADY_PAID` 与通用 `IDEMPOTENCY_CONFLICT` 错误码。

### 攒钱目标

- `GET /saving-goals`
- `POST /saving-goals`
- `GET /saving-goals/:id`
- `PATCH /saving-goals/:id`
- `DELETE /saving-goals/:id`
- `POST /saving-goals/:id/contributions`
- `PATCH /saving-goals/:goalId/contributions/:id`
- `DELETE /saving-goals/:goalId/contributions/:id`

目标列表可选按 `ledgerId` 过滤，只返回当前用户仍是有效成员的未删除目标；目标详情返回有效存入记录和按用户
归属的贡献汇总。初始金额计入创建者贡献但不生成虚构存入记录。列表和详情均返回 `savedCent`、
`remainingCent`、整数万分比 `progressBasisPoints`、`canManage` 与 `canContribute`；存入记录返回
`canEdit/canDelete`。

创建目标与创建存入必须携带 `idempotencyKey`。同一用户和操作下同键同载荷重放原资源，同键异载荷或已删除
原结果返回 409。个人账本 OWNER 与情侣双方有效成员可创建、读取及添加本人存入；只有账本 OWNER 可更新/
删除目标，每位成员只能更新/删除本人存入。所有金额或目标金额变化在目标级事务锁内重新聚合并自动切换
`ACTIVE/COMPLETED`；删除目标设置 `CANCELLED` 并保留历史存入。

攒钱接口使用 `SAVING_GOAL_NOT_FOUND`、`SAVING_LEDGER_NOT_FOUND`、`SAVING_PERMISSION_DENIED`、
`SAVING_GOAL_DELETED`、`SAVING_CONTRIBUTION_NOT_FOUND`、`SAVING_CONTRIBUTION_DELETED`、
`SAVING_AMOUNT_OVERFLOW` 与通用 `IDEMPOTENCY_CONFLICT` 错误码。

### 统计、通知和导出

- `GET /statistics/overview`
- `GET /statistics/trend`
- `GET /statistics/categories`
- `GET /statistics/members`
- `GET /notifications`
- `POST /notifications/read`
- `GET /exports/entries.csv`
- `GET /exports/salary.csv`

四个基础统计端点必须携带 `ledgerId`，可选 `month=YYYY-MM`；缺省月份按用户时区确定。概览返回
`incomeCent/expenseCent/balanceCent/averageDailyExpenseCent/largestExpenseCent/entryCount`；趋势返回完整自然月
逐日零值补齐序列；分类返回支出金额、笔数和整数万分比；成员返回按 Entry 创建人归属的支出。所有端点只聚合
当前用户可见有效账本的未软删除账目，非成员和失效关系按资源不可见处理。

通知列表只返回当前认证用户的通知，按 `createdAt DESC, id DESC` 稳定分页，并返回
`items/page/pageSize/total/hasNext/unreadCount`。通知项包含可空的 `relatedType/relatedId/readAt`；关联字段只用于
导航上下文，不授予目标资源权限。标记已读请求接受 1 至 100 个唯一 `ids`，只更新当前用户且尚未已读的通知；
未知、他人和已读 ID 不区分错误，响应返回 `markedCount/unreadCount`。`readAt` 由服务端以 UTC 首次写入，重放
不得覆盖。

### 最小管理后台

- `GET /admin/overview`
- `GET /admin/users`
- `PATCH /admin/users/{id}/status`
- `GET /admin/ledgers`
- `GET /admin/recurring-runs`
- `POST /admin/recurring-runs/{id}/retry`
- `GET /admin/audit-logs`

所有接口除 `admin:access` 外校验对应细粒度权限。用户、账本关系、周期任务与审计列表均稳定分页，仅返回
BR-ADMIN-002 至 006 批准的脱敏字段；不返回任何财务金额。用户状态变化和任务人工重试要求 2 至 200 字理由、
危险操作确认与审计。停用用户原子撤销其全部活跃会话，禁止自停用；只有 FAILED 周期实例可重试。审计列表
成功读取时写入 `ADMIN_AUDIT_LIST_VIEWED`，响应不包含 IP 哈希及 before/after 业务内容。

## 实现要求

- 详情查询必须包含权限条件，不得先按 ID 裸查。
- 创建类接口支持客户端幂等键。
- DTO 对金额、日期、枚举和文本长度严格校验。
- 业务冲突返回 409；无权限返回 403；资源不可见可按安全策略返回 404。
- 新增或修改接口同步更新 OpenAPI。
- `openapi.yaml` 必须覆盖本文件列出的 81 个已批准操作；`scripts/check-openapi-coverage.mjs`
  负责阻止遗漏或未批准的新增路径。
- TASK-000 只固化契约与生成共享类型，不实现上述业务接口。
