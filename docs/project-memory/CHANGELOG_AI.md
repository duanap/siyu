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

- TASK-007 任务分支达到本地完成定义，尚未创建 PR 或合入 main。
- 未实现 TASK-008 页面、统计或任何来源业务流程。
