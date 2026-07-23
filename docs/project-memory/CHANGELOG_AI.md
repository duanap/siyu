# AI 修改记录

## 2026-07-11 / DOCS-001

### 任务

创建 Codex 开发交接包 v1.0.0。

### 修改内容

- 创建产品、设计、架构、记忆、计划、质量和 Codex 指令文档
- 创建 18 张核心页面低保真 SVG
- 创建参考 Prisma Schema 和 OpenAPI 初稿
- 创建根目录和模块级 AGENTS.md
- 创建验证脚本和任务模板

### 数据库变化

仅设计文档，无实际迁移。

### 验证

- 文件生成：通过
- ZIP 打包：通过
- 应用测试：尚无代码，不适用

### 未完成

- 正式应用代码
- 高保真品牌设计
- 正式 OAuth 与部署配置

## 2026-07-11 / TASK-000

### 任务

将 SIYU 文档交接包修复并初始化为可运行、可验证的 Monorepo 工程基线。

### 修改内容

- 初始化 Git、pnpm workspace、三个应用、三个共享包、锁文件和统一工具链。
- 同步“朝暮同笺 · 四时有余”品牌、PWA、页面标题、后台标题和工程命名。
- 建立 API/Worker 入口、真实 `/health`、requestId、统一错误响应和配置校验。
- 建立 Prisma Schema、create-only 初始迁移、部分唯一索引、CHECK 和归属复合外键。
- 将 OpenAPI 补齐到 API_CONTRACT 的 65 个操作并生成共享 TypeScript 类型。
- 建立 Compose、Nginx、环境变量样例、数据库约束脚本、CI、秘密扫描和依赖审计。
- 建立可重复的 MANIFEST 哈希生成与检查。

### 数据库变化

新增尚未应用到共享或生产环境的初始迁移。迁移包含 17 个模型对应表、外键、索引，以及 Prisma
无法表达的 PostgreSQL 部分唯一索引和 CHECK。迁移已在一次性空 PostgreSQL 中完整回放，并通过
status、零 diff、introspection、约束、删除策略和并发幂等实测。

### API 变化

新增 `/health` 工程健康接口；业务 API 仅形成 OpenAPI 契约，不含 Controller 或假实现。
OpenAPI 覆盖 65/65 个批准操作，并定义统一成功/错误/分页、金额、日期、认证和主要请求响应类型。

### 验证

- 文档、格式、lint、typecheck、单元/组件、API E2E、build：通过。
- Prisma validate、OpenAPI lint/覆盖、Compose 静态检查：通过。
- 320/375/480 真浏览器视口、日夜主题和 44px 点击区：通过。
- 依赖审计：无已知漏洞。
- Docker Compose config、空库迁移回放、Prisma status/diff/introspection：通过。
- PostgreSQL 唯一/部分唯一/CHECK/复合外键/删除策略及并发幂等：通过。
- PostgreSQL、Redis、API、BullMQ Worker、Nginx 五容器健康和服务链路：通过。
- API/Worker 同时重启、Redis 重连和 Nginx 动态 DNS 恢复：通过。
- 验收修复：Prisma shadow datasource、并发测试分类 UUID、Worker/Nginx healthcheck、Nginx API 动态解析。

### 未完成

- 所有业务模块、高保真 UI、真实 OAuth/域名/S3/生产密钥。
- 无 TASK-000 范围内未完成项；TASK-001 已吸收且不再单独执行。

## 2026-07-12 / TASK-004

### 任务

实现邮箱密码与 QQ OAuth 双认证、用户原子初始化、安全会话、密码重置、最小 RBAC，以及移动端和
管理端认证基础。

### 修改内容

- 新增 Auth、Users、Database、Session/RBAC、QQ Provider 和 Redis 限流模块。
- 实现 Argon2id 密码、15 分钟 Access Token、30 天 Refresh Session、原子轮换和重放撤销。
- 实现密码修改/重置、BullMQ 邮件任务、认证审计脱敏和严格环境变量配置。
- 实现移动端登录/注册/忘记与重置密码/OAuth 回调/受保护占位页，以及管理端登录和 ADMIN Guard。
- OpenAPI 从 65 扩展到 71 个批准操作并重新生成共享类型；同步产品、设计、架构和项目记忆。

### 数据库变化

新增正式迁移 `20260712000000_authentication_foundation`，将 `User.qqOpenId` 改为可空唯一，并新增
UserCredential、AuthSession、RefreshToken、PasswordResetToken、Role、Permission、UserRole、
RolePermission。迁移包含唯一约束、CHECK、复合约束和明确的 RESTRICT/CASCADE 删除策略。

### API 变化

实现既有 QQ authorize/callback、refresh、logout、users/me 契约，新增邮箱 register/login、
forgot/reset/change password 和管理端认证检查；Refresh Token 仅通过 HttpOnly Cookie 传递。

### 验证

- 22 项单元/组件测试和隔离 PostgreSQL 认证 E2E 通过。
- 空库迁移、status、零 diff、25 模型 introspection、约束与并发幂等通过。
- OpenAPI 71/71、Prisma、构建、Compose、依赖审计和 `pnpm verify` 通过。
- 五容器服务链路、密码重置 Worker、API/Worker 重启后会话恢复通过。
- Chrome DevTools 真实 320/375/480 CSS 视口无横向溢出，主题切换通过。

### 未完成

- 未配置真实 QQ 凭据，未执行线上 QQ 授权；未配置生产邮件提供方。
- 未实现任何账本 API/页面、记账、统计、情侣、多用户协作或后台业务管理。
- 未创建 PR；正式 QQ 与生产邮件部署配置仍需后续提供。

## 2026-07-14 / TASK-005

### 任务

合并 PR #1，整理 TASK-002/003 状态，冻结情侣账本规则，并实现情侣账本邀请、成员和权限能力。

### 修改内容

- PR #1 以 GitHub 合并提交进入 main；QQ 互联申请已通过，因此取消临时审核页制作与部署。
- TASK-002 设计 Token/基础组件和 TASK-003 PostgreSQL/Prisma 基线明确吸收进 TASK-000。
- 新增 BR-COUPLE-010 至 016、AC-COUPLE-008 至 012、ADR-014 至 016。
- 新增 Ledgers Repository/Service/Controller，实现创建、查询、改名、邀请、接受、退出、转移和解散。
- 邀请凭证仅保存摘要，创建响应一次性返回明文；新邀请撤销旧邀请，写接口使用限流、幂等键、事务锁和审计。
- 新增移动端“朝暮同笺”管理页，覆盖加载、空、错误、无权限、正常、提交中和危险操作确认。
- 真浏览器补验修复无效邀请错误替换表单、返回链接点击区不足 44px，以及长昵称压缩头像的问题。

### 数据库变化

新增迁移 `20260714000000_couple_ledger_permissions`，为情侣账本和邀请增加创建幂等字段；新增账本/邀请
幂等部分唯一索引、单活邀请和单活所有者索引，以及限制每账本两名有效成员、每用户一个有效情侣账本的
PostgreSQL 触发器和 advisory lock。

### API 变化

实现账本与情侣关系既有 8 个操作，新增 `POST /couple-ledgers/:id/transfer-ownership`；OpenAPI 从
71 扩展到 72 个批准操作。错误响应保留业务错误码，账本响应不暴露幂等键，邀请响应不暴露 Token 摘要。

### 验证

