# TASK-009 验证报告

日期：2026-07-15

## 结论

TASK-009 已在本地源码快照完成首页与基础统计。四个既有统计端点真实聚合未软删除 Entry，移动端新增
受保护 `/home` 与 `/statistics`，自动质量门和真实 Chromium 多尺寸、双主题验收通过。无数据库迁移或缓存；
当前工作区没有 `.git` 和 Docker，因此没有提交/远端 CI，也未本地复跑 PostgreSQL E2E。

## 统计、权限与隐私

- 概览返回收入、支出、结余、日均支出、最大单笔和笔数；金额全过程使用 `bigint`，响应前检查安全整数范围。
- 月份缺省按用户时区确定，显式月份按 Entry 业务日期解释；当前月日均按已过自然日，过去月按整月天数。
- 趋势返回 28–31 天完整逐日零值序列；分类返回支出金额、笔数和整数万分比。
- 情侣成员支出按 Entry 创建人归属，保留有历史账目的退出成员；个人账本只返回本人。
- Repository 查询固定 `ledgerId`、业务日期范围和 `deletedAt: null`，账本查询要求有效账本与当前用户 ACTIVE 成员。
- 非成员、退出成员和已解散账本按资源不可见处理；不返回工资或个人借贷数据。

## 移动端

- `/home` 支持个人/情侣账本和月份切换，展示真实月度汇总、情侣成员支出和最近账目。
- `/statistics` 展示概览、ECharts 完整日趋势、支出分类排行、情侣成员对比和其他指标。
- 首页不显示未上线工资、借贷、周期、攒钱金额，仅说明模块上线后开放。
- 加载、空数据、请求失败、无权限、长文本和夜间状态均有明确呈现。
- ECharts 按需注册，两个新路由懒加载；入口约 294 KB，图表块约 507 KB（gzip 172 KB），构建无告警。

## 自动化验证

- 移动端：10 个测试文件、28 项通过。
- API：4 个测试文件、10 项通过，覆盖统计日期、精确汇总、零值趋势、占比、软删除过滤和成员授权查询形状。
- 全仓：53 项通过。
- `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`：通过。
- `pnpm openapi:lint`：通过，74/74；共享类型重新生成成功。
- 原始 `pnpm docs:check`/`manifest:check` 需要 Bash；当前 WSL 未安装，使用等价 PowerShell 检查与清单生成。

## 浏览器验收

- Chromium 320px、375px、480px：`scrollWidth === innerWidth`，可见交互区均不小于 44px。
- 日间/夜间无白底残留，ECharts 颜色和背景随 Token 更新；控制台正常数据场景无错误或警告。
- 长账本名、长分类名、长成员昵称和大金额未产生横向溢出。
- 空数据不显示空坐标轴，提供“记一笔”；404 场景显示资源不可见状态。
- API 响应仅在 Playwright 会话中按批准契约拦截，未写入生产代码。

## 2026-07-17 全分支集成验证

- 审计 10 个远端分支和 8 个 PR，确认仅 `task/TASK-008-entry-ui` 含有未被 `main` 完整覆盖的实现。
- 移动端：20 个测试文件、61 项测试通过；包含会话恢复、金额解析、筛选分页、创建防重、服务端权限、确认删除、弹层焦点和首页/统计导航兼容。
- 全仓：94 项测试通过；lint、typecheck、Prisma validate、生产构建、OpenAPI 74/74、manifest 和 docs 检查通过。
- Redocly 在 Windows 上完成契约验证后退出时出现 libuv 断言；覆盖率脚本独立通过，最终数据库和 Linux 工具链验证交由 GitHub CI。

## 已知边界与下一项

- 当前没有统计缓存，因此账目修改/删除后的下一次查询直接聚合最新数据；未来引入缓存必须实现失效规则。
- 当前机器没有 Docker，无法复跑真实 PostgreSQL 统计查询与 E2E；需在 CI/可用环境补做。
- TASK-010 借贷数据与 API 是下一项；KI-006 必须先决定删除来源业务时已同步账目的保留/解绑/删除策略。

## 2026-07-22 TASK-008 至 TASK-010 正式闭环

- PR #8、PR #9 已合并；最新 `main` 为 `2b4b384c7dcac23e58e2042f0a3f43ea79679277`。
- PR #8 CI Run `29568630493`、PR #9 CI Run `29571169599`、main push CI Run `29571310880` 的
  `quality`、`database`、`secret-scan` 全部通过。
- Linux CI 已执行借贷隔离 E2E、第六迁移部署和数据库约束脚本，因此上文“无 Git/Docker、TASK-010 待执行”
  是历史快照，不再代表当前状态；TASK-008、TASK-009、TASK-010 已正式关闭。

## 2026-07-22 TASK-011 本地验收

- Node.js 24.18.0 下，借贷工具、页面和 TASK-009 回归定向 3 个文件 9 项通过。
- 类型检查在按当前 Prisma Schema 重新生成本地 Client 后通过；此前错误来自同步 main 后的旧本地生成物。
- 全仓 99 项测试和临时隔离 PostgreSQL 17 / Redis 7.4 上的 API E2E 通过；临时容器和网络已清理，未删除数据卷。
- format、lint、typecheck、Prisma validate、OpenAPI lint/74 覆盖、Compose、build、docs 和差异检查通过。
- Google Chrome Headless/CDP 验收覆盖 320px、375px、480px，日间/暗色、空数据、网络失败、404、
  长对方名称、长备注和处理抽屉；所有页面无横向溢出，可见交互区均不小于 44px。
- 依赖审计最初发现 OpenAPI/Prisma 工具链 3 个可修补传递依赖公告；以补丁版本覆盖更新
  `@hono/node-server`、`fast-uri` 和 `js-yaml` 后，`pnpm audit --audit-level moderate` 无已知漏洞。
