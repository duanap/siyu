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