- 三迁移空库回放、status、零 diff、25 模型 introspection 和 19 个关键唯一索引：通过。
- 情侣成员上限、单用户单情侣账本、单活所有者和单活邀请数据库约束：通过。
- 认证、创建/邀请幂等、自邀拒绝、满员、越权、转移、退出、解散和审计 E2E：通过。
- 移动端 8 项组件/API 测试、API 类型检查、OpenAPI 72/72 和 lint：通过。
- `pnpm verify` 包含的 27 项单元/组件测试、Prisma、健康 E2E 与生产构建：通过。
- Windows Chrome 150.0.7871.101 对 `/login`、`/account`、`/couple/invite` 完成 320×800、
  375×812、480×900 的日间/暗色 18 组真浏览器验收；无横向溢出，44px 点击区和完整业务状态通过。
- 邀请复制、重复提交防护、API 失败、加载、双方权限、转移/退出/解散确认、返回和刷新恢复：通过。
- 临时截图、浏览器配置与用户数据目录已清理，未提交验收产物。
- PR #2 已按预期 Head SHA `8b449d1aca643a51d4b98b6b08d8d6456100c842` 以 Squash merge 合入
  main，合并提交为 `6ebb13537dc0246a4a6a165bd348b88582c4dbbe`。
- main push CI Run `29275012134` 的 `quality`、`database`、`secret-scan` 全部成功，无失败或跳过步骤；
  TASK-005 正式关闭，远程任务分支保留。

### 未完成

- 分类、普通记账和后续业务模块未开始。
- TASK-005 范围内无未完成项。

## 2026-07-14 / TASK-006

### 任务

实现账本分类模块，包括默认模板、迁移、权限、API、移动端页面和真浏览器验收。

### 修改内容

- 新增 BR-CATEGORY-004 至 012、AC-CATEGORY-001 至 008 和 ADR-017，明确系统模板账本内实例与
  ADR-016 优先的 MEMBER 自定义分类权限。
- 新增 Categories Controller/Service/Repository、固定模板/图标/颜色、账本与类型排序锁、创建幂等和审计。
- 邮箱注册、QQ 首次建号和情侣账本创建在原事务中初始化 9 个支出与 7 个收入默认分类。
- 新增移动端 `/categories` 与账号入口，支持 URL 恢复、能力字段、抽屉编辑、固定图标/颜色、排序和启停。
- 视觉验收修复关闭重复名称抽屉后 sticky 错误覆盖列表的问题，并补充组件回归。

### 数据库变化

新增迁移 `20260714020000_category_module`：Category 改为账本作用域，新增颜色、模板版本和幂等字段；
迁移并重绑既有分类引用，为有效账本补齐默认分类；确定性迁移 ID 固定为合法 UUID v4/variant；新增模板/幂等/启用名称唯一约束、形态 CHECK、
查询索引、Entry/RecurringRule 复合归属外键及启用状态触发器。

### API 变化

实现分类查询、创建、更新、排序、启用和停用 6 个操作；列表返回分类级与集合级服务端能力。
OpenAPI/API_CONTRACT 从 72 扩展到 74 个批准操作并重新生成共享类型。

### 验证

- 四迁移空库回放、status、零 diff、25 模型 introspection、既有数据升级及迁移 UUID v4/variant、24 个关键索引、约束和并发：通过。
- 认证、情侣账本和分类 E2E：通过；分类覆盖默认初始化、OWNER/MEMBER/非成员、幂等、排序、启停和审计。
- 移动端 16 项 API/组件测试、类型检查和生产构建：通过。
- Chrome 150.0.7871.101 覆盖 320×800、375×812、480×900 日间/暗色；无横向溢出和小于 44px
  的可见交互控件，抽屉、确认、错误、长文本、重复提交与 MEMBER 权限通过。
- Windows 原生 Tab 从返回链接移动到账本选择器，Enter 成功切换收支类型；临时截图、脚本和浏览器目录已清理。
- PR #4 按预期 Head SHA `094588dae9b69c554f3edeb87a31372e9b1264be` 以 Squash merge 合入 main，
  功能提交为 `25dcad0a29951ba4269e318423d5ebbf301857b3`。
- main push CI Run `29298535552` 的 `quality`、`database`、`secret-scan` 全部成功，无失败或跳过步骤；
  Node.js 20 弃用 annotation 仅作为非阻断工具链提示记录。

### 闭环状态

- TASK-006 已正式关闭；下一项计划任务为 TASK-007，但尚未开始普通账目 API 或其他业务模块。

## 2026-07-14 / TASK-007

### 任务

实现普通账目后端 API、数据库约束、OpenAPI/共享类型和自动化验证，不包含客户端页面。

### 修改内容

- 新增 Entries Controller/Service/Repository，完成列表、创建、详情、修改和软删除五个既有操作。
- 实现个人/情侣 OWNER/MEMBER 权限、防枚举、服务端 `canEdit/canDelete` 和禁用操作者写保护。
- 创建以版本化规范载荷 SHA-256 `createRequestHash` 判断幂等；PATCH/DELETE 使用整数版本乐观锁。
- 普通 API 拒绝维护非 MANUAL 来源账目；软删除重试完整重验权限、来源和墓碑版本。
- 列表支持月份、类型、分类、创建人、备注关键词和分页，并返回最小创建人/分类摘要。

### 数据库变化

新增迁移 `20260714040000_entry_api`：受控支付方式枚举、Entry version、不可变创建请求哈希、
成员复合外键、有效创建人和哈希不可变触发器、备注/幂等/UUID/CHECK，以及四个
`WHERE deleted_at IS NULL` 查询部分索引。迁移只修复可证明合法的 OWNER 成员缺失，其他异常历史
归属 fail-closed；既有 Entry 使用 legacy hash 命名空间。

### API 变化

实现已批准的 5 个 Entry 操作，路径和 operationId 不变；OpenAPI 继续保持 74/74。PATCH body 必填
`expectedVersion`，DELETE 使用查询参数；新增具体 Entry、分页、删除响应和受控支付共享类型。

### 验证

- 五迁移空库回放、四迁移升级、合法 OWNER 修复、异常非 OWNER 拒绝、零 diff、25 模型 introspection：通过。
- 28 个关键索引、Entry 金额/版本/UUID/哈希/成员/分类/来源/支付/幂等约束与并发：通过。
- 认证、情侣账本、分类和 Entry E2E：通过；覆盖请求哈希重放、版本冲突、权限、来源和软删除。
- OpenAPI 74/74、35 项全仓测试、构建、依赖审计和完整质量门：通过。
- Compose 五服务健康；经 Nginx 完成注册、账本/分类查询、Entry 创建和列表真实链路；本机 Redis 恢复 PONG。

### 交付状态

- PR #6 按 Head SHA `aa9ea3bccc5d5bd48ed2bb5e98506d7e34df6be7` 以 Squash merge 合入 main，
  功能提交为 `f6e579957535ccb5ea4ce06d9d4bb8368d7c994c`。
- main push CI Run `29305065285` 的 `quality`、`database`、`secret-scan` 全部成功，无失败或跳过步骤；
  Node.js 20、Redis 版本和 `pg` 弃用提示仅作为非阻断工具链信息记录。
- TASK-007 已正式关闭；KI-006 仍未解决。下一项计划任务为 TASK-008，但尚未开始。

## 2026-07-15 / TASK-008

### 任务

实现移动端记账、明细列表和账目详情/编辑页面，复用 TASK-007 普通账目 API。

### 修改内容

- 新增账目 API 封装、整数分金额解析/格式化、业务日期和创建幂等键管理。
- 新增当前账本持久化、账本切换、底部导航和账目列表项组件。
- 实现 `/entries/new`、`/entries`、`/entries/:id`，覆盖创建、筛选分页、详情、编辑与删除。
- 创建防重复提交且同一表单重试复用幂等键；编辑和删除携带 `expectedVersion` 并处理版本冲突。
- 只按服务端 `canEdit/canDelete` 显示操作；非 `MANUAL` 来源保持只读。

