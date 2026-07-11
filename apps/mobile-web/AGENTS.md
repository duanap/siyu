# Mobile Web Instructions

继承根目录 AGENTS.md。

- Vue 3 + TypeScript + Composition API。
- 页面优先适配 320px、375px 和 480px。
- 核心页面不得直接堆叠 Ant Design 默认 Card。
- 所有颜色来自 ui-tokens。
- 表单保存必须防重复点击。
- API 金额以整数分接收，展示层统一格式化。
- 每个页面实现正常、加载、空、错误、无权限和夜间状态。
- 新增页面必须更新 SCREEN_SPECIFICATIONS 和对应截图/测试。
- 禁止在组件中复制权限规则；按钮可隐藏，但后端是最终权限来源。
