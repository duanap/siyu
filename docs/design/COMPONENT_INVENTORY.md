# 组件清单

## 基础组件

| 组件 | 用途 | 实现 |
|---|---|---|
| AppButton | 主、次、危险按钮 | Ant Button 二次封装 |
| AppCard | 统一卡片 | Ant Card 二次封装 |
| AppDrawer | 手机底部抽屉 | Ant Drawer |
| AppDialog | 确认与提示 | Ant Modal |
| AppStatusTag | 统一状态标签 | Ant Tag 二次封装 |
| AppAmount | 金额格式、符号、语义 | 自定义 |
| AppEmpty | 空状态 | Ant Empty |
| AppPageHeader | 页面标题与操作 | 自定义 |
| AppBottomNav | 五项底部导航 | 自定义 |
| AppErrorState | 网络/权限/业务错误 | Ant Result 二次封装 |

## 业务组件

认证基础组件包括统一认证表单容器、邮箱/密码字段、提交错误状态、QQ 登录入口和受保护路由状态；
Access Token 只由集中 Pinia Store 在内存管理。

| 组件 | 页面 |
|---|---|
| LedgerSwitcher | 首页、明细、统计 |
| EntryAmountInput | 记一笔 |
| CategoryGrid | 记一笔、筛选 |
| EntryListItem | 明细、首页最近账目 |
| MonthlySummaryCard | 首页 |
| SalaryBalanceCard | 个人首页、工资首页 |
| DebtSummaryCard | 首页、借贷 |
| DebtProgressCard | 借贷列表 |
| RecurringBillCard | 首页、周期列表 |
| SavingGoalCard | 首页、目标列表 |
| CoupleMemberSummary | 情侣首页、统计 |
| CoupleLedgerManager | 情侣账本创建、邀请、成员、所有权和解散 |
| SalaryItemEditor | 月度工资 |
| SalaryAnnualSummary | 年度工资 |
| NotificationItem | 消息中心 |

## 状态要求

每个业务组件支持：

- loading
- empty
- error
- disabled
- light/dark
- long text
- permission-limited