### 数据库与 API 变化

无数据库、迁移或 API 契约变化；客户端直接使用 TASK-007 已批准接口。

### 验证

- 移动端 8 个测试文件、23 项测试通过；全仓 42 项测试通过。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 通过。
- 真实 Chromium 覆盖 320px、375px、480px 日间/夜间、长账本名、长成员名、长备注、响应式筛选、
  固定底栏遮挡和横向溢出；控制台无应用错误。

### 交付状态

- TASK-008 已在本地源码快照完成；当前工作区没有 `.git`，未形成提交、PR 或远端 CI 记录。
- 高保真稿仍未确认，页面遵循现有低保真、UI Token 与信息结构；下一项为 TASK-009 首页与统计。

## 2026-07-15 / TASK-009

### 任务

实现首页与基础统计后端、具体 API 契约、移动端页面和真实浏览器验收。

### 修改内容

- 新增 BR-STAT-001 至 004、AC-STAT-003 至 004 和 ADR-019，冻结月份、日均、零值趋势、分类与成员口径。
- 新增 Statistics Controller/Service/Repository/DTO/Module，聚合未软删除 Entry 并校验有效账本成员。
- 四个统计端点返回具体概览、完整逐日趋势、支出分类和成员支出 Schema；OpenAPI 保持 74/74。
- 新增 `/home`、`/statistics`、月度摘要卡与 ECharts 趋势图，共享账本持久化、URL 和月份。
- 首页仅展示已上线数据；工资、借贷、周期和攒钱模块未用静态数据伪装。
- ECharts 模块化按需注册，首页/统计路由懒加载，图表依赖隔离为非首屏块。

### 数据库变化

无迁移或 Schema 变化；统计使用既有 Entry 账本/业务日期索引，不引入缓存或汇总表。

### API 变化

实现既有四个统计操作；所有端点支持 `ledgerId + month`，非成员/失效账本按资源不可见处理，金额聚合在
`bigint` 中完成并经安全范围检查后返回整数分。

### 验证

- 全仓 53 项测试通过，其中移动端 28 项、API 10 项。
- format、lint、typecheck、OpenAPI lint/74 覆盖、共享类型生成和 build 通过。
- 320px、375px、480px Chromium 覆盖双主题、ECharts、长文本、空数据、无权限、44px 点击区和横向溢出。
- 手机主入口约 294 KB；图表依赖作为统计页懒加载块约 507 KB（gzip 172 KB），构建无告警。

### 交付状态

- TASK-009 已在本地源码快照完成；当前工作区没有 `.git` 和 Docker，未形成提交/PR/远端 CI，也未本地复跑数据库 E2E。
- 下一项 TASK-010 受 KI-006 来源业务删除策略约束。

## 2026-07-16 / TASK-010（实现完成，数据库验收待执行）

### 任务

实现本人私有借贷 CRUD、部分还款/收款、结清、逾期、处理幂等和可选普通账目联动，并落实负责人选择的
`1A 2A 3A 4A` 业务规则。

### 修改内容

- 新增 Debts Controller/Service/Repository/DTO/Module，提供既有 6 个借贷操作；列表分页、详情处理记录、
  服务端 `canEdit/canDelete`、本人私有防枚举和写限流已接入。
- 借贷创建和处理使用不可变 SHA-256 规范载荷哈希、用户/操作/幂等键与事务级锁；相同请求重放原结果，
  不同载荷冲突，部分处理、超额拒绝和最终结清在整数分中计算。
- `BORROWED` 处理同步个人支出、`LENT` 同步个人收入，使用启用的系统“其他”分类；Entry 来源固定为
  `DEBT_TRANSACTION + transactionId`，与处理记录和汇总更新同事务。
- 采用 ADR-020：存在同步账目时禁止删除借贷；无同步账目时借贷与未同步处理记录一起软删除。
- 同步记录 ADR-021 至 ADR-023：周期恢复不补期、短月发薪取月末、目标初始金额归创建者且完成状态可回退。

### 数据库与 API 变化

- 新增第六迁移 `20260716000000_debt_api`：Debt 创建幂等键/哈希、DebtTransaction 请求哈希、文本/状态约束、
  核心事实不可变触发器、未删除列表索引和借贷来源 Entry 延迟一致性触发器。
- OpenAPI 保持 74/74，CreateDebt 新增必填 `idempotencyKey`，Debt 响应补齐逾期天数、能力、时间和处理记录；
  共享类型已重新生成。

### 验证

- Prisma validate、format check、lint、typecheck、OpenAPI lint、74/74 覆盖、Compose 静态检查和 build 通过。
- 全仓 57 项单元/组件测试通过，其中 API 14 项；借贷黑盒 E2E 已覆盖隐私、创建/处理防重、并发重放、
  超额拒绝、部分处理、结清、两方向账目映射与 1A 删除策略。
- 当前机器无 Docker CLI、PostgreSQL、Redis 和 psql；`pnpm test:e2e` 在 Redis `ECONNREFUSED` 停止，
  因此迁移回放、数据库约束和隔离 E2E 仍待执行，任务未伪装为已完成。

### 交付状态

- 实现和非数据库质量门完成；恢复 Docker/PostgreSQL/Redis 后运行
  `pnpm prisma:migrate:test && pnpm test:e2e && pnpm verify`，全部通过后关闭 TASK-010 并开始 TASK-011。
- 当前源码快照没有 `.git`，无法形成提交、PR、diff 审查或远端 CI 记录。

## 2026-07-16 / 非 Docker 原生运行

### 修改内容

- 新增 `.env.native.example`、`native:check`、`native:migrate`、`dev:native` 和 `start:native`；PostgreSQL 与
  Redis/Valkey 可使用本机或云服务，不再强制要求 Docker。
- API、Worker 和 Prisma CLI 可从仓库根目录 `.env` 或 `SIYU_ENV_FILE` 加载配置，操作系统已有变量保持优先。
- 手机端和管理端 Vite 开发服务新增 `/api`、`/health` 代理，原生开发模式可使用相对 API 路径和 QQ 登录入口。
- 新增跨平台原生进程编排；开发同时启动 API、Worker 和两个 Vite 服务，生产同时启动编译后 API、Worker
  与 Node 静态网关。
- 原生网关提供手机端、`/admin/` SPA 静态服务，并将 `/api/`、`/health` 反向代理到 API；默认仅监听
  `127.0.0.1:8080`，正式部署继续由外层 Caddy/Nginx/EdgeOne 提供 HTTPS。
- 新增完整原生运行文档、systemd 示例、更新步骤和发布检查项，ADR-024 冻结 Docker 可选策略。

### 验证

- Node 脚本语法与原生配置检查通过；缺少服务时 `native:check` 明确指出不可连接端点并拒绝启动整组应用。
- 已构建产物下，原生网关实测 `/` 与 `/admin/` 返回 200；API 未运行时 `/health` 返回结构化 502。
- 原生运行新增 3 项自动测试；合并既有工作区测试后全仓 61 项通过，lint、typecheck、format 和 build 通过。
- 当前机器仍没有 PostgreSQL/Redis，因此尚不能用原生模式完成 TASK-010 数据库迁移与 E2E。

## 2026-07-17 / 全远端分支审计与 TASK-008 集成

- 核对全部 10 个远端分支及 8 个 PR；确认 TASK-000 已进入历史，TASK-004 至 TASK-007 无合并后遗留提交。
- 发现未独立提 PR 的 `task/TASK-008-entry-ui` 含有当前 `main` 缺失的完整组件化记账客户端，建立 `agent/integrate-all-branches` 集成分支。
- 合并 TASK-008 的生成类型请求层、401 单飞恢复、Abort 处理、精确金额工具、账本恢复、筛选分页、编辑删除交互、14 个公共组件和完整测试。
- 解决与 TASK-009 的路由、底部导航、首页最近账目和统计页面冲突；保留 TASK-010 借贷 API、数据库迁移及原生运行部署支持。
- 移动端 61 项、全仓 94 项测试通过；lint、typecheck、Prisma validate、OpenAPI 74/74、build、manifest 和 docs 检查通过。

