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
- 功能提交 `b64a5a05c4744d50636d1c14a1d438a34e9283f3` 经 PR #16 合入 `main`，合并提交为
  `7bf30e48322caf5a32bcf044548ebbac7d5faa55`。
- PR CI Run `29903360052` 与 main push CI Run `29903511196` 的 `quality`、`database`、`secret-scan`
  全部通过；两轮 `quality` 均执行完整 PostgreSQL/Redis E2E，TASK-014 正式关闭。

## 2026-07-22 TASK-015 本地验收

- Node.js 24.18.0 全仓 `pnpm verify` 与 123 项测试通过；API typecheck/build、Prisma validate、OpenAPI
  lint 74/74、共享类型、生产构建、文档、清单和差异检查通过。
- 第九迁移在隔离 PostgreSQL 17 空库部署成功；migrate status、零 diff、26 模型 introspection、43 个关键
  索引、62 个自定义约束、14 个关键删除策略和工资明细/汇总延迟一致性验证通过。
- 完整 API/Worker E2E 覆盖工资档案创建重放/冲突、单有效档案、模板更新、本人隔离、显式月度项目、同月
  唯一、严格复制紧邻上月、服务端汇总、未到账更新、跨用户 404 和已到账不可修改。
- E2E 使用宿主 Redis 6.0.16 时产生 BullMQ 最低 6.2 的非阻断提示；Compose 与 CI 固定 Redis 7.4，未降低
  运行基线。`pnpm audit --audit-level moderate` 无已知漏洞。
- 功能提交 `243f2bf6a546f2fc4a6379fb4967fb71ed5ef52f` 经 PR #18 合入 `main`，合并提交为
  `8d3bb4f012a4e4c275e3f96d2ebc54c39ceb6fe4`；PR CI Run `29907066496` 与 main push CI Run
  `29907257057` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-015 正式关闭。

## 2026-07-22 TASK-016 本地验收

- Node.js 24.18.0 全仓 `pnpm verify` 通过，共 125 项测试；format、lint、typecheck、Prisma validate、
  OpenAPI lint 74/74、Compose 配置、生产构建、文档和清单检查全部通过。
- 第十迁移在隔离 PostgreSQL 17 空库部署成功；migrate status、零 diff、26 模型 introspection、44 个关键
  索引、65 个自定义约束、14 个关键删除策略和数据库约束脚本通过。
- 隔离 PostgreSQL 完整 API/Worker E2E 覆盖工资无同步到账、同步生成 `income.salary` 收入、相同幂等请求
  重放、同键不同载荷冲突、不同键重复确认、并发去重、同步条件不可用原子回滚、跨用户 404、来源明细只读
  和脱敏到账审计，全部通过。
- 工资记录与 `SALARY` 来源收入的金额、业务日期、创建人、个人账本、工资分类和双向引用由延迟约束验证；
  已到账事实和来源财务字段不可修改，来源 Entry 禁止硬删除。
- 宿主 Redis 6.0.16 产生 BullMQ 最低 6.2 的非阻断提示；Compose 与 CI 固定 Redis 7.4。依赖审计无已知漏洞，
  `git diff --check` 和 Prisma 架构镜像一致性检查通过。
- 功能提交 `4b7222a649a72d9b60efc526e1bde8c72fc6b288` 经 PR #20 合入 `main`，合并提交为
  `4cfbd26ed24c42438ede27f57afef3a8c180e011`。PR CI Run `29912892385` 与 main push CI Run
  `29913079247` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-016 正式关闭。

## 2026-07-22 TASK-017 本地验收

- Node.js 24.18.0 下全仓 130 项测试通过；format、lint、typecheck、Prisma validate、OpenAPI lint 74/74、
  共享类型生成、Compose、生产构建、文档、清单、差异检查和依赖审计通过。
- 十迁移空库/历史回放、Prisma status/零 diff、26 模型 introspection、44 个关键索引、65 个自定义约束、
  14 个关键删除策略和数据库约束脚本通过；TASK-017 无新增迁移。
- 隔离 PostgreSQL 完整 API/Worker E2E 覆盖年度累计、12 月零值趋势、记录月份月均、六类专项代码、最近到账
  周期、短月发薪日、固定/日常支出、情侣账本排除、负余额、零剩余天数和跨用户空态，全部通过。
- 最终本地 E2E 首次因隔离 PostgreSQL 容器未运行在注册阶段返回 500；恢复容器并部署十次迁移后无代码改动
  即完整通过。宿主 Redis 6.0.16 仅提示 BullMQ 最低 6.2，Compose/CI 使用 Redis 7.4。
- 功能提交 `23420de1a434b0a3b299b90e2438b991bc30bfb7` 经 PR #22 合入 `main`，合并提交为
  `e972fe54c6228ff6079494f10b32a38fc50415af`。PR CI Run `29917586181` 与 main push CI Run
  `29917758079` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-017 正式关闭。

