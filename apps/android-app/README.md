# 四时有余 Android APP

该模块实现 ADR-036：固定加载 `https://siyu.duanap.cn` 的最小 Android WebView 壳。它不包含原生
JavaScript 桥，不申请相机、定位或存储权限，也不允许明文流量、文件 URL 或其他主机在应用内打开。

```bash
./gradlew lint testDebugUnitTest assembleDebug
```

调试 APK 输出到 `app/build/outputs/apk/debug/app-debug.apk`。调试签名仅供本人和女朋友受控安装；公开分发前
必须创建正式签名、确认 `cn.duanap.siyu` 包名权属，并完成应用商店与真实设备验收。
