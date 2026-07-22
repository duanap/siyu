# 当前项目状态

更新时间：2026-07-22
文档版本：v1.11.0
代码状态：TASK-008 至 TASK-010 已合并、远程 CI 全部通过并正式关闭；TASK-011 借贷页面和统计已完成本地实现与浏览器验收，待提交和远程 CI

## 当前阶段

M3 已完成并合入 `main`；M4 的借贷数据与 API 已完成，TASK-011 客户端处于本地交付候选状态。

## 已完成

- 品牌唯一事实来源迁至 `docs/product/BRAND_IDENTITY.md`，正式名称和工程命名已同步。
- Git 仓库与 `task/TASK-000-project-bootstrap` 分支。
- Node.js 24 / pnpm 11 Monorepo，三个应用和三个共享包。
- Vue 手机端与管理后台最小可渲染壳、设计 Token 和日夜主题基线。
- NestJS API/Worker 独立入口、统一 requestId、统一错误响应和 `/health`。
- Prisma 7.8 Schema、create-only 初始迁移、部分唯一索引、归属外键和 CHECK。
- OpenAPI 3.1 覆盖 API_CONTRACT 已批准的 65 个操作，并生成共享类型。
- PostgreSQL、Redis、API、Worker、Nginx Compose 与占位环境样例。
- 非 Docker 原生运行：根目录环境加载、依赖连通性检查、Vite API 代理、API/Worker/前端进程编排和生产静态网关。
- 文档、格式、lint、类型、单元、API E2E、构建、OpenAPI、Prisma、依赖审计和 CI 基线。
- 邮箱注册/登录、QQ OAuth Provider、Access/Refresh 会话、密码修改/重置、用户资料和最小 RBAC。
- 首次注册或 QQ 登录事务内创建用户、唯一 PERSONAL 账本、OWNER 成员和默认 USER 角色。
- Refresh Token 原子轮换、重放撤销、Cookie 安全策略、Redis 限流和认证审计脱敏。
- 密码重置 BullMQ 任务、移动端认证页面与路由恢复、管理端登录与 ADMIN 服务端授权边界。
- 情侣账本创建、查询、改名、邀请、接受、成员退出、所有权转移和解散 API。
- 邀请一次性摘要、用户/操作幂等键、单活邀请、事务级锁、两人上限与单用户单情侣账本数据库触发器。
- 情侣成员和所有者权限、退出/转移/解散审计，以及移动端“朝暮同笺”管理页面完整状态。
- PR #2 已以 Squash merge 合入 main，提交为 `6ebb13537dc0246a4a6a165bd348b88582c4dbbe`。
- TASK-002 设计 Token/基础组件和 TASK-003 PostgreSQL/Prisma 基线已确认吸收进 TASK-000。
- 默认分类全局模板与账本内实例、16 个版本 1 默认分类、注册/QQ/情侣账本事务初始化。
- 分类创建、更新、稳定排序、启停、幂等、审计和 OWNER/MEMBER 权限 API；OpenAPI 74/74。
- 分类、Entry 和 RecurringRule 的账本/类型复合归属外键，停用分类新引用拒绝与历史引用保留。
- 移动端 `/categories` 页面：账本/类型 URL 恢复、启停分组、图标/颜色、上下排序和服务端能力字段。
- PR #4 已以 Squash merge 合入 main，功能提交为 `25dcad0a29951ba4269e318423d5ebbf301857b3`。
- 普通手工账目查询、创建、详情、修改和软删除 API，以及服务端 OWNER/MEMBER 能力字段。
- Entry 不可变 SHA-256 创建请求哈希、用户/操作幂等、整数版本乐观锁和权限优先软删除重试。
- 受控支付方式、创建人成员复合归属、有效创建人触发器、四个未删除记录部分查询索引和安全审计。
- TASK-007 五迁移历史升级、异常归属 fail-closed、Entry/认证/情侣/分类 E2E 和 OpenAPI 74/74。
- PR #6 已以 Squash merge 合入 main，功能提交为 `f6e579957535ccb5ea4ce06d9d4bb8368d7c994c`。
- 移动端 `/entries/new`、`/entries`、`/entries/:id`，覆盖账本切换、创建防重复、筛选分页、详情编辑和版本化删除。
- 账目页面只消费服务端 `canEdit/canDelete`，非 `MANUAL` 来源只读；金额以整数分收发并统一格式化。
- StatisticsModule 直接聚合未软删除 Entry，提供概览、完整逐日趋势、支出分类和成员支出四个端点。
- 移动端受保护 `/home` 与 `/statistics`，共享账本、月份和用户时区；ECharts 按需注册并随统计路由懒加载。
- TASK-008 完整记账客户端经 PR #9 整合进入 `main`；TASK-009 首页与统计、TASK-010 借贷 API 和原生运行模式经 PR #8 进入 `main`。
- 借贷 API 支持本人私有 CRUD、部分还款/收款、结清、逾期、幂等和可选普通账目联动；第六迁移、数据库约束与隔离 E2E 已由 GitHub CI 验证。
- 移动端 `/debts`、`/debts/new`、`/debts/:id` 已实现完整分页汇总、创建、详情、编辑、删除、部分还款/收款和可选普通账目同步。
- 借贷客户端只在个人入口出现，使用服务端 `canEdit/canDelete`、稳定幂等键和整数分；统计完整性不足时不显示部分汇总。

## 明确未实现

TASK-011 尚未提交或通过远程 CI；周期、工资、攒钱、通知、导出和后台业务管理均未实现。
这些未实现模块的 OpenAPI 路径覆盖只表示契约完整，不表示接口已经上线。

## 当前验证状态

