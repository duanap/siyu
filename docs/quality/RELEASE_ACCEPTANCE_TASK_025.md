# TASK-025 发布验收报告

验收日期：2026-07-26 至 2026-07-27

代码基线：`main@7fe0b8b91b40996f9325aa61a02c23f93ef54958`

## 结论

仓库内开发、隔离环境全链路 E2E、备份恢复、生产构建产物、原生网关和真浏览器发布候选验收通过。
面向公众的生产上线验收未通过；阻断项是正式 QQ 凭据与回调、已批准生产邮件适配器与
真实发送/退信、域名/TLS/EdgeOne/WAF、staging/production 目标与监控、回滚制品，以及品牌/域名/包名权属确认。

本报告不把本地、隔离数据库或 GitHub CI 结果冒充为正式环境上线。

2026-07-27 负责人确认产品先供本人和女朋友私有使用。该目标由 TASK-026/ADR-035 单独处理：可显式关闭
注册、QQ 和邮件密码重置，并保留 HTTPS、强密钥、权限、备份恢复和回滚门槛。本报告以下阻断与“不允许上线”
结论仅指面向不特定用户的 `public` 档案，不再阻断 `personal` 档案。

仓库闭环证据：PR #38 已 Squash merge；最终 PR CI Run `30213362056` 与 main push CI Run
`30213469686` 的 `quality`、`database`、`secret-scan` 全绿。两轮均覆盖完整测试、迁移、E2E、构建、
依赖审计和秘密扫描，数据库任务还执行真实 PostgreSQL 备份、隔离恢复与约束验证。

## 新增发布门禁

- `pnpm release:check`：校验显式运行模式、生产环境、强 JWT、Secure Cookie、HTTPS 同源 URL、CORS、
  PostgreSQL/Redis URL、QQ 完整凭据与严格回调，并在无已批准生产邮件适配器时失败关闭；输出不含秘密。
- `pnpm release:backup`：在仓库外生成 PostgreSQL custom format 备份、`0600` 权限、非敏感元数据和
  SHA-256；支持使用数据库容器内同版本客户端。
- `pnpm release:restore:verify`：校验备份哈希，只恢复到名称匹配 `siyu_restore_*` 的隔离数据库，
  检查有效 Prisma 迁移和业务表，并支持验收后清理。
- `pnpm release:smoke`：只读验证健康、手机端、管理端、未认证保护和统一安全响应头。
- `pnpm release:browser:smoke`：通过 Chrome DevTools Protocol 验证 320px、375px、480px 的日间/夜间、
  正式品牌、无横向溢出和可见交互区 44px 下限，并可将截图写到仓库外。
- CI `database` 任务新增 PostgreSQL 备份与隔离恢复演练，不只验证向前迁移和约束。

## 本地验收证据

| 范围 | 结果 | 证据 |
|---|---|---|
| 发布工具定向测试 | 通过 | Node 脚本 12 项全部通过 |
| 全仓单元/组件测试 | 通过 | 187 项：移动端 104、API 56、脚本 12、其余 15 |
| 标准质量门 | 通过 | 一轮 `pnpm verify` 完整通过；最终加固后因单次工具 10 分钟上限，按同一门禁拆分复核 docs、manifest、format、lint、typecheck、187 项 test、Prisma、OpenAPI 81/81、Compose、E2E、build |
| 依赖审计 | 通过 | `pnpm audit --audit-level moderate` 无已知漏洞 |
| 数据库迁移 | 通过 | 12 个迁移完成空库、历史升级、重复部署、status、零 diff、introspection 与约束验证 |
| API/Worker E2E | 通过 | 认证、情侣、分类、账目、借贷、周期、工资、导出、攒钱、通知和管理端完整链路 |
| 备份恢复 | 通过 | PostgreSQL 17 custom format，197198 字节；SHA-256 `8d3502dbd584ce7072bc89ee1af5239a3292a2fa1eff4b157b9995376606aab0`；隔离恢复确认 12 个迁移、27 张表并清理 |
| 生产构建产物 | 通过 | API、Worker、手机端和管理端构建；原生 API + 静态网关真实启动 |
| 只读发布冒烟 | 通过 | `/health` 200、`/` 200、`/admin/` 200、未认证 `/api/v1/users/me` 401，安全响应头完整 |
| 真浏览器矩阵 | 通过 | Google Chrome Headless/CDP；320/375/480px × 日/夜共 6 组，无溢出或小于 44px 的可见交互区 |
| 生产配置负向门禁 | 通过 | `.env.production.example` 的占位密钥、QQ 与邮件明确失败，不打印密码或 App Key |

真浏览器截图只保存在 `/tmp/siyu-task025-browser-evidence`，未进入仓库。宿主 Redis 6.0.16 只用于本地
E2E 并产生最低 6.2 提示；Compose、CI 和正式要求仍为 Redis 7.4 或兼容 Valkey。

## 正式环境未验收项

| 编号 | 阻断 | 完成所需证据 |
|---|---|---|
| REL-025-01 | 没有正式 QQ App ID/App Key 与严格回调环境 | 受控环境注入、真实新用户与既有用户双向登录、state/重放负向验证 |
| REL-025-02 | 没有已批准生产邮件适配器、供应商和凭据 | 负责人选择供应商并批准契约；实现适配器；真实发送、链接使用、失败重试和退信/投诉处理 |
| REL-025-03 | 没有正式域名和边界设施 | 域名权属、TLS/HSTS、EdgeOne/WAF、外层限流、可信代理拓扑和公开响应检查 |
| REL-025-04 | 没有 staging/production 目标与访问权限 | staging 迁移/E2E、生产备份、迁移窗口、部署、监控和发布后观察 |
| REL-025-05 | 没有不可变回滚制品与监控入口 | 上一/当前镜像或提交、回滚演练、API/队列/错误率告警和 Redis 持久化/内存参数 |
| REL-025-06 | 品牌与分发权属未确认 | Logo、商标、域名、软著、应用商店名称和 `cn.duanap.siyu` 可用性确认 |

## 发布决定

当前决定：**不允许 `public` 档案生产上线；`personal` 档案转入 TASK-026 独立验收**。

允许继续的动作：合并发布门禁和验收工具、运行远程 CI、准备 staging 环境。

禁止动作：绕过 `MAIL_PROVIDER`、用测试邮箱替代真实邮件、把占位 QQ/域名当正式配置、在未知数据库迁移、
在无备份恢复与回滚制品时上线，或将本报告标记为正式发布完成。