## 2026-07-22 / TASK-008 至 TASK-010 闭环与 TASK-011 启动

### 任务

同步本地 `main`，以远程 PR/CI 事实正式关闭 TASK-008、TASK-009、TASK-010，并进入 TASK-011 借贷页面和统计。

### 修改内容

- 本地 `main` 快进到 `origin/main@2b4b384c7dcac23e58e2042f0a3f43ea79679277`。
- 核验 PR #8、PR #9 均已合并，且两个 PR 与最新 main push 的质量、数据库、秘密扫描全部通过。
- 修正任务清单、三个任务计划、当前状态、已知问题、发布历史和验证报告中的陈旧“待 PR/无 Git/待数据库”描述。
- 创建 `task/TASK-011-debt-ui` 与 TASK-011 ExecPlan，限定为现有 6 个借贷 API 的手机端实现，不新增迁移或后端契约。

### 数据库与 API 变化

无。TASK-010 的第六迁移和既有借贷 API 仅补充已完成的远程验证与关闭记录。

### 验证

- PR #8 CI Run `29568630493`：`quality`、`database`、`secret-scan` 通过。
- PR #9 CI Run `29571169599`：`quality`、`database`、`secret-scan` 通过。
- main push CI Run `29571310880`：`quality`、`database`、`secret-scan` 通过；包含 `test:e2e`、第六迁移部署和数据库约束脚本。

### 当前状态

TASK-008、TASK-009、TASK-010 正式关闭；TASK-011 进行中。

## 2026-07-22 / TASK-011 借贷页面和统计本地交付候选

### 修改内容

- 新增类型化借贷请求层和完整分页/详情汇总；统计包含总负债、总待收、本月已还/已收、从今天起 7 个自然日
  到期和服务端逾期事实，读取不完整时拒绝展示部分结果。
- 新增 `/debts`、`/debts/new`、`/debts/:id` 页面、三个借贷业务组件和账号/个人首页入口；情侣首页不呈现
  个人借贷数据。
- 完成借贷新增、详情编辑、二次确认删除、部分还款/收款、可选同步普通账目、快速重复提交防护、稳定幂等键、
  超额处理预防和服务端错误映射。
- 补充 BR-DEBT-011 至 012、AC-DEBT-010 至 011、页面规格、组件清单、候选发布记录和浏览器验收截图。
- 质量门发现 OpenAPI/Prisma 工具链 3 个可修补传递依赖公告；通过补丁版本覆盖更新
  `@hono/node-server`、`fast-uri`、`js-yaml` 和锁文件，未增加直接或生产依赖。

### 数据库与 API 变化

无数据库迁移、后端 API、OpenAPI 或生产依赖变化；只消费 TASK-010 的既有契约和生成类型。

### 验证

- Node.js 24.18.0 下，TASK-011 借贷工具/页面及首页回归定向 3 个文件 9 项、全仓 99 项和隔离数据库
  API E2E 通过。
- Google Chrome Headless/CDP 覆盖 320px、375px、480px，日间/暗色、空、网络失败、404、长文本；页面无
  横向溢出，所有可见交互区不小于 44px。
- format、lint、typecheck、Prisma validate、OpenAPI 74/74、Compose、build、docs 和差异检查通过；依赖审计
  从 3 个公告修复到无已知漏洞。

### 当前状态

TASK-011 本地实现与浏览器验收完成，仍待提交、PR 和远程 CI；未正式关闭，也未开始 TASK-012 实现。

## 2026-07-22 / TASK-011 正式关闭

### 关闭证据

- 功能提交 `f5f012f04868bab29e5d21d191ab9e2731b59ba8` 已推送并经 PR #10 合入 `main`；合并提交为
  `9bbc560622761fc9e0dc74807e2b85e0366246ad`。
- PR CI Run `29889775437` 与 main push CI Run `29889890113` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含全仓质量门、隔离数据库迁移/E2E 和秘密扫描。
- 项目状态、任务清单、发布历史、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-011 正式关闭；下一项为 TASK-012 周期规则和实例，开始前先冻结 KI-009 剩余业务口径并建立 ExecPlan。

## 2026-07-22 / TASK-012 周期规则和实例本地交付候选

### 修改内容

- 新增周期规则与实例 Controller/Service/Repository/DTO/Module，实现规则列表、创建、详情、修改、暂停、
  恢复、软删除，以及实例列表、确认入账和跳过。
- 实现以开始日期为锚的月度/年度算法，覆盖 29 至 31 日短月、闰日恢复、间隔、固定期数和恢复不补期。
- 新增 Worker 可复用的到期物化入口；自动账目、实例、规则进度和审计同事务提交，失败实例记录错误、
  尝试次数与最后时间，并在原实例上安全重试。
- 创建与确认分别使用不可变请求哈希、用户/操作幂等键和事务级锁；确认金额只覆盖当前实例，跳过不入账。
- 个人/情侣成员可创建和查看，创建人可写，账本 OWNER 可管理全部；非成员、退出成员、失效用户和解散账本
  在查询、写入和执行时重新校验。
- 补充 BR-RECUR-011 至 016、AC-RECUR-010 至 014、ADR-025，并解决 KI-009。

### 数据库与 API 变化

- 新增第七迁移 `20260722040000_recurring_rules`：周期规则创建幂等事实、确认操作者/幂等事实、活动创建人
  归属、状态/日期/文本约束、查询索引、失败记录、计划与终态不可变触发器，以及周期实例/来源账目的
  双向延迟一致性和即时防篡改触发器。
- OpenAPI 保持 74/74；10 个既有周期操作补齐具体请求、响应、能力和错误契约，共享类型重新生成。
- 普通 Entry API 行为不变，仍拒绝修改或删除 `RECURRING_RUN` 来源账目。

### 验证

- Node.js 24.18.0 下 format、lint、typecheck、103 项全仓测试、Prisma validate、OpenAPI lint/74 覆盖、
  Compose、原生配置、生产构建和 `pnpm audit --audit-level moderate` 全部通过。
- 七迁移空库与历史升级、status、零 diff、25 模型 introspection、34 个关键索引、56 个约束、13 个删除策略、
  来源双向一致性和并发幂等验证通过。
- 隔离 PostgreSQL API E2E 覆盖周期创建重放/冲突、权限、并发自动生成、固定期数、确认并发、跳过、
  分类停用失败、失败实例计划锁定、恢复后原位重试和情侣 OWNER/MEMBER 权限。

### 当前状态

TASK-012 已完成本地交付候选；待提交、PR 与远程 CI，尚未正式关闭。TASK-013 未开始。

## 2026-07-22 / TASK-012 正式关闭

### 关闭证据

- 功能提交 `558fdb84c0b61352f8725048faf4556fc3b02be6` 已推送并经 PR #12 合入 `main`；合并提交为
  `0181f2e98effb23bc5c9e5e29a3415784db51ca4`。
- PR CI Run `29894967989` 与 main push CI Run `29895072247` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含全仓质量门、第七迁移/数据库约束、隔离 E2E 和秘密扫描。

### 当前状态

TASK-012 正式关闭；下一项为 TASK-013 BullMQ Worker 与幂等。

## 2026-07-22 / TASK-013 BullMQ Worker 与幂等本地交付候选

### 修改内容

