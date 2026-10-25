# 新源离线检查

在源仓库根目录执行：

```sh
./tools/source-tests/run-all.sh /path/to/easybangumi_android
PYTHONPATH=src python3 -m unittest discover -s tests
```

需要 JDK、Node.js、Python 3，以及 Android 项目的 Rhino 1.7.15 和 Jsoup 1.16.1。脚本使用已有依赖，不联网安装；Jsoup 可从 Android `app/libs` 或 Gradle 缓存查找，也可设置 `JSOUP_JAR`。各套检查仍可单独执行，见各目录入口脚本。临时编译目录在退出时清理。

| 套件 | 检查数量 | 主要覆盖 |
| --- | ---: | --- |
| GGL Beta | 208 断言 | 实际 API 数据、顺序与分页、所有线路、Host/ApiHost、响应关闭、API15 Rhino |
| GGL 正式版 | 253 断言 / 48 次请求 | 新版六分类、真实 offset、固定搜索顺序、完整选集、HostV2 兼容、旧 ID 提示、API15 Rhino |
| MiFun | 182 断言 | HTML 首页/搜索/详情、整数分页 ABI、Host、旧收藏校验、官方播放接口、原验证窗口 |
| MiliMili | 185 断言 | 目录真实偏移、单批搜索、剧集顺序、Host、登录接续、播放方式兼容性 |
| 次元城 | 67 用例及 Rhino 检查 | 新版接口、完整剧集分页、旧 ID 明确迁移、Host、登录与原窗口接续 |
| 路漫漫 | 42 用例 | 真机首页/搜索/两线片段、Host、旧收藏校验、原窗口验证、当前集媒体 |

fixtures 已去除登录态、签名媒体地址和正文描述；必要的媒体占位使用 `.invalid` 或 `.example`。合成边界样例单独标明，不能代替真实网页取证。

离线检查仅验证解析与运行时契约。真机继续使用 Android `tools/run_source_acceptance.py`，直接传入最终 `dev-extensions` 字节，按[本批验收记录](../../docs/new-source-adapters-2026-10-14.md)执行。只有真实首帧和连续进度达到 3000ms 才能记录播放通过。
