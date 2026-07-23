# 当前项目状态

更新时间：2026-07-23
文档版本：v1.31.0
代码状态：TASK-023 CSV 导出已合并、CI 通过并正式关闭；下一项为 TASK-024 权限与安全审计

## 当前阶段

M3、M4、M5、M6、M7 已完成并合入 `main`；M8 的 TASK-022、TASK-023 已正式关闭，下一项为 TASK-024。

## 已完成

- 品牌唯一事实来源迁至 `docs/product/BRAND_IDENTITY.md`，正式名称和工程命名已同步。
- Git 仓库与 `task/TASK-000-project-bootstrap` 分支。
- Node.js 24 / pnpm 11 Monorepo，三个应用和三个共享包。
- Vue 手机端与管理后台最小可渲染壳、设计 Token 和日夜主题基线。
- NestJS API/Worker 独立入口、统一 requestId、统一错误响应和 `/health`。
- Prisma 7.8 Schema、create-only 初始迁移、部分唯一索引、归属外键和 CHECK。
- OpenAPI 3.1 覆盖 API_CONTRACT 已批准的 65 个操作，并生成共享类型。
- PostgreSQL、Redis、API、Worker、Nginx Compose 与占位环境样例。
- 非 Docker 原生运行：根目录环境加载、依赖连通性检查、Vite API 代理、API/Worker/前端进程编排和生产静态网关。
- 文档、格式、lint、类型、单元、API E2E、构建、OpenAPI、Prisma、依赖审计和 CI 基线。
- 邮箱注册/登录、QQ OAuth Provider、Access/Refresh 会话、密码修改/重置、用户资料和最小 RBAC。
- 首次注册或 QQ 登录事务内创建用户、唯一 PERSONAL 账本、OWNER 成员和默认 USER 角色。
- Refresh Token 原子轮换、重放撤销、Cookie 安全策略、Redis 限流和认证审计脱敏。
- 密码重置 BullMQ 任务、移动端认证页面与路由恢复、管理端登录与 ADMIN 服务端授权边界。
- 情侣账本创建、查询、改名、邀请、接受、成员退出、所有权转移和解散 API。
- 邀请一次性摘要、用户/操作幂等键、单活邀请、事务级锁、两人上限与单用户单情侣账本数据库触发器。
- 情侣成员和所有者权限、退出/转移/解散审计，以及移动端“朝暮同笺”管理页面完整状态。
- PR #2 已以 Squash merge 合入 main，提交为 `6ebb13537dc0246a4a6a165bd348b88582c4dbbe`。
- TASK-002 设计 Token/基础组件和 TASK-003 PostgreSQL/Prisma 基线已确认吸收进 TASK-000。
- 默认分类全局模板与账本内实例、16 个版本 1 默认分类、注册/QQ/情侣账本事务初始化。
- 分类创建、更新、稳定排序、启停、幂等、审计和 OWNER/MEMBER 权限 API；OpenAPI 74/74。
- 分类、Entry 和 RecurringRule 的账本/类型复合归属外键，停用分类新引用拒绝与历史引用保留。
- 移动端 `/categories` 页面：账本/类型 URL 恢复、启停分组、图标/颜色、上下排序和服务端能力字段。
- PR #4 已以 Squash merge 合入 main，功能提交为 `25dcad0a29951ba4269e318423d5ebbf301857b3`。
- 普通手工账目查询、创建、详情、修改和软删除 API，以及服务端 OWNER/MEMBER 能力字段。
- Entry 不可变 SHA-256 创建请求哈希、用户/操作幂等、整数版本乐观锁和权限优先软删除重试。
- 受控支付方式、创建人成员复合归属、有效创建人触发器、四个未删除记录部分查询索引和安全审计。
- TASK-007 五迁移历史升级、异常归属 fail-closed、Entry/认证/情侣/分类 E2E 和 OpenAPI 74/74。
- PR #6 已以 Squash merge 合入 main，功能提交为 `f6e579957535ccb5ea4ce06d9d4bb8368d7c994c`。
- 移动端 `/entries/new`、`/entries`、`/entries/:id`，覆盖账本切换、创建防重复、筛选分页、详情编辑和版本化删除。
- 账目页面只消费服务端 `canEdit/canDelete`，非 `MANUAL` 来源只读；金额以整数分收发并统一格式化。
- StatisticsModule 直接聚合未软删除 Entry，提供概览、完整逐日趋势、支出分类和成员支出四个端点。
- 移动端受保护 `/home` 与 `/statistics`，共享账本、月份和用户时区；ECharts 按需注册并随统计路由懒加载。
- TASK-008 完整记账客户端经 PR #9 整合进入 `main`；TASK-009 首页与统计、TASK-010 借贷 API 和原生运行模式经 PR #8 进入 `main`。
- 借贷 API 支持本人私有 CRUD、部分还款/收款、结清、逾期、幂等和可选普通账目联动；第六迁移、数据库约束与隔离 E2E 已由 GitHub CI 验证。
- 移动端 `/debts`、`/debts/new`、`/debts/:id` 已实现完整分页汇总、创建、详情、编辑、删除、部分还款/收款和可选普通账目同步。
- 借贷客户端只在个人入口出现，使用服务端 `canEdit/canDelete`、稳定幂等键和整数分；统计完整性不足时不显示部分汇总。
- TASK-011 功能提交 `f5f012f04868bab29e5d21d191ab9e2731b59ba8` 已经 PR #10 合入 `main`，合并提交为 `9bbc560622761fc9e0dc74807e2b85e0366246ad`。
- 周期规则列表、创建、详情、修改、暂停、恢复、软删除，以及周期实例列表、确认和跳过 API 已实现。
- 月末/闰日锚点、固定期数、恢复不补期、确认金额覆盖、创建/确认幂等和情侣 OWNER/MEMBER 权限已固化。
- TASK-012 第七迁移补齐周期创建/确认事实、活动创建人归属、计划与终态不可变、失败记录和周期来源账目双向一致性。
- Worker 可复用的到期物化领域入口已完成；自动账目、实例和规则进度在同一事务内提交，并支持失败实例原位重试。
- TASK-012 功能提交 `558fdb84c0b61352f8725048faf4556fc3b02be6` 已经 PR #12 合入 `main`，合并提交为 `0181f2e98effb23bc5c9e5e29a3415784db51ca4`。
- 周期 Worker 已实现 `siyu-recurring-due` Job Scheduler、启动扫描、按创建人时区游标扫描和规则/计划日稳定 Job ID。
- 多 Worker 重复扫描、重试和延迟旧任务在领域锁内复核计划日，并由周期实例、来源账目和通知唯一约束共同幂等。
- 临时失败使用指数退避，分类停用等业务状态直接最终失败；结构化日志只记录安全事件码、ID、计数和耗时。
- 确认模式实例在同一事务中通知当前规则创建人与情侣账本 OWNER，第八迁移防止同一接收人重复通知。
- TASK-013 交付头 `830a9592da5ed9043208d88e1c5877c7c69d2b06` 已经 PR #14 合入 `main`，合并提交为
  `72633ac7a478c01012a9ded7e41e8390b50a876a`。