- 真实 API/数据库契约没有变化；TASK-010 的服务端权限、幂等、事务和隐私 E2E 继续由已通过的 main CI 覆盖。
- 功能提交 `f5f012f04868bab29e5d21d191ab9e2731b59ba8` 经 PR #10 合入 `main`，合并提交为
  `9bbc560622761fc9e0dc74807e2b85e0366246ad`。
- PR CI Run `29889775437` 与 main push CI Run `29889890113` 的 `quality`、`database`、
  `secret-scan` 全部通过，TASK-011 正式关闭。

## 2026-07-22 TASK-012 本地验收

- Node.js 24.18.0 下 format、lint、typecheck 与全仓 103 项测试通过，其中周期日期算法 4 项、API 共 19 项。
- Prisma validate、OpenAPI lint/74 覆盖及共享类型生成、Compose、原生配置、生产构建和依赖审计通过。
- 第七迁移在空库和历史升级路径应用成功；status、零 diff、25 模型 introspection、34 个关键索引、
  56 个约束、13 个删除策略、周期计划/终态不可变和来源账目防篡改验证通过。
- 隔离 PostgreSQL 上认证、情侣账本、分类、Entry、借贷和周期完整 E2E 通过；周期覆盖创建与确认并发幂等、
  自动入账、固定期数、待确认/跳过、失败事实、失败实例计划锁定、原位重试和情侣权限。
- 宿主 Redis 6.0.16 产生 BullMQ 最低 6.2 的非阻断提示；Compose 与生产基线仍固定 Redis 7.4，未降低要求。
- 功能提交 `558fdb84c0b61352f8725048faf4556fc3b02be6` 经 PR #12 合入 `main`，合并提交为
  `0181f2e98effb23bc5c9e5e29a3415784db51ca4`。
- PR CI Run `29894967989` 与 main push CI Run `29895072247` 的 `quality`、`database`、
  `secret-scan` 全部通过，TASK-012 正式关闭。

## 2026-07-22 TASK-013 本地验收

- Node.js 24.18.0 下 format、lint、typecheck 和全仓 113 项测试通过；新增 API 单元测试覆盖 Worker 配置、
  稳定 Job ID、时区扫描、分页、计划日传递、错误分类和毒任务拒绝。
- 生产构建、Prisma validate、OpenAPI lint/74 覆盖与类型生成、Compose、原生配置和
  `pnpm audit --audit-level moderate` 全部通过，无公开 API 或生产依赖变化。
- 第八迁移在空库与历史升级路径应用成功；Prisma status/零 diff、25 模型 introspection、36 个关键索引、
  56 个约束、13 个删除策略和同接收人/同周期实例通知唯一性验证通过。
- 隔离 PostgreSQL 17 + Redis 7.4 的完整 API/Worker E2E 通过；真实 BullMQ 覆盖 Job Scheduler 注册、两个
  并行 Worker、重复扫描和稳定 Job ID、自动入账、确认通知、情侣创建人与 OWNER 接收人、旧任务跳过、
  不可恢复业务失败，以及失败任务再次扫描不自动重跑。
- Worker 日志断言未包含金额或规则名称；未知底层错误统一为安全错误码。临时测试容器在验收后已移除。
- GitHub `quality` 作业已补充 PostgreSQL 17 服务、测试环境变量和显式迁移步骤；PR CI 将真实执行同一完整
  API/Worker E2E，而非在缺少 `siyu_test` 数据库时只通过健康检查。
- 实现提交 `ba136bad896e0dd6d065df83626a0801cf93c27f`、CI 提交
  `b6f6718eba13e5181ab1e3b2430a2bc7e21407a7` 与交付头 `830a9592da5ed9043208d88e1c5877c7c69d2b06`
  经 PR #14 合入 `main`，合并提交为 `72633ac7a478c01012a9ded7e41e8390b50a876a`。
- PR CI Run `29898941240` 与 main push CI Run `29899089545` 的 `quality`、`database`、`secret-scan`
  全部通过；两次 `quality` 均执行迁移和完整 PostgreSQL/Redis Worker E2E，TASK-013 正式关闭。

## 2026-07-22 TASK-014 本地验收

- 周期类型化客户端、共享卡片/表单及 `/recurring`、`/recurring/new`、`/recurring/:id` 三条受保护路由完成。
- 移动端 24 个测试文件 72 项通过；周期定向 6 项覆盖完整分页和去重、账本边界、编码确认路径、状态标签、
  创建/确认失败重试稳定幂等键、快速重复点击和服务端能力字段。
- Node.js 24.18.0 下 `pnpm verify` 通过：全仓 119 项测试、隔离 PostgreSQL 17 / Redis 7 完整 E2E、
  生产构建、Prisma、OpenAPI 74/74、Compose、文档、清单和差异检查全部通过。
- `pnpm audit --audit-level moderate` 无已知漏洞；E2E 的 `pg` 调用产生既存未来弃用提示，不影响测试结果。
- Google Chrome Headless/CDP 覆盖 320px、375px、480px，日间/暗色、正常、空、网络失败、404、长文本、
  创建顶端/底部、详情和确认抽屉；13 张截图均无横向溢出或小于 44px 的可见交互区。
- 浏览器验收发现并修复长表单粘性保存按钮遮挡；复测计算样式为普通文档流，滚动到底部仍可完整访问结束条件、
  提醒天数、帮助文本和保存按钮。页面 API 仅在验收会话中按已批准契约拦截，未加入生产假数据。
- 本任务无数据库、公开 API、Worker、通知或生产依赖变化；TASK-012/TASK-013 的事务、权限与幂等事实保持不变。
