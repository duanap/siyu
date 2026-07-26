# TASK-025：全链路 E2E 和发布验收

## 状态

仓库内开发、PR、远程 CI、合并和 main CI 已闭环；正式环境外部条件阻断

## 目标

- 建立可重复、失败关闭且不泄露秘密的发布前配置检查、数据库备份恢复演练和部署后冒烟工具。
- 在隔离 PostgreSQL/Redis、生产构建产物和真实浏览器中完成 MVP 全链路回归，形成可追溯验收证据。
- 明确区分仓库/本地/CI 验收与正式环境验收；缺少生产凭据或基础设施时不得伪造上线完成。
- 完成本任务的提交、PR、远程 CI、合并和最终 `main` CI 闭环。

## 非目标

- 不擅自选择邮件供应商、云厂商、正式域名、EdgeOne/WAF 规则或生产部署目标。
- 不写入或提交 QQ、邮件、JWT、数据库、Redis、TLS 等真实秘密。
- 不增加未批准业务、生产依赖、数据模型或管理员财务权限。
- 不在未知数据库执行迁移、恢复或其他写操作，不以本地测试替代正式环境验收。

## 相关规则与验收

- BR-SECURITY-001 至 003、BR-AUTH-001 至 006、BR-USER-001 至 003。
- 各领域的归属、整数分、事务、幂等、软删除、Worker 和日志安全规则。
- AC-AUTH-001 至 007、AC-SECURITY-001 至 004、各业务模块 AC，以及 AC-QUALITY-001。
- ADR-033 与 `docs/quality/RELEASE_CHECKLIST.md`。

## 发布验收口径

- 发布配置必须显式声明运行模式和环境，生产 URL 使用 HTTPS，Cookie 安全，JWT 非默认，QQ 三项配置完整
  且回调与公开地址同源；密码重置只能使用仓库实际支持的生产邮件适配器。
- 备份先完整生成并计算 SHA-256，再允许迁移；恢复演练只能写入显式、隔离且名称受限的验证数据库。
- 冒烟至少覆盖健康、手机端、管理端、未认证保护和统一安全响应头；登录、记账、查询与 Worker 使用隔离
  staging E2E 验证，不对生产用户数据造数。
- CI、本地 E2E、构建或冒烟通过均不自动证明正式域名、QQ、邮件、TLS/WAF、备份存储和监控已验收。

## 依赖与风险

- KI-002：正式 QQ App ID/App Key 和严格回调地址尚未进入部署环境。
- KI-015：域名、商标、软著、应用商店名称和 `cn.duanap.siyu` 可用性待负责人确认。
- KI-017：仓库尚无已批准生产邮件提供方；密码重置邮件是上线阻断项。
- 当前没有 staging/production 目标、访问权限、监控入口或回滚镜像标识，无法执行真实发布动作。
- 本机 Redis 6.0.16 低于正式最低版本；本地应用验证可继续，正式运行必须使用 Redis 7.4 或兼容 Valkey。

## 实施步骤

- [x] 按仓库规范完成文档、任务、Git 与发布工具预检
- [x] 创建任务分支和 ExecPlan，冻结发布验收边界
- [x] 实现并测试生产发布配置预检，输出仅含非敏感检查结果
- [x] 实现并测试 PostgreSQL 备份、校验和隔离恢复演练
- [x] 实现并测试构建产物 HTTP 冒烟与安全响应头检查
- [x] 将发布验收工具接入根脚本、CI 和部署/发布文档
- [x] 完成迁移、约束、全量 E2E、构建、依赖、安全和真实浏览器验收
- [x] 更新发布报告、项目记忆、已知问题、发布历史和任务状态
- [x] 提交、PR、远程 CI、合并并确认最终 `main` CI

## 数据迁移与回滚

- 本任务不预设新迁移；现有 12 个迁移需在全新库、历史升级库和重复部署路径验证。
- 备份产物使用 PostgreSQL custom format、限制文件权限并记录 SHA-256；恢复演练目标必须与源库不同，
  且数据库名满足 `siyu_restore_*`，默认只允许本机目标。
- 应用回滚到发布前不可变提交或镜像；数据库新增列和约束默认保留，数据问题优先向前修复。
- 发现重复入账时先停止 Worker，再按审计事实处理，不直接修改生产财务数据。

## 验证命令

```bash
pnpm release:check -- --env-file <staging-or-production-env> --mode native|compose
pnpm release:backup
pnpm release:restore:verify
pnpm release:smoke -- --base-url <staging-or-release-origin>
pnpm prisma:migrate:test
pnpm verify
pnpm native:check:config
pnpm audit --audit-level moderate
pnpm docs:check
pnpm manifest:check
git diff --check
```

## 进度日志

- 2026-07-26：TASK-024 关闭 PR #37 已合入，最终
  `main@687b4bf759e1bf37d8fc751476fbc412033e14cd` 的 CI Run `30210067946` 全绿。
- 2026-07-26：读取产品、架构、部署、安全、质量、任务、环境、CI 与现有工具链；确认没有既有
  TASK-025 ExecPlan，也没有发布配置、备份恢复和部署后冒烟自动化。
- 2026-07-26：确认仓库内代码审计无未解决高/中危发现，但 KI-002、KI-015、KI-017 及正式环境访问仍是
  独立外部验收边界。
- 2026-07-26：完成发布配置预检、PostgreSQL 备份/隔离恢复、HTTP 冒烟和 Chrome CDP 验收工具；CI
  `database` 任务加入真实备份恢复。
- 2026-07-27：PostgreSQL 17 custom format 备份经 SHA-256 校验后恢复，确认 12 个迁移与 27 张表并清理；
  生产构建 API/网关只读冒烟通过。
- 2026-07-27：Google Chrome Headless/CDP 的 320px、375px、480px × 日间/暗色 6 组矩阵与截图目视通过；
  无横向溢出、小于 44px 的可见交互区或品牌错误。
- 2026-07-27：标准 `pnpm verify` 完整通过；最终符号链接边界加固后，单次工具执行在移动端 104/104 通过
  后达到 10 分钟上限，因此按同一门禁拆分续跑。最终 187 项测试、完整 E2E、构建、Prisma、OpenAPI 81/81、
  Compose、文档、清单与差异检查全部通过；依赖审计无已知漏洞。
- 2026-07-27：功能分支经 PR #38 合入 `main`，Squash merge 提交为
  `7fe0b8b91b40996f9325aa61a02c23f93ef54958`；最终 PR CI Run `30213362056` 的 `quality`、
  `database`、`secret-scan` 全绿。
- 2026-07-27：合并后的 main push CI Run `30213469686` 全绿，再次覆盖完整测试、迁移、E2E、构建、
  依赖审计、秘密扫描以及 PostgreSQL 真实备份和隔离恢复。

## 决策记录

- 采用 ADR-034：发布验收以失败关闭配置、仓库外备份、隔离恢复和分层冒烟为准；外部条件缺失时明确拒绝上线。

## 完成结果

仓库内开发、发布候选、PR、远程 CI、合并和最终 `main` CI 已完成闭环。当前决定仍为不允许生产上线；
TASK-025 的生产发布验收不能正式关闭，继续等待正式 QQ、生产邮件、域名/TLS、staging/production、
监控/回滚和品牌权属外部验收。
