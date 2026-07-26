# TASK-024：权限与安全审计

## 状态

已完成

## 目标

- 系统审计认证、会话、RBAC、资源归属、情侣成员关系、私有财务数据、管理后台、Worker、日志和运行配置。
- 以可复现证据确认已批准权限与安全规则；发现缺陷时在本任务完成最小修复和回归测试。
- 形成分级审计报告，为 TASK-025 发布验收提供无高危/中危未解决项的基线。

## 非目标

- 不新增业务能力、未批准数据模型、生产依赖或管理员财务明细权限。
- 不执行生产部署、生产凭据配置、真实用户数据扫描或攻击外部系统。
- 不借安全审计重构无关 UI、领域模型或迁移历史。

## 相关规则与验收

- BR-AUTH-001 至 003、BR-USER-001 至 003、BR-COUPLE-001 至 016、BR-AUDIT-001。
- 各领域的本人/成员/OWNER、软删除、幂等、来源维护和私有数据规则。
- AC-AUTH-001 至 004、AC-COUPLE-001 至 012、AC-ENTRY-008 至 014、AC-RECUR-013 至 015、
  AC-SALARY-010 至 022、AC-SAVING-005 至 011、AC-NOTIFY-001 至 003、AC-ADMIN-001 至 006、
  AC-EXPORT-002 至 003、AC-QUALITY-001。
- ADR-013 至 018、ADR-020、ADR-025 至 032。

## 审计口径

- 资源不可见操作优先完成当前用户、有效账本/成员和归属过滤，不通过错误码或时序泄露资源存在性。
- 禁用、退出、转移和解散提交后，Access Guard 与每个业务查询都必须立即按数据库现状失效。
- 工资和借贷只按当前 `userId` 查询；管理员默认不能读取财务明细，细粒度权限必须由服务端同时校验。
- Cookie、CORS、OAuth state、密码重置、限流和日志必须 fail closed；Token、密钥、完整财务内容不得进入日志或审计。
- API、Worker、数据库约束和反向代理配置共同构成安全边界，前端路由与按钮不是授权依据。

## 依赖与风险

- 审计横跨全部业务模块，静态发现必须用真实负向 E2E 复现，避免只按代码形状误判。
- 修复授权查询可能改变 403/404 或事务顺序，必须验证防枚举、幂等重放和既有正常路径。
- 安全工具可能产生依赖或秘密误报；只记录可验证问题，不以隐藏/跳过扫描换取通过。
- 生产 OAuth、邮件、域名和密钥不可用，生产联调缺口必须与代码安全结论分开记录。

## 实施步骤

- [x] 强制预检、同步 `main`、建立任务分支与 ExecPlan
- [x] 盘点全部 HTTP/Worker 入口、Guard、DTO、Repository 授权条件和审计内容
- [x] 审计认证/会话/OAuth/Cookie/CORS/CSRF/限流和错误处理
- [x] 审计各业务资源 IDOR、防枚举、成员状态、私有数据和来源维护边界
- [x] 审计管理员 RBAC、Worker、运行配置、日志、秘密与供应链
- [x] 以负向单元/E2E 复现并修复全部高危、中危和可安全修复的低危发现
- [x] 生成审计报告并完成全仓质量门、文档、项目记忆和清单
- [x] 提交、PR、CI、合并、main CI 与正式关闭

## 数据迁移与回滚

- 审计本身不预设数据库变化；若发现只能由约束修复的问题，先在本计划记录具体风险再新增 create-only 迁移。
- 应用修复按独立提交回滚；不得删除既有财务、审计、幂等或会话事实。

## 验证命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm prisma:validate
pnpm openapi:lint
pnpm compose:check
pnpm native:check:config
pnpm build
pnpm audit --audit-level moderate
pnpm docs:check
pnpm manifest:check
git diff --check
```

## 进度日志

- 2026-07-23：TASK-023 功能与关闭 PR 均合入，最终 `main@e5deb8e43e81117ff95b9018cb21c934c4765540`
  的 CI Run `29970951297` 全绿；创建 `task/TASK-024-security-audit`。
- 2026-07-23：完成产品、权限、安全、API、Worker、部署、质量和项目状态预检；确认无既有 TASK-024 ExecPlan。
- 2026-07-26：完成全部 Controller、Guard、Repository、Worker、Nginx、Compose、原生网关和环境配置审计；
  工资、借贷、情侣/账目/周期/统计/攒钱/通知/导出与管理端未发现新的 IDOR 或财务越权旁路。
- 2026-07-26：修复 4 项高危、2 项中危和 1 项低危发现；新增实时 RBAC/禁用会话、OAuth 浏览器绑定、
  absolute-form SSRF、生产配置、限流和响应头回归。
- 2026-07-26：依赖审计捕获新发布的 PostCSS、`brace-expansion` 和 Valibot 公告；覆盖到安全版本并为旧版
  `minimatch` 加入兼容补丁，受影响版本已从锁文件清除，累计修复 6 项高危、3 项中危和 1 项低危发现。
- 2026-07-26：Node.js 24.18.0 全仓 177 项测试与完整 PostgreSQL/Redis API/Worker E2E 通过；两处旧 E2E
  断言按 ADR-033 更新为“禁用即 401、数据库实时授予 ADMIN”，未弱化新 Guard。
- 2026-07-26：冻结锁文件安装、12 个迁移空库/历史升级/重复部署/约束检查、标准 `pnpm verify`、原生配置、
  依赖审计、文档、清单和差异检查通过；OpenAPI 覆盖 81/81，依赖审计无已知漏洞。
- 2026-07-26：功能提交 `72b38ea8709a2ddc84942df9f4fc734233a88033` 经 PR #36 Squash merge 合入
  `main@c8154019544f11ccb30f92c5ecf73744042ac103`。
- 2026-07-26：PR CI Run `30209669521` 与 main push CI Run `30209769716` 的 `quality`、`database`、
  `secret-scan` 全部通过；两轮均覆盖完整 E2E、构建、依赖审计和秘密扫描，TASK-024 正式关闭。

## 决策记录

- 采用 ADR-033：JWT 角色声明不是当前授权事实，Guard 每次读取数据库现状；OAuth state 绑定浏览器；代理
  固定上游且生产配置失败关闭。不扩大管理员业务或财务数据范围。

## 完成结果

TASK-024 已正式关闭：10 项发现全部修复，无未解决高危/中危代码发现；无数据库或公开 API 契约变化。
下一项为 TASK-025 全链路 E2E 与发布验收。
