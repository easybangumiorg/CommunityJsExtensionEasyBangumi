#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then
    printf '%s\n' 'Usage: run-ggl-formal-fixtures.sh <androidRoot> <sourceJs> <fixturesDir>' \
        'Optional environment: RHINO_JAR, JSOUP_JAR, JAVA, JAVAC.' >&2
    exit 2
fi

android_root=$1
source_js=$2
fixtures_dir=$3
tools_dir=$(CDPATH= cd -P "$(dirname "$0")" && pwd)

# Prefer an explicit dependency path; otherwise use one runtime jar from app/libs.
resolve_jar() {
    if [ -n "$1" ]; then
        if [ ! -f "$1" ]; then
            printf 'Dependency does not exist: %s\n' "$1" >&2
            return 1
        fi
        printf '%s\n' "$1"
        return
    fi
    dependency_path=
    for candidate in "$android_root"/app/libs/"$2"-*.jar; do
        [ -f "$candidate" ] || continue
        case "$candidate" in
            *-sources.jar|*-javadoc.jar) continue ;;
        esac
        if [ -n "$dependency_path" ]; then
            printf 'Multiple %s jars in app/libs; set %s explicitly.\n' "$2" "$3" >&2
            return 1
        fi
        dependency_path=$candidate
    done
    if [ -z "$dependency_path" ]; then
        printf 'No %s runtime jar in %s/app/libs; set %s explicitly.\n' "$2" "$android_root" "$3" >&2
        return 1
    fi
    printf '%s\n' "$dependency_path"
}

[ -d "$android_root" ] || { printf 'Android root does not exist: %s\n' "$android_root" >&2; exit 2; }
[ -f "$source_js" ] || { printf 'Source does not exist: %s\n' "$source_js" >&2; exit 2; }
[ -d "$fixtures_dir" ] || { printf 'Fixture directory does not exist: %s\n' "$fixtures_dir" >&2; exit 2; }

rhino_jar=$(resolve_jar "${RHINO_JAR:-}" rhino RHINO_JAR)
jsoup_jar=$(resolve_jar "${JSOUP_JAR:-}" jsoup JSOUP_JAR)
compile_dir=$(mktemp -d "${TMPDIR:-/tmp}/ggl-formal-fixtures.XXXXXX")
trap 'rm -rf "$compile_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"${JAVAC:-javac}" -cp "$rhino_jar" -d "$compile_dir" "$tools_dir/GglFormalRhinoFixtureTest.java"
"${JAVA:-java}" -cp "$compile_dir:$rhino_jar:$jsoup_jar" GglFormalRhinoFixtureTest \
    "$source_js" "$fixtures_dir" "$tools_dir"