- 移动端 `/recurring`、`/recurring/new`、`/recurring/:id` 已实现完整规则/实例分页、账本切换、创建、详情、
  编辑、暂停、恢复、删除、确认入账和跳过。
- 周期客户端只消费服务端能力字段；创建和确认使用失败重试稳定幂等键，金额仍以整数分收发，长表单提交按钮
  保持普通文档流且不遮挡字段。
- TASK-014 功能提交 `b64a5a05c4744d50636d1c14a1d438a34e9283f3` 已经 PR #16 合入 `main`，合并提交为
  `7bf30e48322caf5a32bcf044548ebbac7d5faa55`。
- 工资档案列表/创建/更新、独立默认项目模板，以及月度记录列表/创建/详情/未到账更新 API 已实现。
- 工资创建支持显式项目或严格复制同档案紧邻上月，服务端从项目计算应发、扣除和实发；档案与记录创建均
  保存不可变请求哈希和用户级幂等事实。
- 第九迁移新增工资模板表、单有效档案、记录/模板项目唯一性、明细汇总延迟一致性和已到账不可变约束；工资
  数据始终按本人隔离，越权详情不泄露资源事实。
- 工资到账确认 API 已实现显式到账日期、是否同步收入和独立幂等键；同键同载荷重放、不同载荷冲突，已到账
  工资保持一次性终态。
- 选择同步时，在本人有效个人账本的 `income.salary` 分类生成唯一 `INCOME + SALARY` 来源明细；金额等于
  实发工资、业务日期等于到账日，状态、来源明细、幂等事实和脱敏审计同事务提交。
