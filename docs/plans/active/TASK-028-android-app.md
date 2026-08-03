# TASK-028：Android APP、品牌图标与骨架屏

## 状态

本地开发与构建完成，待远程 CI 与真机验收

## 目标

- 为个人私有档案提供可直接安装的 Android APK，应用名称使用“四时有余”，包名暂定 `cn.duanap.siyu`。
- 使用负责人提供的品牌图和 Image 2 重构结果生成统一启动图标、PWA 图标和应用内品牌标记。
- 为 JavaScript 启动前、核心页面加载中和 Android 网络加载提供可识别骨架屏，避免白屏和跳变。
- 收敛底部导航与账目分类的图标映射，保持语义、无障碍名称和 44px 点击区不变。

## 非目标

- 不修改数据库、API、权限、认证 Cookie、生产 Nginx 或 EdgeOne 配置。
- 不增加 Push、相机、文件、定位、支付、应用商店发布或自动更新能力。
- 不开放任意网址、明文 HTTP、JavaScript 原生桥或本地文件访问。
- 不承诺本次 APK 已完成签名、上架或公网生产验收。

## 相关规则

- ADR-003、ADR-006、ADR-009、ADR-035、ADR-036。
- AC-APP-001 至 AC-APP-005、AC-SHELL-001 至 002、AC-QUALITY-001。

## 受影响模块

- `apps/mobile-web`：PWA 图标、首屏/页面骨架、集中图标注册表及测试。
- `apps/android-app`：固定一方域名的 Android WebView 壳、启动/失败状态、品牌资源和构建脚本。
- 产品验收、页面规格、架构决策和项目记忆。

## 风险

- Android WebView 依赖公网域名可达；源站或 DNS 不可用时只能展示重试页。
- 调试 APK 使用调试签名，只适合受控安装验证，正式分发前必须换正式签名并确认包名权属。
- 远程页面仍由服务端发布版本决定，APK 本身不会固定某一版 Web 资源。
- 100×100 原图包含横向文字，不适合小尺寸启动图标；启动图标只使用其重构后的无文字中心徽记。

## 实施步骤

- [x] 预检、Graphify 导航和品牌原图检查
- [x] 冻结 Android 安全边界、验收条件和 ADR-036
- [x] 生成并接入品牌图标资源
- [x] 实现通用骨架屏和集中图标注册表
- [x] 实现 Android 壳、网络失败重试和安全导航
- [x] 生成 APK 并执行本地安装包/网页质量门禁
- [x] 更新项目记忆并交付制品

## 验证命令

```bash
pnpm --filter @siyu/mobile-web test
pnpm --filter @siyu/mobile-web typecheck
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
pnpm manifest:check
git diff --check

cd apps/android-app
./gradlew lint testDebugUnitTest assembleDebug
```

页面检查覆盖 320px、375px、480px，日间/夜间、JavaScript 启动前、页面加载、网络失败、刷新恢复、
减少动态效果和底部安全区。APK 检查包名、名称、图标、HTTPS 限制、域名导航和断网重试。

## 回滚

无数据库迁移。删除 Android 模块、PWA 图标、骨架组件及其引用即可回滚；服务端数据和认证会话不变。

## 进度日志

- 2026-08-04：完成预检；负责人提供 100×100 品牌图并要求 1.5 倍速连续推进。
- 2026-08-04：Image 2 生成无文字方形品牌徽记；Graphify 确认 `index.html → main.ts → App.vue` 启动链、
  底部导航与分类图标为最小改动接缝。
- 2026-08-04：根据官方生产限制放弃 Capacitor `server.url`，采用 ADR-036 的固定 HTTPS Android 壳。
- 2026-08-04：Android lint、导航单测和 debug APK 真构建通过；包元数据只包含 INTERNET 权限。
- 2026-08-04：Node.js 24.14.0 全仓 lint、typecheck、204 项测试、生产构建和文档检查通过；375×844
  日间/夜间首屏骨架目视通过。无连接 Android 设备，真机安装与远程 CI 待验收。
- 2026-08-04：交付调试包 `siyu-task028-debug-20260804.apk`，SHA-256 为
  `2185da5f4060bb0b2d8d04bafda2b074c1297198206a3852d5d1a37f5093fa05`；ZIP 完整性和 APK v2 调试签名验证通过。
