#!/usr/bin/env python3
"""Compile and exercise LMM with the Android repository's Rhino and real Jsoup."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--android-root', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--fixtures', type=Path, default=root / 'sanitized-fixtures')
    parser.add_argument('--jsoup-jar', type=Path, help='Optional explicit Jsoup jar; otherwise discover local Gradle cache')
    parser.add_argument('--node', default='node')
    parser.add_argument('--java', default='java')
    parser.add_argument('--javac', default='javac')
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    fixtures = args.fixtures.resolve(strict=True)
    rhino = (args.android_root / 'app/libs/rhino-1.7.15.jar').resolve(strict=True)
    if args.jsoup_jar:
        jsoup = args.jsoup_jar.resolve(strict=True)
    else:
        candidates = sorted((Path.home() / '.gradle/caches/modules-2/files-2.1/org.jsoup/jsoup').glob('*/*/jsoup-*.jar'))
        candidates = [p for p in candidates if not p.name.endswith(('-sources.jar', '-javadoc.jar'))]
        if not candidates:
            parser.error('No cached Jsoup jar; provide --jsoup-jar')
        jsoup = candidates[-1].resolve()
    for command in (args.node, args.java, args.javac):
        if not shutil.which(command):
            parser.error('Required command not found: ' + command)
    subprocess.run([args.node, '--check', str(source)], check=True)
    with tempfile.TemporaryDirectory(prefix='lmm-rhino-') as classes:
        subprocess.run([args.javac, '-d', classes, '-cp', str(rhino), str(root / 'LmmFixtures.java')], check=True)
        subprocess.run([args.java, '-cp', os.pathsep.join((classes, str(rhino), str(jsoup))), 'LmmFixtures', str(source), str(fixtures), str(root / 'test_lmm.js')], check=True)


if __name__ == '__main__':
    main()