- 新增 `siyu-recurring-due` 队列、固定 Job Scheduler、启动扫描和 `scan` / `materialize` 两类任务；扫描按
  UUID 游标分页并按规则创建人当前时区判断业务日期。
- 物化 Job ID 固定为规则 ID 与计划日；消费时在领域锁内复核计划日仍为当前 `nextRunDate`，旧任务安全跳过。
- Worker 通过 Nest 应用上下文复用 `RecurringService`，临时错误最多 5 次指数退避，业务状态错误使用
  BullMQ 不可恢复失败；启动、扫描、执行、停滞、失败和关闭均输出脱敏结构化日志。
- 确认实例在同一事务中通知规则创建人与情侣账本 OWNER；新增第八迁移和条件唯一索引，重试不重复通知。
- Compose、原生环境样例和后台任务/部署文档新增扫描间隔、分页、并发、重试和退避配置。
- 修复 GitHub `quality` 作业缺少 PostgreSQL 导致 E2E 仅执行健康检查的既有缺口；CI 现先部署八次迁移，再
  使用 PostgreSQL 17 + Redis 7 运行完整 API/Worker 黑盒流程。

### 数据库与 API 变化

- 新增 `20260722060000_recurring_worker_notifications`，包含通知查询索引和周期待确认通知条件唯一索引。
- 公开 REST API 与 OpenAPI 74 个操作保持不变；周期 Worker 只调用内部领域入口。

### 验证

- Node.js 24.18.0 下 format、lint、typecheck、113 项全仓测试、生产构建、Prisma validate、OpenAPI 74/74、
  Compose、原生配置与依赖审计通过。
- 八迁移空库/历史升级、status、零 diff、25 模型 introspection、36 个关键索引、56 个约束、13 个删除策略和
  周期待确认通知唯一性通过。
- 隔离 PostgreSQL 17 + Redis 7.4 完整 E2E 通过，覆盖 Job Scheduler、两个并行 Worker、稳定 Job ID、自动
  入账、确认通知、情侣通知接收人、旧任务跳过、最终失败和失败任务重复扫描。

### 当前状态

TASK-013 已完成本地交付候选，待提交、PR、远程 CI、合并和 main CI；尚未正式关闭，TASK-014 未开始。

## 2026-07-22 / TASK-013 正式关闭

### 关闭证据

- 实现提交 `ba136bad896e0dd6d065df83626a0801cf93c27f`、CI 提交
  `b6f6718eba13e5181ab1e3b2430a2bc7e21407a7` 与交付头 `830a9592da5ed9043208d88e1c5877c7c69d2b06`
  已推送并经 PR #14 合入 `main`；合并提交为 `72633ac7a478c01012a9ded7e41e8390b50a876a`。
- PR CI Run `29898941240` 与 main push CI Run `29899089545` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含八迁移、数据库约束、完整 PostgreSQL/Redis Worker E2E 和秘密扫描。
- 项目状态、任务清单、发布历史、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-013 正式关闭；下一项为 TASK-014 周期记账页面。

## 2026-07-22 / TASK-014 周期记账页面本地交付候选

### 修改内容

- 新增移动端 `/recurring`、`/recurring/new`、`/recurring/:id`，覆盖账本切换、规则与实例完整分页、创建、
  详情、编辑、暂停、恢复、二次确认删除、待确认金额入账和二次确认跳过。
- 新增类型化周期客户端、`RecurringRuleCard`、`RecurringRunCard` 与创建/编辑共享表单；账户页提供可发现入口。
- 创建和每个实例确认分别复用稳定幂等键，快速重复点击只发送一次有效写请求；所有能力来自服务端字段。
- 规则金额使用整数分，日期使用业务日期字符串；不根据局部分页伪造“本月固定支出”。
- 修复真实浏览器验收发现的长表单粘性提交按钮遮挡，提交按钮改回普通文档流。

### 数据库与 API 变化

- 无数据库、迁移、公开 API、Worker、通知事实或生产依赖变化；仅消费 TASK-012 已批准契约。

### 验证

- Node.js 24.18.0 下移动端 24 个测试文件 72 项通过；周期定向 2 个文件 6 项覆盖完整分页、账本边界、
  编码路径、标签、稳定幂等键、重复提交和服务端能力字段。
- `vue-tsc --noEmit`、根目录 `pnpm lint`、`pnpm format:check` 与 `git diff --check` 通过。
- Node.js 24.18.0 全仓 119 项测试、隔离 PostgreSQL 17 / Redis 7 完整 E2E、生产构建、Prisma、OpenAPI
  74/74、Compose、文档、清单和依赖审计通过。
- 真实 Chrome Headless/CDP 覆盖 320px、375px、480px、日间/暗色、正常、空、网络失败、404、长文本、
  创建顶端/底部、详情和确认抽屉；无横向溢出、小点击区或意外运行时异常。

### 当前状态

TASK-014 已完成本地交付候选；待提交、PR、远程 CI、合并和 main CI，尚未正式关闭。

## 2026-07-22 / TASK-014 正式关闭

### 关闭证据

- 功能提交 `b64a5a05c4744d50636d1c14a1d438a34e9283f3` 已推送并经 PR #16 合入 `main`；合并提交为
  `7bf30e48322caf5a32bcf044548ebbac7d5faa55`。
- PR CI Run `29903360052` 与 main push CI Run `29903511196` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含完整质量门、八迁移/数据库约束、PostgreSQL/Redis E2E 和秘密扫描。
- 项目状态、任务清单、发布历史、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-014 正式关闭，M5 完成；下一项为 TASK-015 工资档案和月度记录。

## 2026-07-22 / TASK-015 工资档案和月度记录本地交付候选

### 修改内容

- 新增本人私有 SalaryModule，提供工资档案列表、创建、更新，以及月度记录列表、创建、详情和未到账更新。
- 工资档案保存独立默认项目模板；MVP 一人一个有效档案，模板项目金额可为零且不回写历史月度记录。
- 月度创建支持显式正数项目或严格复制同档案紧邻上月；服务端按项目计算应发、个人扣除和实发。
- 档案和月度创建使用规范载荷 SHA-256、用户级幂等键和事务锁；相同请求重放，不同载荷冲突。
- 所有查询固定本人归属，跨用户 ID 返回不可见；已到账记录的金额、月份和项目由服务与数据库共同锁定。
- 冻结 TASK-017 固定支出口径为工资周期内个人账本 `EXPENSE + RECURRING_RUN` 的有效普通账目，解决 KI-010。

### 数据库与 API 变化

- 新增第九迁移 `20260722100000_salary_records`：`salary_profile_items`、创建幂等事实、单有效档案、项目代码
  唯一、文本/金额边界、查询索引、事务提交时明细汇总一致性、创建事实和已到账记录不可变触发器。
- OpenAPI 仍覆盖 74/74；前 7 个工资操作补齐具体请求、响应、分页、能力和错误契约，共享类型已重新生成。
- 工资到账、收入 Entry 联动、工资余额与年度统计仍分别留给 TASK-016 和 TASK-017。

### 验证

- Node.js 24.18.0 下全仓 `pnpm verify`、123 项测试、真实 PostgreSQL E2E、生产构建、文档、清单、差异
  检查和依赖审计通过；OpenAPI 保持 74/74。
- 九迁移空库部署、status、零 diff、26 模型 introspection、43 个关键索引、62 个自定义约束、14 个删除策略和
  数据库约束脚本通过。
- 隔离 PostgreSQL 完整 API/Worker E2E 通过，覆盖创建重放/冲突、单有效档案、本人隔离、同月唯一、相邻
  月份复制、汇总更新和已到账不可修改。宿主 Redis 6.0.16 仅有最低 6.2 提示，生产基线仍为 Redis 7.4。

