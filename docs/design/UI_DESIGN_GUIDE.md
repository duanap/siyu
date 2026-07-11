# UI 设计规范

品牌名称与工程命名遵循 `../product/BRAND_IDENTITY.md`。

## 1. 定位

手机端优先，整体气质为简洁、温和、清晰、可信赖。避免银行后台、专业会计软件、过度粉色情侣风格和过量阴影。

## 2. 尺寸与布局

- 设计基准：375px
- 最低适配：320px
- 手机内容最大宽度：480px
- 页面左右边距：16px
- 卡片间距：12px
- 模块间距：24px
- 控件高度：44px
- 底部导航：60px + 安全区
- 卡片内边距：16px

## 3. 颜色 Token

```css
:root[data-theme="light"] {
  --primary: #5b7cfa;
  --primary-soft: #eef2ff;
  --page-bg: #f6f7f9;
  --card-bg: #ffffff;
  --secondary-bg: #f1f3f6;
  --text-primary: #1f2329;
  --text-secondary: #6f7682;
  --text-tertiary: #a1a7b0;
  --border: #e8ebef;
  --income: #22a06b;
  --expense: #e85d5d;
  --debt: #e67e22;
  --receivable: #3b82f6;
  --warning: #f5a623;
  --danger: #e5484d;
}

:root[data-theme="dark"] {
  --primary: #7d98ff;
  --primary-soft: #242c4a;
  --page-bg: #0f1115;
  --card-bg: #191c22;
  --secondary-bg: #22262e;
  --text-primary: #f4f5f7;
  --text-secondary: #a7adb7;
  --text-tertiary: #747b86;
  --border: #2b3039;
  --income: #49bf8a;
  --expense: #f17b7b;
  --debt: #f0a04b;
  --receivable: #6ea8ff;
  --warning: #f4b85e;
  --danger: #f17b7b;
}
```

业务组件禁止直接写死主题颜色。

## 4. 字体

- 页面标题：22px / 600
- 模块标题：18px / 600
- 卡片标题：16px / 500
- 正文：14px / 400
- 辅助：12px / 400
- 核心金额：32px / 600
- 金额启用 `font-variant-numeric: tabular-nums`

## 5. 金额格式

- 内部：整数分
- 明细：`-¥ 128.50`
- 收入：`+¥ 8,500.00`
- 核心大金额可省略 `.00`
- 不以颜色作为唯一收入/支出识别方式

## 6. 圆角

- 标签：6px
- 输入框：10px
- 按钮：12px
- 卡片：14px
- 重点卡片/弹窗：16px
- 胶囊：999px

## 7. Ant Design Vue

可直接使用：

- Form、Input、InputNumber、Select、DatePicker
- Switch、Radio、Checkbox、Upload
- Modal、Drawer、Tabs、Progress
- Avatar、Badge、Empty、Skeleton、Tooltip、Message

必须二次封装：

- Card、Statistic、List、Table、Descriptions、Segmented、Tag

建议自定义：

- 首页核心卡片
- 金额输入
- 分类九宫格
- 底部导航
- 工资余额卡
- 情侣首页
- 攒钱目标卡
- 账目列表项

建议 Token：

```ts
export const antTheme = {
  token: {
    colorPrimary: "#5B7CFA",
    borderRadius: 10,
    fontSize: 14,
    controlHeight: 44,
    colorSuccess: "#22A06B",
    colorWarning: "#F5A623",
    colorError: "#E5484D",
  },
};
```

## 8. 交互

- 新增账目、工资、借贷、周期规则和目标使用全屏页面。
- 账本、分类、日期、筛选使用底部抽屉。
- 删除、解散、退出、注销必须二次确认。
- 保存按钮防重复点击并展示加载状态。
- 列表整行可点击。
- 不依赖悬停。
- 手机端不放宽表格。

## 9. 状态文案

- 进行中
- 已完成
- 已暂停
- 待确认
- 已逾期
- 已结清
- 未到账
- 已到账
- 生成失败

## 10. 图表

使用 ECharts：

- 趋势图 220px
- 环形图 200px
- 收入绿色、支出红色
- 当前用户品牌蓝、情侣另一方柔和紫
- 无数据时不显示空坐标轴，展示空状态和“记一笔”入口

## 11. 页面状态

所有页面必须覆盖：

- 首次加载
- 分页或下拉加载
- 正常数据
- 空数据
- 请求失败
- 无权限
- 长文本
- 夜间主题
- 提交中
- 提交失败

## 12. 设计验收

- 320px 无横向滚动
- 44px 最小点击区域
- 夜间模式无白底残留
- 金额和日期格式一致
- 相同状态颜色和文案一致
- 核心页面不呈现后台风格
