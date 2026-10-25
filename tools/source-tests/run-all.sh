#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <easybangumi-android-root>" >&2
    echo "Optional dependency: JSOUP_JAR" >&2
    exit 2
fi
android_root=$1
tools_dir=$(cd "$(dirname "$0")" && pwd)
repo_root=$(cd "$tools_dir/../.." && pwd)
cd "$repo_root"
export RHINO_JAR=$android_root/app/libs/rhino-1.7.15.jar
if [[ -z ${JSOUP_JAR:-} ]]; then
    for candidate in "$android_root"/app/libs/jsoup-1.16.1.jar \
        "${GRADLE_USER_HOME:-$HOME/.gradle}"/caches/modules-2/files-2.1/org.jsoup/jsoup/1.16.1/*/jsoup-1.16.1.jar; do
        if [[ -f "$candidate" ]]; then
            export JSOUP_JAR=$candidate
            break
        fi
    done
fi
if [[ ! -f "$RHINO_JAR" || ! -f ${JSOUP_JAR:-} ]]; then
    echo "Missing Rhino 1.7.15 or Jsoup 1.16.1. Set RHINO_JAR and JSOUP_JAR to existing runtime jars." >&2
    exit 2
fi
"$tools_dir/ggl-beta/run-ggl-beta-fixtures.sh" "$android_root" dev-extensions/girigirilove-beta.js tests/fixtures/ggl-beta
"$tools_dir/ggl-formal/run-ggl-formal-fixtures.sh" "$android_root" dev-extensions/girigirilove-v2.js tests/fixtures/ggl-formal
"$tools_dir/mifun/run-fixtures.sh" "$android_root" dev-extensions/kazumi-mifun.js tests/fixtures/mifun
"$tools_dir/milimili/run-milimili-fixtures.sh" "$android_root" dev-extensions/milimili.js tests/fixtures/milimili
python3 "$tools_dir/cycani/verify_cycani.py" --android-root "$android_root" --source dev-extensions/kazumi-ciyuancheng.js --fixtures tests/fixtures/cycani

python3 "$tools_dir/lmm/verify_lmm.py" --android-root "$android_root" --source dev-extensions/kazumi-lmm.js --fixtures tests/fixtures/lmm --jsoup-jar "$JSOUP_JAR"
