"""dev 通道索引生成器。

通道划分：

* **release** 通道 —— ``release_gate`` 读取准入清单与真机证据后，交给 ``parser_v2`` 打包。
* **dev** 通道 —— 本模块负责：监听 ``dev-extensions/``，只生成一份 ``index.jsonl``，条目 url
  直接指向仓库里的原始文件（不复制、不改名）。等 dev 里的源测试稳定后，由人工把文件复制到
  ``extensions/`` 并更新 ``release-manifest.json``，从而触发严格 release 门禁。

dev 收录策略（release 在相同静态检查之外还要求真机验收）：

1. ``@blocked true`` 的源不收录；
2. ``libVersion`` 不在客户端支持区间内的源不收录（客户端会在加载时报
   ``unsupported source libVersion``，收录了也装不上）；
3. 缺少 ``@libVersion`` 的源不收录（同上，客户端要求该字段存在）。

每一项被跳过的源都会打日志，不会静默消失。

因为 dev 索引里的 url 指向的就是 ``dev-extensions/`` 下的原始文件，所以发布 dev 索引之前
这些文件必须已经在仓库里（流水线由 ``dev-extensions/**`` 的 push 触发，天然满足）。
"""

from __future__ import annotations

import json
import hashlib
import re
import time
import urllib.request
from urllib.parse import quote
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, Sequence

from .parser_v2 import ExtensionMeta, parse_single_extension

RAW_BASE = "https://raw.githubusercontent.com"
DEFAULT_REPO = "easybangumiorg/CommunityJsExtensionEasyBangumi"

#: dev 源目录，与 release 的 extensions/ 并列
DEV_SOURCE_DIR = "dev-extensions"
#: dev 通道索引的输出位置（相对仓库根）
DEV_INDEX_REL_PATH = "channel/dev/index.jsonl"
INDEX_FILE = "index.jsonl"

#: 客户端当前支持的源库版本区间。取值来自 EasyBangumi 的
#: plugin/source/PluginV3.kt（MIN_SUPPORTED_LIB_VERSION..MAX_SUPPORTED_LIB_VERSION），
#: 区间外的源客户端直接拒绝加载。dev 索引过滤；release 门禁严格检查。
SUPPORTED_LIB_VERSION_RANGE = (15, 15)

Logger = Callable[[str], None]


class ChannelError(Exception):
    """源无法进入索引：目录缺失、元数据非法，或同目录出现重复 key。"""


@dataclass(frozen=True)
class ChannelSource:
    """一个待收录的源：头部元数据 + 它在仓库里的位置。"""

    meta: ExtensionMeta
    rel_path: str
    sha256: str | None = None

    @property
    def key(self) -> str:
        return self.meta.key


def read_metadata(path: Path) -> ExtensionMeta:
    """读取单个 .js 的头部元数据。"""
    with path.open(encoding="utf-8") as f:
        lines = f.readlines()
    try:
        return parse_single_extension(lines)
    except AssertionError as e:
        raise ChannelError(str(e)) from e


def exclusion_reason(
    meta: ExtensionMeta,
    lib_version_range: tuple[int, int] = SUPPORTED_LIB_VERSION_RANGE,
) -> Optional[str]:
    """该源不应进入 dev 索引的原因；可收录时返回 None。"""
    if meta.is_blocked:
        return "@blocked 已屏蔽"
    if meta.lib_version is None:
        return "缺少 @libVersion，客户端无法加载"
    low, high = lib_version_range
    if not low <= meta.lib_version <= high:
        return f"libVersion {meta.lib_version} 不在客户端支持范围 {low}..{high}"
    return None


def scan_dir(
    root: str | Path,
    source_path: Optional[str] = None,
    log: Optional[Logger] = None,
) -> list[ChannelSource]:
    """扫描 dev 源目录。

    ``source_path`` 是该目录在仓库里的路径（用于拼 url），缺省取目录名本身。
    """
    root = Path(root)
    if not root.is_dir():
        raise ChannelError(f"源目录不存在: {root}")

    prefix = (source_path or root.name).strip("/")
    files = sorted(p for p in root.rglob("*.js") if p.is_file())
    sources: list[ChannelSource] = []
    seen: dict[str, str] = {}

    for path in files:
        rel = path.relative_to(root).as_posix()
        try:
            meta = read_metadata(path)
        except ChannelError as e:
            raise ChannelError(f"{rel}: {e}") from e
        except Exception as e:  # 例如 @versionCode 不是数字
            raise ChannelError(f"{rel}: {e}") from e

        if meta.key in seen:
            raise ChannelError(f"重复的 @key `{meta.key}`：{seen[meta.key]} 与 {rel}")
        seen[meta.key] = rel
        sources.append(ChannelSource(
            meta=meta, rel_path=f"{prefix}/{rel}",
            sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        ))

    if log:
        log(f"{root} -> 发现 {len(sources)} 个源")
    return sorted(sources, key=lambda source: source.key)


def build_entry(
    source: ChannelSource,
    repo: str = DEFAULT_REPO,
    ref: str = "main",
    base_url: str = RAW_BASE,
) -> dict:
    """把一条源转成索引条目。

    字段说明（客户端 RepositoryEntry 的定义见 EasyBangumi 的
    plugin/source/repository/RepositoryEntry.kt）：

    * ``version``      —— 客户端**真正读取**的版本字段，release 索引里没有，这里补上；
    * ``versionName``  —— 只做与 release 索引同构，客户端会忽略；
    * ``libVersion``   —— 客户端当前忽略，为将来「下载前过滤不兼容源」留钩子；
    * ``describe``     —— 会在客户端界面渲染，用于标示这是未并入正式仓库的预发布源。
    """
    meta = source.meta
    return {
        "key": meta.key,
        "url": f"{base_url.rstrip('/')}/{repo}/{quote(ref, safe='')}/{quote(source.rel_path, safe='/')}",
        "label": meta.label,
        "versionCode": meta.versionCode,
        "versionName": meta.versionName,
        "version": meta.versionName,
        "libVersion": meta.lib_version,
        "sha256": source.sha256,
        "cover": meta.cover,
        "describe": f"dev 通道预发布版本，位于 {source.rel_path}，尚未并入正式源仓库",
    }


