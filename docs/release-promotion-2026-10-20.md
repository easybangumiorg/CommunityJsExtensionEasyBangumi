# 2026-10-20 release 发布

按用户要求先发布当前完整通过的源：9 条。7 个源移除占位一级 Tab 并递增版本，在小米 14 / Android 16 上按最终字节重测；AGE 和 GGL Beta 保持原字节，使用 10 月 17 日魅族 MEIZU 21 的有效证据。源仓库更新，不涉及 Android APK 版本或 Tag。

| key | 版本 / versionCode |
| --- | --- |
| `heyanle.age` | 1.0 / 1 |
| `heyanle.ggl.beta` | 1.0 / 1 |
| `kazumi.7sefun` | 1.2.1 / 10201 |
| `kazumi.9ciyuan` | 1.3.1 / 10301 |
| `kazumi.anime7` | 1.0.1 / 10001 |
| `kazumi.ant` | 0.0.3 / 3 |
| `kazumi.baimao` | 1.0.1 / 10001 |
| `kazumi.mifun` | 1.1.1 / 10101 |
| `kazumi.mxdm` | 2.3.1 / 20301 |

所有条目均为 `SEARCH_PLAYABLE`，首页、固定顺序搜索的第一部、线路首集、真实首帧、非零尺寸与至少 3000ms 正常播放推进通过。门禁仍使用 7 天时效，证据原件没有改写。测试 APK 是独立 `.sourcelab` 包，基于带未提交改动的 Android 工作区；构建指纹记录在发布 JSON，gitCommit 不能单独描述该包全部内容。

相对发布前已核验的线上 12 条：更新 7sefun、9ciyuan、anime7、ant、baimao、MiFun、MXdm；保留 AGE、GGL Beta；移除 GGL 正式源、LMM 和 sorani。GGL/LMM最新运行仍需人工验证，保留旧通过和新阻断原件，继续 dev。sorani 本轮搜索和详情超时、首页首项变成客户端下载页，保留失败原件并退出 release。缺首页的 akianime、DM84、Fantuan、WYDM、xigua，以及搜索失败的 gpjda 也继续 dev；MiliMili、次元城按用户要求跳过。

dev 保持 82 条 API15 候选，索引固定到源提交 `30571411820855ba0a5f8c74eae685034e53da20`，不表示这些候选都可播放。未涉及的本地开发改动没有混入本次发布。

发布前从生产入口下载并核验了 12 条索引和源文件，刷新 baseline 为这次真实线上快照；不将尚未部署的 9 条产物写成线上状态。旧下架项保留在 legacyArtifacts，继续约束后续版本升级。

51 项仓库测试已通过，发布前继续验证严格 release gate、9 个 JS 和索引的完整产物、dev 索引及远端原始字节。通过 PR 合入 main 后由既有 CI 发布，线上索引与所有文件 hash 核验成功才算完成。[精确清单与证据](../acceptance/publication-2026-10-20.json)。
