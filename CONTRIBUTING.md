# 贡献指南

本仓库提供纯纯看番JS插件源的社区分发

## 如何开发

[插件示例](https://easybangumi.org/docs/js-extension-example)

[API参考](https://easybangumi.org/docs/js-extension-utils)

## 源提交与晋级

1. 新增或更新源放在 `dev-extensions/`，保持 `@key` 稳定；内容发生变化时增加 `@versionCode`，完善 `@label/@versionName/@libVersion`。当前客户端仅支持 `libVersion=15`。
2. 运行 `uv run python -m unittest discover -s tests -v`。先提交源代码，再以该完整提交 SHA 运行 `uv run ebjer channel --source-dir dev-extensions --to channel/dev --ref <源提交 SHA>`，把索引作为下一提交加入同一 PR。运行 `uv run ebjer channel-check` 核对当前字节；源提交推到远端后可加 `--verify` 检查 raw 字节。main 受 PR 保护，索引随 PR 合并上线，CI 不用 bot 直接回推 main。
3. 在 Android 真机 dev 环境安装最终文件，用「源体检」按 `source-acceptance-v1` 执行首页、固定关键词搜索、首条结果或首页首项详情、逐线路真实播放器验收，导出 JSON 证据。没有首帧和至少 3 秒实际播放进度不能晋级。
4. 把通过源的原字节复制到 `extensions/`；证据放入 `acceptance/evidence/`。在 `release-manifest.json` 登记 key、最终文件 SHA256、versionCode、证据相对路径及维护者复核，再把该源状态改为 `approved`。其它源保留 `pending` 或明确标为 `rejected`。
5. 运行 `uv run ebjer release --check-only`；通过后运行 `uv run ebjer release --to /tmp/easybangumi-release-preview` 审核完整产物与源数量。新构建仅包含 `approved` 源，因此未通过的历史源会从新发布索引及文件目录移除；在 PR 中列清新增、更新、下架 key。
6. 合并至 main 后 CI 再次验证并发布。只有线上索引和文件校验完成后才更新 `release-baseline.json`；这个快照记录实际发布字节，不代表真机通过。

完整的判定规则、当前候选清单及 CI 链路见[仓库环境与发布流程](docs/repository-environments.md)。

## 开源许可

本仓库的开源许可分为两个部分：仓库核心代码的许可和社区贡献插件的许可。

### 仓库核心代码

本仓库本身，包括用于解析和索引插件的解析器，均基于 **MIT 许可** 开源。你可以在仓库的 `LICENSE` 文件中找到完整的许可文本。

### 社区贡献的插件

所有提交到本仓库的插件，其所有权归原作者所有。

*   **默认许可：** 如果插件作者没有在插件目录中特别指定开源许可，则该插件默认以 **MIT 许可** 开源。
*   **自定义许可：** 插件作者可以选择使用其他的开源许可。为此，作者需要在其插件的文件夹（建议以插件 ID 命名）中包含一个 `LICENSE` 文件，用以声明所选择的开源许可。

我们鼓励插件开发者使用开放的、经过认可的开源许可，以促进代码的分享和重用。
