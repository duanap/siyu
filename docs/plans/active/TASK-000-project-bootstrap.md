# TASK-000：SIYU 项目接管修复与工程初始化 ExecPlan

## 状态

已完成（2026-07-11）。TASK-001、TASK-002 和 TASK-003 已吸收，不再单独执行。

## 目标

- 将文档交接包转为可安装、检查、测试、构建和容器化运行的 SIYU Monorepo。
- 固化品牌、Prisma、OpenAPI、Docker、CI 与真实健康检查基线。
- OpenAPI 覆盖 API_CONTRACT 已批准的 65 个操作。

## 非目标

- 不实现 OAuth、用户、账本、记账、借贷、周期、工资、攒钱、通知或后台业务。
- 不制作高保真 UI，不封装 Android/Capacitor，不决定未批准功能。
- 不使用真实密钥、生产地址或生产数据，不连接共享或生产数据库。

## 允许与禁止范围

允许修改根工程配置、README、品牌和索引、`apps/`、`packages/`、`scripts/`、CI、Docker、
Nginx、环境变量样例、Prisma Schema/迁移、OpenAPI、架构文档和项目记忆。

禁止新增业务 Controller/Service/Repository/Job，禁止假业务接口、静态业务数据、空测试、
既有表名和 `/api/v1` 路径改名，禁止真实密钥和生产数据。

## 工程约定

- 根包 `siyu`；应用包 `@siyu/mobile-web`、`@siyu/admin-web`、`@siyu/api`。
- 共享包 `@siyu/shared-types`、`@siyu/validation`、`@siyu/ui-tokens`。
- 服务名 `siyu-nginx`、`siyu-api`、`siyu-worker`、`siyu-postgres`、`siyu-redis`。
- Node.js 24 LTS，pnpm 由根 `packageManager` 固定；API 前缀 `/api/v1`，健康检查 `/health`。
- 金额为安全整数分；业务日期 `YYYY-MM-DD`；系统时间 UTC。
- 幂等键作用域为用户 + 操作 + Key；相同载荷重放，不同载荷返回 409。

## 实施步骤与进度

- [x] 预检 70 个原始文件哈希，初始化 Git 和任务分支，建立 `.gitignore`。
- [x] 将品牌事实来源迁至 `docs/product/BRAND_IDENTITY.md`，同步入口和展示名称。
- [x] 建立 pnpm workspace、三个应用、三个共享包、统一工具链与锁文件。
- [x] 建立 NestJS API/Worker 独立入口和 `/health`，未注册业务模块或业务 Job。
- [x] 修正 Prisma 关系、幂等作用域与枚举，生成 create-only 初始迁移。
- [x] 在迁移 SQL 增加部分唯一索引、复合归属外键、金额/日期/汇总 CHECK。
- [x] 补齐 65 个已批准 OpenAPI 操作、统一响应和类型生成。
- [x] 建立 PostgreSQL、Redis、API、Worker、Nginx Compose 与占位环境样例。
- [x] 建立单元、组件、API E2E、数据库约束验证和 CI 基线。
- [x] 完成最终全量静态/应用质量门禁、浏览器冒烟和文档清单更新。
- [x] 在 Docker 环境完成一次性数据库迁移回放、五容器健康、服务链路和重启恢复。

## Prisma 修正与迁移计划

Schema 位于 `apps/api/prisma/schema.prisma`，文档镜像必须逐字一致。Prisma 不可表达的
`deleted_at IS NULL` / 非空来源部分唯一索引、归属复合外键和 CHECK 固化在受审初始迁移。
迁移仅在 Compose 的一次性 `siyu-postgres-test` 数据库应用；应用启动不自动迁移。

验证覆盖个人账本唯一、工资月份软删除唯一、来源唯一、正数/安全整数金额、汇总等式、月份
归一、跨用户归属和唯一冲突。并发仍依赖数据库唯一索引作为最终裁决。

## OpenAPI 校验计划

Redocly 校验 OpenAPI 3.1；覆盖脚本从 API_CONTRACT 提取操作并与 OpenAPI 双向比较，固定为
65 个。`openapi-typescript` 生成 `packages/shared-types/src/openapi.generated.ts`，生成文件不得手改；
重复生成后必须无差异。产品存在但契约未批准的上传、异步导出、反馈和后台 API 留待后续任务。

## Docker 与环境计划

