#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 3 ]]; then
    echo "Usage: $0 <android-repo> <source.js> <fixture-dir>" >&2
    exit 2
fi
android_repo=$1
source_js=$2
fixture_dir=$3
test_tools_dir=$(cd "$(dirname "$0")" && pwd)
class_dir=$(mktemp -d "${TMPDIR:-/tmp}/milimili-rhino.XXXXXX")
trap 'rm -rf "$class_dir"' EXIT
rhino_jar="$android_repo/app/libs/rhino-1.7.15.jar"
javac -cp "$rhino_jar" -d "$class_dir" "$test_tools_dir/MiliMiliRhinoFixtureTest.java"
java -cp "$rhino_jar:$class_dir" MiliMiliRhinoFixtureTest "$source_js" "$fixture_dir" "$test_tools_dir"
