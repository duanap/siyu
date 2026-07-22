# TASK-008：记账页面与明细列表

## 状态

已合并进 `main` 并正式关闭

## 模型与推理

- 推荐模型：Terra
- 推理：Medium
- 是否使用子代理：否

## 目标

- 实现受保护的 `/entries`、`/entries/new`、`/entries/:id` 移动端页面。
- 完成普通账目创建、筛选分页列表、详情、手工编辑和软删除交互。
- 提供可复用的账本切换、金额、分类、列表项、抽屉、弹窗、页面标题和底部导航组件。
- 使用既有五个 Entry API 和 OpenAPI 生成类型，完成组件测试、全仓回归和真实浏览器验收。

## 非目标

- 不新增后端 API、数据库迁移、OpenAPI 路径或生产依赖。
- 不实现首页、统计、借贷、周期、工资、攒钱、凭证上传、CSV 或 TASK-009。
- 不解决 KI-006，不实现来源业务的维护或删除流程。

## 相关规则

- BR-MONEY-001 至 BR-MONEY-003、BR-DATE-001 至 BR-DATE-002。
- BR-ENTRY-001 至 BR-ENTRY-015、BR-CATEGORY-001 至 BR-CATEGORY-012。
- AC-ENTRY-001 至 AC-ENTRY-014、AC-CATEGORY-006、AC-QUALITY-001。
- ADR-002、ADR-003、ADR-006、ADR-011、ADR-018。

## 允许修改

- `apps/mobile-web` 的请求层、认证类型、Entry 数据层、路由、页面、组件和测试。
- 与 TASK-008 直接相关的设计、验收、任务状态、验证报告和项目记忆文档。
- `MANIFEST.md`。

## 禁止修改

- `apps/api` 业务实现、Prisma Schema 和历史迁移。
- 现有 API 路径、Entry 权限规则和来源账目边界。
- TASK-009 或后续业务模块。

## 当前状态与依赖

- 基线：`main@731d42ec39c48bd5bb0f0eb9f96b8394b342df6a`。
- TASK-007 已关闭；Entry 五个 API、OpenAPI 74/74 和共享生成类型可用。
- 移动端已有 Pinia 认证、账本/分类客户端、日夜 Token 和手机端页面风格，但无公共组件目录与 Entry 页面。
- `docs/design/DESIGN_TOKENS.md` 缺失；实际工程 Token 位于 `@siyu/ui-tokens`。

## 关键设计

### 类型和请求

- 从生成文件实际导出的 `components` 建立 `Entry/User/Ledger/CreateEntryRequest/UpdateEntryRequest` 本地别名，不复制 DTO。
- 通用错误携带 `status/code/requestId`；网络失败与主动取消分离。
- 非认证请求遇到 401 时使用单飞 Refresh，最多重放一次；认证端点跳过恢复，所有阶段尊重原 `AbortSignal`。

### 页面与导航

- `/entries` 使用 `ledgerId/month/type/categoryId/creatorUserId/keyword/page` 作为事实来源。
- `/entries/new` 使用 `ledgerId/type`；`/entries/:id` 使用 `from`。
- `from` 必须由 Router 解析且目标路由名严格为 `entries`。
- 底部导航只显示在明细列表；首页和统计入口禁用，记账与我的分别指向现有有效路由。

### 账本、金额与幂等

- 账本优先级为 URL、设备存储、个人账本；无效选择回退个人账本并仅提示一次。
- 金额输入保存字符串，以 `BigInt` 精确转分并检查安全整数；`amountCent` 始终为正整数，符号由 Entry 类型决定。
- 创建草稿生成一次 `entry-${crypto.randomUUID()}`；失败重试保持 Key，成功后才轮换。

### 列表、分页和筛选

- `page` 表示累计加载深度，恢复上限固定为 10 页；按 1 到目标页顺序请求。
- `hasNext=false`、非法页码、达到上限、Abort 或查询变更时立即停止并安全规范化 URL。
- 条件变化取消旧请求；关键词防抖 300ms；按 API 顺序、Entry ID 去重、业务日期分组。
- 创建人仅来自当前有效成员及已加载账目发现的历史创建人，不新增历史成员 API。

### 详情、编辑与删除