- 第十迁移新增到账幂等事实、用户级唯一索引、工资与来源收入双向延迟约束、到账/来源不可变触发器及来源
  明细删除限制；跨用户记录和来源明细继续保持不可见。
- 工资年度汇总 API 已按工资月份返回本人全年累计、存在记录月份的月均实发、六类稳定项目代码累计和完整
  12 个月零值趋势；所有金额仍为整数分，并显式声明非官方账户余额。
- 工资余额 API 已按用户时区选择最近已到账工资，计算短月份安全的下一预计发薪日，并只聚合本人有效个人
  账本在工资周期内的有效支出；周期来源与其他来源分别计入固定和日常支出，支持负余额与零剩余天数空态。
- BR-SALARY-021 至 023、AC-SALARY-020 至 022 和 ADR-029 已冻结工资年度、到账周期、支出分类与隐私口径；
  两个统计操作已补齐精确 OpenAPI Schema 和共享生成类型，不新增迁移或持久化统计事实。
- 移动端 `/salary`、`/salary/:year/:month`、`/salary/year/:year` 已实现工资档案设置、当前周期余额、月度
  创建/编辑、服务端复制上月、到账二次确认、已到账只读和年度 12 月趋势；账号页新增个人工资入口。
- 工资客户端完整读取记录分页，使用精确元分转换；档案、月度记录和到账分别维护稳定幂等键，0 分模板项不
  写入月度记录，年度专项数据固定声明不代表官方账户余额。
- AC-SALARY-023 至 025 已固化工资三页的数据来源、空态、重复提交、移动端状态和视觉验收边界；本任务没有
  修改工资 API、数据库、迁移、Worker、情侣权限或生产依赖。
- TASK-018 功能提交 `315079a2a807d97c76b07edeb9e7bc2a2cfd366a` 经 PR #24 合入 `main`，合并提交为
  `2967c588b1d0d923f8ec2f6e36acc95c6270a579`；PR CI Run `29922038043` 与 main push CI Run
  `29922213012` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-018 正式关闭。

- 攒钱目标与存入 API 已实现列表、创建、详情、更新和软删除；支持初始金额归属、成员汇总、整数万分比进度、
  双向 `ACTIVE/COMPLETED` 切换和服务端能力字段。
- 第十一迁移新增目标/存入幂等哈希、成员归属、创建事实不可变、目标汇总/状态延迟一致性和查询索引；目标级
  事务锁串行化并发存入，每次从有效事实重算汇总。
- TASK-019 功能提交 `37ac11c9f2ff91b73af07fb0dd6b85f98572d28f` 经 PR #26 合入 `main`，合并提交为
  `a04bbef97dfe1cb35527b6e6d3f2cca46db74964`；PR CI Run `29929382178` 与 main push CI Run
  `29929562773` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-019 正式关闭。
- 移动端 `/saving-goals`、`/saving-goals/new`、`/saving-goals/:id` 已实现目标完整分页、账本选择恢复、创建、
  详情、OWNER 编辑/删除、本人存入新增/编辑/删除、成员贡献和服务端进度展示；账号页已新增入口。
- 目标与存入创建分别保持失败重试稳定幂等键，金额精确转整数分；客户端只消费服务端
  `canManage/canContribute/canEdit/canDelete`，操作成功后重取详情而不本地猜测汇总。
- AC-SAVING-012 至 014 已固化移动端分页、幂等、能力字段、删除确认、状态和视觉验收边界；本任务没有修改
  攒钱 API、数据库、迁移、Worker、其他业务行为或生产依赖。
- TASK-020 功能提交 `f1e69b99c716cfbc9b0b48aba5c0694799d282fb` 经 PR #28 合入 `main`，合并提交为
  `4f88b8b20fec2b0790ebd84f5d863ae6cdf95a34`；PR CI Run `29937823275` 与 main push CI Run
  `29938160014` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-020 正式关闭。
- 本人站内通知 API 已实现 `createdAt DESC, id DESC` 稳定分页、全局未读数和 1 至 100 个唯一 UUID 的批量已读；
  列表与更新均固定当前接收人，未知、他人和已读 ID 不区分存在性，首次 `readAt` 不覆盖。