## 2026-07-22 TASK-018 本地验收

- 工资类型化客户端、余额/项目/年度图表组件及 `/salary`、`/salary/:year/:month`、`/salary/year/:year`
  三条受保护路由完成；账号入口已接入。
- 移动端 26 个测试文件 82 项通过；工资定向 2 个文件 10 项覆盖完整分页、精确元分转换、0 分模板过滤、
  无档案、服务端年度汇总、月度创建和到账快速重复点击、稳定幂等键、已到账只读和 12 月非官方声明。
- Node.js 24.18.0 下 `pnpm verify` 通过：全仓 140 项测试、format、lint、typecheck、Prisma validate、
  OpenAPI 74/74、Compose、生产构建、文档、清单和差异检查全部通过。
- `pnpm verify` 的首次 E2E 子步骤因当前 shell 未注入 `DATABASE_URL` 只完成健康检查；随后显式部署十次迁移并
  在隔离 PostgreSQL 上完整复跑 API/Worker E2E，认证、情侣、分类、Entry、借贷、周期和工资流程全部通过。
- 十迁移空库与历史回放、Prisma status、零 diff、introspection 和数据库约束脚本通过；TASK-018 无新迁移。
  宿主 Redis 6.0.16 仅产生最低 6.2 的非阻断提示，Compose/CI 基线保持 Redis 7.4。
- `pnpm audit --audit-level moderate` 无已知漏洞；Google Chrome Headless/CDP 覆盖 13 个工资场景，包含
  320px、375px、480px、日间/暗色、长文本、无档案、网络错误、档案抽屉、月度编辑、到账二次确认和年度
  12 月趋势，全部无横向溢出或小于 44px 的可见交互区。
- 本任务未修改数据库、公开 API、Worker、情侣权限或生产依赖。
- 功能提交 `315079a2a807d97c76b07edeb9e7bc2a2cfd366a` 经 PR #24 合入 `main`，合并提交为
  `2967c588b1d0d923f8ec2f6e36acc95c6270a579`。PR CI Run `29922038043` 与 main push CI Run
  `29922213012` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-018 正式关闭。

## 2026-07-22 TASK-019 本地验收

- 攒钱目标 8 个 API 操作已真实实现；成员汇总、初始金额归属、服务端能力字段、幂等、目标锁和软删除审计完成。
- API 单元测试 44 项通过；完整 PostgreSQL/Redis API/Worker E2E 通过，新增覆盖目标重放/冲突、成员越权、
  并发存入、本人贡献修改/删除、完成状态回退、删除留痕、退出成员不可见和解散账本不可见。
- 第十一迁移空库与历史升级、重复部署、Prisma status、零 diff、introspection、47 个关键索引、73 个自定义
  约束、15 个关键删除策略及储蓄专属触发器验证通过。
- OpenAPI lint 与 74/74 覆盖通过，共享类型生成成功；无生产依赖、Worker、普通账目、工资、借贷或周期行为变化。
- Node.js 24.18.0 全仓 `pnpm verify` 与 144 项测试通过；文档、清单、format、lint、typecheck、Prisma、
  OpenAPI、Compose、完整 E2E、生产构建和差异检查全部通过。
- 首次完整 E2E 在迁移测试清理掉隔离数据库容器后于注册阶段返回 500；重建测试数据库并部署 11 个迁移后无
  业务代码改动即完整通过。宿主 Redis 6.0.16 仅有 BullMQ 最低 6.2 的非阻断提示。
- 功能提交 `37ac11c9f2ff91b73af07fb0dd6b85f98572d28f` 经 PR #26 合入 `main`，合并提交为
  `a04bbef97dfe1cb35527b6e6d3f2cca46db74964`。PR CI Run `29929382178` 与 main push CI Run
  `29929562773` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-019 正式关闭。

## 2026-07-22 TASK-020 本地验收（交付候选）

- 攒钱类型化客户端、目标卡/表单及 `/saving-goals`、`/saving-goals/new`、`/saving-goals/:id` 三条路由完成；
  账号入口、账本恢复、完整分页、目标管理和本人存入增改删已接入。
- 定向 2 个测试文件 10 项通过，覆盖分页去重、精确元分、整数万分比、路径编码、目标/存入快速重复提交、
  独立稳定幂等键、加载竞态、删除确认、操作后详情重取和服务端能力字段；移动端 typecheck 与全仓 lint 通过。
- 首次移动端全量压力执行中既有周期快速提交用例单次未发出请求；同文件单独复跑 3/3 通过，最终再次完整执行
  28 个文件 92 项全部通过。测试未被删除、跳过或弱化。
- Google Chrome Headless/CDP 覆盖 13 个场景，包含 320px、375px、480px、日间/暗色、正常、加载、空、
  网络失败、新建长表单、详情长文本、只读、资源不可见和刷新恢复；全部 `scrollWidth === innerWidth`，
  可见交互区不小于 44px，无未处理运行时错误。
