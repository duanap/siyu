# 设计 Token

工程中的主题 Token 唯一事实来源为 `packages/ui-tokens/src/styles.css`，移动端通过
`@siyu/ui-tokens/styles.css` 引入。本文只说明使用边界，不复制另一套可独立修改的颜色值。

## 使用规则

- 页面背景、表面、文本、边框、收入、支出、警告和危险状态必须使用 `--siyu-*` CSS 变量。
- 日间与暗色值由 Token 包统一切换，业务组件不得按主题写死颜色。
- 品牌主按钮文字使用 `--siyu-on-primary`；弱背景使用 `--siyu-primary-soft`、
  `--siyu-secondary-bg` 或对应语义 soft Token。
- 分类固有颜色来自服务端批准的固定色板，可通过 `color-mix` 与当前主题表面混合。
- 新增 Token 时同步更新 Token 包测试、`UI_DESIGN_GUIDE.md` 和本说明；不得在单个页面创建同义变量。

## 尺寸

断点和手机内容宽度由 `@siyu/ui-tokens` 导出的 `breakpoints` 管理；交互控件最小高度为 44px，
手机内容最大宽度为 480px，底部固定区域必须包含 `env(safe-area-inset-bottom)`。