def write_index(path: Path, entries: Sequence[dict]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = "".join(json.dumps(e, ensure_ascii=False) + "\n" for e in entries)
    path.write_text(text, encoding="utf-8")
    return len(entries)


def verify_urls(
    entries: Sequence[dict],
    timeout: int = 15,
    attempts: int = 2,
    log: Optional[Logger] = None,
) -> list[str]:
    """对所有条目 url 做 HEAD 校验，返回不可达项的描述。

    新推上去的文件可能还在 CDN 回源，所以默认重试一次。
    """
    bad: list[str] = []
    for entry in entries:
        url = entry["url"]
        last_error = ""
        for attempt in range(attempts):
            try:
                request = urllib.request.Request(
                    url, method="HEAD", headers={"User-Agent": "ebjer-channel-check"}
                )
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    if response.status == 200:
                        last_error = ""
                        break
                    last_error = f"HTTP {response.status}"
            except Exception as e:
                last_error = f"{type(e).__name__}: {e}"
            if attempt + 1 < attempts:
                time.sleep(3)
        if last_error:
            bad.append(f"{entry['key']} -> {last_error}: {url}")
    if log:
        log(f"url 校验：{len(entries) - len(bad)}/{len(entries)} 可达")
    return bad


def generate_channel(
    source_dir: str | Path = DEV_SOURCE_DIR,
    to_dir: str | Path = "channel/dev",
    repo: str = DEFAULT_REPO,
    ref: str = "main",
    base_url: str = RAW_BASE,
    source_path: Optional[str] = None,
    lib_version_range: tuple[int, int] = SUPPORTED_LIB_VERSION_RANGE,
    verify: bool = False,
    log: Optional[Logger] = None,
) -> int:
    """生成 dev 通道索引，返回进程退出码。"""
    log = log or (lambda _msg: None)

    sources = scan_dir(source_dir, source_path=source_path, log=log)

    kept: list[ChannelSource] = []
    for source in sources:
        reason = exclusion_reason(source.meta, lib_version_range)
        if reason:
            log(f"skip: {source.key} —— {reason}")
        else:
            kept.append(source)
    log(f"收录 {len(kept)} 个源，跳过 {len(sources) - len(kept)} 个")

    entries = [build_entry(s, repo=repo, ref=ref, base_url=base_url) for s in kept]
    if not entries:
        log("warning: dev 源目录里没有可发布的源，索引为空")
    count = write_index(Path(to_dir) / INDEX_FILE, entries)
    log(f"写入 {count} 条到 {Path(to_dir) / INDEX_FILE}")

    if verify:
        bad = verify_urls(entries, log=log)
        if bad:
            for item in bad:
                log(f"error: url 不可达 {item}")
            return 1

    return 0


def check_channel_index(
    source_dir: str | Path = DEV_SOURCE_DIR,
    index_path: str | Path = DEV_INDEX_REL_PATH,
    *,
    repo: str = DEFAULT_REPO,
    verify: bool = False,
    log: Optional[Logger] = None,
) -> int:
    """Validate a PR-committed index without writing protected main.

    All URLs share one immutable source commit; current metadata and bytes must
    match every row. Online verification checks the actual remote bytes as well.
    """
    log = log or (lambda _message: None)
    try:
        rows = [json.loads(line) for line in Path(index_path).read_text(encoding="utf-8").splitlines() if line.strip()]
        if not rows or not all(isinstance(row, dict) for row in rows):
            raise ChannelError("dev 索引必须包含非空条目")
        prefix = f"{RAW_BASE}/{repo}/"
        refs = set()
        for row in rows:
            url = row.get("url", "")
            if not isinstance(url, str) or not url.startswith(prefix):
                raise ChannelError("dev URL 必须属于当前仓库 GitHub raw")
            ref = url[len(prefix):].split("/", 1)[0]
            if not re.fullmatch(r"[0-9a-f]{40}", ref):
                raise ChannelError("dev URL 必须固定到完整提交 SHA")
            refs.add(ref)
        if len(refs) != 1:
            raise ChannelError("dev 索引必须使用同一个源提交")
        ref = refs.pop()
        expected = [build_entry(source, repo=repo, ref=ref) for source in scan_dir(source_dir)
                    if exclusion_reason(source.meta) is None]
        if rows != expected:
            raise ChannelError("dev 索引与当前源的 key/版本/路径/hash 不一致，请重新生成并提交")
        if verify:
            for row in rows:
                request = urllib.request.Request(row["url"], headers={"User-Agent": "ebjer-channel-check"})
                with urllib.request.urlopen(request, timeout=20) as response:
                    if response.status != 200 or hashlib.sha256(response.read()).hexdigest() != row["sha256"]:
                        raise ChannelError(f"dev 远端字节与索引 hash 不一致: {row['key']}")
        log(f"dev 索引校验通过：{len(rows)} 条，sourceRef={ref}，remoteBytes={verify}")
        return 0
    except (ChannelError, OSError, ValueError, TypeError, KeyError) as error:
        log(f"error: {error}")
        return 1
