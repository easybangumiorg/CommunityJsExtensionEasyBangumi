#!/usr/bin/env python3
"""Run portable offline Cycani fixture and repository-Rhino checks."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    script_root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--android-root', type=Path, required=True, help='Android repository containing app/libs/rhino-1.7.15.jar')
    parser.add_argument('--source', type=Path, required=True, help='Cycani adapter JS path')
    parser.add_argument('--fixtures', type=Path, default=script_root / 'sanitized-fixtures', help='Sanitized fixture JSON directory')
    parser.add_argument('--node', default='node')
    parser.add_argument('--java', default='java')
    parser.add_argument('--javac', default='javac')
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    fixtures = args.fixtures.resolve(strict=True)
    jar = (args.android_root / 'app/libs/rhino-1.7.15.jar').resolve(strict=True)
    for command in (args.node, args.java, args.javac):
        if shutil.which(command) is None:
            parser.error('Required command not found: ' + command)
    subprocess.run([args.node, '--check', str(source)], check=True)
    subprocess.run([args.node, str(script_root / 'test_cycani.js'), str(source), str(fixtures)], check=True)
    with tempfile.TemporaryDirectory(prefix='cycani-rhino-') as classes:
        subprocess.run([args.javac, '-d', classes, '-cp', str(jar), str(script_root / 'CompileCycani.java')], check=True)
        subprocess.run([args.java, '-cp', os.pathsep.join((classes, str(jar))), 'CompileCycani', str(source)], check=True)


if __name__ == '__main__':
    main()
