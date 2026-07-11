# API Instructions

继承根目录 AGENTS.md。

- NestJS + Prisma，模块化单体。
- Controller 只处理协议，业务在 Service/Domain，数据在 Repository。
- DTO 使用严格白名单验证。
- 金额变量和字段使用 `Cent` 后缀。
- 详情查询必须包含授权条件。
- 跨表财务写入使用事务。
- 自动生成和客户端重复提交都必须幂等。
- Worker 与 API 共用业务服务。
- 数据库变化必须有 migration、回滚/向前修复说明和 E2E。
- 禁止在日志中打印完整请求体的敏感字段。
- 新接口同步更新 OpenAPI 和 API_CONTRACT。
