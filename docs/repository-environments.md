# 官方源仓库环境与晋级流程

## 2026-10-20 当前发布准备

本批准备 10 个通过源，7 个含首页 Tab 修正并递增版本；GGL 正式源与 LMM 因验证阻断退回 dev；sorani 按用户的内网说明保留现网版本，其他受限项继续 dev。详见[精确清单与验收](release-promotion-2026-10-20.md)。通过 PR 合并并核验线上字节后才视为部署完成；以下日期段落为历史记录。

## 2026-10-14 最新晋级补充

用户要求已通过项一起加入 release，当前批准 12 条、dev 收录 82 条。原先 8 条继续保留，本次加入 GGL 正式版、GGL Beta、MiFun 和路漫漫。全部最终 hash/版本及真实播放器证据通过 gate；验证码客户端能力限制保留在说明中，旧公开 APK 未经兼容验证。详见[最新晋级记录](release-promotion-2026-10-14.md)。main 尚未合并，baseline 仍保留实际线上快照。

## 2026-10-14 早期发布准备（已补充）

本次以小米 14 新的 10 份原始证据重新复核。release 准备发布 8 条：`heyanle.age`、`kazumi.7sefun`、`kazumi.9ciyuan`、`kazumi.anime7`、`kazumi.ant`、`kazumi.baimao`、`kazumi.mxdm`、`kazumi.sorani`。dev 的 84 候选中 80 条通过 API/元数据静态收录，dev 收录不表示播放通过。

旧线上 16 条中排除 `ayala.jellyfin`、`heyanle.ggl`、`heyanle.xifan`、`heyanle.yhw`、`kazumi.gpjda`、`kazumi.omofun03`、`kazumi.tvtfun`、`kazumi.ylsp`。GGL 在新 QA 包通过，但人工验证桥的公开 APK 兼容性未核实，继续 pending；gpjda 本次搜索 HTTP503，不能用旧通过覆盖。其它旧失败与旧 API 均保留原件、文件和 pending 状态，严格产物只收录 approved。

用户明确授权发布现有双通道，Codex 作为授权执行者复核完整证据、请求顺序、首部首集、hash/版本与播放器计量，并如实写入 review。此授权不等于用户逐条审阅原件或画面。[发布记录与精确差异](../acceptance/publication-2026-10-14.json) 是本次当前视图；下文日期段落保留历史。公开部署成功前不刷新 baseline，不发布 Android APK。

## 目录与产物

| 路径 | 用途 | 发布方式 |
| --- | --- | --- |
| `dev-extensions/**/*.js` | 现有源与新源候选，尚未保证可用 | 源提交后生成 `channel/dev/index.jsonl` 并纳入同一 PR，JS 使用 GitHub raw 的提交 SHA |
| `extensions/**/*.js` | 准备进入正式环境的源文件 | 严格门禁按 `release-manifest.json` 选出 approved 文件 |
| `release-manifest.json` | 源的验收状态、精确 hash、证据与复核 | 与源和证据一起提交；不能仅靠搬文件晋级 |
| `release-baseline.json` | 2026-10-09 实际线上 16 源版本与字节快照 | 仅在正式发布后核验线上内容再刷新，用于检查升级版本递增 |
| `acceptance/evidence/*.json` | Android 真机导出的可复核证据 | 只记录源、流程、设备和结果；不记录 Cookie 或媒体 URL |
| `acceptance/candidate-import.json` | 本次补齐 dev 候选及跨目录差异 | 保留现有 dev 内容，遇到冲突不覆盖 |
| `repository/v2/` | 本地 release 打包输出，Git 忽略 | 发布工作流复制到 website 仓库 |

公开 release 入口固定为 `https://easybangumi.org/repository/v2/index.jsonl`。公开 dev 入口固定为 `https://raw.githubusercontent.com/easybangumiorg/CommunityJsExtensionEasyBangumi/main/channel/dev/index.jsonl`。截至 2026-10-09，dev 尚未推送部署，入口返回 404；此文描述已实现的本地方案与后续流水线。

baseline 的 `sources` 只记录实际线上索引中的 16 个源；另以 `legacyArtifacts` 记录本地历史 `extensions/` 中两个 blocked 文件的版本/hash。这两项只用于约束后续更新版本必须增加，不表示它们在活跃索引中，也不作为可播放证据。

