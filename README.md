# 密藏阁 · Mikkyo Reader v1.0

> 东密离线藏经阁 —— Android 应用。数据内置，阅读与全文检索**全程离线**，不依赖任何在线服务。

## 收录范围（v1.0）
- **大正藏·密教部**（第 18–21 册）全部：T848–T1420，共 **541 部 / 875 卷**，约 390 万字
  - 两部大经：大日经（T848）、金刚顶经（T865）、苏悉地经（T893）、瑜祇经（T867）等
  - 《大日经疏》（T1796，一行记）、《菩提心论》（T1665）、《理趣经》（T243）、《理趣释》（T1003）附收
- 检索支持**简繁互查**（内置 OpenCC 简繁映射，歧义字多变体匹配）

## 功能
目录（按册分组/最近阅读）· 阅读（字号/卷切换/进度记忆）· 全文检索（进度条+高亮跳转）· 书签 · 夜间模式（OLED 纯黑）

## 数据来源与授权
- 经文数据来自 **CBETA 电子佛典**（经 deerpark.app 底本 API 获取），依 CBETA 非营利散布授权使用，出处保留于各卷末尾
- 简繁映射数据来自 OpenCC（Apache-2.0）
- 本项目代码以 MIT 许可发布；经文数据再分发请遵循 CBETA 授权条款

## 构建方法（零 gradle 依赖）
```bash
bash tools/build_apk.sh
```
依赖：JDK 17、Android SDK（build-tools 34.0.0 + platforms android-34）。
管线：aapt2 → javac → d8 → zip 打包 → zipalign → apksigner。

## 签名档案（重要！）
- `android/mizangge.jks`（密码见 `android/KEYSTORE.txt`）
- 证书 SHA-256：`0ad88c9863c2fbbe1131db1fed53e69d9de3baf3769d5a7c4ee07252d0e08dfb`
- **务必妥善保管**：后续升级必须用同一签名，否则无法覆盖安装

## 架构
```
web/        纯前端（vanilla JS + 国风双主题：宣纸/玄墨）
android/    零依赖 WebView 壳（虚拟域 mzg.local 映射 assets，含主题桥与返回键协议）
tools/      数据抓取与构建脚本（deerpark API → 册级 JSON 懒加载）
```

## 路线图
- v1.1：空海十卷章（《十住心论》等 14 部，大正藏 56–84 册，因版权仅个人版内置）
- v1.2：竖排阅读、内嵌缺字字体、检索按卷分页