- 真浏览器发现首次账本选择与 URL 同步会并发中止加载请求并短暂显示空态；改为显式账本切换处理后全矩阵通过。
- 本任务无数据库、迁移、公开 API、Worker、通知或生产依赖变化；TASK-019 服务端权限、事务、幂等和隐私边界不变。
- Node.js 24.18.0 全仓 `pnpm verify` 与 153 项测试通过；format、lint、typecheck、Prisma validate、OpenAPI
  74/74、Compose、生产构建、文档、清单和差异检查全部通过。
- 隔离 PostgreSQL 17 确认 11 个迁移无待应用，认证、情侣、分类、Entry、借贷、周期、工资和攒钱完整
  PostgreSQL/Redis E2E 通过；依赖审计无已知漏洞。宿主 Redis 6.0.16 只有非阻断最低版本提示。
- 功能提交 `f1e69b99c716cfbc9b0b48aba5c0694799d282fb` 经 PR #28 合入 `main`，合并提交为
  `4f88b8b20fec2b0790ebd84f5d863ae6cdf95a34`；PR CI Run `29937823275` 与 main push CI Run
  `29938160014` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-020 正式关闭。

## 2026-07-22 TASK-021 本地验收（交付候选）

- 通知 API 已实现本人稳定分页、全局未读数和批量已读；单条更新同时限定 `userId` 与 `readAt IS NULL`，未知、
  他人和已读 ID 不区分存在性，首次服务端 UTC `readAt` 不覆盖。
- API 12 个文件 47 项、移动端 30 个文件 99 项通过；新增 7 项覆盖完整分页去重、超过 100 条分批、未知类型
  回退、加载竞态、快速重复已读门禁、服务端事实重取和网络错误。
- Node.js 24.18.0 标准 `pnpm verify` 通过，连同原生网关、共享包、校验包和管理端共 164 项测试；format、
  lint、typecheck、Prisma validate、OpenAPI lint/74 覆盖、Compose、生产构建、文档、清单和差异检查通过。
- 第十一迁移空库/历史升级、重复部署、Prisma status、零 diff、introspection 和数据库约束脚本通过；本任务
  没有新增 Schema 或迁移。迁移测试按设计删除测试容器后首次完整 E2E 在注册阶段返回 500；重建容器并部署
  11 个迁移后无代码改动即通过。
- 隔离 PostgreSQL/Redis 完整 API/Worker E2E 新增覆盖本人和伴侣通知隔离、`createdAt/id` 稳定排序、分页
  元数据、跨用户/未知 ID 防枚举、重复已读幂等、首次已读时间不覆盖及空/重复 ID 校验。宿主 Redis 6.0.16
  仅有最低 6.2 的非阻断提示。
- Google Chrome Headless/CDP 11 个场景覆盖 320px、375px、480px、日间/暗色、正常、加载、空、网络失败、
  无权限、长文本、刷新恢复和提交中；均无横向溢出或小于 44px 的可见交互区。
- `pnpm audit --audit-level moderate` 无已知漏洞；TASK-021 不新增通知生产类型、数据库迁移、生产依赖、邮件、
  短信、Push、通知偏好、导出或管理后台范围。
- 功能提交 `1e9b6582951ef33fd8970f6bb746b4d6bb688783` 经 PR #30 合入 `main`，合并提交为
  `1b87e87c45af5fa5e361374719f6f0b70c8b886a`；PR CI Run `29943627794` 与 main push CI Run
  `29943823960` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-021 正式关闭。

## 2026-07-23 TASK-022 本地验收（交付候选）

- 第十二迁移新增七个 ADMIN 细粒度权限，空库、历史升级、重复部署、Prisma status/零 diff 与数据库约束通过。
- Node.js 24.18.0 `pnpm verify` 与 164 项全仓测试通过；OpenAPI 81/81、共享类型生成、API 47 项、管理端 2 项和生产构建通过，依赖审计无已知漏洞。
- 隔离 PostgreSQL/Redis 完整 E2E 新增覆盖普通用户拒绝、脱敏用户/关系/审计、管理员自停用拒绝、停用后
  会话失效、FAILED 周期实例人工重试和审计读取留痕；全部通过。
- 迁移测试按设计清理测试容器后，首次 E2E 在注册阶段因数据库不可达返回 500；恢复测试容器并部署 12 个
  迁移后无业务代码改动即完整通过。宿主 Redis 6.0.16 只有既有最低版本提示。
- WSL 禁用 Windows 可执行互操作，Chrome CLI 无法启动；Chrome 控制插件又缺少本会话必需运行接口，因此
  未生成真浏览器截图。未将组件测试或构建冒充视觉验收，待可用环境补跑三尺寸、双主题矩阵。
