# GiriGiriLove 正式站改版与验收（2026-10-25）

按用户要求，新版以独立 key **`heyanle.ggl.v2`**、名称 **GiriGiriLove 新版** 提供，版本 **1.6 / code 8**，API 15。文件为 `dev-extensions/girigirilove-v2.js`，最终 SHA-256：`c835dcbdffd5382b7d616576692e889bccf79ed141c2052cd0a805eb7f798552`。与旧正式源 `heyanle.ggl`、Beta `heyanle.ggl.beta` 分别安装；旧源的收藏、历史和设置不会被新源覆盖。

## 问题与实现

官网 `https://ani.girigirilove.com/` 已改为 Vite 单页应用。旧源依赖的首页、搜索和选集 HTML 选择器失效；当天对 main 旧版 1.5 的真机检查也未读到首页或四种搜索词的结果。

从正式站本身引用的脚本确认新契约，未沿用 Beta 的旧取证：

| 正式站模块 | 契约 |
| --- | --- |
| `client-EH5oUj5z.js` | 公开 API `https://m3u8.girigirilove.com/api.php`，普通 GET `Vod/get_list` / `Vod/get_detail` |
| `HomePage-D0VbS6dN.js`、`BrowsePage-CdOn3rVc.js` | 日番 2、美番 3、剧场版 21、真人番剧 20、BD副音轨 24、演唱会及其他 26；每页 20 条 |
| `SearchPage-KQInoR5x.js`、`api-KAzGFvB_.js` | `vod_name` 搜索，每页 24 条；分页 offset 增加实际返回条数，保留原顺序 |
| `RelatedSection-CRlAuBn9.js` | `vod_play_from` / `vod_play_url`，按 `$$$` 分线路、`#` 分集、首个 `$` 分标签和完整媒体地址 |
| `PlayerPage-RjE_twmb.js` | 官网将详情签发的媒体地址直接交给播放器 |
| `vod-normalize-BV1iBSDX.js` | 相对 `upload/` 图片使用 `https://jpg.girigirilove.net/`，外部绝对图片保留 |

模块 URL 均为 `https://ani.girigirilove.com/assets/<文件名>`；字节数、SHA-256、旧页面检查及数据脱敏规则见 [fixture manifest](../tests/fixtures/ggl-formal/manifest.json)。网页详情、播放链接改用 `/detail/<id>` 与 `/play/<id>?sourceIndex=&episodeIndex=`。

源实现六个首页分类、搜索与分页、详情、完整线路和选集、原生播放。播放前重新获取同一作品详情，核对线路和集名、位置，避免使用过期媒体地址或错集。HTTP 拒绝、无效 JSON、空壳网页及异常列表结构均明确报错。

网页设置统一为 `Host`；在本源自己的设置空间内，新字段未设置时兼容读取 `HostV2`，显式留空恢复默认。改用独立源 key 后，不会自动导入旧源的设置。官网声明的独立 API 使用 `ApiHost`。设置会裁去查询、片段和尾部斜杠，缺协议补 HTTPS，拒绝非 HTTP(S) 与账号密码。网页链接和 Referer/Origin 随网页 Host 变化，独立 API、图片和媒体 CDN 保留各自地址。

## 收藏兼容

旧源 key `heyanle.ggl` 不再用于本候选的 dev 条目；新源 key 为 `heyanle.ggl.v2`。新作品 ID 为 `ggl-v2:<vod_id>`，线路、剧集 ID 绑定作品、位置和名称，不保存会过期的媒体 URL。

**安装新版后，在新源中重新搜索并关联作品。旧收藏与历史仍保留在旧源中，不自动搬迁。** 旧 `/GV…/` 和 `/playGV…/` 仅返回新版壳，没有官方重定向，当前路由也无旧 GV 映射。防御性校验继续拒绝旧 ID，不按相同数字猜作品。

## 真机证据

