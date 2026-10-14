"""release 索引契约与 dev 通道索引的回归测试（仅依赖标准库）。

运行方式（在仓库根目录）：

    python -m unittest discover -s tests -v

release 部分锁的是"输出契约"：字段集合、blocked 过滤、url 形态都不能变，因为它的产物
直接对外分发。dev 部分锁的是收录策略、索引字段与错误处理。
"""

import contextlib
import io
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from communityjsextensioneasybangumi.channel import (  # noqa: E402
    DEFAULT_REPO,
    DEV_SOURCE_DIR,
    RAW_BASE,
    ChannelError,
    generate_channel,
)
from communityjsextensioneasybangumi.parser_v2 import REPO_URL, parse_extensions  # noqa: E402


def source_file(body: str, *, lib_version: str = "// @libVersion 15", blocked: str = "") -> str:
    """拼一个最小可解析的源文件内容。"""
    lines = [body]
    if lib_version:
        lines.append(lib_version)
    if blocked:
        lines.append(f"// @blocked {blocked}")
    lines += ["", "// 元数据之后就不再是注释了", "function PageComponent_getMainTabs() { return null; }"]
    return "\n".join(lines)


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def read_index(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


class TempWorkspaceTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.release_dir = self.root / "extensions"
        self.dev_dir = self.root / DEV_SOURCE_DIR

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def seed_release(self) -> None:
        write(self.release_dir / "a.js", source_file("// @key test.a\n// @label 源A\n// @versionName 1.0\n// @versionCode 100"))
        write(self.release_dir / "b.js", source_file("// @key test.b\n// @label 源B\n// @versionName 1.0\n// @versionCode 100", blocked="true"))
        write(self.release_dir / "c.js", source_file("// @key test.c\n// @label 源C\n// @versionName 2.0\n// @versionCode 200", lib_version=""))

    def seed_dev(self) -> None:
        write(self.dev_dir / "a.js", source_file("// @key dev.a\n// @label dev源A\n// @versionName 0.1\n// @versionCode 1"))
        write(self.dev_dir / "b.js", source_file("// @key dev.b\n// @label dev源B\n// @versionName 0.2\n// @versionCode 2", blocked="true"))
        write(self.dev_dir / "nested" / "c.js", source_file("// @key dev.c\n// @label dev源C\n// @versionName 0.3\n// @versionCode 3"))

    def generate(self, **kwargs) -> int:
        return generate_channel(
            source_dir=kwargs.pop("source_dir", self.dev_dir),
            to_dir=kwargs.pop("to_dir", self.root / "channel" / "dev"),
            log=kwargs.pop("log", lambda _m: None),
            **kwargs,
        )


class ReleaseContractTest(TempWorkspaceTest):
    """release 通道的输出契约（改动前已验证与线上产物逐字节一致）。"""

    def test_fields_urls_and_blocked_filtering(self) -> None:
        self.seed_release()
        out = self.root / "repository"
        with contextlib.redirect_stdout(io.StringIO()):
            code = parse_extensions(self.release_dir, out)

        self.assertEqual(code, 0)
        index = read_index(out / "index.jsonl")

        self.assertEqual([e["key"] for e in index], ["test.a", "test.c"], "@blocked 的源必须被过滤")
        for entry in index:
            self.assertEqual(
                set(entry),
                {"key", "url", "label", "versionCode", "versionName", "cover"},
                "release 索引的字段集合已冻结，不可增删",
            )
            self.assertEqual(entry["url"], f"{REPO_URL}/{entry['key']}.js")
            self.assertTrue((out / f"{entry['key']}.js").is_file(), "release 需要复制并改名为 <key>.js")

    def test_blocked_false_is_not_treated_as_blocked(self) -> None:
        write(
            self.release_dir / "a.js",
            source_file("// @key test.a\n// @label 源A\n// @versionName 1.0\n// @versionCode 100", blocked="false"),
        )
        out = self.root / "repository"
        with contextlib.redirect_stdout(io.StringIO()):
            parse_extensions(self.release_dir, out)

        self.assertEqual([e["key"] for e in read_index(out / "index.jsonl")], ["test.a"])


class DevChannelTest(TempWorkspaceTest):
    def test_entries_shape_sorting_and_url(self) -> None:
        self.seed_dev()
        self.assertEqual(self.generate(), 0)
        entries = read_index(self.root / "channel" / "dev" / "index.jsonl")

        self.assertEqual([e["key"] for e in entries], ["dev.a", "dev.c"], "按 key 稳定排序，且过滤 @blocked")
        entry = entries[0]
        self.assertEqual(entry["url"], f"{RAW_BASE}/{DEFAULT_REPO}/main/{DEV_SOURCE_DIR}/a.js")
        self.assertEqual(entry["version"], "0.1", "补上客户端真正读取的 version 字段")
        self.assertEqual(entry["versionName"], "0.1", "保留与 release 同构的 versionName")
        self.assertEqual(entry["versionCode"], 1)
        self.assertEqual(entry["libVersion"], 15)
        self.assertEqual(entry["sha256"], hashlib.sha256((self.dev_dir / "a.js").read_bytes()).hexdigest())
        self.assertIn("dev 通道预发布版本", entry["describe"])

    def test_nested_dir_keeps_relative_path(self) -> None:
        self.seed_dev()
        self.generate()
        entries = {e["key"]: e for e in read_index(self.root / "channel" / "dev" / "index.jsonl")}
        self.assertTrue(entries["dev.c"]["url"].endswith(f"/{DEV_SOURCE_DIR}/nested/c.js"))

    def test_source_path_override(self) -> None:
        self.seed_dev()
        self.generate(source_path="preview/sources")
        entries = read_index(self.root / "channel" / "dev" / "index.jsonl")
        self.assertIn(f"/main/preview/sources/a.js", entries[0]["url"])

    def test_missing_source_dir_is_an_error(self) -> None:
        with self.assertRaises(ChannelError) as ctx:
            self.generate()
        self.assertIn("源目录不存在", str(ctx.exception))

    def test_empty_source_dir_writes_empty_index(self) -> None:
        self.dev_dir.mkdir(parents=True)
        write(self.dev_dir / ".gitkeep", "# 占位\n")
        self.assertEqual(self.generate(), 0)
        self.assertEqual(read_index(self.root / "channel" / "dev" / "index.jsonl"), [])

    def test_duplicate_key_is_rejected(self) -> None:
        write(self.dev_dir / "a.js", source_file("// @key dev.a\n// @label A\n// @versionName 1.0\n// @versionCode 1"))
        write(self.dev_dir / "a2.js", source_file("// @key dev.a\n// @label A2\n// @versionName 1.0\n// @versionCode 2"))
        with self.assertRaises(ChannelError) as ctx:
            self.generate()
        self.assertIn("重复的 @key", str(ctx.exception))

    def test_unparsable_source_is_rejected_not_skipped(self) -> None:
        write(self.dev_dir / "bad.js", "// 作者：某人\n// @key dev.bad\n")
        with self.assertRaises(ChannelError) as ctx:
            self.generate()
        self.assertIn("bad.js", str(ctx.exception))

    def test_non_numeric_version_code_is_rejected(self) -> None:
        write(self.dev_dir / "a.js", source_file("// @key dev.a\n// @label A\n// @versionName 1.0\n// @versionCode abc"))
        with self.assertRaises(ChannelError) as ctx:
            self.generate()
        self.assertIn("a.js", str(ctx.exception))

    def test_missing_lib_version_is_excluded(self) -> None:
        write(self.dev_dir / "a.js", source_file("// @key dev.a\n// @label A\n// @versionName 1.0\n// @versionCode 1", lib_version=""))
        logs: list[str] = []
        self.assertEqual(self.generate(log=lambda m: logs.append(m)), 0)
        self.assertEqual(read_index(self.root / "channel" / "dev" / "index.jsonl"), [])
        self.assertTrue(any("缺少 @libVersion" in m for m in logs))

    def test_unsupported_lib_version_is_excluded(self) -> None:
        write(self.dev_dir / "old.js", source_file("// @key dev.old\n// @label 老源\n// @versionName 1.0\n// @versionCode 1", lib_version="// @libVersion 11"))
        write(self.dev_dir / "new.js", source_file("// @key dev.new\n// @label 新源\n// @versionName 1.0\n// @versionCode 1", lib_version="// @libVersion 15"))
        self.assertEqual(self.generate(), 0)
        keys = [e["key"] for e in read_index(self.root / "channel" / "dev" / "index.jsonl")]
        self.assertEqual(keys, ["dev.new"], "libVersion 11 的源应被跳过，libVersion 15 的保留")

    def test_blocked_source_is_excluded(self) -> None:
        write(self.dev_dir / "b.js", source_file("// @key dev.b\n// @label B\n// @versionName 1.0\n// @versionCode 1", blocked="true"))
        self.assertEqual(self.generate(), 0)
        self.assertEqual(read_index(self.root / "channel" / "dev" / "index.jsonl"), [])


if __name__ == "__main__":
    unittest.main()
