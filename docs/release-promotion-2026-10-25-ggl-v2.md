# GGL 新版独立 key 的 release 准备

2026-10-25，依据会话中将已通过源纳入 release 的授权，本轮仅新增 **GiriGiriLove 新版 `heyanle.ggl.v2`，1.6 / code 8**。生产已有 10 个源保持原版本和字节，合计 **11 条 release**。dev 仍为 82 条，用新 key 替代旧 GGL 的 dev 条目。此次为源仓库更新，不涉及 Android APK 版本或 Tag。

新版文件：`dev-extensions/girigirilove-v2.js` 与 `extensions/girigirilove-v2.js`，SHA-256 均为 `c835dcbdffd5382b7d616576692e889bccf79ed141c2052cd0a805eb7f798552`。保留版本 1.6 / code 8 表达本轮适配版本；独立新 key 不承接旧源的自动更新和应用数据。

## 验收与兼容

改 key 后重新验证最终文件：魅族 21 / Android 16 / API36，专用 `.sourcelab` 包。首页日番 20 条；搜索“孤独摇滚”3 条，首部“孤独摇滚总集篇”；chs 线路首集“前篇”，1920×1080 真实首帧，进度 3098ms。严格 `validate_evidence` 通过。没有将旧 key 的报告改写为新 key 的报告。

与旧源 `heyanle.ggl`、Beta `heyanle.ggl.beta` 分开安装。旧收藏、历史和源设置仍保留，用户在新版重新搜索关联作品；不猜旧 GV 作品 ID、不自动移动应用数据。新版公开 API 流程不依赖旧 WebView 验证恢复桥，也没有复制旧源的客户端能力声明。实际验证对应本次 QA APK，未声称所有历史公开客户端都已重测。

## 完整清单

| key | 版本 | 本次动作 |
| --- | --- | --- |
| heyanle.age | 1.0 | 原字节，刷新今日证据 |
| heyanle.ggl.beta | 1.0 | 原字节，刷新今日证据 |
| heyanle.ggl.v2 | 1.6 | 新独立源 |
| kazumi.7sefun | 1.2.1 | 原字节，刷新今日证据 |
| kazumi.9ciyuan | 1.3.1 | 原字节，刷新今日证据 |
| kazumi.anime7 | 1.0.1 | 原字节，刷新今日证据 |
| kazumi.ant | 0.0.3 | 原字节，刷新今日证据 |
| kazumi.baimao | 1.0.1 | 原字节，刷新今日证据 |
| kazumi.mifun | 1.1.1 | 原字节，刷新今日证据 |
| kazumi.mxdm | 2.3.1 | 原字节，刷新今日证据 |
| kazumi.sorani | 1.0 | 原字节，独立补测 3045ms 通过 |

没有顺带加入路漫漫或升级青空次元。旧 GGL 与路漫漫继续 pending；旧 GGL 文件和历史验收原件仍保留。

青空次元现网 1.0 / code10000 与 dev 1.0.1 / code10001 的报告不能混用。保留原现网文件后，首次同批运行在播放地址解析 45s 超时；随后手机普通浏览器同一首集从 Redirect 加载成真实页面，再独立重试同一作品、同一首线路首集通过，1920×1080、3045ms。先前失败报告保留在 `acceptance/evidence/2026-10-25/ggl-v2/`，最终补测在 `acceptance/evidence/2026-10-25/release/kazumi.sorani/`。可能与网络或页面加载耗时有关，未精确定位根因，不把失败归因于版本差异，也不隐去失败或借用不同 hash 的上午报告。

## 门禁与产物

所有准入条目的 review 均晚于对应验收生成时间；证据有效期仍为 7 天。原 10 条的今日报告经 hash/版本核对，源文件未修改。已下载当前生产索引及 10 份 JS 核验，baseline 刷新为这次真实快照；原旧 GGL、路漫漫转入 legacyArtifacts 保留版本约束，没有把尚未部署的新 key 写成已发布。

已通过：253 项正式源 Rhino 断言、48 次模拟请求、统一离线套件、51 项仓库单测、完整 release check-only 与打包。产物核对为 **11 个 JS + 11 行索引**，新增 key 只有 `heyanle.ggl.v2`；生产原 10 条均保持精确 hash，无条目遗漏。

[精确发布准备与证据索引](../acceptance/publication-2026-10-25-ggl-v2.json)记录候选字节、原线上快照及各源的报告。分支推送、准入批准和产物通过均不等于线上完成；需要 PR 合并、CI 发布并核验最终公开索引与全部源字节。
