# 非 Docker 原生运行

## 适用范围

原生模式由 Node.js 直接运行 API、BullMQ Worker 和前端，不要求 Docker 或容器内 Nginx。PostgreSQL 与
Redis/Valkey 仍是正式依赖，可以安装在本机、局域网服务器或使用云服务；本项目不使用 SQLite、内存 Redis
或其他行为不同的嵌入式替代品伪装生产能力。

最低版本：

- Node.js 24
- pnpm 11
- PostgreSQL 17
- Redis 7.4 或兼容的 Valkey

## 环境文件

```bash
cp .env.native.example .env
```

Windows PowerShell 使用：

```powershell
Copy-Item .env.native.example .env
```

至少修改：

```env
DATABASE_URL=postgresql://siyu:数据库密码@127.0.0.1:5432/siyu?schema=public
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=至少32字符的随机值
```

周期 Worker 默认每 60 秒扫描一次、每页 200 条、并发 8、最多 5 次指数退避；可通过
`SIYU_RECURRING_SCAN_INTERVAL_MS`、`SIYU_RECURRING_SCAN_BATCH_SIZE`、
`SIYU_RECURRING_WORKER_CONCURRENCY`、`SIYU_RECURRING_JOB_ATTEMPTS` 和
`SIYU_RECURRING_BACKOFF_DELAY_MS` 调整。原生与 Compose 使用同一默认值和校验边界。

可以通过 `SIYU_ENV_FILE` 指定其他文件。相对路径先按当前工作目录解析，再按仓库根目录解析；操作系统已有环境变量
优先于文件值。密码包含 `@:/?#%` 等字符时必须进行 URL 编码。

## 准备 PostgreSQL 与 Redis

PostgreSQL 示例：

```sql
CREATE ROLE siyu WITH LOGIN PASSWORD '替换为强密码';
CREATE DATABASE siyu OWNER siyu;
```

Redis/Valkey 必须监听配置 URL 对应的地址。生产环境不要把 5432 或 6379 暴露到公网；使用云服务时启用 TLS、
访问控制和网络白名单，并将 URL 改为提供方给出的 `postgresql://`、`redis://` 或 `rediss://` 地址。

检查 Node、URL 和 TCP 连通性：

```bash
pnpm native:check
```

该命令只检查 TCP 可达性；数据库账号、密码和 Schema 权限由迁移命令进一步验证。

## 开发模式

首次安装和迁移：

```bash
pnpm install --frozen-lockfile
pnpm native:check
pnpm native:migrate
```

一条命令启动 API、Worker、手机端和管理端：

```bash
pnpm dev:native
```

入口：

- 手机端：`http://localhost:5173`
- 管理端：`http://localhost:5174/admin/`
- API：`http://localhost:3000`

两个 Vite 服务会把 `/api` 和 `/health` 转发到 `SIYU_API_ORIGIN`，默认是
`http://127.0.0.1:3000`。按 `Ctrl+C` 停止整组进程。

## 生产模式

生产 `.env` 至少设置：

```env
NODE_ENV=production
JWT_SECRET=至少32字符的强随机值
SIYU_PUBLIC_URL=https://你的域名
SIYU_ADMIN_URL=https://你的域名/admin/
SIYU_CORS_ORIGINS=https://你的域名
SIYU_COOKIE_SECURE=true
SIYU_API_ORIGIN=http://127.0.0.1:3000
SIYU_GATEWAY_HOST=127.0.0.1
SIYU_GATEWAY_PORT=8080
```

发布步骤：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm native:check
pnpm native:migrate
pnpm build
pnpm start:native
```

`start:native` 同时运行编译后的 API、Worker 和 Node 静态网关。网关行为与 Compose Nginx 对齐：

- `/`：手机 Web 静态文件和 SPA 回退
- `/admin/`：管理后台静态文件和 SPA 回退
- `/api/`、`/health`：反向代理到 `SIYU_API_ORIGIN`

网关默认只监听 `127.0.0.1:8080`。正式域名继续使用宿主机 Caddy/Nginx/面板反代并提供 HTTPS，例如：

```caddy
你的域名 {
    reverse_proxy 127.0.0.1:8080
}
```

原生网关用于减少部署依赖，不替代公网边界上的 TLS、限流、WAF 和访问日志设施。

## systemd 示例

```ini
[Unit]
Description=SIYU native runtime
After=network-online.target postgresql.service redis-server.service

[Service]
Type=simple
User=siyu
WorkingDirectory=/opt/siyu
EnvironmentFile=/opt/siyu/.env
ExecStart=/usr/bin/pnpm start:native
Restart=always
RestartSec=5
KillMode=control-group

[Install]
WantedBy=multi-user.target
```

启用前应先手工完成迁移和构建；应用启动仍不会自动执行数据库迁移。

## 更新与验证

```bash
git pull
pnpm install --frozen-lockfile
pnpm native:check
pnpm native:migrate
pnpm build
```

重启服务后检查：

```bash
curl http://127.0.0.1:8080/health
```

同时检查 Worker 日志出现 `recurring.worker.started` 与周期性 `recurring.scan.completed`；日志中的队列计数可用于
发现等待、延迟或最终失败积压。日志不应出现规则名称、金额或底层数据库错误正文。

隔离测试数据库和 Redis 已原生运行时，可通过 `SIYU_ENV_FILE` 指向测试环境文件后执行 `pnpm test:e2e`。
迁移必须先在 staging 验证并备份数据库；回滚应用时保留新数据库列，数据库问题优先使用向前修复迁移。

## 当前限制

- 生产邮件提供方尚未实现；`SIYU_MAIL_PROVIDER=test` 只把密码重置邮件写入 Redis 测试邮箱。
- PostgreSQL 与 Redis 的安装、升级、备份、高可用和 TLS 由宿主机或云服务负责。
- `pnpm native:check` 不创建数据库或 Redis 实例，也不会修改数据。
