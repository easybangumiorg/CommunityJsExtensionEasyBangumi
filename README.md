# Community EasyBangumi Js Extension

## 2026-10-20 当前发布准备

本批准备 10 个通过源，7 个含首页 Tab 修正并递增版本；GGL 正式源与 LMM 因验证阻断退回 dev；sorani 按用户的内网说明保留现网版本，其他受限项继续 dev。详见[精确清单与验收](docs/release-promotion-2026-10-20.md)。通过 PR 合并并核验线上字节后才视为部署完成；以下日期段落为历史记录。

纯纯看番社区 JS 源仓库

## 当前发布准备（2026-10-14）

按用户最新要求，将全部 12 个真机通过源一同纳入 release：AGE、GGL 正式版、GGL Beta、7sefun、9ciyuan、anime7、ant、baimao、路漫漫、MiFun、mxdm、青空次元。12 份精确字节证据通过严格 gate，51 项仓库单测通过，打包预览包含 12 个 JS 与一份索引。GGL 正式版和路漫漫的验证码重试需要含验证桥修复的客户端，旧公开客户端尚未核实兼容性。

需求分支 `feat/new-site-adapters` 同时保留 dev 的 82 个 API15 条目。次元城和 MiliMili 因暂无账号留在 dev，gpjda 因搜索 HTTP503 留在 dev。main 尚未合并，线上未由本次工作更新。详见[本次晋级与差异](docs/release-promotion-2026-10-14.md)、[精确批准记录](acceptance/release-promotion-2026-10-14.json)和[新源实现与验收](docs/new-source-adapters-2026-10-14.md)。

早期 8 条 release / 80 条 dev 的准备记录保留在[原发布记录](acceptance/publication-2026-10-14.json)，其当前清单由本次 12 条 / 82 条补充替代；下文 10 月 9 日状态为历史记录。

## 官方仓库环境

| 环境 | 索引入口 | 源目录 | 收录条件 |
| --- | --- | --- | --- |
| release | https://easybangumi.org/repository/v2/index.jsonl | `extensions/` | 兼容客户端、真机可播放、证据与文件一致、维护者复核 |
| dev | https://raw.githubusercontent.com/easybangumiorg/CommunityJsExtensionEasyBangumi/main/channel/dev/index.jsonl | `dev-extensions/` | 元数据合法、未屏蔽、`libVersion=15`；功能可能失效，供验收 |

dev 索引入口稳定，索引内源文件使用 GitHub raw 的提交 SHA 地址，并附 `sha256`。两个环境共用源 key，在同一客户端中安装 dev 会更新或覆盖已有同 key 源；返回 release 不会自动降级。

截至 2026-10-09，dev 方案仍为本地未提交变更，公开入口返回 404；需要合并并运行 `parse2dev` 后才能在线使用。release 在线有 16 个索引条目；历史发布记录不作为当前验收通过证据。本地 18 个历史 release 文件全部登记为 `pending`。现已完成 84 个候选的真机检查，以及 10 个候选的专用 `.sourcelab` 干净包复核；最新 9 个满足自动门禁，GiriGiriLove 因搜索验证码继续留在 dev，全部仍等待维护者复核；严格发布门禁暂不放行，线上仓库保持原状。

目前只接受开源 JS 源；JSC 加密源可自行搭建分发仓库。新增源先[向 dev 目录提 PR](https://github.com/easybangumiorg/CommunityJsExtensionEasyBangumi/upload/main/dev-extensions)，经过验收后晋级。

详见[仓库环境与发布流程](docs/repository-environments.md)和[贡献指南](CONTRIBUTING.md)。
