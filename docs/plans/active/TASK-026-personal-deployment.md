# TASK-026：个人/情侣私有部署就绪

## 状态

已正式关闭

## 背景

TASK-025 已完成仓库开发、PR、远程 CI、合并和最终 `main` CI，但其发布口径将 QQ、生产邮件、
公开域名、EdgeOne/WAF、监控平台和品牌权属全部作为同一上线门槛。当前产品首先服务于负责人和其女朋友，
因此本任务把交付目标收敛为可安全运行的个人/情侣私有版本，并把面向公众或商业发布的外部条件延期。

## 目标

- 保持邮箱密码注册、登录、修改密码和全部核心财务能力可用。
- 允许部署者显式关闭未配置的 QQ OAuth 与邮件密码重置，并让 API 与客户端使用同一能力事实。
- 允许两人受控建号后关闭新账号注册，既有邮箱账号继续登录。
- 关闭密码重置时不创建令牌、不投递任务、不启动对应 Worker；关闭 QQ 时相关端点失败关闭。
- 发布预检区分 `personal` 与 `public`：个人模式不要求 QQ、邮件、品牌权属或公开运营设施；公开模式保持
  TASK-025 的严格门槛。
- 保持公网入口的 HTTPS、Secure Cookie、强 JWT、数据库/Redis 隔离、备份恢复和财务权限要求不变。

## 非目标

- 不接入或选择 QQ、邮件、云、WAF、监控或广告供应商。
- 不申请域名、商标、软著、应用商店名称或包名。
- 不修改财务数据模型、权限、金额、事务、幂等和审计语义。
- 不把本地或 CI 验收表述为已经部署到真实生产环境。

## 相关规则与验收

- BR-AUTH-001 至 007、BR-SECURITY-001 至 004。
- AC-AUTH-001 至 008、AC-SECURITY-001 至 005。
- ADR-035。

## 实施步骤

- [x] 读取仓库事实、Git 状态和 TASK-025 发布边界并完成预检
- [x] 建立任务分支、ExecPlan、规则和验收口径
- [x] 实现认证能力配置、公开能力接口与禁用路径失败关闭
- [x] 实现 Worker 按能力启动及个人/公开发布预检
- [x] 手机端按服务端能力隐藏注册、QQ 与密码重置入口
- [x] 更新 OpenAPI、环境示例、部署/安全/设计与发布文档
- [x] 完成针对性测试、全量验证、浏览器验收和最终差异审查
- [x] 更新项目记忆并完成提交、PR、远程 CI、合并和最终 main CI

## 验证命令

```bash
pnpm --filter @siyu/api test
pnpm --filter @siyu/mobile-web test
node --test scripts/check-release-environment.test.mjs scripts/native-runtime.test.mjs
pnpm openapi:generate
pnpm verify
pnpm release:check -- --env-file <personal-env> --mode native
pnpm release:browser:smoke
git diff --check
```

## 发布与回滚

- 本任务不修改数据库，无迁移。
- 发布前仍需仓库外备份及隔离恢复验证；个人模式可使用原生 Node 或 Compose。
- 应用回滚到 TASK-025 最终 `main@18fd57a6d472ecc98cee44adce40ebc56811ae33`。
- 若能力配置与客户端显示不一致，先回滚应用，不修改财务数据。

## 进度日志

- 2026-07-27：负责人确认当前目标是本人和女朋友可用；公开商业发布所需 QQ、邮件、品牌权属及运营设施
  可后续处理。完成预检并创建 `task/TASK-026-personal-deployment`。
- 2026-07-27：实现 `personal/public`、注册/QQ/密码重置开关、认证能力接口、API/Worker 失败关闭和移动端
  动态入口；个人档案 CLI 发布预检全部 PASS。
- 2026-07-27：Node 24 标准 `pnpm verify` 通过，全仓 197 项测试通过；另行完成 12 迁移/历史升级/约束、
  隔离 PostgreSQL/Redis 完整 API/Worker E2E、依赖审计和 Chrome 320/375/480px 双主题矩阵。
- 2026-07-27：功能提交 `344e4e7d5be0942ccf38759b09255d4e28073a3b` 经 PR #40 Squash merge
  合入 `main`，合并提交为 `fa36e9567906b087ac494f891be0e2fc63f39601`；PR CI Run
  `30236916112` 与 main push CI Run `30237054972` 的 `quality`、`database`、`secret-scan`
  全部通过，TASK-026 正式关闭。