- 移动端 `/notifications` 已实现完整分页、账号入口、单条/全部已读、超过 100 条分批、提交中防重复、失败重取、
  周期待确认安全导航和未知通知通用回退；关联 ID 不替代目标资源授权。
- BR-NOTIFY-003 至 006、AC-NOTIFY-002 至 004 和 ADR-030 已冻结通知稳定分页、接收人私有、防枚举、首次已读
  与客户端分批口径；本任务复用 TASK-013 通知事实，不新增迁移、生产通知类型或生产依赖。
- TASK-021 功能提交 `1e9b6582951ef33fd8970f6bb746b4d6bb688783` 经 PR #30 合入 `main`，合并提交为
  `1b87e87c45af5fa5e361374719f6f0b70c8b886a`；PR CI Run `29943627794` 与 main push CI Run
  `29943823960` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-021 正式关闭。
- 最小管理后台已实现运行概览、脱敏用户状态、账本成员关系、周期执行状态/FAILED 人工重试和脱敏审计查询；
  所有业务接口使用 `admin:access + 细粒度权限`，不提供财务明细编辑。
- 第十二迁移新增七个 ADMIN 权限；用户停用与 Session/Refresh Token 撤销同事务完成，禁止自停用。任务重试
  复用周期领域服务和既有幂等约束，写操作要求理由并审计，审计读取本身留痕。
- TASK-022 功能提交 `042682665adbc2194a92dc4bb58a40ec206987f7`、生成类型修正
  `7e0dbd3e72225244bbbd6d5c21674db84187e1f1` 经 PR #32 合入 `main`，合并提交为
  `0a91f7adf82ea8a790340885d76079dcaa88cee9`；PR CI Run `29968254365` 与 main push CI Run
  `29968379326` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-022 正式关闭。
- 当前用户可见账本账目 CSV 与本人工资 CSV 已实现；账目查询要求有效账本及当前有效成员，个人账本还要求
  本人 OWNER，工资查询固定当前认证用户，不接受目标用户参数。
- CSV 使用 UTF-8 BOM、CRLF、标准转义和公式注入防护，金额从整数分精确输出两位元字符串；日期范围、
  10000 行上限、每类每用户限流、`no-store/nosniff` 和不含财务内容的成功审计已实现。
- 移动端 `/exports` 已提供账本/日期与工资年份选择、下载中防重复、成功和错误反馈；账号入口、底部导航归属、
  会话刷新与实际 Blob 下载已接入。
- TASK-023 功能提交 `5ac941e546aee86c19c2d207265b68af8ce6ad25` 经 PR #34 合入 `main`，合并提交为
  `306a6ad513099e11e3215fcbcfca89483085cee9`；PR CI Run `29970521966` 与 main push CI Run
  `29970632424` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-023 正式关闭。

## 明确未实现

除周期待确认外的通知生产链路、通知偏好、邮件/短信/Push、异步导出、公告、反馈和后台敏感详情均未实现。
这些未实现模块的 OpenAPI 路径覆盖只表示契约完整，不表示接口已经上线。

## 当前验证状态

