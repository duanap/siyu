# TASK-000 验证报告

日期：2026-07-11

## 结论

TASK-000 最终验收通过并关闭。未开始 TASK-001；本报告作为 TASK-000 最终 Git 归档依据。

## 数据库验收

- `pnpm prisma:migrate:test` 在 tmpfs 空库应用 `20260711000000_init`：通过。
- `prisma migrate status`：数据库最新；`prisma migrate diff --exit-code`：无差异。
- `prisma db pull --print`：introspection 得到 17 个应用模型，并识别 migration 中的 CHECK。
- 唯一约束、部分唯一索引、金额/日期/汇总 CHECK、复合归属外键：通过。
- RESTRICT、SET NULL、CASCADE 删除策略：通过。
- 两个并发连接复用同一用户幂等键：恰好一条成功，一条命中
  `entries_creator_user_id_idempotency_key_key`，最终仅一行。

## 容器与服务链路

- Docker Engine 29.6.1、Docker Compose 5.3.1；Compose 配置校验通过。
- `siyu-postgres`、`siyu-redis`、`siyu-api`、`siyu-worker`、`siyu-nginx`：全部 running/healthy。
- PostgreSQL：接受连接，数据库时区 UTC，18 张 public 表，初始迁移 finished。
- Redis：PING、临时键写入/读取/删除通过。
- API：容器内可达 PostgreSQL 5432、Redis 6379，直连 `/health` 通过。
- Worker：`node dist/worker.js` 运行，Redis 可见 ioredis 普通连接及 BullMQ `bzpopmin` 阻塞连接。
- Nginx：移动端 `/`、后台 `/admin/` 和 `/health` 均返回 200；响应含一致的 requestId。
- API 与 Worker 同时重启后容器 IP 互换，二者恢复 healthy，Worker 重连 Redis；Nginx 未重启并通过
  Docker DNS 动态解析恢复 API 代理，`http://localhost:8080/health` 再次返回 200。

## 全量质量门禁

- `pnpm verify`：通过，覆盖文档、MANIFEST、格式、lint、类型、单元/组件、Prisma、OpenAPI、
  Compose、API E2E、build、Docker Compose config 和 Git diff 检查。
- 17 项单元/组件测试和 3 项 API E2E：通过。
- Redocly OpenAPI 3.1 lint，API_CONTRACT 覆盖 65/65，类型生成可重复：通过。
- `pnpm audit --audit-level moderate`：无已知漏洞。
- MANIFEST 哈希与最终文件一致；应用 Schema 与文档镜像逐字一致。
- Git 分支、忽略文件、敏感文件、构建缓存、diff whitespace：通过；未提交任何内容。

## 验收中发现并修复

- Prisma diff 缺少 shadow datasource：测试容器增加独立 `siyu_shadow` 并仅在 diff 时注入 URL。
- 并发测试引用无效分类 UUID：改用有效分类，并断言指定唯一索引和最终行数。
- Worker、Nginx 无 Docker healthcheck：补充 Redis TCP 和 Nginx 代理健康检查。
- Nginx 缓存 API 旧容器 IP：启用 Docker DNS 动态解析，重启恢复实测通过。

## 日志与已知环境提示

五个容器完整日志已检查，无未处理的应用异常。Redis 报告宿主机 `vm.overcommit_memory=0`，不影响
本次 PING、AOF 启动、Worker 连接和重启验收；低内存下后台持久化/复制风险记录为 KI-016，部署
主机应设为 `1`。PostgreSQL Alpine 初始化时缺少系统 locale 的 warning 不影响 UTF8 数据库启动。

## 视觉验证说明

TASK-000 明确不制作高保真 UI，现有 18 张低保真图不是本任务要复刻的成品概念。浏览器冒烟仅
验证工程壳的品牌、留白、Token、响应式和主题能力；没有伪装业务页面。浏览器插件不可用，因此
使用本机 Chrome 150 的 DevTools Protocol，并用 `view_image` 检查低保真登录参考与最新 320px
工程壳截图。检查点为品牌文案、居中布局、字体层级、背景/文字色、按钮边界、44px 点击区、无
横向溢出和日夜切换；未发现工程基线范围内的可修复视觉问题。
