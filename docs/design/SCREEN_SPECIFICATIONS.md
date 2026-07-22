# 页面规格

| 编号 | 页面 | 路由 | 核心目的 | 必须覆盖状态 |
|---|---|---|---|---|
| 01 | 登录与注册 | `/login`、`/register` | 邮箱密码与 QQ 登录、注册、登录失败与加载状态 | 加载、错误、提交中、无权限、夜间 |
| 01A | 找回与重置密码 | `/forgot-password`、`/reset-password` | 防枚举申请、一次性令牌重置 | 加载、错误、成功、提交中、夜间 |
| 01B | OAuth 回调 | `/oauth/callback` | 通过 Refresh Cookie 恢复 QQ 登录状态 | 加载、错误、成功、夜间 |
| 02 | 个人首页 | `/home?ledger=personal` | 月度收支、工资余额、借贷、周期和目标 | 加载、空、错误、无权限、夜间 |
| 03 | 情侣首页 | `/home?ledger=couple` | 共同收支、成员对比、共同周期和目标 | 加载、空、错误、无权限、夜间 |
| 04 | 快速记账 | `/entries/new` | 收入/支出、金额、分类、日期和备注 | 加载、空、错误、无权限、夜间 |
| 05 | 账目明细 | `/entries` | 日期分组、月份和类型筛选、搜索 | 加载、空、错误、无权限、夜间 |
| 06 | 统计 | `/statistics` | 概览、趋势、分类占比和排行 | 加载、空、错误、无权限、夜间 |
| 07 | 借贷列表 | `/debts` | 我欠别人的/别人欠我的、汇总和逾期 | 加载、空、错误、无权限、夜间 |
| 07A | 新增借贷 | `/debts/new` | 方向、对方、整数分金额、业务日期、到期和提醒偏好 | 错误、提交中、重复点击、长文本、夜间 |
| 08 | 借贷详情 | `/debts/:id` | 进度、处理记录、还款或收款 | 加载、空、错误、无权限、夜间 |
| 09 | 周期记账 | `/recurring` | 到期、待确认、规则状态和分期 | 加载、空、错误、无权限、夜间 |
| 10 | 创建周期账目 | `/recurring/new` | 频率、模式、期数、账本和提醒 | 加载、空、错误、无权限、夜间 |
| 10A | 周期规则详情 | `/recurring/:id` | 执行记录、编辑、暂停、恢复、删除、确认与跳过 | 加载、空、错误、无权限、提交中、夜间 |
| 11 | 工资首页 | `/salary` | 工资余额、当月实发和年度累计 | 加载、空、错误、无权限、夜间 |
| 12 | 月度工资详情 | `/salary/:year/:month` | 收入项、扣除项、实发和到账 | 加载、空、错误、无权限、夜间 |
| 13 | 年度工资统计 | `/salary/year/:year` | 月度趋势、五险一金与个税累计 | 加载、空、错误、无权限、夜间 |
| 14 | 攒钱目标列表 | `/saving-goals` | 个人/情侣目标和完成进度 | 加载、空、错误、无权限、夜间 |
| 15 | 攒钱目标详情 | `/saving-goals/:id` | 进度、存入记录和成员贡献 | 加载、空、错误、无权限、夜间 |
| 16 | 我的与设置 | `/profile` | 资料、主题、通知、导出和账号 | 加载、空、错误、无权限、夜间 |
| 17 | 朝暮同笺管理 | `/couple/invite` | 创建账本、邀请/加入、成员、改名、转移、退出和解散 | 加载、空、错误、无权限、提交中、长昵称、夜间 |
| 18 | 消息中心 | `/notifications` | 邀请、到期、失败、完成和未读状态 | 加载、空、错误、无权限、夜间 |
| 19 | 分类管理 | `/categories?ledgerId=&type=` | 账本/收支切换、分类新增编辑、图标颜色、排序和启停 | 加载、空、错误、无权限、提交中、长文本、夜间 |

