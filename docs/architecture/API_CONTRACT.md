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
- `ENTRY_DUPLICATE_SOURCE`
- `DEBT_AMOUNT_EXCEEDS_REMAINING`
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
- `DELETE /couple-ledgers/:id`

### 分类和账目

- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `POST /categories/:id/disable`
- `GET /entries`
- `POST /entries`
- `GET /entries/:id`
- `PATCH /entries/:id`
- `DELETE /entries/:id`

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

### 借贷

- `GET /debts`
- `POST /debts`
- `GET /debts/:id`
- `PATCH /debts/:id`
- `DELETE /debts/:id`
- `POST /debts/:id/transactions`

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

## 实现要求

- 详情查询必须包含权限条件，不得先按 ID 裸查。
- 创建类接口支持客户端幂等键。
- DTO 对金额、日期、枚举和文本长度严格校验。
- 业务冲突返回 409；无权限返回 403；资源不可见可按安全策略返回 404。
- 新增或修改接口同步更新 OpenAPI。
- `openapi.yaml` 必须覆盖本文件列出的 65 个已批准操作；`scripts/check-openapi-coverage.mjs`
  负责阻止遗漏或未批准的新增路径。
- TASK-000 只固化契约与生成共享类型，不实现上述业务接口。
