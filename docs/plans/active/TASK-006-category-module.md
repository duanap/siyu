# TASK-006：分类模块

## 状态

已完成（任务分支待 PR）

## 模型与推理

- 推荐模型：Terra
- 推理：Medium
- 是否使用子代理：否

## 目标

- 将系统分类模板实例化为账本内分类，完整隔离个人账本和情侣账本。
- 实现默认分类幂等初始化、自定义分类管理、稳定排序、启停、权限和审计。
- 实现 Categories API、OpenAPI/共享类型和移动端分类管理页面。

## 非目标

- 不实现普通账目 API、明细、统计、预算、周期记账、工资、攒钱目标或 TASK-007。
- 不修改历史迁移，不重新设计整体移动端视觉。

## 当前数据模型分析

现有 `Category` 只有可空 `ownerUserId`，没有 `ledgerId`、颜色、模板键或创建幂等键；系统分类通过
`ownerUserId IS NULL` 表示全局记录。Entry 和 RecurringRule 只按 `categoryId` 关联，数据库尚未校验分类
与目标账本、类型一致。OpenAPI 已批准查询、创建、更新和停用 4 个分类操作，但没有实现代码。

## 分类模型设计

- Category 必填 `ledgerId`，原 `ownerUserId` 迁移为可空 `creatorUserId`。
- 保留 `type/name/icon/sortOrder/isSystem/isEnabled/createdAt/updatedAt`；新增非空 `color`、可空
  `templateKey/templateVersion/idempotencyKey`。
- 系统分类必须有模板键且无创建者；自定义分类必须有创建者且无模板键。
- `(ledgerId, templateKey)` 唯一；创建幂等键按创建用户隔离；启用分类名称在账本和类型内忽略大小写唯一。
- 名称必须裁剪且长度 1–50，排序非负，颜色为 `#RRGGBB`，图标来自受控键集合。
- Entry/RecurringRule 使用分类、账本、类型复合外键；新增或更换分类时数据库拒绝停用分类。

## 默认分类初始化策略

- 模板版本为 1，使用稳定 `templateKey`，运行时不得按显示名称判断。
- 支出：餐饮、购物、交通、居住、娱乐、医疗、教育、人情、其他支出。
- 收入：工资、奖金、兼职、理财、红包、退款、其他收入。
- 邮箱注册、首次 QQ 建号和情侣账本创建均在原事务内初始化 16 个默认分类。
- `(ledgerId, templateKey)` 唯一约束、账本/类型事务锁和冲突时默认停用策略保证重复、重试和并发幂等。

## 个人账本与情侣账本隔离规则

系统模板目录全局定义，Category 记录始终属于一个账本；个人和情侣账本不共享分类行。历史 Entry 和
RecurringRule 继续引用原语义对应的账本分类，分类停用不删除记录。

## 权限矩阵

| 场景 | 查看/使用 | 创建自定义 | 修改/启停 | 排序 |
|---|---:|---:|---:|---:|
| 个人 OWNER | 是 | 是 | 全部 | 是 |
| 情侣 OWNER | 是 | 是 | 全部 | 是 |
| 情侣 MEMBER | 是 | 是 | 仅自己创建的自定义分类 | 否 |
| 非成员/已退出 | 否 | 否 | 否 | 否 |
| 已解散账本 | 否 | 否 | 否 | 否 |

附件中的“MEMBER 完全只读”与已冻结 ADR-016 冲突；按任务冲突处理条款，以 ADR-016 为准。系统分类
不可改名、换图标或换颜色；OWNER 可以排序、停用和启用系统分类。

## API 契约

- `GET /api/v1/categories?ledgerId=&type=&includeDisabled=`
- `POST /api/v1/categories`
- `PATCH /api/v1/categories/:id`
- `PUT /api/v1/categories/reorder`
- `POST /api/v1/categories/:id/enable`
- `POST /api/v1/categories/:id/disable`

创建请求包含 `ledgerId/type/name/icon/color/idempotencyKey`；更新只接收 `name/icon/color`；排序请求包含
`ledgerId/type/categoryIds` 完整顺序。列表返回服务端计算的分类级 `canEdit/canToggle` 和集合级
`canCreate/canReorder`。批准操作从 72 增至 74。

## 移动端页面范围

新增受保护 `/categories` 页面和账号页入口，支持账本选择、收入/支出切换、启用/停用分组、新增、
编辑、图标/颜色选择、上下移动排序、停用确认、重新启用、系统标识和权限提示。状态覆盖加载、空、
错误、提交中、禁用、长文本、日夜主题、返回和刷新恢复。

## 数据迁移方案