- `pnpm verify`：通过，包含 Docker Compose daemon 配置校验。
- TASK-007 功能合并 main push CI Run [`29305065285`](https://github.com/duanap/siyu/actions/runs/29305065285)：`quality`、
  `database`、`secret-scan` 全部通过，无失败或跳过步骤。
- Prisma validate：通过；Prisma CLI 与 Client 均为 7.8.0。
- OpenAPI lint：通过，API_CONTRACT 覆盖 74/74，生成类型成功。
- 全分支集成本地验证：移动端 20 个文件 61 项、全仓 94 项测试通过；lint、typecheck、Prisma validate、OpenAPI 74/74、build、清单和文档检查通过。
- PR #8 CI Run `29568630493`、PR #9 CI Run `29571169599` 以及最新 main push CI Run
  [`29571310880`](https://github.com/duanap/siyu/actions/runs/29571310880) 的 `quality`、`database`、`secret-scan` 全部通过。
- CI `quality` 已执行包含借贷黑盒流程的 `pnpm test:e2e`；`database` 已执行第六迁移部署和数据库约束脚本。TASK-010 数据库验收闭环。
- 原生运行配置检查通过；Node 静态网关实测手机端 `/` 与管理端 `/admin/` 返回 200，API 未启动时 `/health` 明确返回 502。
- Windows Chrome 150.0.7871.101 真浏览器覆盖 `/login`、`/account`、`/couple/invite`、`/categories`：
  320px、375px、480px 均无横向溢出，44px 点击区、Tab 焦点、日间/暗色和长文本通过。
- TASK-008 真实 Chromium 覆盖 `/entries`、`/entries/new`、`/entries/:id`：320px、375px、480px 无横向溢出，
  日间/夜间、长账本名、长成员名、长备注、响应式筛选和固定底栏遮挡检查通过；API 响应仅在浏览器验收中按批准契约拦截。
- TASK-009 真实 Chromium 覆盖 `/home` 与 `/statistics`：320px、375px、480px 无横向溢出和小于 44px 的可见交互，
  日间/夜间、ECharts、长账本/分类/成员名、空数据和无权限状态通过。
- TASK-011 定向 3 个测试文件 9 项在 Node.js 24.18.0 下通过；真实 Chrome Headless/CDP 覆盖 `/debts`、
  `/debts/new`、`/debts/:id` 的 320px、375px、480px、日间/暗色、空、网络失败、404 和长文本，均无横向
  溢出或小于 44px 的可见交互区。
- TASK-011 全仓 99 项测试、隔离 PostgreSQL/Redis API E2E、format、lint、typecheck、Prisma validate、
  OpenAPI 74/74、Compose、build、docs 和差异检查通过；传递依赖安全覆盖更新后审计无已知漏洞。
- OpenAPI 74/74 覆盖与具体统计响应 Schema 生成通过；手机入口 294 KB，统计图表独立懒加载。
- 依赖审计：无已知漏洞。
- 空库初始迁移、Prisma migrate status/diff/introspection、PostgreSQL 特殊约束和并发幂等实测：通过。
- 25 模型三迁移空库回放、Prisma status/diff/introspection、19 个关键唯一索引、情侣成员触发器和并发验证：通过。
- 25 模型四迁移回放、24 个关键索引、分类复合归属、既有分类迁移、默认补齐和重名策略：通过。
- 25 模型五迁移回放、28 个关键索引、Entry 创建哈希/版本/成员/来源/支付约束、合法 OWNER 修复、
  异常非 OWNER 归属拒绝和并发幂等：通过。
- `siyu-postgres`、`siyu-redis`、`siyu-api`、`siyu-worker`、`siyu-nginx`：验收时全部 running/healthy。
- PostgreSQL、Redis、API、BullMQ Worker、Nginx 服务链路和 `http://localhost:8080/health`：通过。
- API 与 Worker 同时重启后连接恢复：通过；Nginx 使用 Docker DNS 动态解析 API 地址，无需随 API 重启。

## 下一项动作

完成 `task/TASK-011-debt-ui` 的全仓质量门、最终差异审查和提交/PR；远程 CI 通过前不正式关闭 TASK-011，
不开始 TASK-012 实现。

## 待负责人确认

- Logo、商标、域名、软著、应用商店名称和安卓包名可用性。
- 默认时区是否保留 `Asia/Shanghai`。
- 周期跳过/确认金额与工资固定支出口径；恢复不补期、短月取月末、来源借贷删除和目标归属已确认。
- 上传、异步导出、反馈、会话与后台 API/数据模型的最小契约。
- QQ 互联申请已通过；生产部署仍需通过环境变量配置 App ID/App Key/严格回调地址和邮件提供方。

## 2026-07-17 全分支集成

- 已审计 GitHub 全部远端分支：TASK-000 是 `main` 祖先；TASK-004 至 TASK-007 分支头与各自已合并 PR 的输入提交一致，合并后无新增提交。
- `task/TASK-008-entry-ui` 的 61 个变更文件未被此前的快照实现完整覆盖，现已将其类型化请求层、会话恢复、精确金额工具、14 个公共组件、记账页面、无障碍交互和测试并入完整项目。
- 路由和底部导航已向前合并，`/entries`、`/entries/new`、`/entries/:id`、`/home`、`/statistics` 与 `/account` 可同时使用；TASK-009、TASK-010 和非 Docker 原生运行能力保持不变。
- 本地验证：移动端 20 个测试文件 61 项通过，全仓共 94 项测试通过；lint、typecheck、Prisma validate、OpenAPI 74/74、build、交付清单和必需文档检查通过。
- PR #9 合并提交为 `2b4b384c7dcac23e58e2042f0a3f43ea79679277`；main push CI Run `29571310880`
  已在 Linux 环境完成质量、数据库和秘密扫描，TASK-008 至 TASK-010 正式关闭。
