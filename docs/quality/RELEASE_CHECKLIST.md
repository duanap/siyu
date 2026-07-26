# 发布检查表

## 发布前

- [ ] 版本号和发布说明
- [ ] 所有 CI 通过
- [ ] 数据库迁移审查
- [ ] staging 迁移和 E2E
- [ ] 权限和安全审计
- [ ] `pnpm release:check -- --env-file <受控环境文件> --mode native|compose` 通过
- [ ] 已选择并验证 Docker Compose 或原生 Node 运行模式
- [ ] 原生模式执行 `pnpm native:check`，网关仅监听批准地址
- [ ] `pnpm release:backup` 生成仓库外备份、0600 权限、元数据和 SHA-256
- [ ] `pnpm release:restore:verify` 在 `siyu_restore_*` 隔离库恢复成功
- [ ] 回滚镜像和方案
- [ ] Worker 队列为空或可控

## 发布中

- [ ] 执行迁移
- [ ] 更新 API
- [ ] 更新 Worker
- [ ] 更新前端
- [ ] 健康检查
- [ ] `pnpm release:smoke -- --base-url <入口> --expect-production` 通过
- [ ] 登录、记账、查询和任务冒烟
- [ ] 错误率和任务失败监控

## 发布后

- [ ] 观察 API 和队列
- [ ] 验证未重复入账
- [ ] `pnpm release:browser:smoke` 验证 320/375/480px、日间/夜间、无溢出和 44px 交互区
- [ ] 记录 RELEASE_HISTORY
- [ ] 更新 CURRENT_STATE