- `pnpm verify`：通过，包含 Docker Compose daemon 配置校验。
- TASK-007 功能合并 main push CI Run [`29305065285`](https://github.com/duanap/siyu/actions/runs/29305065285)：`quality`、
  `database`、`secret-scan` 全部通过，无失败或跳过步骤。
- Prisma validate：通过；Prisma CLI 与 Client 均为 7.8.0。
- OpenAPI lint：通过，API_CONTRACT 覆盖 74/74，生成类型成功。
- 全分支集成本地验证：移动端 20 个文件 61 项、全仓 94 项测试通过；lint、typecheck、Prisma validate、OpenAPI 74/74、build、清单和文档检查通过。
- PR #8 CI Run `29568630493`、PR #9 CI Run `29571169599` 以及最新 main push CI Run
  [`29571310880`](https://github.com/duanap/siyu/actions/runs/29571310880) 的 `quality`、`database`、`secret-scan` 全部通过。
- CI `quality` 已执行包含借贷黑盒流程的 `pnpm test:e2e`；`database` 已执行第六迁移部署和数据库约束脚本。TASK-010 数据库验收闭环。
- 原生运行配置检查通过；Node 静态网关实测手机端 `/` 与管理端 `/admin/` 返回 200，API 未启动时 `/health` 明确返回 502。
- Windows Chrome 150.0.7871.101 真浏览器覆盖 `/login`、`/account`、`/couple/invite`、`/categories`：
  320px、375px、480px 均无横向溢出，44px 点击区、Tab 焦点、日间/暗色和长文本通过。
- TASK-008 真实 Chromium 覆盖 `/entries`、`/entries/new`、`/entries/:id`：320px、375px、480px 无横向溢出，
  日间/夜间、长账本名、长成员名、长备注、响应式筛选和固定底栏遮挡检查通过；API 响应仅在浏览器验收中按批准契约拦截。
- TASK-009 真实 Chromium 覆盖 `/home` 与 `/statistics`：320px、375px、480px 无横向溢出和小于 44px 的可见交互，
  日间/夜间、ECharts、长账本/分类/成员名、空数据和无权限状态通过。
- TASK-011 定向 3 个测试文件 9 项在 Node.js 24.18.0 下通过；真实 Chrome Headless/CDP 覆盖 `/debts`、
  `/debts/new`、`/debts/:id` 的 320px、375px、480px、日间/暗色、空、网络失败、404 和长文本，均无横向
  溢出或小于 44px 的可见交互区。
- TASK-011 全仓 99 项测试、隔离 PostgreSQL/Redis API E2E、format、lint、typecheck、Prisma validate、
  OpenAPI 74/74、Compose、build、docs 和差异检查通过；传递依赖安全覆盖更新后审计无已知漏洞。
- TASK-011 PR CI Run `29889775437` 与 main push CI Run `29889890113` 的 `quality`、`database`、
  `secret-scan` 全部通过，TASK-011 正式关闭。
- TASK-012 在 Node.js 24.18.0 下 format、lint、typecheck、103 项全仓测试、Prisma validate、
  OpenAPI 74/74、Compose、原生配置、生产构建和依赖审计通过。
- TASK-012 七迁移空库/历史升级、status、零 diff、25 模型 introspection、数据库约束与并发幂等通过；
  隔离 PostgreSQL 上的认证、情侣、分类、Entry、借贷和周期完整 E2E 通过。
- 周期 E2E 覆盖创建重放/冲突、非成员隔离、自动生成并发去重、固定期数完成、待确认、确认并发、跳过、
  失败记录与原位重试、失败实例后的计划锁定，以及情侣创建人/OWNER 权限。宿主 Redis 6.0.16 仅产生
  最低 6.2 的非阻断工具提示；生产与 Compose 基线仍使用 Redis 7.4。
- TASK-012 PR CI Run `29894967989` 与 main push CI Run `29895072247` 的 `quality`、`database`、
  `secret-scan` 全部通过，TASK-012 正式关闭。
- TASK-013 在 Node.js 24.18.0 下 format、lint、typecheck、113 项全仓测试、生产构建、Prisma validate、
  OpenAPI 74/74、Compose、原生配置和依赖审计通过。
- 第八迁移空库/历史回放、Prisma status/零 diff、36 个关键索引、56 个约束和通知条件唯一性通过；隔离
  PostgreSQL 17 + Redis 7.4 的完整 API/Worker E2E 通过。
- Worker E2E 覆盖 Job Scheduler 注册、两个并行 Worker、按时区扫描、稳定 Job ID、自动入账、确认通知、
  延迟旧任务跳过、不可恢复业务失败和失败任务重复扫描不自动重跑；日志未包含金额或规则名称。
- GitHub `quality` 作业现同时提供 PostgreSQL 17 与 Redis 7、先部署迁移再执行完整 API/Worker E2E，不再只
  因缺少隔离数据库而退化为健康检查。
- TASK-013 PR CI Run `29898941240` 与 main push CI Run `29899089545` 的 `quality`、`database`、
  `secret-scan` 全部通过，TASK-013 正式关闭。
- TASK-014 移动端 24 个测试文件 72 项通过；其中周期定向 2 个文件 6 项覆盖完整分页、账本边界、编码路径、
  标签、创建/确认稳定幂等和服务端能力呈现；`vue-tsc --noEmit`、根目录 lint、format 与差异检查通过。
- TASK-014 Node.js 24.18.0 全仓 119 项测试、隔离 PostgreSQL 17 / Redis 7 完整 E2E、生产构建、Prisma、
  OpenAPI 74/74、Compose、文档、清单和依赖审计通过。
- TASK-014 真实 Chrome Headless/CDP 覆盖 320px、375px、480px、日间/暗色、正常、空、网络失败、404、
  创建顶端/底部、详情和确认抽屉；均无横向溢出、无小于 44px 的可见交互区或意外运行时异常。
- TASK-014 PR CI Run `29903360052` 与 main push CI Run `29903511196` 的 `quality`、`database`、
  `secret-scan` 全部通过，TASK-014 正式关闭。
- TASK-015 Node.js 24.18.0 全仓 `pnpm verify`、123 项测试、真实 PostgreSQL E2E、生产构建、文档、清单、
  差异检查和依赖审计通过；OpenAPI 保持 74/74。
- TASK-015 九迁移空库部署、Prisma status/零 diff、26 模型 introspection、43 个关键索引、62 个自定义约束、
  14 个关键删除策略和数据库约束脚本通过。
- 隔离 PostgreSQL 完整 API/Worker E2E 覆盖工资档案创建重放/冲突、单有效档案、本人隔离、显式月度项目、
  同月唯一、紧邻上月复制、服务端汇总、未到账更新和已到账不可修改；宿主 Redis 6.0.16 只有非阻断最低
  版本提示，Compose 与 CI 继续使用 Redis 7.4。
- TASK-015 功能提交 `243f2bf6a546f2fc4a6379fb4967fb71ed5ef52f` 经 PR #18 合入 `main`，合并提交为
  `8d3bb4f012a4e4c275e3f96d2ebc54c39ceb6fe4`；PR CI Run `29907066496` 与 main push CI Run
  `29907257057` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-015 正式关闭。
- TASK-016 本地定向单元测试 35 项通过；第十迁移空库部署、Prisma status/零 diff、26 模型 introspection、
  44 个关键索引、65 个自定义约束和 14 个关键删除策略通过。
- Node.js 24.18.0 全仓 `pnpm verify` 与 125 项测试通过；format、lint、typecheck、OpenAPI 74/74、Prisma、
  Compose、生产构建、文档、清单和依赖审计均通过。
- 隔离 PostgreSQL 完整 API/Worker E2E 通过，新增覆盖无同步到账、同步收入、同键重放、同键不同载荷、
  不同键重复确认、并发去重、分类不可用事务回滚、跨用户防枚举、来源明细只读和到账审计。宿主 Redis
  6.0.16 仅有最低 6.2 的非阻断提示，Compose 与 CI 基线仍为 Redis 7.4。
- TASK-016 功能提交 `4b7222a649a72d9b60efc526e1bde8c72fc6b288` 经 PR #20 合入 `main`，合并提交为
  `4cfbd26ed24c42438ede27f57afef3a8c180e011`；PR CI Run `29912892385` 与 main push CI Run
  `29913079247` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-016 正式关闭。
- TASK-017 Node.js 24.18.0 下全仓 130 项测试通过；format、lint、typecheck、Prisma validate、OpenAPI
  74/74、Compose、生产构建、差异检查和依赖审计通过。
- 十迁移空库/历史回放、Prisma status/零 diff、26 模型 introspection、44 个关键索引、65 个自定义约束和
  14 个关键删除策略通过；本任务无新增迁移。
- 隔离 PostgreSQL 完整 API/Worker E2E 通过，新增覆盖年度累计、缺月补零、记录月份月均、专项代码累计、
  最近到账周期、固定/日常支出拆分、情侣账本排除、负余额、零剩余天数和跨用户空态。宿主 Redis 6.0.16
  仅有最低 6.2 的非阻断提示，Compose 与 CI 基线仍为 Redis 7.4。
- TASK-017 功能提交 `23420de1a434b0a3b299b90e2438b991bc30bfb7` 经 PR #22 合入 `main`，合并提交为
  `e972fe54c6228ff6079494f10b32a38fc50415af`；PR CI Run `29917586181` 与 main push CI Run
  `29917758079` 的 `quality`、`database`、`secret-scan` 全部通过，TASK-017 正式关闭。
- TASK-018 Node.js 24.18.0 下 `pnpm verify`、全仓 140 项测试、format、lint、typecheck、Prisma validate、
  OpenAPI 74/74、Compose、生产构建、文档、清单和差异检查通过；依赖审计无已知漏洞。
- TASK-018 十迁移空库/历史回放、Prisma status/零 diff、数据库约束脚本和隔离 PostgreSQL 完整 API/Worker
  E2E 通过；本任务无数据库或公开 API 变化。宿主 Redis 6.0.16 只有非阻断最低版本提示，Compose/CI 使用 7.4。
- TASK-018 真实 Google Chrome Headless/CDP 覆盖工资三页 320px、375px、480px、日间/暗色、长文本、无档案、
  网络错误、档案抽屉、月度编辑、到账确认和年度趋势；13 张截图无横向溢出或小于 44px 的可见交互区。
- TASK-018 PR CI Run `29922038043` 与 main push CI Run `29922213012` 的 `quality`、`database`、
  `secret-scan` 全部通过；两轮 `quality` 均执行迁移、完整 PostgreSQL/Redis E2E、构建与依赖审计。
- TASK-019 Node.js 24.18.0 全仓 `pnpm verify` 与 144 项测试通过；文档、清单、format、lint、typecheck、
  Prisma validate、OpenAPI 74/74、Compose、完整 PostgreSQL/Redis E2E、生产构建和差异检查全部通过。
- TASK-020 定向 2 个测试文件 10 项、移动端 28 个文件 92 项、移动端 typecheck 与全仓 lint 通过；首次全量
  压力执行中既有周期快速提交用例单次抖动，单独复跑及最终完整 92 项复跑均通过。
- TASK-020 真实 Google Chrome Headless/CDP 覆盖 13 个场景：320px、375px、480px、日间/暗色、正常、加载、
  空、网络失败、只读、资源不可见、长文本和刷新恢复；均无横向溢出或小于 44px 的可见交互区。
- TASK-020 Node.js 24.18.0 全仓 `pnpm verify` 与 153 项测试通过；format、lint、typecheck、Prisma validate、
  OpenAPI 74/74、Compose、完整 PostgreSQL/Redis E2E、生产构建、文档、清单和差异检查全部通过。
- 隔离 PostgreSQL 17 的 11 个迁移无待应用；认证、情侣、分类、Entry、借贷、周期、工资和攒钱完整 E2E
  通过。依赖审计无已知漏洞；宿主 Redis 6.0.16 仅有最低 6.2 的非阻断提示，Compose/CI 使用 Redis 7.4。
- TASK-020 PR CI Run `29937823275` 与 main push CI Run `29938160014` 的 `quality`、`database`、
  `secret-scan` 全部通过；两轮 `quality` 均执行完整测试、迁移、PostgreSQL/Redis E2E、构建和依赖审计。
- TASK-021 Node.js 24.18.0 标准 `pnpm verify` 通过：移动端 30 个文件 99 项、API 12 个文件 47 项，连同
  原生网关、共享包、校验包和管理端共 164 项测试；format、lint、typecheck、Prisma validate、OpenAPI
  74/74、Compose、生产构建、文档、清单和差异检查通过。
- TASK-021 隔离 PostgreSQL 17 的 11 个迁移空库/历史回放、重复部署、status、零 diff、introspection 和
  数据库约束脚本通过；完整 API/Worker E2E 新增覆盖本人/伴侣通知隔离、稳定分页、跨用户防枚举、首次已读
  不覆盖、重放幂等和 DTO 拒绝重复/空 ID。宿主 Redis 6.0.16 仅有非阻断最低版本提示。
- TASK-021 Google Chrome Headless/CDP 覆盖 11 个消息中心场景：320px、375px、480px、日间/暗色、正常、
  加载、空、网络失败、无权限、长文本、刷新恢复和提交中；均无横向溢出或小于 44px 的可见交互区。
- TASK-021 PR CI Run `29943627794` 与 main push CI Run `29943823960` 的 `quality`、`database`、
  `secret-scan` 全部通过；两轮 `quality` 均执行完整测试、迁移、PostgreSQL/Redis E2E、构建和依赖审计。
- TASK-022 Node.js 24.18.0 标准 `pnpm verify` 与 164 项测试通过；第十二迁移、OpenAPI 81/81、完整
  PostgreSQL/Redis E2E、管理端生产构建和依赖审计通过。PR CI Run `29968254365` 与 main push CI Run
  `29968379326` 的三个任务全部通过。
- TASK-022 真浏览器矩阵仍受 WSL Windows 可执行互操作不可用影响；组件测试、构建或接口 E2E 未被冒充为
  视觉验收，该环境缺口不改变权限、数据库和远程 CI 的正式关闭结果。
- TASK-023 API 专项 50 项、移动端新增 5 项与类型/lint 通过；隔离 PostgreSQL/Redis 完整 API/Worker E2E
  覆盖账本成员隔离、工资本人隔离、软删除排除、精确金额、公式防护、范围校验和脱敏审计并通过。
- TASK-023 真实 Chrome Headless/CDP 使用实际 API 与 Blob 下载覆盖 320px、375px、480px、日间/暗色和
  网络失败；无横向溢出、小于 44px 的可见交互区或未处理运行时错误，实际 CSV 文件下载成功。
- TASK-023 Node.js 24.18.0 全仓 `pnpm verify` 与 172 项测试通过：移动端 104 项、API 50 项，其余原生网关、
  共享包、校验包和管理端 18 项；format、lint、typecheck、Prisma、OpenAPI 81/81、Compose、完整
  PostgreSQL/Redis E2E、生产构建、文档、清单和差异检查全部通过，依赖审计无已知漏洞。
- 第十一迁移空库/历史升级、重复部署、status、零 diff、26 模型 introspection、47 个关键索引、73 个自定义
  约束和 15 个删除策略通过；新增 E2E 覆盖目标幂等、权限、并发贡献、状态回退、删除留痕和成员退出隔离。
- OpenAPI 74/74 覆盖与具体统计响应 Schema 生成通过；手机入口 294 KB，统计图表独立懒加载。
- 依赖审计：无已知漏洞。
- 空库初始迁移、Prisma migrate status/diff/introspection、PostgreSQL 特殊约束和并发幂等实测：通过。
- 25 模型三迁移空库回放、Prisma status/diff/introspection、19 个关键唯一索引、情侣成员触发器和并发验证：通过。
- 25 模型四迁移回放、24 个关键索引、分类复合归属、既有分类迁移、默认补齐和重名策略：通过。
- 25 模型五迁移回放、28 个关键索引、Entry 创建哈希/版本/成员/来源/支付约束、合法 OWNER 修复、
  异常非 OWNER 归属拒绝和并发幂等：通过。
- `siyu-postgres`、`siyu-redis`、`siyu-api`、`siyu-worker`、`siyu-nginx`：验收时全部 running/healthy。
- PostgreSQL、Redis、API、BullMQ Worker、Nginx 服务链路和 `http://localhost:8080/health`：通过。
- API 与 Worker 同时重启后连接恢复：通过；Nginx 使用 Docker DNS 动态解析 API 地址，无需随 API 重启。

## 下一项动作

进入 TASK-024 权限与安全审计，系统复核认证、资源归属、情侣成员关系、管理员 RBAC、财务隐私、限流和审计边界。

## 待负责人确认

- Logo、商标、域名、软著、应用商店名称和安卓包名可用性。
- 默认时区是否保留 `Asia/Shanghai`。
- 周期恢复/跳过/确认金额、短月取月末、来源借贷删除、工资固定支出口径和目标归属已确认。
- 上传、异步导出、反馈、公告与后台扩展数据模型的最小契约；有界同步 CSV 与最小后台已冻结。
- QQ 互联申请已通过；生产部署仍需通过环境变量配置 App ID/App Key/严格回调地址和邮件提供方。

## 2026-07-17 全分支集成

- 已审计 GitHub 全部远端分支：TASK-000 是 `main` 祖先；TASK-004 至 TASK-007 分支头与各自已合并 PR 的输入提交一致，合并后无新增提交。
- `task/TASK-008-entry-ui` 的 61 个变更文件未被此前的快照实现完整覆盖，现已将其类型化请求层、会话恢复、精确金额工具、14 个公共组件、记账页面、无障碍交互和测试并入完整项目。
- 路由和底部导航已向前合并，`/entries`、`/entries/new`、`/entries/:id`、`/home`、`/statistics` 与 `/account` 可同时使用；TASK-009、TASK-010 和非 Docker 原生运行能力保持不变。
- 本地验证：移动端 20 个测试文件 61 项通过，全仓共 94 项测试通过；lint、typecheck、Prisma validate、OpenAPI 74/74、build、交付清单和必需文档检查通过。
- PR #9 合并提交为 `2b4b384c7dcac23e58e2042f0a3f43ea79679277`；main push CI Run `29571310880`
  已在 Linux 环境完成质量、数据库和秘密扫描，TASK-008 至 TASK-010 正式关闭。
