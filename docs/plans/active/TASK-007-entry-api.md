# TASK-007：普通账目 API

## 状态

已完成（PR #6 已合并，主线 CI 通过，正式关闭）

## 模型与推理

- 推荐模型：Sol
- 推理：High
- 是否使用子代理：否

## 目标

- 实现普通手工账目的查询、创建、详情、修改和软删除 API。
- 固化账本/分类/成员归属、支付方式、来源边界、请求哈希幂等、乐观锁和审计约束。
- 完善 OpenAPI、共享类型、数据库验证、E2E 和项目文档，保持批准操作 74/74。

## 非目标

- 不实现记账或明细页面、首页统计、图表、导出、附件上传。
- 不实现借贷、周期、工资或攒钱来源业务，不开始 TASK-008。
- 不修改历史迁移，不新增未经批准的 API 路径或生产依赖。

## 当前 Entry 数据模型分析

现有 Entry 已包含账本、创建人、类型、整数分金额、分类、业务日期、备注、支付方式、来源、幂等键和
软删除时间。数据库已有金额、来源形状、来源唯一、创建幂等和分类复合归属约束，但尚无受控支付枚举、
不可变创建请求哈希、版本号、创建人复合成员归属、正常记录部分索引或 Entries 模块实现。

## 普通账目与来源账目边界

- 公开 POST 只创建 `MANUAL`，服务端固定创建人并令 `sourceId = null`。
- `SALARY`、`DEBT_TRANSACTION`、`RECURRING_RUN` 只允许未来对应领域模块维护。
- 普通 PATCH/DELETE 对非 MANUAL 记录返回 `ENTRY_SOURCE_MANAGED`。
- 非 MANUAL 的 `sourceType + sourceId` 在全部历史记录中保持唯一；KI-006 批准前不因软删除释放来源键。

## 权限矩阵

| 场景 | 查看 | 创建 | 修改/删除 |
|---|---:|---:|---:|
| 个人账本有效 OWNER | 全部 | 是 | 全部手工账目 |
| 情侣账本有效 OWNER | 全部 | 是 | 双方手工账目 |
| 情侣账本有效 MEMBER | 全部 | 是 | 仅自己创建的手工账目 |
| 非成员、退出成员、解散账本 | 否 | 否 | 否 |
| 被禁用的当前操作者 | 可按有效会话读取 | 否 | 否 |

`canEdit/canDelete` 只按当前操作者计算。创建人被禁用不取消有效 OWNER 的管理权限；不可见资源统一 404，
已可见但缺少写权限使用 `ENTRY_PERMISSION_DENIED`。

## API 查询和分页契约

- 保持 `GET/POST /api/v1/entries` 与 `GET/PATCH/DELETE /api/v1/entries/:id` 五个路径。
- 列表必填 `ledgerId`，可选 `month/type/categoryId/creatorUserId/keyword/page/pageSize`。
- month 缺省为操作者时区当前月；非法存量时区回退 `Asia/Shanghai`。业务日期仍按 PostgreSQL DATE 范围查询。
- page 默认 1，pageSize 默认 20、最大 100；关键词裁剪，空关键词视为未提供。
- 排除软删除记录，以 `businessDate DESC, createdAt DESC, id DESC` 稳定排序并返回统一分页结构。
- 列表和详情包含最小 creator/category、version 与服务端能力字段，不查询或暴露敏感身份数据。

## 幂等与并发策略

- 创建前规范化载荷并按版本化 canonical JSON 计算 SHA-256 `createRequestHash`。
- 哈希覆盖账本、类型、金额、分类、业务日期、裁剪备注、支付方式和固定 MANUAL 来源，不依赖后续可变字段。
- `createRequestHash` 创建后不可更新；数据库触发器兜底。既有记录使用保留 legacy hash，不能伪装可重放。
- 用户、创建操作和幂等键使用 advisory transaction lock，数据库唯一键作为并发最终约束。
- 相同有效 hash 重放原结果；不同 hash、legacy hash 或已删除原记录返回 `IDEMPOTENCY_CONFLICT`。
- PATCH 必填 `expectedVersion`，原子匹配并递增 version；空修改拒绝，无实际变化不改版本或审计。
- DELETE 使用查询参数 `expectedVersion`。墓碑版本恰为请求版本加一时可幂等成功，否则版本冲突。

## 软删除和审计策略

- DELETE 只设置 `deletedAt` 并递增版本，不物理删除任何关联记录。
- 软删除重试仍按顺序校验账本可见性、操作者权限、MANUAL 来源和版本，不能绕过防枚举。
- 创建、实际修改和首次删除分别写 `ENTRY_CREATED/UPDATED/DELETED`，与业务写入同一事务。
- 审计只记录账本、类型、来源和 changedFields 等安全元数据，不保存完整备注或幂等载荷。
- 当前无统计缓存，只记录无需执行缓存失效，不提前引入统计缓存系统。

