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

### 工资

- `GET /salary/profiles`
- `POST /salary/profiles`
- `PATCH /salary/profiles/:id`
- `GET /salary/records`
- `POST /salary/records`
- `GET /salary/records/:id`
- `PATCH /salary/records/:id`
- `POST /salary/records/:id/mark-paid`
- `GET /salary/summary/:year`
- `GET /salary/balance`

### 攒钱目标

- `GET /saving-goals`
- `POST /saving-goals`
- `GET /saving-goals/:id`
- `PATCH /saving-goals/:id`
- `DELETE /saving-goals/:id`
- `POST /saving-goals/:id/contributions`
- `PATCH /saving-goals/:goalId/contributions/:id`
- `DELETE /saving-goals/:goalId/contributions/:id`

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

## 实现要求

- 详情查询必须包含权限条件，不得先按 ID 裸查。
- 创建类接口支持客户端幂等键。
- DTO 对金额、日期、枚举和文本长度严格校验。
- 业务冲突返回 409；无权限返回 403；资源不可见可按安全策略返回 404。
- 新增或修改接口同步更新 OpenAPI。
- `openapi.yaml` 必须覆盖本文件列出的 74 个已批准操作；`scripts/check-openapi-coverage.mjs`
  负责阻止遗漏或未批准的新增路径。
- TASK-000 只固化契约与生成共享类型，不实现上述业务接口。