`.env.example` 和 `.env.test.example` 只含本地占位值。开发 PostgreSQL、Redis、Nginx 仅绑定
localhost；容器有健康检查和依赖条件；持久数据使用命名卷，测试数据库使用 tmpfs。QQ OAuth、
JWT、域名与 S3 不提供真实值，生产迁移由发布流程显式执行。

## CI 与测试基线

CI 顺序为文档、冻结锁文件安装、格式、lint、类型、单元、Prisma/OpenAPI、API E2E、构建和
依赖审计；独立数据库任务回放迁移并执行约束 SQL；Gitleaks 负责秘密扫描。前端基线测试仅验证
应用渲染与 Token 加载，不伪造业务页面。

## 文档更新要求

同步 CURRENT_STATE、CHANGELOG_AI、KNOWN_ISSUES、DECISIONS、RELEASE_HISTORY、TASK_BACKLOG、
数据库/API/架构/部署/测试文档、MANIFEST 与 VALIDATION_REPORT。完成前搜索旧品牌和错误路径。

## 风险

- Prisma 特殊约束位于定制 SQL，未来重新生成迁移时不得覆盖。
- 来源业务删除、情侣所有权、周期补期、短月发薪等规则未批准，不在本任务决定。
- Docker 验证依赖本机 daemon；只能操作本项目命名服务，删除持久卷需另行确认。
- OpenAPI 目前是契约基线而非已实现业务；不得将路径覆盖误报为业务完成。

## 回滚

代码通过 TASK-000 提交 revert；尚未提交时按文件清单撤销。测试容器可停止并移除，持久卷不自动
删除。已进入共享环境的迁移不得降级，必须使用向前修复；本任务禁止向共享环境应用迁移。

## 验收条件

- Git 分支、锁文件、三个应用和三个共享包存在，无密钥或构建缓存入库。
- 品牌事实来源正确，旧临时名称只在品牌迁移示例中保留。
- lint、typecheck、test、API E2E、build、Prisma validate、OpenAPI lint 通过。
- 初始迁移可在空 PostgreSQL 回放，特殊索引和 CHECK 自动验证。
- Compose 配置有效，PostgreSQL、Redis、API、Worker 和 Nginx 健康，`/health` 返回 requestId。
- CI、项目记忆、架构文档、清单与验证报告同步。

## 验证命令

```bash
bash scripts/check-docs.sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm openapi:lint
docker compose config
pnpm prisma:migrate:test
pnpm test:e2e
pnpm build
docker compose up -d --wait siyu-postgres siyu-redis siyu-api siyu-worker siyu-nginx
curl --fail http://localhost:8080/health
pnpm audit --audit-level moderate
git diff --check
git status --short
```

## 决策记录

- 默认时区按授权计划暂定 `Asia/Shanghai`，保留负责人否决后的向前迁移方案。
- TASK-001 的 Monorepo、工具链和 CI 范围吸收到 TASK-000。
- TASK-002 的设计 Token、日夜主题和基础组件基线吸收到 TASK-000。
- TASK-003 的 PostgreSQL/Prisma 模型、迁移、特殊约束和验证基线吸收到 TASK-000。
- 部分唯一索引不依赖 Prisma 预览特性，使用人工审查 SQL。
- TASK-000 不创建 Session、Attachment、Setting 或 Admin 模型。

## 完成结果

已建立全部约定工程、数据库、API、Docker、CI 和文档基线，未实现业务模块。`pnpm verify`、
Prisma validate、OpenAPI 65/65、单元/组件、API E2E、构建、依赖审计和移动视口验证通过。

Docker 最终验收已通过：空库迁移可完整回放，Prisma status 为最新、迁移目录与实库零 diff，
introspection 得到 17 个应用模型；唯一约束、部分唯一索引、CHECK、复合外键、删除策略及并发
幂等均由 PostgreSQL 实测通过。

`siyu-postgres`、`siyu-redis`、`siyu-api`、`siyu-worker`、`siyu-nginx` 均为
running/healthy，PostgreSQL、Redis、API、BullMQ Worker、Nginx 与 `/health` 链路通过。API 和
Worker 同时重启、容器 IP 互换后，Worker 自动重连 Redis，Nginx 通过 Docker DNS 动态解析恢复
API 代理。验收中修复了 Prisma shadow datasource、并发测试无效分类、Worker/Nginx 健康检查和
Nginx 缓存旧 API 地址四项缺陷。TASK-000 无剩余关闭项。
