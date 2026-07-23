INSERT INTO "permissions" ("id", "code", "description") VALUES
  ('20000000-0000-0000-0000-000000000004', 'admin:overview:read', '读取管理端运行概览'),
  ('20000000-0000-0000-0000-000000000005', 'admin:users:read', '读取脱敏用户运营信息'),
  ('20000000-0000-0000-0000-000000000006', 'admin:users:write', '管理用户状态'),
  ('20000000-0000-0000-0000-000000000007', 'admin:ledgers:read', '读取账本成员关系'),
  ('20000000-0000-0000-0000-000000000008', 'admin:tasks:read', '读取周期任务状态'),
  ('20000000-0000-0000-0000-000000000009', 'admin:tasks:retry', '人工重试失败周期任务'),
  ('20000000-0000-0000-0000-000000000010', 'admin:audit:read', '读取脱敏审计记录')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT '10000000-0000-0000-0000-000000000002', "id"
FROM "permissions"
WHERE "code" IN (
  'admin:overview:read',
  'admin:users:read',
  'admin:users:write',
  'admin:ledgers:read',
  'admin:tasks:read',
  'admin:tasks:retry',
  'admin:audit:read'
)
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
