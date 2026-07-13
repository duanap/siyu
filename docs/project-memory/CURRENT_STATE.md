# 当前项目状态

更新时间：2026-07-12
文档版本：v1.2.0
代码状态：TASK-004 身份认证与用户基础能力已实现并验收

## 当前阶段

M1：SIYU Monorepo 基线与身份认证基础已建立并通过最终验收。账本、记账、统计等业务模块尚未开始。

## 已完成

- 品牌唯一事实来源迁至 `docs/product/BRAND_IDENTITY.md`，正式名称和工程命名已同步。
- Git 仓库与 `task/TASK-000-project-bootstrap` 分支。
- Node.js 24 / pnpm 11 Monorepo，三个应用和三个共享包。
- Vue 手机端与管理后台最小可渲染壳、设计 Token 和日夜主题基线。
- NestJS API/Worker 独立入口、统一 requestId、统一错误响应和 `/health`。
- Prisma 7.8 Schema、create-only 初始迁移、部分唯一索引、归属外键和 CHECK。
- OpenAPI 3.1 覆盖 API_CONTRACT 已批准的 65 个操作，并生成共享类型。
- PostgreSQL、Redis、API、Worker、Nginx Compose 与占位环境样例。
- 文档、格式、lint、类型、单元、API E2E、构建、OpenAPI、Prisma、依赖审计和 CI 基线。
- 邮箱注册/登录、QQ OAuth Provider、Access/Refresh 会话、密码修改/重置、用户资料和最小 RBAC。
- 首次注册或 QQ 登录事务内创建用户、唯一 PERSONAL 账本、OWNER 成员和默认 USER 角色。
- Refresh Token 原子轮换、重放撤销、Cookie 安全策略、Redis 限流和认证审计脱敏。
- 密码重置 BullMQ 任务、移动端认证页面与路由恢复、管理端登录与 ADMIN 服务端授权边界。

## 明确未实现

账本管理、分类、记账、借贷、周期、工资、攒钱、统计、通知、导出和后台业务管理均未实现；
除本次认证、用户资料和管理端认证检查外，其余 OpenAPI 路径覆盖只表示契约完整，不表示接口已经上线。

## 当前验证状态

- `pnpm verify`：通过，包含 Docker Compose daemon 配置校验。
- Prisma validate：通过；Prisma CLI 与 Client 均为 7.8.0。
- OpenAPI lint：通过，API_CONTRACT 覆盖 71/71，生成类型成功。
- 单元/组件测试：22 项通过；隔离 PostgreSQL 认证 E2E 全流程通过。
- 手机端 320px、375px、480px：无横向溢出；44px 点击区通过；日夜主题切换通过。
- 依赖审计：无已知漏洞。
- 空库初始迁移、Prisma migrate status/diff/introspection、PostgreSQL 特殊约束和并发幂等实测：通过。
- 25 模型空库迁移、Prisma status/diff/introspection、认证约束和并发验证：通过。
- `siyu-postgres`、`siyu-redis`、`siyu-api`、`siyu-worker`、`siyu-nginx`：验收时全部 running/healthy。
- PostgreSQL、Redis、API、BullMQ Worker、Nginx 服务链路和 `http://localhost:8080/health`：通过。
- API 与 Worker 同时重启后连接恢复：通过；Nginx 使用 Docker DNS 动态解析 API 地址，无需随 API 重启。

## 下一项动作

TASK-004 已关闭。等待负责人明确后续任务；不得自行开始其他业务任务。

## 待负责人确认

- Logo、商标、域名、软著、应用商店名称和安卓包名可用性。
- 默认时区是否保留 `Asia/Shanghai`。
- 来源业务删除、情侣所有权转移、情侣分类共享、周期补期、短月发薪和目标归属规则。
- 上传、异步导出、反馈、会话与后台 API/数据模型的最小契约。
- QQ App ID/App Key/严格回调地址与生产邮件提供方配置。
