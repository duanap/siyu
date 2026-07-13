# TASK-005 验证报告

日期：2026-07-14

## 结论

TASK-005 情侣账本邀请、成员和权限能力已完成实现与真浏览器补验，达到完成定义。PR #2 已以
Squash merge 合入 main，合并提交为 `6ebb13537dc0246a4a6a165bd348b88582c4dbbe`；main push CI Run
`29275012134` 全部通过，任务已正式关闭。QQ 互联申请已通过，按负责人指示取消临时审核页制作与部署；
正式 OAuth 凭据仍只允许由部署环境提供。

## 数据库与并发

- 三条迁移从 tmpfs 空库顺序回放：通过；migrate status 最新、diff 零差异、introspection 25 模型。
- 19 个关键唯一索引、单活邀请、单活所有者、每账本最多两名成员、每用户最多一个情侣账本：通过。
- Prisma 与服务层共同使用事务和 advisory lock；重复成员保留既有唯一约束错误语义。

## API、权限与隐私

- 创建、查询、改名、邀请、接受、退出、转移、解散：通过。
- 创建账本和邀请幂等重放、不同载荷冲突、自邀拒绝、已满拒绝、非成员不可见：通过。
- 所有者不能直接退出；所有权原子转移后原所有者可退出；解散后双方不可访问且历史记录保留。
- 邀请数据库仅保存摘要，响应不暴露摘要，账本响应不暴露幂等键；关系变化写审计。
- OpenAPI/API_CONTRACT 72/72，生成共享类型成功。

## 前端

- “朝暮同笺”页面覆盖加载、空、错误、无权限、正常和提交中状态。
- 创建、接受、成员展示、改名、邀请复制、所有权转移、退出和解散均有真实 API 调用。
- 危险操作二次确认、提交防重复、44px 控件和主题 Token 已实现。
- Windows Chrome 150.0.7871.101 通过 CDP 验证 `/login`、`/account`、`/couple/invite`；
  320×800、375×812、480×900 的日间/暗色共 18 组页面组合全部通过。
- 每组 `document.documentElement.scrollWidth <= window.innerWidth`，无横向滚动、截断、重叠或固定元素遮挡；
  44px 点击区、Tab 焦点、键盘操作、长昵称、长账本名、长邀请码和状态颜色均通过。
- 真实流程覆盖未创建、OWNER 创建、创建/展示/复制邀请、MEMBER 接受、成员列表、双方权限差异、
  所有权转移、MEMBER 退出、解散、真实 API 错误、重复提交防护、加载、成功、失败和禁用状态。
- 真浏览器发现并修复两类页面问题：无效邀请错误会替换空状态表单；返回链接不足 44px 且长昵称压缩头像。
  修复后从注册开始重跑全部业务流程及 18 组视觉矩阵，均通过。
- 8 项移动端 API/组件测试通过；临时截图、浏览器配置和用户数据目录均已清理，未进入仓库。

## 质量门

- Prisma validate、迁移回放、数据库约束、API E2E、OpenAPI lint/类型生成：通过。
- `pnpm verify`：通过；包含格式、lint、typecheck、27 项单元/组件测试、Prisma、OpenAPI、健康 E2E 和 build。
- 隔离 `siyu_test` 下的认证与情侣账本完整 E2E 另行运行并通过。
- `git diff --check`：通过；`pnpm audit`：无已知漏洞。
- 当前分支镜像下 PostgreSQL、Redis、API、Worker、Nginx 均曾达到 healthy；验收后 `docker compose down`
  已清理容器，本机 `redis-server` 已恢复为 active，`redis-cli ping` 返回 `PONG`。
- PR #2 合并后的 main push CI Run `29275012134`：`quality`、`database`、`secret-scan` 全部成功，
  无失败或跳过步骤。

## 已知边界

- 分类作用域规则已冻结，分类数据模型与 CRUD 由 TASK-006 实现。
- 正式 QQ 凭据和生产邮件提供方尚未进入部署环境。
- 本机占用 6379 的 Redis 为 6.0.16，E2E 通过但 BullMQ 输出建议升级到 6.2+；项目 Compose 固定 Redis 7.4。
