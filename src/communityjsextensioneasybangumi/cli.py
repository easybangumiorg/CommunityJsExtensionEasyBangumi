
import sys
import argparse
from .parser_v2 import parse_extensions


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

    return parser.parse_args()


def main():
    args = parse_args()
    if not hasattr(args, 'func'):
        print("未指定子命令, 请使用 --help 查看可用命令")
        return -1
    return args.func(args)


if __name__ == "__main__":
    main()