### 当前状态

TASK-015 已完成本地交付候选与完整质量门；待提交、PR、远程 CI、合并和 main CI，尚未正式关闭。

## 2026-07-22 / TASK-015 正式关闭

### 关闭证据

- 功能提交 `243f2bf6a546f2fc4a6379fb4967fb71ed5ef52f` 已推送并经 PR #18 Squash merge 合入
  `main`；合并提交为 `8d3bb4f012a4e4c275e3f96d2ebc54c39ceb6fe4`。
- PR CI Run `29907066496` 与 main push CI Run `29907257057` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含九迁移、数据库约束、完整 PostgreSQL/Redis E2E 和秘密扫描。
- 项目状态、任务清单、发布历史、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-015 正式关闭；下一项为 TASK-016 工资到账与收入联动。

## 2026-07-22 / TASK-016 工资到账与收入联动本地交付候选

### 修改内容

- 实现 `POST /salary/records/:id/mark-paid`，请求显式提交到账业务日期、是否同步收入和到账专用幂等键。
- 相同用户和幂等键的同载荷请求重放原结果；同键不同记录、日期或同步选项返回幂等冲突，其他键重复确认
  返回已到账冲突。记录锁、幂等唯一索引和来源唯一索引覆盖并发重复提交。
- `syncEntry=false` 仅确认到账；`syncEntry=true` 在本人有效个人账本的 `income.salary` 分类生成唯一
  `INCOME + SALARY` 来源明细，金额和业务日期分别等于实发工资与到账日。
- 到账状态、来源收入、幂等事实和脱敏审计同事务提交；同步条件不可用或任一步失败时整体回滚。跨用户工资
  和来源明细仍统一按资源不可见处理。

### 数据库与 API 变化

- 新增第十迁移 `20260722120000_salary_mark_paid`：到账幂等键/请求哈希、用户级唯一索引、状态一致性 CHECK、
  工资与来源收入双向延迟约束、到账与来源财务事实不可变触发器，以及来源 Entry `RESTRICT` 删除策略。
- 对迁移前已到账记录回填确定性内部幂等事实；迁移前检查既有工资来源关联，异常数据 fail-closed。
- OpenAPI 仍覆盖 74/74，到账端点改为具体工资记录响应并补齐 400/401/403/404/409/429 契约，共享类型已生成。
- 新增 BR-SALARY-019 至 020、AC-SALARY-018 至 019 和 ADR-028。

### 验证

- Node.js 24.18.0 全仓 `pnpm verify` 与 125 项测试通过；第十迁移空库部署、Prisma status/零 diff、26 模型 introspection、44 个关键索引、
  65 个自定义约束、14 个删除策略和数据库约束脚本通过。
- 隔离 PostgreSQL 完整 API/Worker E2E 通过，覆盖无同步到账、同步收入、同键重放/冲突、并发去重、分类
  不可用回滚、本人隔离、来源只读和审计。宿主 Redis 6.0.16 只有非阻断最低版本提示；依赖审计无已知漏洞。

### 当前状态

TASK-016 已完成本地交付候选与全部质量门；待提交、PR、远程 CI、合并和 main CI，尚未正式关闭。

## 2026-07-22 / TASK-016 正式关闭

### 关闭证据

- 功能提交 `4b7222a649a72d9b60efc526e1bde8c72fc6b288` 已推送并经 PR #20 Squash merge 合入
  `main`；合并提交为 `4cfbd26ed24c42438ede27f57afef3a8c180e011`。
- PR CI Run `29912892385` 与 main push CI Run `29913079247` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含十迁移、数据库约束、完整 PostgreSQL/Redis E2E 和秘密扫描。
- 项目状态、任务清单、发布历史、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-016 正式关闭；下一项为 TASK-017 工资余额与年度统计。

## 2026-07-22 / TASK-017 工资余额与年度统计本地交付候选

### 修改内容

- 实现 `GET /salary/summary/:year`，按工资月份聚合本人全年所有有效工资记录，返回累计应发、扣除、实发、
  存在记录月份的月均实发、奖金/养老/医疗/失业/公积金/个税专项累计和完整 12 个月零值趋势。
- 实现 `GET /salary/balance`，按用户时区选择到账日不晚于今天的最近已到账工资，并用档案发薪日计算下一
  自然月预计发薪日；29–31 日在短月取月末，周期为到账日含、下一发薪日不含。
- 工资余额只聚合本人有效个人账本周期内未删除支出；`RECURRING_RUN` 计为固定支出，其他来源计为日常
  支出。剩余金额可为负，剩余天数不小于零，零天不返回伪造的每日可用金额。
- 年度和余额查询均保持本人私有，情侣账本和其他用户数据不进入聚合；所有金额使用整数分并检查安全整数
  边界，响应显式声明结果不是官方社保、医保、公积金或个税账户余额。

### 数据库与 API 变化

- 无数据库 Schema、迁移、写行为或生产依赖变化；只读聚合既有工资、工资项目、个人账本和账目事实。
- 两个既有预留操作由通用统计响应细化为 `SalaryAnnualSummary`、`SalaryMonthlySummary` 和
  `SalaryBalance` 精确 Schema，共享 OpenAPI 类型已重新生成，覆盖保持 74/74。
- 新增 BR-SALARY-021 至 023、AC-SALARY-020 至 022 和 ADR-029，固化工资月份、到账日期、业务日期、
  项目代码、工资周期、支出来源和隐私边界。

### 验证

- Node.js 24.18.0 下全仓 130 项测试通过；format、lint、typecheck、Prisma validate、OpenAPI 74/74、
  Compose、生产构建、差异检查和依赖审计通过。
- 十迁移空库/历史回放、Prisma status/零 diff、26 模型 introspection、44 个关键索引、65 个自定义约束、
  14 个删除策略和数据库约束脚本通过；本任务无新迁移。
- 隔离 PostgreSQL 完整 API/Worker E2E 通过，覆盖年度累计、12 月零值、记录月份月均、专项代码、最近到账
  周期、固定/日常支出拆分、情侣账本排除、负余额、零剩余天数和跨用户空态。宿主 Redis 6.0.16 仅有
  最低 6.2 的非阻断提示，Compose/CI 基线仍为 Redis 7.4。

### 当前状态

TASK-017 已完成本地交付候选与全部质量门；待提交、PR、远程 CI、合并和 main CI，尚未正式关闭。

## 2026-07-22 / TASK-017 正式关闭

### 关闭证据

- 功能提交 `23420de1a434b0a3b299b90e2438b991bc30bfb7` 已推送并经 PR #22 Squash merge 合入
  `main`；合并提交为 `e972fe54c6228ff6079494f10b32a38fc50415af`。
- PR CI Run `29917586181` 与 main push CI Run `29917758079` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含十迁移、数据库约束、完整 PostgreSQL/Redis E2E 和秘密扫描。
- 项目状态、任务清单、发布历史、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-017 正式关闭；下一项为 TASK-018 工资页面。

## 2026-07-22 / TASK-018 工资页面本地交付候选

### 修改内容

- 新增工资类型化客户端，完整读取年度记录分页，并提供安全整数分格式、元分转换、月份路由和工资项目校验。
- 新增工资余额卡、工资项目编辑器和按需 ECharts 年度趋势组件；工资首页支持首次档案设置、档案更新、当前
  周期余额、当前月记录和年度汇总。
- 新增月度工资页，支持从模板显式创建、服务端复制紧邻上月、未到账编辑、到账二次确认、可选同步个人收入
  和已到账事实只读；档案、记录、到账分别使用失败重试稳定幂等键。
