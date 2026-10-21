# 密藏阁（Mikkyo Reader）v1.0 — 项目规格

> 东密离线藏经阁：Android 原生壳 + 本地全文数据，一次开发、双端发布（APK + GitHub Pages PWA）。

## 1. 目标
做一个「真正的离线 App」：数据打进 APK，阅读与检索全程不走网，碾压 TWA 壳与在线网页。
覆盖《东密核心原典对照清单》中 100% 的经目。

## 2. 数据范围（v1.0）
| 区块 | 范围 | 来源册 |
|---|---|---|
| 密教部（全） | T848–T1420 | 大正藏 18–21 册 |
| 真言宗（续诸宗部） | 册 76–78 实际收录全部 | 76–78 册 |
| 台密精选 | T2362 / T2376 / T2377 / T2395a / T2395b / T2396 | 74–75 册 |

- 来源仓库：github.com/cbeta-org/xml-p5（master 分支，TEI P5 XML）
- 授权：CBETA 非营利散布授权，README 与 App「关于」页注明出处
- 产出：`index.json`（经目元数据）+ `data/vol{NN}.json`（按册分文件、卷级文本，懒加载）

## 3. 功能（v1.0 五件套）
1. **目录**：按册分组的经目列表（经号/经名/卷数/朝代译者），支持筛选
2. **阅读**：卷内上下文切换、字号/行距调节、进度记忆
3. **检索**：全文检索，逐册扫描带进度条，结果高亮与跳转（LIKE 级别即可，密教部数据量 ~40MB 级）
4. **书签**：localStorage 持久化
5. **夜间模式**：极致暗色（OLED 友好），宣纸/墨/朱砂三色国风体系
- （加分项）导览页：对照清单摘要嵌入

## 4. 技术方案
- 前端：vanilla JS + CSS（国风 UI），字体 LXGW WenKai（OFL 许可，可再分发）+ 系统衬线，pyftsubset 子集化控制体积
- Web 壳：单页应用，fetch 懒加载册数据；兼容 `file://` 与 WebViewAssetLoader 两种基址
- Android：单 Activity Kotlin + androidx.webkit WebViewAssetLoader（https 虚拟域，避免 file:// CORS）
- minSdk 26 / targetSdk 34 / applicationId 待定（io.github.<用户名>.mizangge）
- 构建链：/home/z/buildtools/android-sdk + flutter 自带 gradle wrapper（Horosa 同款环境）

## 5. 里程碑
- M1 数据管线：sparse 拉取 → XML 解析 → JSON 产出（含样例校验）
- M2 Web 阅读器：国风 UI，Playwright 截图迭代至审美过关
- M3 功能联调：检索/书签/夜间模式全通
- M4 APK：Kotlin 壳 + Gradle 构建 + 新 keystore 签名（档案交用户保管）
- M5 发布：README（含授权与数据来源）、Release 材料、交付源码包 + APK

## 6. 验收标准
- 清单内 24 部著作全部可读、T 号可检索命中
- 实机（鸿蒙 4.2）安装通过，夜间模式 / 书签 / 检索可用
- 用户审美验收通过
