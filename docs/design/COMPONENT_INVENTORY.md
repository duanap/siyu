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
| CategoryManager | 分类管理的账本/类型切换、启停分组和服务端能力呈现 |
| CategoryEditorDrawer | 自定义分类名称、固定图标和颜色选择 |
| CategoryOrderControls | OWNER 使用的 44px 上移/下移完整排序控件 |
| EntryListItem | 明细、首页最近账目 |
| EntryAmountInput | 字符串金额输入、精确转分和字段错误 |
| CategoryGrid | 记账与编辑时选择当前启用分类 |
| EntryFilterDrawer | 明细类型、分类和创建人筛选 |
| EntryEditorForm | 新增和编辑共享字段与提交状态 |
| EntryDetailCard | 账目完整字段、来源和历史分类状态 |
| MonthlySummaryCard | 首页 |
| SalaryBalanceCard | 工资首页的当前周期余额、固定/日常支出和日均可用 |
| DebtSummaryCard | 借贷完整汇总、完整性加载与失败状态 |
| DebtProgressCard | 借贷列表方向、进度、到期和剩余金额 |
| DebtEditorForm | 借贷新增与详情编辑的共享表单 |
| RecurringRuleCard | 周期列表的规则状态、计划、金额、期数和服务端能力入口 |
| RecurringRunCard | 周期列表与详情的实例状态、计划日、金额和确认/跳过入口 |
| RecurringRuleForm | 周期规则创建与详情编辑共享表单 |
| SavingGoalCard | 首页、目标列表 |
| SavingGoalForm | 目标创建和 OWNER 详情编辑，精确元分字段、日期、封面网址与备注 |
| CoupleMemberSummary | 情侣首页、统计 |
| CoupleLedgerManager | 情侣账本创建、邀请、成员、所有权和解散 |
| SalaryItemEditor | 工资档案模板、月度工资项目和只读到账明细 |
| SalaryAnnualChart | 工资首页、年度工资的 12 月实发趋势 |
| NotificationItem | 消息中心的未读状态、类型图标、长文本、时间和安全关联入口 |

## 状态要求

每个业务组件支持：

- loading
- empty
- error
- disabled
- light/dark
- long text
- permission-limited