- 新增年度工资页，展示服务端完整 12 月实发趋势、应发/扣除/月均、奖金、养老/医疗/失业保险、住房公积金
  和个人所得税，并固定提示数据不代表官方账户余额。
- 接入 `/salary`、`/salary/:year/:month`、`/salary/year/:year` 和账号入口；新增 AC-SALARY-023 至 025、
  页面规格、组件清单、测试策略、ExecPlan、项目记忆和 13 张真浏览器验收截图。

### 数据库与 API 变化

- 无数据库 Schema、迁移、公开 API、Worker、统计口径或生产依赖变化；只消费 TASK-015 至 TASK-017 已批准契约。
- 工资数据保持本人私有，不进入情侣账本页面或情侣统计。

### 验证

- Node.js 24.18.0 下全仓 `pnpm verify` 和 140 项测试通过；format、lint、typecheck、Prisma validate、
  OpenAPI 74/74、Compose、生产构建、文档、清单和差异检查通过。
- 十迁移空库/历史回放、Prisma status/零 diff、数据库约束脚本与隔离 PostgreSQL 完整 API/Worker E2E 通过；
  宿主 Redis 6.0.16 只有非阻断最低版本提示，Compose/CI 使用 Redis 7.4。
- `pnpm audit --audit-level moderate` 无已知漏洞。Google Chrome Headless/CDP 的 13 个工资场景覆盖
  320px、375px、480px、日间/暗色、长文本、空态、错误、档案、编辑、到账确认和年度趋势，均无横向溢出
  或小于 44px 的可见交互区。

### 当前状态

TASK-018 已完成本地交付候选与全部质量门；待提交、PR、远程 CI、合并和 main CI，尚未正式关闭。

## 2026-07-22 / TASK-018 正式关闭

### 关闭证据

- 功能提交 `315079a2a807d97c76b07edeb9e7bc2a2cfd366a` 已推送并经 PR #24 Squash merge 合入
  `main`；合并提交为 `2967c588b1d0d923f8ec2f6e36acc95c6270a579`。
- PR CI Run `29922038043` 与 main push CI Run `29922213012` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含十迁移、数据库约束、完整 PostgreSQL/Redis E2E、构建、审计和秘密扫描。
- 项目状态、任务清单、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-018 正式关闭，M6 完成；下一项为 TASK-019 攒钱目标 API。

## 2026-07-22 / TASK-019 攒钱目标 API 本地交付候选

### 修改内容

- 新增攒钱目标模块，完成目标列表、创建、详情、更新、软删除和本人存入记录的创建、更新、软删除。
- 返回初始金额归创建者的成员汇总、有效存入明细、整数万分比进度及目标/存入服务端能力字段。
- 创建目标和存入使用稳定幂等键与不可变请求哈希；目标级事务锁串行化并发写入并从事实重算汇总。
- 补齐 BR-SAVING-009 至 013、AC-SAVING-008 至 011、权限、安全、数据库、API、OpenAPI 和测试文档。

### 数据库与 API 变化

- 新增第十一迁移，为目标和存入补齐创建哈希、成员复合归属、活动成员触发器、创建事实不可变、金额/文本/
  状态 CHECK、三个关键索引和目标汇总/完成状态延迟一致性约束。
- 实现既有 8 个 `/saving-goals` 操作，细化目标摘要/详情、成员贡献、存入和删除响应 Schema；OpenAPI 保持
  74/74，生成共享类型已同步。
- 非成员、退出成员和已解散账本统一不可见；目标更新/删除只允许账本 OWNER，存入更新/删除只允许记录本人。

### 验证

- 第十一迁移空库/历史升级、重复部署、Prisma status/零 diff/introspection 和数据库约束脚本通过。
- 隔离 PostgreSQL 完整 API/Worker E2E 通过，覆盖创建重放/冲突、个人与情侣权限、并发存入、贡献归属、
  完成回退、软删除留痕、成员退出隔离和账本解散。
- API 11 个测试文件 44 项通过；Node.js 24.18.0 全仓 `pnpm verify` 与 144 项测试通过。

### 当前状态

TASK-019 已完成本地交付候选；待提交、PR、远程 CI、合并和 main CI 后正式关闭。

## 2026-07-22 / TASK-019 正式关闭

### 关闭证据

- 功能提交 `37ac11c9f2ff91b73af07fb0dd6b85f98572d28f` 已推送并经 PR #26 Squash merge 合入
  `main`；合并提交为 `a04bbef97dfe1cb35527b6e6d3f2cca46db74964`。
- PR CI Run `29929382178` 与 main push CI Run `29929562773` 的 `quality`、`database`、
  `secret-scan` 全部通过；包含 11 个迁移、数据库约束、完整 PostgreSQL/Redis E2E、构建、审计和秘密扫描。
- 项目状态、任务清单、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-019 正式关闭；下一项为 TASK-020 攒钱目标页面。

## 2026-07-22 / TASK-020 攒钱目标页面本地交付候选

### 修改内容

- 新增类型化攒钱客户端，完整读取目标分页，提供精确元分、整数分格式和整数万分比展示工具。
- 新增 `SavingGoalCard`、`SavingGoalForm` 及 `/saving-goals`、`/saving-goals/new`、
  `/saving-goals/:id` 三条受保护路由，账号页新增攒钱入口。
- 实现个人/朝暮同笺账本选择与 URL/本地恢复、目标创建、OWNER 编辑/删除、本人存入新增/编辑/删除、
  成员贡献、长文本、加载、空、网络错误、只读和资源不可见状态。
- 目标与存入创建分别维护失败重试前稳定幂等键，快速重复提交由 busy 门禁拦截；所有操作成功后重新读取
  服务端详情，只消费 `canManage/canContribute/canEdit/canDelete`，不在客户端复制权限或增量重算汇总。
- 新增 AC-SAVING-012 至 014、页面规格、组件清单、测试策略、ExecPlan 和 13 张真浏览器验收截图。

### 数据库与 API 变化

- 无数据库 Schema、迁移、公开 API、Worker、通知、普通账目或生产依赖变化；只消费 TASK-019 已批准契约。
- 目标和存入仍由服务端保证成员隔离、事务重算、幂等、软删除和历史留痕。

### 验证

- Node.js 24.18.0 定向 2 个测试文件 10 项、移动端 28 个文件 92 项、移动端 typecheck 和全仓 lint 通过。
- 首次移动端全量压力执行中既有周期快速提交用例单次未发出请求；单独复跑 3/3 及最终完整 92 项复跑均通过，
  未删除、跳过或弱化该测试。
- Google Chrome Headless/CDP 13 个场景覆盖 320px、375px、480px、日间/暗色、正常、加载、空、网络失败、
  新建、详情、只读、资源不可见、长文本和刷新恢复；均无横向溢出或小于 44px 的可见交互区。
- 浏览器验收发现并修复首次账本选择、URL 同步和列表请求之间的加载/空态竞态；复验 13/13 通过。
- Node.js 24.18.0 全仓 `pnpm verify` 与 153 项测试通过；format、lint、typecheck、Prisma validate、OpenAPI
  74/74、Compose、生产构建、文档、清单和差异检查全部通过。
- 隔离 PostgreSQL 17 确认 11 个迁移无待应用，完整 API/Worker E2E 覆盖全部既有业务并通过；宿主 Redis
  6.0.16 仅有非阻断最低版本提示，Compose/CI 使用 Redis 7.4。依赖审计无已知漏洞。

### 当前状态

TASK-020 已完成本地开发与视觉验收；待最终全量质量门、提交、PR、远程 CI、合并和 main CI 后正式关闭。

## 2026-07-22 / TASK-020 正式关闭

### 关闭证据