## 数据库增量迁移

- 正式迁移：`20260714040000_entry_api`，create-only。
- 增加 `EntryPaymentMethod`、version、createRequestHash、CHECK、不可变触发器和创建人有效性触发器。
- 增加 `(ledgerId, creatorUserId)` 到成员表的复合外键；只允许修复可证明合法的有效 OWNER 缺失关系。
- 非 OWNER 缺少成员关系、失效对象或角色冲突使迁移明确失败，不自动生成 LEFT MEMBER。
- 现有四组查询索引替换为 `WHERE deleted_at IS NULL` 的 PostgreSQL 部分索引。
- 支付方式只规范化批准值的大小写；未知值失败。备注裁剪、空值转 NULL；幂等键变更前检查冲突。
- 迁移进入共享环境后不回滚；问题通过新的向前迁移修复。

## OpenAPI 兼容策略

- 路径和 operationId 不变，操作总数保持 74/74。
- 新增受控支付枚举、具体 Entry/分页响应、嵌套摘要、version 和能力字段。
- PATCH body 包含 `expectedVersion`；DELETE 通过 `?expectedVersion=` 传递。
- createRequestHash 为服务端内部幂等事实，不作为可写字段暴露。

## 风险、回滚和完成定义

- 风险：异常历史成员关系、legacy hash 不能还原创始载荷、Prisma 不表达部分索引、删除重试越权。
- 控制：fail-closed 迁移、legacy 命名空间、受审 SQL/约束测试、权限优先的墓碑查询和并发 E2E。
- 完成定义：数据库、权限、幂等、并发、软删除、审计、API/契约和文档全部完成；五迁移、E2E、
  OpenAPI 74/74、构建、Compose/Nginx、`pnpm verify`、`pnpm audit`、`git diff --check` 全部通过；
  本机 Redis 恢复 PONG，任务分支提交并推送，工作区干净。

## 实施步骤

- [x] 预检、确认基线和创建任务分支
- [x] 创建 ExecPlan 并冻结修订决策
- [x] 更新规则、ADR、Prisma 模型和增量迁移
- [x] 实现 Entries API、权限、幂等、并发和审计
- [x] 完善数据库验证、单元测试和 E2E
- [x] 更新 OpenAPI、共享类型和项目文档
- [x] 完成 Compose/Nginx 和完整质量门
- [x] 最终审查、提交和推送

## 验证命令

```bash
pnpm prisma:validate
pnpm prisma:migrate:test
pnpm test:e2e
pnpm verify
pnpm audit
git diff --check
```

## 进度日志

- 2026-07-14：本地 main、HEAD 和已有 origin/main 均为
  `2a5cde546253703b11d50c1c7662de27b562b8e4`，工作区干净；创建任务分支。
- 2026-07-14：冻结 createRequestHash、fail-closed 历史成员迁移、正常记录部分索引、操作者能力计算和
  权限优先软删除重试五项修订。WSL Git 凭据助手暂不可执行，推送前需恢复远程认证。
- 2026-07-14：完成第五迁移、Entries 分层 API、具体 OpenAPI/共享类型和数据库/E2E 覆盖；五迁移回放、
  28 个关键索引、38 个自定义约束、异常历史归属拒绝和并发幂等通过。
- 2026-07-14：认证、情侣、分类、Entry 黑盒回归及 35 项全仓测试通过；Compose 五服务 healthy，
  Nginx 注册、账本/分类、Entry 创建与回读真实链路通过；本机 Redis 恢复 PONG。
- 2026-07-14：最终 `pnpm verify`、`pnpm audit`、`git diff --check` 和敏感产物审查通过；
  仅提交并推送 TASK-007 任务分支，不创建 PR。
- 2026-07-14：PR #6 以 Squash merge 合入 main；合并时 Head SHA 为
  `aa9ea3bccc5d5bd48ed2bb5e98506d7e34df6be7`，功能提交为
  `f6e579957535ccb5ea4ce06d9d4bb8368d7c994c`。main CI Run
  [`29305065285`](https://github.com/duanap/siyu/actions/runs/29305065285) 的 `quality`、`database`、
  `secret-scan` 全部成功，Failed=0、Skipped=0。

## 完成结果

普通账目 API 的数据库、权限、幂等、并发、软删除、来源边界、审计、契约和自动化验收已完成。
PR #6 已合入 main 且主线 CI 全绿，TASK-007 正式关闭。未实现客户端页面或来源业务；KI-006 仍未解决，
TASK-008 尚未开始。
