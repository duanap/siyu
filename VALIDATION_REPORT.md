# TASK-007 验证报告

日期：2026-07-14

## 结论

TASK-007 普通账目 API 已完成数据库、后端、OpenAPI/共享类型、自动化回归和 Compose/Nginx 链路验收。
PR #6 已按 Head SHA `aa9ea3bccc5d5bd48ed2bb5e98506d7e34df6be7` 以 Squash merge 合入 main，
功能提交为 `f6e579957535ccb5ea4ce06d9d4bb8368d7c994c`；main push CI Run
[`29305065285`](https://github.com/duanap/siyu/actions/runs/29305065285) 全部通过，TASK-007 正式关闭。

## 功能、权限与隐私

- 实现 `GET/POST /entries` 和 `GET/PATCH/DELETE /entries/:id` 五个既有批准操作。
- 个人 OWNER 和情侣 OWNER 可管理账本内全部手工账目；情侣 MEMBER 可查看双方、创建并仅管理自己的账目。
- 非成员、退出成员和解散账本按资源不可见处理；详情、更新、删除和墓碑重试均从带成员条件的查询开始。
- `canEdit/canDelete` 只按当前操作者计算；创建人被禁用不取消有效 OWNER 的管理权限。
- 当前操作者被禁用时可按有效会话读取但不可写；响应不包含邮箱、QQ OpenID、角色或请求哈希。

## 数据库与迁移

- 正式迁移：`20260714040000_entry_api`；四条历史迁移未修改。
- 新增 `EntryPaymentMethod`、`version`、不可变 `createRequestHash`、成员复合外键和有效创建人触发器。
- 创建哈希由版本化规范创建载荷计算 SHA-256；数据库触发器拒绝修改，历史记录使用 `legacy:<id>`。
- 迁移仅补建可证明合法的 ACTIVE OWNER；异常非 OWNER 缺失成员关系会让事务迁移失败，不生成 LEFT MEMBER。
- 四个正常查询索引均为 `WHERE deleted_at IS NULL` 部分索引，并覆盖稳定倒序字段。
- 金额、UUID v4/variant、版本、备注、幂等键、来源形状/唯一、支付枚举、分类复合归属与启用状态约束：通过。
- 五迁移空库回放、四迁移升级、migrate status、零 diff、Prisma validate、25 模型 introspection：通过。
- 28 个关键索引、38 个自定义约束、11 个关键删除动作和数据库并发幂等：通过。

## API、幂等与并发

- 列表支持月份、类型、分类、创建人、备注关键词和分页；默认 1/20、最大 100，按
  `businessDate DESC, createdAt DESC, id DESC` 排序，无 N+1。
- 创建服务端固定当前用户、MANUAL 和空 sourceId；相同请求 hash 重放同一记录，不同 hash 冲突。
- 账目后续修改不改变创建 hash；修改后使用原载荷重放仍识别原创建操作。
- 并发相同 POST 只产生一行；PATCH 版本冲突返回 `ENTRY_VERSION_CONFLICT`；无变化 PATCH 不递增版本或审计。
- DELETE 只软删除并递增版本；合法重试完整重验可见性、权限、来源和墓碑版本，只写一条删除审计。
- 非 MANUAL 账目可按权限读取，普通修改/删除返回 `ENTRY_SOURCE_MANAGED`。
- 审计覆盖创建、实际修改和首次删除，不保存完整备注、请求原文、Token 或创建哈希。

## E2E 与契约

- 个人收入/支出、情侣 OWNER/MEMBER 创建与双方查看、MEMBER 自己/他人权限、OWNER 全量管理：通过。
- 非成员、退出成员、解散账本、跨账本 ID、禁用操作者、禁用创建人 OWNER 管理：通过。
- 分类类型/账本/启用状态，金额零/负数/浮点/超上限，非法日期/支付方式/长备注/来源伪造：通过。
- 创建重放、不同载荷、并发重复提交、修改冲突、软删除隐藏/重试、来源保护和审计：通过。
- 月份、类型、分类、创建人、关键词、分页 total/hasNext、稳定排序和 BigInt 安全序列化：通过。
- 认证、情侣账本和分类完整回归：通过。
- OpenAPI/API_CONTRACT 74/74，Redocly lint 和共享类型重新生成：通过。

## 质量门与运行环境

- 全仓 35 项单元/API/组件测试通过，其中移动端既有 16 项；TASK-007 未修改前端。
- lint、typecheck、生产构建、Prisma validate、OpenAPI、E2E、文档、Manifest 和 `git diff --check`：通过。
- `pnpm verify`：通过；`pnpm audit`：无已知漏洞。
- PR #6 CI Run `29303770616` 与功能合并后的 main push CI Run `29305065285`：`quality`、
  `database`、`secret-scan` 全部成功，Failed=0、Skipped=0。
- Node.js 20、Redis 版本和 `pg` 弃用提示仅作为非阻断工具链信息记录，不在 TASK-007 闭环中处理。
- Compose PostgreSQL、Redis 7.4、API、Worker、Nginx 构建成功并全部 healthy。
- `http://localhost:8080` Nginx 真实链路完成注册、个人账本/分类查询、Entry 创建及分页回读：通过。
- 验收后 Compose 已关闭；本机 Redis 已恢复 active，`redis-cli ping` 返回 `PONG`。

## 范围边界

- 未实现记账或明细页面、首页统计、图表、借贷、周期、工资、攒钱、CSV、上传或 TASK-008。
- 来源业务删除策略 KI-006 仍待批准；当前保持跨软删除记录的来源唯一性，普通 API 不删除来源账目。
- PR #6 已合并且 TASK-007 正式关闭；远程任务分支保留，TASK-008 尚未开始。
