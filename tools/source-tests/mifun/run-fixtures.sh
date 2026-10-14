#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 3 ]]; then
    echo "Usage: $0 <android-root> <source.js> <fixtures-dir>" >&2
    echo "Optional dependencies: RHINO_JAR=/path/rhino.jar JSOUP_JAR=/path/jsoup.jar" >&2
    exit 2
fi
android_root=$1
source_js=$2
fixtures_dir=$3
tools_dir=$(cd "$(dirname "$0")" && pwd)
class_dir=$(mktemp -d "${TMPDIR:-/tmp}/mifun-fixtures.XXXXXX")
trap 'rm -rf "$class_dir"' EXIT
rhino_jar=${RHINO_JAR:-}
jsoup_jar=${JSOUP_JAR:-}
if [[ -z "$rhino_jar" ]]; then
    for candidate in "$android_root"/app/libs/rhino*.jar; do
        if [[ -f "$candidate" ]]; then rhino_jar=$candidate; break; fi
    done
fi
if [[ -z "$jsoup_jar" ]]; then
    for candidate in "$android_root"/app/libs/jsoup*.jar; do
        if [[ -f "$candidate" ]]; then jsoup_jar=$candidate; break; fi
    done
fi
if [[ ! -f "$rhino_jar" || ! -f "$jsoup_jar" ]]; then
    echo "Missing Rhino or Jsoup jar. Put the existing jars in <android-root>/app/libs or set RHINO_JAR and JSOUP_JAR." >&2
    exit 2
fi
javac -cp "$rhino_jar:$jsoup_jar" -d "$class_dir" "$tools_dir/MiFunRhinoFixtureTest.java"
java -cp "$rhino_jar:$jsoup_jar:$class_dir" MiFunRhinoFixtureTest "$source_js" "$fixtures_dir" "$tools_dir"
