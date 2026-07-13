# TASK-004：身份认证与用户基础能力

状态：已完成

## 目标

在 TASK-000 工程与数据库基线上实现邮箱密码和 QQ OAuth 双认证、短期 Access Token、可轮换与撤销的
Refresh Token、密码重置、用户资料、最小 RBAC、认证审计，以及移动端和管理端认证入口。

## 边界

- 首次注册或 QQ 登录必须在同一事务创建用户、唯一个人账本、所有者成员和 USER 角色。
- 不提供账本管理 API 或页面，不实现交易、统计、情侣、多用户协作和后台业务管理。
- 邮箱身份与 QQ 身份不自动合并；显式绑定延后。
- TASK-000 的 17 模型与初始迁移已满足本任务数据库前置，TASK-004 直接依赖 TASK-000。

## 实施

1. 新增认证模型和正式增量迁移，保留初始迁移不变。
2. 实现 Auth、Users、Sessions、RBAC、QQ Provider、密码重置队列和审计。
3. 实现移动端注册、登录、忘记/重置密码、OAuth 回调、认证恢复和路由保护。
4. 实现管理端登录、认证恢复、ADMIN Guard 和无权限状态。
5. 同步 OpenAPI、共享类型、产品/架构/设计文档和项目记忆。
6. 完成数据库、并发、Docker、重启、移动端、审计和完整质量验证。

## 安全参数

- 密码 12–128 字符，Argon2id。
- Access Token 15 分钟；Refresh Session 30 天；重置令牌 30 分钟。
- Refresh Token 和重置令牌仅存摘要；Refresh 每次使用均轮换，重放撤销整个会话。
- 改密撤销其他会话并轮换当前会话；重置密码撤销全部会话。
- Refresh Cookie 为 HttpOnly、SameSite=Lax，生产环境启用 Secure。
- QQ、JWT 和邮件配置只来自环境变量；不得记录密码或令牌。

## 验收

- OpenAPI、Controller、DTO、共享类型和前端调用一致。
- 注册并发、登录防枚举、令牌轮换/重放、退出幂等、改密/重置和 RBAC E2E 通过。
- 空库迁移、约束、外键、删除策略、migrate status、零 diff 和 introspection 通过。
- `pnpm verify`、依赖审计、Docker 服务链路、API/Worker 重启恢复和最终 diff 检查通过。
- 无真实 QQ 或邮件凭据时准确标记为未配置，不伪造线上联调成功。

## 进度

- [x] 预检、契约冲突澄清和实施设计
- [x] 数据模型与迁移
- [x] 后端认证和 Worker
- [x] 移动端与管理端
- [x] 契约和文档同步
- [x] 完整验收

## 验收结论

- 空库迁移、Prisma status/diff/introspection、数据库约束和并发幂等验证通过。
- 邮箱认证、会话轮换与重放撤销、密码重置、USER/ADMIN 授权和用户初始化 E2E 通过。
- PostgreSQL、Redis、API、Worker、Nginx 及移动端/管理端链路通过，API/Worker 重启后会话恢复通过。
- 320px、375px、480px 无横向溢出，主题切换与持久化通过。
- `pnpm verify`、依赖审计、Schema 镜像、MANIFEST、秘密扫描和 Git diff 检查通过。
- QQ OAuth 与生产邮件适配器代码已实现隔离验证；因未配置正式凭据，未执行线上联调。