- 权限只消费服务端 `canEdit/canDelete`；非 MANUAL 账目只读。
- 编辑携带 `expectedVersion`，无实际变化不提交；版本冲突只允许重载或放弃，不强制覆盖。
- 删除使用二次确认及原版本重试；成功、冲突、来源管理和资源不可见分别处理。

### 状态、主题与无障碍

- 页面覆盖首次/局部加载、空、筛选空、网络错误、认证失效、无权限、资源失效、冲突、只读、长文本和提交状态。
- 所有颜色使用 SIYU Token；点击区至少 44px；Drawer/Dialog 管理焦点并支持 Escape、Tab、Enter/Space。

## 风险

- 401 恢复递归或并发刷新导致重复请求。
- URL 深页触发无界恢复或过期响应覆盖新筛选。
- 金额使用浮点或超过安全整数。
- `from` 产生开放跳转。
- 表单重试错误轮换幂等键，或版本冲突静默覆盖。
- 320px、软键盘和安全区下提交区或列表被遮挡。

## 实施步骤

- [x] 预检
- [x] 建立 ExecPlan 和任务分支
- [x] 类型化请求层、认证恢复、账本与金额工具
- [x] 公共组件和路由
- [x] 快速记账页面
- [x] 明细列表与筛选分页
- [x] 详情、编辑和删除
- [x] 组件测试
- [x] 文档和项目记忆
- [x] 完整回归、Compose/Nginx 与真实浏览器验收
- [x] 最终审查、提交和推送

## 数据迁移与回滚

- 无数据库迁移或数据回填。
- 回滚仅需撤销 TASK-008 移动端与文档提交；既有 API、数据和后端行为不受影响。

## 验证命令

```bash
pnpm --filter @siyu/mobile-web test
pnpm verify
pnpm audit
git diff --check
pnpm prisma:validate
pnpm test:e2e
```

另验证 OpenAPI 74/74、迁移零 diff、五服务 Compose 健康、Nginx 真实业务链路、Redis 恢复及
Chrome/Edge 的 18 组尺寸/主题矩阵和关键状态。

## 进度日志

- 2026-07-14：确认本地/远程 main 与批准基线一致，工作区干净；TASK-007 已关闭，KI-006 未解决。
- 2026-07-14：创建 `task/TASK-008-entry-ui` 和本 ExecPlan；分页恢复上限冻结为 10 页。
- 2026-07-14：完成类型化请求层、会话恢复、金额/账本工具、14 个公共组件和三个 Entry 页面。
- 2026-07-14：移动端 16 个测试文件、48 项测试通过；新增视图测试使用单 Worker 避免 WSL jsdom 并发内存峰值。
- 2026-07-14：Compose 五服务与 Nginx 个人/情侣 OWNER/MEMBER 真实链路通过；Chrome 150 完成 18 组基础矩阵。
- 2026-07-14：真浏览器发现并修复暗色弹层 Token、44px 关闭区和关闭后焦点恢复；12 组弹层补充矩阵通过。
- 2026-07-14：移动端增至 17 个测试文件、52 项测试；全仓 71 项测试、OpenAPI 74/74 和完整质量门通过。

## 决策记录

- 生成类型是 Entry/User/Ledger 客户端模型唯一来源；不新建手写 DTO。
- 新增和详情是无底部导航的全屏任务流，明细列表承载五项底部导航。
- 低保真明细中的月度结余属于未实现统计，不使用假数据呈现。
- 页面截图仅作仓库外临时验收证据；记录矩阵结果但不提交截图、浏览器缓存或用户目录。

## 完成结果

已完成三个受保护 Entry 页面、集中请求/金额/账本工具、14 个公共组件、账号入口和完整状态流。
未新增后端 API、数据库迁移、OpenAPI 操作或生产依赖。真实 Chrome 三尺寸双主题无横向溢出，
Compose/Nginx 与自动质量门通过；KI-006 保持未解决，TASK-009 未开始。任务分支完成交付准备，推送后等待 PR。
后续经 PR #9 完成与 TASK-009、TASK-010 和原生运行能力的前向整合；合并提交
`2b4b384c7dcac23e58e2042f0a3f43ea79679277` 的 main push CI Run `29571310880` 全部通过。
