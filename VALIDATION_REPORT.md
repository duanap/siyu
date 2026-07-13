# TASK-004 验证报告

日期：2026-07-12

## 结论

TASK-004 身份认证与用户基础能力实现和本地最终验收通过。未开始 TASK-002、TASK-003 或其他业务
任务。正式 QQ 凭据和生产邮件提供方未配置，因此未将线上联调写成已完成。

## 数据库验收

- 从 tmpfs 空库顺序应用 `20260711000000_init` 和
  `20260712000000_authentication_foundation`：通过。
- `prisma migrate status`：数据库最新；`prisma migrate diff --exit-code`：无差异。
- `prisma db pull --print`：introspection 得到 25 个应用模型，并识别受审迁移中的 CHECK。
- 用户邮箱、QQ OpenID、角色权限、Refresh/Reset Token 唯一约束：通过。
- 状态/时间 CHECK、复合归属外键以及 RESTRICT/CASCADE 删除策略：通过。
- 既有财务基线的部分唯一索引、CHECK、归属外键和并发幂等回归：通过。

## 认证与权限验收

- 邮箱规范化、Argon2id、密码 12–128 字符、JWT、配置校验和前端认证状态单元测试：通过。
- 注册事务同时创建 User、UserCredential、唯一 PERSONAL Ledger、OWNER LedgerMember 和 USER 角色。
- 重复注册和并发同邮箱注册：恰好一个成功；失败不会留下部分用户或账本。
- 登录未知邮箱与错误密码使用相同 401 响应；响应和日志不含密码哈希或原始 Token。
- Access Token、`GET/PATCH /users/me`、USER/ADMIN 服务端 Guard：通过。
- Refresh 正常轮换、旧令牌失效、重放撤销令牌族、并发消费条件更新：通过。
- 改密轮换当前会话并撤销其他会话；重置令牌一次性使用并撤销全部会话：通过。
- Logout 幂等；Redis 限流和一次性 QQ OAuth state 的隔离测试通过。
- 邮件 Job 使用固定 ID；测试传输器由 Worker 消费并写入隔离邮箱；未配置生产 Provider 时明确失败。

## 容器与服务链路

- `siyu-postgres`、`siyu-redis`、`siyu-api`、`siyu-worker`、`siyu-nginx`：全部 running/healthy。
- `http://localhost:8080/health`、移动端 `/`、后台 `/admin/`、PostgreSQL、Redis、API、Worker、Nginx
  链路：通过。
- 经 Nginx 实测注册、当前用户、刷新、USER 访问管理端 403、忘记密码 Worker 消费、QQ 未配置 503、
  两次退出 200：通过。
- API 与 Worker 同时重启后恢复 healthy，重启前 Cookie 可继续刷新会话：通过。
- 五个容器完整日志已检查；API 重启窗口内 Nginx healthcheck 出现一次预期 502，API healthy 后自动恢复
  200，无持续应用异常。Redis 的 `vm.overcommit_memory=0` 环境提示记录为 KI-016。

## 前端验收

- 移动端登录、注册、忘记/重置密码、OAuth 回调、无权限和受保护占位页：通过。
- 管理端登录、启动恢复、路由 Guard、USER 无权限和 ADMIN 登录：通过。
- Chrome 150 DevTools 设备指标实测 320/375/480px：`scrollWidth` 分别等于视口宽度，无横向溢出；
  卡片宽度为 288/343/420px。
- 日夜主题切换和 localStorage 持久化通过；控件最小点击高度 44px。
- Browser 插件与 Playwright 在环境中不可用，按前端测试技能降级使用本机 Chrome DevTools Protocol；
  控制台仅有未登录启动恢复的预期 401 网络记录，无页面脚本异常。

## 全量质量门禁

- `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`：通过。
- 22 项单元/组件测试与隔离 PostgreSQL 认证 E2E：通过。
- Prisma validate、空库迁移回放、OpenAPI lint/覆盖/类型生成、Compose 检查：通过。
- OpenAPI 覆盖 71/71 个批准操作；应用 Schema 与文档镜像一致。
- `pnpm audit`：无已知漏洞。
- `pnpm verify`、MANIFEST、秘密扫描和 `git diff --check`：通过。

## 配置边界和已知项

- QQ App ID/App Key/正式回调地址未提供；Provider 实现按官方 Authorization Code 流程隔离验证，
  本地接口准确返回“服务未配置”。
- 生产邮件提供方未配置；本任务交付真实队列、测试传输器和明确失败码，不承诺生产邮件已发送。
- Docker 构建默认仍使用官方 npm registry；因本地官方 registry 多次超时，本次镜像验收通过显式
  `PNPM_REGISTRY=https://registry.npmmirror.com` 构建参数完成，锁文件完整性仍由 pnpm 校验。
- 未写入 `.env`、真实密钥、Token、密码、生产数据、构建产物、日志或截图。
