# 当前项目状态

更新时间：2026-07-14
文档版本：v1.3.0
代码状态：TASK-005 实现与自动质量门已通过，待真浏览器视觉补验后关闭

## 当前阶段

M2：身份认证、个人账本初始化和情侣账本关系能力已建立。M3 分类、普通记账和统计尚未开始。

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
- 情侣账本创建、查询、改名、邀请、接受、成员退出、所有权转移和解散 API。
- 邀请一次性摘要、用户/操作幂等键、单活邀请、事务级锁、两人上限与单用户单情侣账本数据库触发器。
- 情侣成员和所有者权限、退出/转移/解散审计，以及移动端“朝暮同笺”管理页面完整状态。
- TASK-002 设计 Token/基础组件和 TASK-003 PostgreSQL/Prisma 基线已确认吸收进 TASK-000。

## 明确未实现

分类、普通记账、借贷、周期、工资、攒钱、统计、通知、导出和后台业务管理均未实现；
除认证、用户资料、账本查询和情侣关系接口外，其余 OpenAPI 路径覆盖只表示契约完整，不表示接口已经上线。

## 当前验证状态

- `pnpm verify`：通过，包含 Docker Compose daemon 配置校验。
- Prisma validate：通过；Prisma CLI 与 Client 均为 7.8.0。
- OpenAPI lint：通过，API_CONTRACT 覆盖 72/72，生成类型成功。
- 单元/组件测试：26 项通过；隔离 PostgreSQL 认证与情侣账本 E2E 全流程通过。
- 手机端 320px、375px、480px：无横向溢出；44px 点击区通过；日夜主题切换通过。
- 依赖审计：无已知漏洞。
- 空库初始迁移、Prisma migrate status/diff/introspection、PostgreSQL 特殊约束和并发幂等实测：通过。
- 25 模型三迁移空库回放、Prisma status/diff/introspection、19 个关键唯一索引、情侣成员触发器和并发验证：通过。
- `siyu-postgres`、`siyu-redis`、`siyu-api`、`siyu-worker`、`siyu-nginx`：验收时全部 running/healthy。
- PostgreSQL、Redis、API、BullMQ Worker、Nginx 服务链路和 `http://localhost:8080/health`：通过。
- API 与 Worker 同时重启后连接恢复：通过；Nginx 使用 Docker DNS 动态解析 API 地址，无需随 API 重启。

## 下一项动作

补验 TASK-005 页面 320px、375px、480px 和日夜主题；通过后关闭 TASK-005。下一条依赖链为
TASK-006 分类模块，未获负责人确认前不得自行开始。

## 待负责人确认

- Logo、商标、域名、软著、应用商店名称和安卓包名可用性。
- 默认时区是否保留 `Asia/Shanghai`。
- 来源业务删除、周期补期、短月发薪和目标归属规则。
- 上传、异步导出、反馈、会话与后台 API/数据模型的最小契约。
- QQ 互联申请已通过；生产部署仍需通过环境变量配置 App ID/App Key/严格回调地址和邮件提供方。
