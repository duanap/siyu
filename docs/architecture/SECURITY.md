# 安全规范

## 认证

- QQ OAuth 使用 state、严格回调域校验，并在支持时使用 PKCE。
- Access Token 短期有效。
- Refresh Token 使用 HttpOnly、Secure、SameSite Cookie。
- 登出和账号禁用后使 Refresh Token 失效。
- 不在 localStorage 长期保存 Refresh Token。

## API

- 全局 DTO 验证和白名单。
- 登录、邀请、导出和写接口分别限流。
- 请求带 `requestId`。
- 错误响应不泄露堆栈、SQL、密钥和内部路径。
- 生产 Swagger 使用访问控制。
- CORS 仅允许正式域名。

## 数据

- PostgreSQL 和 Redis 不暴露公网端口。
- 使用最小权限数据库账号。
- 数据备份加密。
- 日志不记录完整敏感金额明细、Token 和 OAuth 密钥。
- 对象存储私密文件使用签名 URL。
- 文件上传校验 MIME、扩展名、大小和随机文件名。

## 业务安全

- 接受邀请、解散、删除、工资到账、任务重试写审计。
- 金额变更在事务中处理。
- 幂等键和唯一索引防止重复提交。
- 并发更新借贷和目标汇总使用行锁或原子更新。
- 防止通过资源 ID 枚举获取他人数据。

## 上线前

- 依赖漏洞扫描
- 权限越权测试
- OAuth 回调测试
- CSRF、CORS、XSS、文件上传测试
- 备份恢复演练
- 生产环境变量和密钥轮换检查