分类管理页面使用服务端 `canCreate/canReorder/canEdit/canToggle` 能力，不在前端复制 OWNER/MEMBER
规则；停用必须二次确认，上下移动按钮点击区不少于 44px。账本和类型写入 URL 查询参数，刷新和返回后恢复。

快速记账和账目明细已在 TASK-008 实现，另含 `/entries/:id` 详情/编辑路由。页面只消费服务端
`canEdit/canDelete`，非 `MANUAL` 来源保持只读；创建表单在同一载荷重试时复用幂等键，删除携带
`expectedVersion` 并二次确认。浏览器验收截图位于 `output/playwright/entries-320-light.png`、
`entries-375-light.png`、`entries-375-dark.png`、`entries-480-light.png`、
`entry-create-320-light.png`、`entry-create-320-dark.png`、`entry-detail-375-light.png` 和
`entry-detail-375-dark.png`。

个人/情侣首页和统计已在 TASK-009 实现。首页只呈现普通账目月度汇总、情侣成员支出和最近账目；未上线业务模块
不显示静态卡片。统计页使用 ECharts 按需渲染完整逐日趋势，并展示支出分类和情侣成员排行。验收截图位于
`output/playwright/home-320-light.png`、`home-375-dark.png`、`statistics-320-light.png`、
`statistics-375-dark.png`、`statistics-480-light.png`、`statistics-375-empty-light.png` 和
`statistics-375-no-access-light.png`。

借贷列表、新增和详情已在 TASK-011 本地实现。借贷只在个人入口出现，汇总必须完整读取分页和详情；新增与处理
失败重试复用幂等键，删除使用服务端能力字段和二次确认。真实 Chrome 验收截图位于
`output/playwright/debts-320-light.png`、`debts-375-light.png`、`debts-375-dark.png`、
`debts-480-light.png`、`debt-new-320-light.png`、`debt-new-375-dark.png`、
`debt-detail-375-light.png`、`debt-detail-375-dark.png`、`debt-process-375-dark.png`、`debts-empty-375-light.png`、
`debts-error-375-light.png` 和 `debt-404-375-light.png`。

周期列表、创建和详情已在 TASK-014 实现。列表完整读取规则与待确认实例分页，不用局部数据伪造月度汇总；
创建和确认失败重试复用稳定幂等键，编辑、暂停、恢复、删除、确认和跳过只消费服务端能力字段。真实 Chrome
验收截图位于 `output/playwright/recurring-320-light.png`、`recurring-375-light.png`、
`recurring-375-dark.png`、`recurring-480-light.png`、`recurring-empty-375-light.png`、
`recurring-error-375-light.png`、`recurring-new-320-light.png`、`recurring-new-bottom-320-light.png`、
`recurring-new-375-dark.png`、`recurring-detail-375-light.png`、`recurring-detail-375-dark.png`、
`recurring-confirm-375-dark.png` 和 `recurring-404-375-light.png`。

工资首页、月度详情和年度统计已在 TASK-018 实现。首页只呈现本人档案、服务端工资周期余额、当前月记录和
年度汇总；月度页支持模板项目、服务端复制紧邻上月、未到账编辑和到账二次确认，已到账事实保持只读；年度页
直接展示服务端 12 个月趋势，并固定声明数据不代表官方账户余额。真实 Chrome 验收截图位于
`output/playwright/salary-320-light.png`、`salary-375-light.png`、`salary-375-dark.png`、
`salary-480-light.png`、`salary-profile-375-light.png`、`salary-empty-375-light.png`、
`salary-error-375-light.png`、`salary-month-320-light.png`、`salary-month-375-dark.png`、
`salary-paid-confirm-375-dark.png`、`salary-year-375-light.png`、`salary-year-375-dark.png` 和
`salary-year-480-light.png`。

## 页面交付要求

每张页面实现时必须同时提交：

- 页面组件和路由
- API 状态与错误映射
- 320px、375px、480px 截图
- 日间和夜间截图
- 空状态和错误状态
- 关键交互测试
- 对应验收条件编号

低保真 SVG 位于 `screens/`，预览入口为 `screens/index.html`。SVG 固定信息层级和布局，不限制最终品牌插画与图标细节。