dev 索引内 URL 固定到生成时的提交 SHA，避免新源与旧索引在同一可变分支上错配；每项含 `sha256`，支持此字段的客户端在安装时核验下载字节。release 保留原索引字段契约，验收 hash 在内部清单与证据中校验。源真实身份和版本来自 JS 头部，两个环境同 key 共用客户端安装槽位；更新提示按 `versionCode` 增加判定，切换环境不自动降级。

## 本次源整理基线

- `extensions/` 18 个唯一 key：全部 `pending`，不能把历史发布状态视为当前真机验收通过。
- `dev-extensions/` 从 14 个补齐为 84 个候选；补齐 70 个来自 Android `inner_source/` 的缺失 key，现有 dev 文件未覆盖。
- 80 个候选符合当前 `libVersion=15`；另外 4 个保留待迁移但不进入 dev 索引：`ayala.jellyfin`（11）、`heyanle.yhw`（13）、`jisoft.ale`（12）、`jisoft.omofun`（12）。
- dev 与 release 的 `ayala.jellyfin/jisoft.ale/jisoft.omofun` 存在相同 versionCode、不同字节。保留双方原文件；定稿后必须增加版本、按最终字节重测，不能用相同版本替换正式源。
- 目前没有 approved 源。`ebjer release` 应返回非零，停止打包和部署，保持现有线上仓库；不会把空索引部署出去。

## 2026-10-09 真机证据交接

84 个候选均已完成真机检查，随后对原有 10 个候选在专用 `.sourcelab` 干净包完成复核及可见 UI 回归。结合最新独立确认报告，当前 9 个源通过实际 `validate_evidence`；GiriGiriLove 因搜索验证码未处理继续留在 dev。84 个源的最新结论为 9 个 `SEARCH_PLAYABLE`、1 个 `HOME_PLAYABLE_SEARCH_UNAVAILABLE`、72 个 `PLAYBACK_FAILED`、2 个 `INCOMPLETE`。当前状态为 `completed`，不再等待解锁或干净包复核。

10 个被复核源的最新证据均与当前 `extensions/` 的精确字节和版本一致。所有 18 条清单状态仍为 `pending`、`review=null`，没有批准或发布；9 个自动门禁候选仍须维护者审核完整原件和内容。

| 源 key | 最新专用包证据结论 | 需要维护者复核的事项 |
| --- | --- | --- |
| `heyanle.age` | SEARCH_PLAYABLE | 作品与实际播放内容、完整原始证据 |
| `kazumi.7sefun` | SEARCH_PLAYABLE | 作品与实际播放内容、完整原始证据 |
| `kazumi.9ciyuan` | SEARCH_PLAYABLE | 首条结果是《孤独摇滚(上)》，确认作品与内容 |
| `kazumi.anime7` | SEARCH_PLAYABLE | 首条结果是《孤独摇滚(上)》，确认作品与内容 |
| `kazumi.ant` | SEARCH_PLAYABLE | 首条结果是剧场总集篇，确认作品与内容 |
| `kazumi.baimao` | SEARCH_PLAYABLE | 作品与实际播放内容、完整原始证据 |
| `kazumi.gpjda` | SEARCH_PLAYABLE | 作品与实际播放内容、完整原始证据 |
| `kazumi.mxdm` | SEARCH_PLAYABLE | 首次失败历史保留；隔离批、两次独立复测及干净包均通过，复核波动原因 |
| `kazumi.sorani` | SEARCH_PLAYABLE | 保留旧 25s 解析超时，45s 合理预算下两次独立复测通过；源 JS 字节未改 |
| `heyanle.ggl` | HOME_PLAYABLE_SEARCH_UNAVAILABLE | 搜索 VERIFICATION_REQUIRED，当前不可准入，继续留在 dev |

GiriGiriLove 最新 `.sourcelab` 报告首词搜索触发 `VERIFICATION_REQUIRED`（`need web check`），首页与播放 PASS 只供诊断。旧 Debug 报告把四词 EMPTY 描述为“标题未收录”，没有证明该事实；旧证据不能覆盖最新验证码结论，也不能用于当前准入。必须处理验证并重跑完整协议，继续复核搜索 URL、验证页和选择器。