- 正式增量迁移：`20260714020000_category_module`。
- 先增加可空新字段和映射表；按 Entry/RecurringRule 的账本引用复制旧分类并重绑。
- 未引用用户分类归入其个人账本；旧全局系统分类复制至有效账本。
- 一次性迁移允许将已知旧系统名称映射到模板键；运行时只使用模板键。
- 与旧自定义分类重名的默认分类仍创建但初始停用。
- 补齐所有既有账本后收紧非空、外键、CHECK、唯一和查询索引。
- 已进入共享环境后不降级迁移；错误通过新向前迁移修复。

## 并发与幂等策略

- 初始化依靠模板唯一键；创建依靠用户和幂等键唯一索引并校验重放载荷。
- 创建和排序使用 `ledgerId + type` advisory transaction lock。
- 新分类排序取最大值加 100；批量排序重写为 100、200……；查询以 `sortOrder,id` 稳定排序。
- 启用、停用和相同排序重复调用返回当前结果，不产生重复副作用。

## 测试计划

- 数据库：四迁移回放、status、零 diff、25 模型 introspection、FK/唯一/CHECK、旧数据迁移、默认初始化、
  并发、隔离、重名、停用历史和稳定排序。
- API/E2E：个人/情侣默认分类、OWNER/MEMBER/非成员权限、跨账本、解散、非法字段、长名称、幂等、
  审计，以及认证和情侣全流程回归。
- 前端：API 参数、账本/类型切换、能力字段、编辑、排序、启停和全部页面状态。
- OpenAPI：lint、生成类型和 74/74 覆盖。

## 真浏览器验收计划

使用真实 Chrome 或 Edge 覆盖 320×800、375×812、480×900 的日间和暗色，验证默认列表、切换、
新增、编辑、图标/颜色、排序、停用/启用、MEMBER 权限、错误、长名称、加载和禁用；每组确认
`document.documentElement.scrollWidth <= window.innerWidth`。临时截图和浏览器目录验收后删除。

## 风险、回滚和完成定义

- 风险：旧全局分类多账本引用、同名迁移、并发排序、前端复制权限规则。
- 控制：受审 SQL 映射、复合外键、部分唯一索引、事务锁和服务端能力字段。
- 完成定义：迁移/API/UI/权限/审计/文档完整，数据库、E2E、组件、OpenAPI、构建、Compose、真浏览器、
  `pnpm verify`、`pnpm audit` 和 `git diff --check` 全部通过；Redis 恢复并返回 `PONG`。

## 实施步骤

- [x] 预检、同步 main 和创建任务分支
- [x] 创建 ExecPlan 并冻结冲突处理
- [x] 更新业务规则、ADR 和数据契约
- [x] 实现 Prisma 模型、迁移、约束和默认模板
- [x] 实现 Categories API、权限、审计和 E2E
- [x] 实现移动端页面和组件测试
- [x] 更新 OpenAPI、共享类型、设计与项目记忆
- [x] 完成数据库、Compose、真浏览器和全量质量验证
- [x] 最终审查、提交和推送

## 验证命令

```bash
pnpm verify
pnpm audit
pnpm prisma:migrate:test
git diff --check
```

## 进度日志

- 2026-07-14：预检通过；main/origin/main 均为 `b140734bceb40aedea860f5bbe4c208993f9c898`；
  创建 `task/TASK-006-category-module` 并冻结分类模型、权限冲突和 API 方案。
- 2026-07-14：完成账本级 Category 迁移、默认模板初始化、Categories 分层 API、审计、复合归属约束和 E2E。
- 2026-07-14：完成 `/categories` 页面、16 项移动端测试、OpenAPI 74/74 和共享类型生成。
- 2026-07-14：Chrome 150 完成 320/375/480 日夜矩阵；修复关闭抽屉后 sticky 错误覆盖列表并全量重验。
- 2026-07-14：Windows 原生 Tab/Enter、既有分类迁移、Compose 五服务和完整数据库约束验证通过；临时产物已清理。
- 2026-07-14：最终质量审查补强旧分类确定性迁移 ID 的 UUID v4/variant 位，并通过完整迁移回放与断言。
- 2026-07-14：`pnpm verify`、全仓 35 项测试、`pnpm audit` 和 `git diff --check` 通过。

## 决策记录

- 系统分类使用全局模板、账本内实例，不共享数据库记录。
- ADR-016 优先于附件的 MEMBER 完全只读描述。
- 排序使用完整顺序、事务锁和 100 间隔，不引入拖拽依赖或排序版本表。

## 完成结果

分类模块实现与本地验收完成：默认模板按账本实例化，OWNER/MEMBER 权限、幂等、排序、启停、审计、
迁移、API、移动端和文档均已交付，任务分支已通过最终审查并按计划提交、推送。未创建 PR、未合并
main、未开始 TASK-007；本 ExecPlan 关闭。