魅族 21、Android 16 / API 36、物理序列号 `461QYGFJ222HD`，当前局域网无线 ADB。使用专用 `com.heyanle.easybangumi4.sourcelab` 验收包；程序执行真实播放器首帧与至少 3000ms 的播放进度检查，没有调整协议门槛。

**最终独立 key 的验收**：首页日番 20 条，搜索“孤独摇滚”3 条，选择第 1 部“孤独摇滚总集篇”；chs 线路首集“前篇”，真实首帧 **1920×1080、推进 3098ms**，`SEARCH_PLAYABLE / PASS`，无验证码。新 key 与新 hash 均由[原始报告](../acceptance/evidence/2026-10-25/ggl-v2/acceptance-20261025-152937-6b1d64f9.json)记录。首次尝试因手机锁屏，在界面初始化前超时、结果为空；用户手动解锁后才取得本次有效运行，未更改锁屏设置。

以下两次是改 key 前的实现验证，仅证明旧候选，不作为新 key 的准入证据：

| 项目 | 第一次 | 截图复核运行 |
| --- | --- | --- |
| 首页 | 日番 20 条 | 日番 20 条 |
| 搜索 | 孤独摇滚，3 条，选择第 1 部 | 同左 |
| 作品 / 线路 / 首集 | 孤独摇滚总集篇 / chs / 前篇 | 同左 |
| 视频 | 1920×1080，真实首帧 | 1920×1080，真实首帧 |
| 连续进度 | 3113ms | 3166ms |
| 结果 | SEARCH_PLAYABLE / PASS | SEARCH_PLAYABLE / PASS |

旧候选原始报告：[第一次](../acceptance/evidence/2026-10-25/ggl-upgrade/acceptance-20261025-073332-226bc980.json)、[截图运行](../acceptance/evidence/2026-10-25/ggl-upgrade/acceptance-20261025-073545-dc98242c.json)，对应旧 key 和旧 hash `f668…30f3d7`，原件不改写。截图由 ADB 捕获，人工检查确认原生播放器开场动画发生变化，留在 Android 项目 `docs/source-audit/2026-10-25-ggl-upgrade/`。新版公开流程不依赖 WebProxy 验证会话。通过仅代表本网络与固定样本，不等于全站所有作品都验证通过。

手机普通浏览器也确认新版首页、搜索、第一部详情与播放入口；浏览器停留的封面不作为播放通过证据。PC Edge 访问则跳至 `502.girigirilove.com`，标题为暂不支持该地区，浏览器页面抓取工具超时。公开脚本、API 请求与手机浏览器观察分别记录，没有修改网络、地区或伪造登录态。

正常 HTTP 检查另覆盖搜索前三部的各线路首集，结果见 [media probes](../acceptance/evidence/2026-10-25/ggl-upgrade/media-probes.json)。它们仅表示响应与媒体格式，不替代 Android 播放验收。

## 回归与 dev 发布

正式源离线套件通过 **253 个 Rhino 断言、48 次模拟请求**，全部响应关闭；覆盖六分类、分页、搜索顺序、三部完整选集、首集、HostV2、外部 CDN、旧 ID 提示及异常响应。已接入统一入口，独立复核也通过。fixtures 去除真实媒体路径、认证信息和剧情正文。

```sh
tools/source-tests/ggl-formal/run-ggl-formal-fixtures.sh /path/to/easybangumi_android dev-extensions/girigirilove-v2.js tests/fixtures/ggl-formal
PYTHONPATH=src python3 -m unittest discover -s tests
```

dev 索引保持 82 条，以新版独立 key 替换原旧 key 的 dev 条目，按包含最终源文件的完整提交 SHA 生成。release 已复制同字节文件到 `extensions/girigirilove-v2.js` 并完成准入复核，整包门禁与打包均通过 **11 条**：生产原有 10 条保持相同字节，仅新增 GGL 新版。详见[完整 release 准备](release-promotion-2026-10-25-ggl-v2.md)。受保护的 main 需要 PR；分支推送或本地通过不等于官方仓库已部署。