MXdm 首次烟测为 `PLAYBACK_FAILED`；随后隔离批、复测 1、复测 2 及本次干净包四次为 `SEARCH_PLAYABLE`。五次原始报告全部保留，最新证据引用干净包；成功结果没有删除或掩盖首次失败。

Sorani 在首次干净包检查中首页与搜索 PASS，但 25s 播放地址解析预算导致唯一线路 TIMEOUT。源 JS 声明 `PLAY_TIMEOUT=30s`，统一 25s 测试预算先于源自身超时。测试框架增加可配置 `playInfoTimeoutMs=45s`（低于 `JSScope=50s`，同时受总 `playBudgetMs=240s` 约束），没有修改源 JS。此后两次独立 `.sourcelab` 运行完整通过，首帧后进度分别为 3126ms、3145ms，视频均为 1920×1080。旧 25s 失败与两次新原件全部保留；最新引用第二次确认报告，不能把预算冲突当作已确认的源故障。

常规 UI 回归曾发现手机原有 Debug 使用 Room 4，而本分支使用 Room 2；比对 Room identityHash 与签名后恢复了兼容旧 Debug APK，原数据没有删除。专用测试通过 `-PsourceAcceptanceBuild=true` 使用独立 `.sourcelab` 包；ADB 通过 `run-as` 写私有 cache，安装前核对 APK 包名，并显式检查 shell 退出码和 JSON 格式，避免把 `exec-out` 错误文字当 JSON。测试框架失败未计为源失败，空结果和命令文件不作为验收原件归档。

已通过验证：216 个 Android 单测、3 个 Python 设备测试框架回归、33 个源仓库单测，以及专用包 preferences 真机检查。可见 UI 已确认 release 列表与版本显示、dev raw 地址与明确 HTTP404 错误、dev 选择在重启后保留、切回 release 恢复列表；结束环境为 release。UI 证据保存在 Android 项目的 `docs/source-audit/2026-10-09/ui-check.json` 和 `ui/*.png`、`ui/*.xml`，审计摘要记录其索引与 hash。公开 dev 索引尚未部署，HTTP404 是明确显示的预期状态。

原始报告按原目录归档至 `acceptance/evidence/2026-10-09/`，共保留旧 10 份及追加的 10 份有效干净包报告、2 份 Sorani 合理预算复测原件。逐文件验证复制前后 SHA256 相同，JSON 不合并或改写。[device-audit-2026-10-09.json](../acceptance/device-audit-2026-10-09.json) 指向每源最新原件，同时保留逐源历史、MX 五次历史和 Sorani 四次历史。`gateValidated` 仅表示证据验证，不能替代批准。

## 验收协议 source-acceptance-v1

串行验收每个源；可并行准备清单、静态检查和安装，涉及 WebView 验证与播放器的阶段串行，避免线路和渲染 Surface 互相干扰。

1. 确认真机、应用版本、Git 提交、网络和源 SHA256。源兼容性检查先于网络流程；不兼容源先迁移再验收。
2. 首页必须正常返回可见条目；记下首页标签及首项，作为搜索全部正常为空时的候选。
3. 依次搜索 `孤独摇滚`、`孤獨搖滾`、`ぼっち・ざ・ろっく！`、`Bocchi the Rock`。只有正常返回零结果才尝试下一词。第一个有结果的搜索选择第一部；不能因为后续播放失败换关键词或换作品“挑一个能播的”。
4. 四个搜索都正常为空，才回退到首页第一个作品。搜索异常、超时、无组件或验证码属于需修复或人工验证，不能当成“没收录标题”。
5. 打开详情，线路按顺序尝试各自按 `episode.order` 稳定升序排列的首集；order 相同保留源返回顺序，不跳过无效首集挑后续集。失败留证据，直到任一线路渲染出首帧、视频尺寸非零且首帧之后 `currentPosition` 的增量至少 3000 ms。成功后停止测试其它线路；不能把地址解析成功、HTTP 200、播放器 READY 当作播放通过。
6. 导出包含逐词搜索、作品选择、逐线路首帧和进度的证据；人工复核能正确打开作品、实际画面匹配目标、没有未处理的验证或明显错误。

