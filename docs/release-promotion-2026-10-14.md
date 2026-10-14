# 2026-10-14 release 晋级补充

用户在查看 12 个最新真机通过源及客户端限制后要求：“已经通过的放到 release 吧，一起加进去”。本次将这些最终字节一同纳入 `feat/new-site-adapters` 的 release 发布准备，dev 继续保留同版本源。main 尚未合并，不表示线上已更新。

## 正式清单

| 源 | key | 版本 | 实测线路 |
| --- | --- | --- | --- |
| AGE | `heyanle.age` | 1.0 / 1 | VIP 西瓜 |
| GiriGiriLove | `heyanle.ggl` | 1.5 / 7 | 简中2 |
| GiriGiriLove Beta | `heyanle.ggl.beta` | 1.0 / 1 | chs |
| 7sefun | `kazumi.7sefun` | 1.2 / 10200 | 播放线路1 |
| 9ciyuan | `kazumi.9ciyuan` | 1.3 / 10300 | 囧动漫 |
| anime7 | `kazumi.anime7` | 1.0 / 10000 | 線路1 |
| ant | `kazumi.ant` | 0.0.2 / 2 | 播放线路1 |
| baimao | `kazumi.baimao` | 1.0 / 10000 | 播放Ⅰ |
| 路漫漫 | `kazumi.lmm` | 2.2 / 20200 | dp云播 |
| MiFun | `kazumi.mifun` | 1.1 / 10100 | 特快云 |
| mxdm | `kazumi.mxdm` | 2.3 / 20300 | 量子 |
| 青空次元 | `kazumi.sorani` | 1.0 / 10000 | 播放线路1 |

全部证据为当天 `source-acceptance-v1 / SEARCH_PLAYABLE`：首页通过，固定词按顺序搜索，第一部作品逐线路首集，真实非零尺寸首帧与至少 3000ms 播放推进。12 份仓库原件与 Android 审计原件逐字节一致；源 hash 与版本均对应当前 dev 文件，复制到 release 后字节不变。

原先准备的 8 条保持批准；本次另批准 GGL 正式版、GGL Beta、路漫漫和 MiFun。相对最近核验的线上 16 条基线，新增 Beta、路漫漫、MiFun，移除 Jellyfin、旧稀饭、旧樱花、gpjda、omofun03、TvTFun、ylsp，共 12 条。旧文件及失败证据保留，严格产物只包含 approved。`release-baseline.json` 在实际部署并核对线上字节后才刷新。

## 验证码客户端要求

GGL 正式版与路漫漫的人工搜索验证均在原关键词、原页码完成并重试成功；实际等待分别为 21215ms、27002ms，未计作播放进度。二者遇验证码时需要支持同步 WebProxy 验证回调的客户端，即本次验收包已包含的验证桥修复。旧公开 APK 的兼容性尚未证明，不能写成所有 API15 客户端均已兼容，也不能虚构一个最低应用版本号。

该能力要求记录在 `release-manifest.json` 的说明和 `requiredClientCapabilities`，以及[本次晋级记录](../acceptance/release-promotion-2026-10-14.json)。现有打包门禁验证证据、版本和字节，不会自动验证或阻止旧客户端安装。按本次用户授权纳入清单时保留这一边界。

## 检查与合并

- 51 项仓库单测通过。
- 完整 release gate 放行 12 项；其它 9 个历史文件保持 pending，不进入产物。
- 预览目录只有 12 个 JS 和一份索引，key、版本、文件 SHA256、生产 URL 全部校验通过。
- dev 仍为 86 个候选中的 82 个 API15 条目，索引与源字节一致；本次晋级不改 dev 字节或索引。
- 次元城、MiliMili 登录后未验证，gpjda 搜索异常，继续留在 dev；Next 按用户要求暂停。

本批继续使用同一需求分支 `feat/new-site-adapters`，后续以该分支 PR 一起合入 main，再由既有 CI 发布 release/dev。此前 8 条发布准备记录保留，并链接到本次补充；不更改 Android APK 版本或创建 Tag。
