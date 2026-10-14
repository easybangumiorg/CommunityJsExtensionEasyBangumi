
import sys
import argparse
from .channel import DEFAULT_REPO, DEV_SOURCE_DIR, ChannelError, generate_channel, check_channel_index
from .parser_v2 import parse_extensions
from .release_gate import build_release


def parse_args():
    parser = argparse.ArgumentParser(
        description="CommunityJS Extension EasyBangumi CLI")
    subparsers = parser.add_subparsers(dest='subcommand', help='可用的子命令')

    # 添加 parse 子命令
    parse_parser = subparsers.add_parser('parse', help='解析扩展信息，并生成库和索引文件')
    parse_parser.add_argument(
        '--from', dest='from_dir', default="./extensions", help='指定要解析的js文件夹路径，默认为当前工作目录')
    parse_parser.add_argument(
        '--to', dest='to_dir', default="./repository/v2", help='指定解析后的输出文件夹路径，默认为当前工作目录')
    parse_parser.set_defaults(func=lambda args: parse_extensions(from_dir=args.from_dir, to_dir=args.to_dir))

    release_parser = subparsers.add_parser('release', help='严格验收门禁并打包官方 release 仓库')
    release_parser.add_argument('--source-dir', default='extensions')
    release_parser.add_argument('--manifest', default='release-manifest.json')
    release_parser.add_argument('--to', dest='to_dir', default='repository/v2')
    release_parser.add_argument('--max-age-days', type=int, default=7, help='真机证据有效天数，默认 7')
    release_parser.add_argument('--check-only', action='store_true', help='仅检查门禁，不生成产物')
    release_parser.set_defaults(func=lambda args: build_release(
        source_dir=args.source_dir, manifest_path=args.manifest, to_dir=args.to_dir,
        check_only=args.check_only, max_age_days=args.max_age_days))

    # 添加 channel 子命令：只生成 jsonl，不复制源文件
    channel_parser = subparsers.add_parser(
        'channel', help='生成 dev 通道索引（只产 jsonl，条目 url 指向仓库原始文件）')
    channel_parser.add_argument(
        '--source-dir', default=f"./{DEV_SOURCE_DIR}", help=f'dev 源目录，默认为 ./{DEV_SOURCE_DIR}')
    channel_parser.add_argument(
        '--source-path', default=None, help='该目录在仓库里的路径，用于拼 url；缺省取目录名')
    channel_parser.add_argument(
        '--to', dest='to_dir', default="./channel/dev", help='索引输出目录，默认为 ./channel/dev')
    channel_parser.add_argument(
        '--repo', default=DEFAULT_REPO, help='owner/repo，用于拼接 raw url')
    channel_parser.add_argument(
        '--ref', default="main", help='源文件所在分支，默认为 main')
    channel_parser.add_argument(
        '--lib-version-range', default="15-15",
        help='客户端支持的源库版本区间，形如 15-15，默认为 15-15；区间外的源不会被收录')
    channel_parser.add_argument(
        '--verify', action='store_true', help='对生成的所有 url 做一次可达性校验')
    channel_parser.set_defaults(func=run_channel)

    check_parser = subparsers.add_parser('channel-check', help='校验 PR 中已提交的 dev 索引，不写回 main')
    check_parser.add_argument('--source-dir', default=DEV_SOURCE_DIR)
    check_parser.add_argument('--index', default='channel/dev/index.jsonl')
    check_parser.add_argument('--repo', default=DEFAULT_REPO)
    check_parser.add_argument('--verify', action='store_true', help='下载 raw 源并核对每个 SHA256')
    check_parser.set_defaults(func=lambda args: check_channel_index(
        source_dir=args.source_dir, index_path=args.index, repo=args.repo,
        verify=args.verify, log=print))

    return parser.parse_args()


def parse_range(value: str) -> tuple[int, int]:
    parts = value.split("-", 1)
    low = int(parts[0])
    high = int(parts[1]) if len(parts) > 1 else low
    if low < 1 or high < low:
        raise ValueError('源库版本范围必须为正数且下界不大于上界')
    return low, high


def run_channel(args) -> int:
    try:
        return generate_channel(
            source_dir=args.source_dir,
            to_dir=args.to_dir,
            repo=args.repo,
            ref=args.ref,
            source_path=args.source_path,
            lib_version_range=parse_range(args.lib_version_range),
            verify=args.verify,
            log=print,
        )
    except (ChannelError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


def main():
    args = parse_args()
    if not hasattr(args, 'func'):
        print("未指定子命令, 请使用 --help 查看可用命令")
        return -1
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
