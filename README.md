# 四时有余（SIYU）

正式品牌：**朝暮同笺 · 四时有余**
主宣传语：**朝暮同笺，四时有余。**

四时有余是手机端优先的轻量个人与情侣记账应用。本仓库采用 pnpm Monorepo，包含手机 Web、管理后台、NestJS API/Worker 以及共享类型、校验和 UI Token。

## 工作区

```text
apps/mobile-web       @siyu/mobile-web
apps/admin-web        @siyu/admin-web
apps/api              @siyu/api
packages/shared-types @siyu/shared-types
packages/validation   @siyu/validation
packages/ui-tokens    @siyu/ui-tokens
```

## 本地要求

- Node.js 24 LTS
- pnpm 11
- Docker Compose（数据库与 Redis 集成验证需要）

## 开始

```bash
cp .env.example .env
pnpm install
pnpm verify
```

只启动依赖：

```bash
docker compose up -d siyu-postgres siyu-redis
```

启动开发应用：

```bash
pnpm --filter @siyu/mobile-web dev
pnpm --filter @siyu/admin-web dev
pnpm --filter @siyu/api dev
pnpm --filter @siyu/api dev:worker
```

## 关键约束

- 金额使用整数分，API 金额不得超过 JavaScript 安全整数。
- 业务日期使用 `DATE`，系统时间使用 UTC。
- 工资、社保、医保、公积金和个人借贷仅本人可见。
- 跨表财务写入必须事务化，自动账目必须具备数据库级幂等约束。
- 用户端必须覆盖 320px、375px、480px 及日间/夜间状态。

项目事实入口见 [docs/index.md](docs/index.md)，品牌唯一事实来源见 [docs/product/BRAND_IDENTITY.md](docs/product/BRAND_IDENTITY.md)。