| acceptance | 解释 | 可进入 release |
| --- | --- | --- |
| `SEARCH_PLAYABLE` | 首页 PASS，首个成功搜索的第一部至少一线路可播；源和搜索 verdict 都为 PASS | 证据完整且维护者复核后可 |
| `HOME_PLAYABLE_SEARCH_EMPTY` | 四词全部正常 EMPTY，首页首项可播；搜索及源 verdict 为 SUSPECT，仅说明本次解析返回为空，原因待复核 | 证据完整，且维护者复核搜索 URL、验证页与选择器并确认空结果原因后可 |
| `HOME_PLAYABLE_SEARCH_UNAVAILABLE` | 搜索异常或无搜索组件，首页可播 | 不可；修复搜索或明确调整协议后重新测 |
| `MANUAL_VERIFICATION_REQUIRED` | 验证码、登录或人工验证未完成 | 不可；完成验证后重新执行完整流程 |
| `PLAYBACK_FAILED` / `INCOMPLETE` | 所有线路失败、超时、无首帧、无进度或预算耗尽 | 不可 |

## 人工验证码接力（2026-10-13 增补）

手机验收在同一源、同一关键词和页码，或同一作品、线路及首集遇到可识别的网页/图片验证码时，可以暂停并交给操作者完成。源必须提供兼容的验证参数和验证后重载能力；仅识别到验证码文字、没有验证参数或不能重载的旧源仍记录为未解决，先修复源接口。当前接力范围是搜索请求及播放地址解析；首页或详情验证不能因此被标记为通过。

1. 显示被阻断的源、关键词或线路首集，暂停自动推进，在手机上打开验证界面。操作者完成网页验证或输入图片答案后提交；Cookie、答案、验证 URL 和请求头不进入报告。
2. 每个固定请求最多提交 `maxManualAttempts` 次，默认 3 次且硬上限为 3；每次使用独立 `manualTimeoutMs` 人工截止，默认 600,000 ms。等待时间单列为 `manualWaitMs`，不计首页/搜索/解析/播放器及线路总机器预算；等待本身不构成首帧或播放进度。
3. 提交后重载源验证结果，并重试原关键词原页或原线路原首集。再次出现验证码可在剩余次数内接力；不得更换语言、作品或首集规避验证。报告仍保留一条该关键词/线路的最终逻辑记录，人工尝试另记 `verificationEvents`。
4. 操作者可以跳过当前验证或停止整批；超时、界面不可用、超过次数、请求上下文不匹配及未重试均留下事件，不产生准入证据。未解决的验证不能被首页或另一条线路可播所掩盖。
5. 人工提交只表示答案已交回。验证后的搜索必须真实返回 `RESULTS` 或 `EMPTY`；正常空结果才可按原顺序尝试下一词。播放地址解析返回后，仍必须经过真实播放器的首帧、非零尺寸及至少 3 秒正常进度观察。已退出验证后发生的普通线路失败可以继续下一线路，并保留原失败。

ADB 默认开启接力；`--manual-timeout-seconds 600` 设置每次界面的人手截止，`--max-manual-wait-seconds 1800` 另限整批人工等待总量。主机从该次运行的进度文件识别 `WAITING_USER`，暂停单源及批次活跃截止，并输出等待/恢复提示；人工总量耗尽仍会终止。使用 `--no-manual-verification` 可做无人值守诊断，验证阻断会如实保存。2026-10-13 本轮设备未连接，只进行代码与自动化测试，真实验证码操作须在后续手机运行另留证据。

每个事件绑定 `sourceKey/step/type/attempt`，记录 epoch 毫秒 `requestedAt/respondedAt/waitMs`、`decision/retryOutcome`；搜索同时记录 `keyword/searchPageKey`，与最终 `searchAttempts[].pageKey` 对齐；播放同时记录 `cartoonId/lineIndex/lineId/episodeId`，与固定选择及最终线路首集对齐。`COMPLETED` 只是人工提交；`retryOutcome=SUCCEEDED` 表示原接口真实返回，播放地址返回仍不等于播放通过。同一请求的中间事件必须为再次需要验证，最终事件必须已经离开验证状态。`ATTEMPT_LIMIT` 可作为额外的终止事件保存，不能作为第 4 次人工提交或准入记录。