- 功能提交 `f1e69b99c716cfbc9b0b48aba5c0694799d282fb` 已推送并经 PR #28 Squash merge 合入
  `main`；合并提交为 `4f88b8b20fec2b0790ebd84f5d863ae6cdf95a34`。
- PR CI Run `29937823275` 与 main push CI Run `29938160014` 的 `quality`、`database`、
  `secret-scan` 全部通过；两轮均覆盖迁移、完整 PostgreSQL/Redis E2E、构建、依赖审计和秘密扫描。
- PR CI 首次尝试在项目代码执行前因托管 runner 的 PostgreSQL 宿主端口 `55432` 瞬时占用失败；同一 Run
  重跑后容器初始化及所有项目门禁通过，未因此修改或弱化仓库代码、工作流或测试。
- 项目状态、任务清单、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-020 正式关闭，M7 完成；下一项为 TASK-021 站内通知。

## 2026-07-22 / TASK-021 站内通知本地交付候选

### 修改内容

- 新增本人通知稳定分页、全局未读数和批量已读 API；未知、他人和已读 ID 不泄露存在性，首次已读时间不覆盖。
- 新增 `/notifications` 消息中心、`NotificationItem`、账号入口、单条/全部已读、超过 100 条分批和异常态。
- 当前只消费 TASK-013 的周期待确认通知；已批准关联入口仍会在目标页面重新授权，未知类型安全回退。
- 新增 BR-NOTIFY-003 至 006、AC-NOTIFY-002 至 004、ADR-030、精确 OpenAPI/共享类型、测试与 11 张截图。

### 数据库与 API 变化

- 实现既有 `GET /notifications` 与 `POST /notifications/read`；列表返回稳定分页、关联字段和未读总数，已读
  返回本次新标记数与剩余未读数。
- 无数据库 Schema 或迁移变化，不新增通知生产类型、Worker 行为、生产依赖、邮件、短信、Push 或偏好设置。

### 验证

- Node.js 24.18.0 标准 `pnpm verify` 与共 164 项测试通过；移动端 30 个文件 99 项，API 12 个文件 47 项。
- 11 个迁移、Prisma 零差异和数据库约束通过；隔离 PostgreSQL/Redis 完整 API/Worker E2E 通过。
- Chrome Headless/CDP 11 个三尺寸、双主题和异常态场景无横向溢出或小于 44px 的交互区。
- OpenAPI 74/74、生产构建、文档、清单、差异检查和依赖审计通过，无已知漏洞。

### 当前状态

TASK-021 已完成本地交付候选；待提交、PR、远程 CI、合并和 main CI 后正式关闭。

## 2026-07-22 / TASK-021 正式关闭

### 关闭证据

- 功能提交 `1e9b6582951ef33fd8970f6bb746b4d6bb688783` 已推送并经 PR #30 Squash merge 合入
  `main`；合并提交为 `1b87e87c45af5fa5e361374719f6f0b70c8b886a`。
- PR CI Run `29943627794` 与 main push CI Run `29943823960` 的 `quality`、`database`、
  `secret-scan` 全部通过；两轮均覆盖迁移、完整 PostgreSQL/Redis E2E、构建、依赖审计和秘密扫描。
- 项目状态、任务清单、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-021 正式关闭；下一项为 TASK-022 最小管理后台。

## 2026-07-23 / TASK-022 最小管理后台本地交付候选

### 修改内容

- 新增运行概览、脱敏用户状态、账本成员关系、周期任务状态/FAILED 人工重试和脱敏审计查询 API。
- 新增七个 ADMIN 细粒度权限；用户停用原子撤销 Session/Refresh Token，禁止当前管理员停用自己。
- 管理端替换占位页，交付概览、用户、关系、任务与审计五个视图，以及用户状态和人工重试理由确认。
- 新增 BR-ADMIN-001 至 008、AC-ADMIN-002 至 007、ADR-031、OpenAPI 81/81 和真实数据库 E2E。

### 边界与验证

- 不返回账目、工资、借贷、攒钱金额，不提供财务编辑；审计响应不含 IP 哈希与 before/after 内容。
- 公告、反馈、上传和异步导出仍无批准模型，本任务没有以通用字段或假数据实现。
- Node.js 24.18.0 `pnpm verify` 与 164 项全仓测试通过；API 47 项、管理端 2 项、管理端生产构建、第十二迁移回放与完整 PostgreSQL/Redis E2E 通过，依赖审计无已知漏洞。
- WSL 当前禁用 Windows 可执行互操作，Chrome CLI 与插件运行接口均不可用；未伪造真浏览器截图，三尺寸、
  双主题视觉矩阵留待可用浏览器环境补跑。

## 2026-07-23 / TASK-022 正式关闭

### 关闭证据

- 功能提交 `042682665adbc2194a92dc4bb58a40ec206987f7` 与生成类型修正
  `7e0dbd3e72225244bbbd6d5c21674db84187e1f1` 已推送并经 PR #32 Squash merge 合入 `main`；合并提交为
  `0a91f7adf82ea8a790340885d76079dcaa88cee9`。
- 首轮 PR CI 精确发现 OpenAPI 429 响应新增后共享生成类型未同步；补齐生成产物后，PR CI Run
  `29968254365` 与 main push CI Run `29968379326` 的 `quality`、`database`、`secret-scan` 全部通过。
- 两轮通过的质量任务均覆盖 12 个迁移、数据库约束、完整 PostgreSQL/Redis E2E、构建、依赖审计和秘密扫描。
- 项目状态、任务清单、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-022 正式关闭；下一项为 TASK-023 CSV 导出。

## 2026-07-23 / TASK-023 CSV 导出本地交付候选

### 修改内容

- 新增当前用户可见账本账目与本人工资的同步 CSV API，包含稳定排序、本人/有效成员隔离、软删除排除和安全审计。
- CSV 使用 UTF-8 BOM、CRLF、整数分精确两位元输出、公式注入防护、10000 行硬上限及每用户每类限流。
- 新增 `/exports` 移动端页面、账号入口、账本/日期与年份选择、会话恢复、实际 Blob 下载及完整状态反馈。
- 冻结 BR-EXPORT-003 至 006、AC-EXPORT-002 至 004、ADR-032、精确 OpenAPI 81/81 与共享生成类型。

### 边界与验证

- 无数据库 Schema 或迁移变化；不实现异步任务、对象存储、邮件、借贷/目标导出、其他用户工资或生产依赖。
- Node.js 24.18.0 全仓 `pnpm verify` 与 172 项测试通过；移动端 104 项、API 50 项，OpenAPI 81/81、
  Prisma、Compose、完整 PostgreSQL/Redis E2E、生产构建、文档、清单和差异检查通过，依赖审计无已知漏洞。
- 真实 Chrome 使用实际 API 和 Blob 下载覆盖 320px、375px、480px、日间/暗色及网络失败，无溢出、小点击区
  或运行时错误。

### 当前状态

TASK-023 已完成本地交付候选；待提交、PR、远程 CI、合并和 main CI 后正式关闭。

## 2026-07-23 / TASK-023 正式关闭

### 关闭证据

- 功能提交 `5ac941e546aee86c19c2d207265b68af8ce6ad25` 已推送并经 PR #34 Squash merge 合入
  `main`；合并提交为 `306a6ad513099e11e3215fcbcfca89483085cee9`。
- PR CI Run `29970521966` 与 main push CI Run `29970632424` 的 `quality`、`database`、
  `secret-scan` 全部通过；两轮均覆盖迁移部署、完整 PostgreSQL/Redis E2E、构建、依赖审计和秘密扫描。
- 项目状态、任务清单、验证报告、已知问题和 ExecPlan 已同步为正式关闭状态。

### 当前状态

TASK-023 正式关闭；下一项为 TASK-024 权限与安全审计。
