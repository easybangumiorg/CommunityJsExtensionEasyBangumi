import os
import re
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from glob import glob
from typing import Optional


DEFAULT_COVER = "https://easybangumi.org/icons/logo-025x.webp"
REPO_URL = "https://easybangumi.org/repository/v2"
WORKDIR = Path.cwd()
REPOSITORY_FOLDER = WORKDIR / 'repository/v2'
INDEX_FILE = 'index.jsonl'


@dataclass
class ExtensionMeta:
    key: str
    label: str
    versionCode: int
    versionName: str
    url: Optional[str] = None
    cover: Optional[str] = None

    def __post_init__(self):
        if not self.url:
            self.url = f"{REPO_URL}/{self.name}"
            
    @property
    def name(self) -> str:
        return f"{self.key}.js"

    def to_dict(self):
        return {
            'key': self.key,
            'url': self.url,
            'label': self.label,
            'versionCode': self.versionCode,
            'versionName': self.versionName,
            'cover': self.cover,
        }

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> 'ExtensionMeta':
        assert data.get('key'), "Key is required"
        return cls(
            key=data['key'],
            label=data.get('label', data['key']),
            versionCode=int(data.get('versionCode', '0')),
            versionName=data.get('versionName', '0.0'),
            cover=data.get('cover', DEFAULT_COVER),
        )


def parse_single_extension(lines: list[str]) -> ExtensionMeta:
    meta: dict[str, str] = {}
    pattern = re.compile(r'^//\s*@(\w+)\s+(.*)$')
    for line in lines:
        match = pattern.match(line)
        if not match:
            break
        key, value = match.group(1), match.group(2).strip()
        meta[key] = value
    return ExtensionMeta.from_dict(meta)


def parse_extensions(from_dir: Optional[str] | Path, to_dir: Optional[str] | Path) -> int:
    # 处理输入输出目录
    if from_dir is None:
        from_dir = os.getcwd()
    if to_dir is None:
        to_dir = REPOSITORY_FOLDER
    from_dir = Path(from_dir).absolute()
    to_dir = Path(to_dir).absolute()
    index_file = to_dir / INDEX_FILE

    if not os.path.exists(from_dir):
        print(f"Source folder does not exist: {from_dir}")
        return -1
    if not os.path.exists(to_dir):
        os.makedirs(to_dir)
    else:
        # 删了重新创建
        shutil.rmtree(to_dir)
        to_dir.mkdir(parents=True, exist_ok=True)

    # 查找所有 JS 文件
    files = glob(str(from_dir / '**/*.js'), recursive=True)
    print(f"Found {len(files)} files in {from_dir}")

    # 解析所有扩展
    extensions = []
    for file_path in files:
        relative_file_path = os.path.relpath(file_path, from_dir)
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        try:
            extension = parse_single_extension(lines)
            extensions.append(extension)
            shutil.copyfile(file_path, to_dir / extension.name)
            print(f"Processed {relative_file_path}")
        except AssertionError as e:
            print(f"Error parsing {relative_file_path}: {e}")
            continue
        except Exception:
            import traceback
            print(f"Error parsing {relative_file_path}:")
            traceback.print_exc()
            continue

    if os.path.exists(index_file):
        os.remove(index_file)
    with open(index_file, 'w', encoding='utf-8') as f:
        for ext in extensions:
            f.write(json.dumps(ext.to_dict(), ensure_ascii=False) + '\n')
    return 0
