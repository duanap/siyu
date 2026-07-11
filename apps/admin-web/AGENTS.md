# Admin Web Instructions

继承根目录 AGENTS.md。

- Vue 3 + TypeScript + Ant Design Vue。
- 表格、筛选和详情保持可审计、可分页、可导出。
- 默认不展示完整工资、借贷和账目敏感明细。
- 任何敏感查看操作必须调用有审计的 API。
- 不新增直接编辑用户财务数据的入口。
- 任务重试、用户禁用和情侣关系处理等危险操作必须二次确认。
- 后台菜单权限不能替代 API 权限。
