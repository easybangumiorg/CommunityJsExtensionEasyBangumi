# Community EasyBangumi Js Extension

纯纯看番社区 JS 源仓库

## 2026-10-14 发布准备

本轮按既定门禁发布：release 从 16 条收敛为 8 条最新真机通过的源，dev 保留 84 个候选中的 80 个 API 15 可安装条目。GiriGiriLove 因公开客户端兼容性未核实、gpjda 因本次搜索 HTTP503 继续留在 dev；其它未通过与旧 API 源不进入 release。发布授权、精确字节与新旧差异见[本次发布记录](acceptance/publication-2026-10-14.json)。以下 10 月 9 日状态为历史记录。

## 官方仓库环境

| 环境 | 索引入口 | 源目录 | 收录条件 |
| --- | --- | --- | --- |
| release | https://easybangumi.org/repository/v2/index.jsonl | `extensions/` | 兼容客户端、真机可播放、证据与文件一致、维护者复核 |
| dev | https://raw.githubusercontent.com/easybangumiorg/CommunityJsExtensionEasyBangumi/main/channel/dev/index.jsonl | `dev-extensions/` | 元数据合法、未屏蔽、`libVersion=15`；功能可能失效，供验收 |

dev 索引入口稳定，索引内源文件使用 GitHub raw 的提交 SHA 地址，并附 `sha256`。两个环境共用源 key，在同一客户端中安装 dev 会更新或覆盖已有同 key 源；返回 release 不会自动降级。

截至 2026-10-09，dev 方案仍为本地未提交变更，公开入口返回 404；需要合并并运行 `parse2dev` 后才能在线使用。release 在线有 16 个索引条目；历史发布记录不作为当前验收通过证据。本地 18 个历史 release 文件全部登记为 `pending`。现已完成 84 个候选的真机检查，以及 10 个候选的专用 `.sourcelab` 干净包复核；最新 9 个满足自动门禁，GiriGiriLove 因搜索验证码继续留在 dev，全部仍等待维护者复核；严格发布门禁暂不放行，线上仓库保持原状。

目前只接受开源 JS 源；JSC 加密源可自行搭建分发仓库。新增源先[向 dev 目录提 PR](https://github.com/easybangumiorg/CommunityJsExtensionEasyBangumi/upload/main/dev-extensions)，经过验收后晋级。

详见[仓库环境与发布流程](docs/repository-environments.md)和[贡献指南](CONTRIBUTING.md)。