release gate 兼容未包含事件的旧 v1 报告；对包含事件的报告另查源及请求绑定、顺序、连续重试次数、独立人工截止、时间戳与等待总和、步骤/线路活跃耗时，以及最终真实搜索和播放证据。人工等待不得被加到 `progressMs` 或机器预算中。任何未解决、跳过、取消、过期或不可用事件均阻止该次运行准入；维护者审核和精确源 hash/版本要求继续适用。

新运行按当天日期单独归档。2026-10-09 原始报告和当时的 GiriGiriLove 验证阻断结论保持原样；2026-10-13 的新流程不能补写旧报告、把旧失败改为成功或自动批准清单。

## 清单更新与发布检查

证据是手机导出的原始 JSON，字段遵循 Android `LabRun.toEvidenceJson()`：`schemaVersion=1`、`protocolVersion=source-acceptance-v1`、`generatedAt`、`context`、`config`、`results`。gate 会逐项核对，不只读取一个 PASS 标记。必须包含物理设备 serial/model/API、app package/version/buildType/gitCommit、`repositoryEnvironment=dev`、网络、测试时间以及最终源 hash/版本。

维护者复核后更新对应清单记录：

```json
{
  "key": "example.source",
  "status": "approved",
  "sourceSha256": "最终 JS 文件的 64 位 SHA256",
  "versionCode": 2,
  "evidenceFile": "acceptance/evidence/2026-10-09-device-run.json",
  "review": {
    "reviewer": "实际复核者",
    "reviewedAt": "2026-10-09T10:00:00Z",
    "comment": "复核首页、第一部与线路证据；说明搜索返回为空的复核结论等特殊情况"
  }
}
```

每个 `extensions/` key 必须在清单登记，重复 key、缺失登记和非法元数据都使构建失败。pending/rejected 不进入新产物；approved 但证据不合法使整个构建失败。审核时间必须晚于证据生成时间。实际源字节变化后必须增加相对线上基线的 `versionCode`，最终文件变化也必须重新生成证据。

CI 使用 7 天证据有效期；过期阻止下一次新发布，线上源不会由后台任务自动下架。若某源失效，应在清单标为 rejected 并重新构建其它仍通过的源。第一次启用严格门禁后，所有没有准入证据的旧源会被排除；PR 必须审核完整新旧 key 差异，避免遗漏预期下架。

```sh
uv run python -m unittest discover -s tests -v
uv run ebjer channel --source-dir dev-extensions --to /tmp/easybangumi-dev-index --ref <源提交 SHA>
uv run ebjer release --check-only
uv run ebjer release --to /tmp/easybangumi-release-preview
```

`ebjer parse` 只提供索引格式化兼容工具，不能绕过官方 `release` 准入命令。格式化已改为先验证全部输入，再替换产物；非法元数据、重复 key、危险输出目录、空索引都会返回非零，blocked 源文件也不再复制。

## CI 链路

1. dev PR：标准库单测 + 离线索引构建。PR 新文件尚未进入公开 raw，不做无意义的网络校验。
2. main 受 PR 保护：先提交源，再按该完整源提交 SHA 生成 `channel/dev/index.jsonl` 并作为下一提交加入同一 PR。PR 用 `channel-check` 检查 key/版本/路径/hash 与 SHA 固定；合并后 `parse2dev` 再下载所有 raw 文件核对 SHA256。CI 只有 contents:read，不直接回推 main，不复制源、不写 website。
3. release PR 或 main 的 `extensions/**`、清单、证据、解析器或发布工作流变化：单测 → 严格门禁 → 完整产物。PR 到此结束；main 或显式 dispatch 通过门禁后才签出 website 可写仓库。
4. 将产物复制到 `easybangumiorg/website` 的 `src/public/repository/v2/`，提交并推送 website main，后续由 website 自身部署流程发布站点。源仓库脚本不会直接刷新 CDN；发布后必须验证最终公开索引和字节，再记录新的 baseline。

本次只修改本地文件并验证，不提交、不推送，不触发上述真实发布步骤。

2026-10-14 发布时发现 main 仓库规则要求 PR，直接推送被 GH013 拒绝；已改为源与固定父提交 SHA 索引进入同一 PR。未更改或绕过仓库保护规则。
