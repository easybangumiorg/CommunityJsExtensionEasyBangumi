"""Build the official release repository only from reviewed device evidence."""

from __future__ import annotations

import hashlib
import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from .channel import ChannelError, exclusion_reason, scan_dir
from .parser_v2 import parse_extensions

PROTOCOL_VERSION = "source-acceptance-v1"
KEYWORDS = ("孤独摇滚", "孤獨搖滾", "ぼっち・ざ・ろっく！", "Bocchi the Rock")
MINIMUM_PROGRESS_MS = 3000
ALLOWED_ACCEPTANCE = {"SEARCH_PLAYABLE", "HOME_PLAYABLE_SEARCH_EMPTY"}


class AdmissionError(ValueError):
    """A source lacks sufficient, current and matching acceptance evidence."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AdmissionError(message)


def timestamp(value: object, field: str) -> datetime:
    try:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        require(result.tzinfo is not None, f"{field} requires a timezone")
        return result.astimezone(timezone.utc)
    except (ValueError, TypeError) as error:
        raise AdmissionError(f"Invalid {field}: {value}") from error


def read_json(path: Path) -> dict:
    try:
        result = json.loads(path.read_text(encoding="utf-8"))
        require(isinstance(result, dict), f"{path} must contain an object")
        return result
    except (OSError, json.JSONDecodeError) as error:
        raise AdmissionError(f"Cannot read {path}: {error}") from error


def checked_evidence_path(root: Path, value: object) -> Path:
    require(isinstance(value, str) and bool(value), "evidenceFile is required")
    relative = Path(value)
    require(not relative.is_absolute(), "evidenceFile must be repository relative")
    path = (root / relative).resolve()
    require(root in path.parents, "evidenceFile must stay inside the repository")
    return path


def nonnegative_ms(value: object, field: str) -> int:
    require(type(value) is int and 0 <= value <= 2**63 - 1, f"{field} must be nonnegative integer milliseconds")
    return value


def validate_verification_events(result: dict, config: dict, started_at: datetime, finished_at: datetime) -> None:
    """Validate the handoff independently of final search/player success flags.

    Older v1 reports omit events. New reports retain one logical search/line row
    and attach bounded verification retries to that exact request context.
    """
    events = result.get("verificationEvents", [])
    require(isinstance(events, list), "verificationEvents must be a list")
    manual_wait = nonnegative_ms(result.get("manualWaitMs", 0), "manualWaitMs")
    if not events:
        require(manual_wait == 0, "Manual wait requires verification event evidence")
        return
    max_attempts = config.get("maxManualAttempts")
    require(type(max_attempts) is int and 1 <= max_attempts <= 3, "maxManualAttempts must be between 1 and 3")
    deadline = nonnegative_ms(config.get("manualTimeoutMs"), "manualTimeoutMs")
    require(deadline > 0, "Manual verification requires a separate positive deadline")
    start_ms, finish_ms = (round(time.timestamp() * 1000) for time in (started_at, finished_at))
    wall_ms = finish_ms - start_ms
    searches = result["searchAttempts"]
    lines = result["lineAttempts"]
    selection = result["selection"]
    groups: dict[tuple, list[dict]] = {}
    previous_response, previous_order, total_wait = start_ms, (-1, -1), 0
    for event in events:
        require(isinstance(event, dict), "Verification event must be an object")
        require(event.get("sourceKey") == result["key"], "Verification event source does not match the result")
        require(event.get("type") in {"WEB_VIEW", "IMAGE_CAPTCHA"}, "Unknown verification event type")
        require(event.get("decision") == "COMPLETED", "Unresolved, skipped or cancelled verification cannot be approved")
        requested = nonnegative_ms(event.get("requestedAt"), "verification requestedAt")
        responded = nonnegative_ms(event.get("respondedAt"), "verification respondedAt")
        wait = nonnegative_ms(event.get("waitMs"), "verification waitMs")
        require(previous_response <= requested <= responded <= finish_ms, "Invalid or overlapping verification timestamps")
        # Wall and monotonic clocks can differ by a few milliseconds. An entire
        # manual wait must still be accounted for; seconds cannot disappear.
        require(abs(responded - requested - wait) <= 1000, "Verification wait does not match its timestamps")
        require(wait <= deadline and responded - requested <= deadline + 1000, "Verification exceeded the human deadline")
        require(event.get("retryOutcome") in {"SUCCEEDED", "VERIFICATION_REQUIRED", "ERROR", "TIMEOUT"}, "Verification must retry the original request")
        if event.get("step") == "SEARCH":
            matches = [(index, row) for index, row in enumerate(searches) if row.get("keyword") == event.get("keyword")]
            require(len(matches) == 1, "Verification keyword must match one logical search attempt")
            index, row = matches[0]
            require(type(event.get("searchPageKey")) is int and type(row.get("pageKey")) is int and
                    event["searchPageKey"] == row["pageKey"], "Verification must retry the same search page")
            require(all(event.get(field) is None for field in ("cartoonId", "lineIndex", "lineId", "episodeId")), "Search verification cannot carry a playback context")
            group, order = ("SEARCH", index), (0, index)
        else:
            require(event.get("step") == "PLAY", "Only search and play-info verification is supported")
            index = event.get("lineIndex")
            require(type(index) is int and 0 <= index < len(lines), "Verification line index must match an attempted line")
            row = lines[index]
            require(event.get("cartoonId") == selection.get("cartoonId"), "Verification must belong to the selected cartoon")
            require(bool(event.get("lineId")) and event["lineId"] == row.get("lineId") and
                    bool(event.get("episodeId")) and event["episodeId"] == row.get("episodeId"), "Verification must retry the same line and first episode")
            require(event.get("keyword") is None and event.get("searchPageKey") is None, "Playback verification cannot carry a search context")
            group, order = ("PLAY", index), (1, index)
        require(order >= previous_order, "Verification events must follow the search and line protocol order")
        retries = groups.setdefault(group, [])
        require(type(event.get("attempt")) is int and event["attempt"] == len(retries) + 1 and event["attempt"] <= max_attempts, "Verification retries must be consecutive and bounded")
        retries.append(event)
        previous_response, previous_order = responded, order
        total_wait += wait
    require(manual_wait == total_wait, "manualWaitMs must equal the sum of verification waits")
    require(manual_wait <= wall_ms + 1000, "Manual wait cannot exceed the source run duration")
    for (step, index), retries in groups.items():
        require(all(event["retryOutcome"] == "VERIFICATION_REQUIRED" for event in retries[:-1]), "Only another verification challenge permits a further manual retry")
        outcome = retries[-1]["retryOutcome"]
        require(outcome != "VERIFICATION_REQUIRED", "Final verification retry remains unresolved")
        row = searches[index] if step == "SEARCH" else lines[index]
        if step == "SEARCH":
            require(outcome == "SUCCEEDED" and row.get("status") in {"EMPTY", "RESULTS"}, "Submitted verification requires a real completed search")
        elif outcome != "SUCCEEDED":
            require(row.get("status") == outcome, "Verification retry outcome must match the actual line failure")
        else:
            require(row.get("status") not in {"VERIFICATION_REQUIRED", "EMPTY_LINE"}, "Submitted verification requires a real play-info retry")
    require(all(row.get("status") != "VERIFICATION_REQUIRED" for row in searches + lines), "Unresolved verification in any attempt cannot be approved")
    steps = {row["step"]: row for row in result["steps"]}
    active_ms = sum(nonnegative_ms(row.get("elapsedMs"), "step elapsedMs") for row in steps.values())
    require(active_ms + manual_wait <= wall_ms + 1000, "Active step time and manual wait exceed the source run duration")
    for name, rows in (("SEARCH", searches), ("PLAY", lines)):
        elapsed = [nonnegative_ms(row.get("elapsedMs"), f"{name} attempt elapsedMs") for row in rows]
        require(sum(elapsed) <= steps[name]["elapsedMs"] + 1000, "Attempt time exceeds its active step time")
    for row in lines:
        progress = nonnegative_ms(row.get("progressMs", 0), "playback progressMs")
        require(progress <= row["elapsedMs"] + 100, "Human waiting cannot substitute for active playback progress")


def validate_evidence(
    evidence: dict,
    key: str,
    sha256: str,
    version_code: int,
    version_name: str,
    now: datetime,
    max_age_days: int,
) -> dict:
    require(evidence.get("schemaVersion") == 1, "Unsupported evidence schemaVersion")
    require(evidence.get("protocolVersion") == PROTOCOL_VERSION, "Wrong acceptance protocol")
    generated_at = timestamp(evidence.get("generatedAt"), "generatedAt")
    require(now - timedelta(days=max_age_days) <= generated_at <= now + timedelta(minutes=5), "Evidence is stale or dated in the future")
    context = evidence.get("context", {})
    device = context.get("device", {})
    app = context.get("app", {})
    require(device.get("isPhysicalDevice") is True, "Acceptance requires a physical Android device")
    require(bool(device.get("serial")) and bool(device.get("model")), "Device serial and model are required")
    require(isinstance(device.get("apiLevel"), int) and device["apiLevel"] >= 23, "Device API level is required")
    for name in ("packageName", "versionName", "buildType", "gitCommit"):
        require(bool(app.get(name)), f"App {name} is required")
    require(isinstance(app.get("versionCode"), int) and app["versionCode"] > 0, "App versionCode is required")
    require(context.get("repositoryEnvironment") == "dev", "Validate candidates in the dev environment")
    require(bool(context.get("network")), "Record the device network used for acceptance")
    config = evidence.get("config", {})
    require(config.get("keywords") == list(KEYWORDS), "Acceptance keyword sequence does not match the protocol")
    require(config.get("minimumProgressMs", 0) >= MINIMUM_PROGRESS_MS, "Minimum playback observation is 3000 ms")
    results = [result for result in evidence.get("results", []) if result.get("key") == key]
    require(len(results) == 1, f"Evidence must contain exactly one result for {key}")
    result = results[0]
    require(result.get("playBudgetExhausted") is False, "Playback budget exhaustion cannot be approved")
    require(result.get("minimumProgressMs") == config.get("minimumProgressMs"), "Result observation threshold must match the run configuration")
    require(result.get("sourceSha256") == sha256, "Evidence source hash does not match the source being packaged")
    require(result.get("versionCode") == version_code and result.get("versionName") == version_name, "Evidence source version does not match")
    started_at = timestamp(result.get("startedAt"), "startedAt")
    finished_at = timestamp(result.get("finishedAt"), "finishedAt")
    require(now - timedelta(days=max_age_days) <= started_at <= finished_at <= generated_at, "Invalid or stale run timestamps")
    require(result.get("acceptance") in ALLOWED_ACCEPTANCE, "Source does not meet automatic release acceptance")
    expected_verdict = "PASS" if result["acceptance"] == "SEARCH_PLAYABLE" else "SUSPECT"
    require(result.get("verdict") == expected_verdict, "Source verdict does not match its acceptance route")
    step_rows = result.get("steps", [])
    steps = {step.get("step"): step for step in step_rows}
    require(len(step_rows) == 3 and set(steps) == {"HOME", "SEARCH", "PLAY"}, "Exactly one home, search and playback step is required")
    require(all(steps.get(name, {}).get("verdict") == "PASS" for name in ("HOME", "PLAY")), "Home and playback checks must pass")
    require(steps.get("SEARCH", {}).get("verdict") == expected_verdict, "Search verdict does not match its acceptance route")
    selection = result.get("selection") or {}
    require(selection.get("resultIndex") == 0 and bool(selection.get("cartoonId")) and bool(selection.get("title")), "Use the first result or first home item and record its identity")
    attempts = result.get("searchAttempts", [])
    require(bool(attempts), "Search attempt evidence is required")
    require(len(attempts) <= len(KEYWORDS), "Too many search attempts")
    require([item.get("keyword") for item in attempts] == list(KEYWORDS[:len(attempts)]), "Search aliases must be attempted in protocol order")
    if result["acceptance"] == "SEARCH_PLAYABLE":
        require(selection.get("route") == "SEARCH_RESULT", "Search acceptance requires a search selection")
        require(all(item.get("status") == "EMPTY" and item.get("resultCount") == 0 for item in attempts[:-1]), "Only an empty search allows trying the next alias")
        require(attempts[-1].get("status") == "RESULTS" and attempts[-1].get("resultCount", 0) > 0, "Final search must contain results")
        require(selection.get("keyword") == attempts[-1].get("keyword"), "Selected result must belong to the first successful search")
    else:
        require(selection.get("route") == "HOME_FALLBACK" and bool(selection.get("homePageLabel")), "Home fallback must record its home page")
        require(len(attempts) == len(KEYWORDS), "Try all search aliases before home fallback")
        require(all(item.get("status") == "EMPTY" and item.get("resultCount") == 0 for item in attempts), "Home fallback is only releasable when all searches completed normally with zero results")
    lines = result.get("lineAttempts", [])
    require(bool(lines), "Playback line evidence is required")
    if "totalLineCount" in result:
        require(isinstance(result["totalLineCount"], int) and result["totalLineCount"] >= len(lines), "Invalid actual total line count")
    require([item.get("lineIndex") for item in lines] == list(range(len(lines))), "Try playback lines in order")
    require(all(line.get("status") != "VERIFICATION_REQUIRED" for line in lines), "Unresolved verification in any line cannot be approved")
    passed = [line for line in lines if line.get("status") == "PASS"]
    require(len(passed) == 1 and lines[-1] == passed[0], "Stop after the first successful playback line")
    playback = passed[0]
    require(playback.get("firstFrame") is True, "A decoded video frame must be rendered")
    require(playback.get("progressMs", 0) >= config["minimumProgressMs"], "The real player position must advance by the configured observation threshold (at least 3000 ms)")
    require(playback.get("videoWidth", 0) > 0 and playback.get("videoHeight", 0) > 0, "Video dimensions must be nonzero")
    require(bool(playback.get("episodeId")) and bool(playback.get("lineId")), "Record the successful line and episode")
    validate_verification_events(result, config, started_at, finished_at)
    return result


def check_release(
    source_dir: str | Path,
    manifest_path: str | Path,
    *,
    max_age_days: int = 7,
    now: datetime | None = None,
    log: Callable[[str], None] = print,
) -> list[Path]:
    """Return approved source paths; pending and rejected sources are excluded."""
    require(max_age_days > 0, "max_age_days must be positive")
    manifest_path = Path(manifest_path).resolve()
    root = manifest_path.parent
    source_dir = Path(source_dir).resolve()
    require(root in source_dir.parents, "Source directory must be inside the manifest repository")
    sources = scan_dir(source_dir)
    source_map = {source.key: source for source in sources}
    paths = {source.key: source_dir / Path(source.rel_path).relative_to(source_dir.name) for source in sources}
    manifest = read_json(manifest_path)
    require(manifest.get("schemaVersion") == 1, "Unsupported release manifest schemaVersion")
    records = manifest.get("sources")
    require(isinstance(records, list), "Manifest sources must be a list")
    records_by_key = {record.get("key"): record for record in records}
    require(len(records_by_key) == len(records), "Duplicate manifest source key")
    require(set(records_by_key) == set(source_map), "Manifest and extensions keys differ; register new sources as pending first")
    baseline = read_json(root / "release-baseline.json")
    require(baseline.get("schemaVersion") == 1, "Unsupported release baseline schemaVersion")
    baseline_rows = baseline.get("sources", []) + baseline.get("legacyArtifacts", [])
    published = {row.get("key"): row for row in baseline_rows}
    require(len(published) == len(baseline_rows), "Duplicate release baseline key")
    accepted = []
    now = now or datetime.now(timezone.utc)
    for key in sorted(source_map):
        source = source_map[key]
        record = records_by_key[key]
        status = record.get("status")
        require(status in {"pending", "approved", "rejected"}, f"{key}: invalid admission status")
        if status != "approved":
            log(f"exclude: {key} ({status})")
            continue
        try:
            require(exclusion_reason(source.meta) is None, "Blocked or unsupported source cannot enter release")
            path = paths[key]
            sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
            previous = published.get(key)
            if previous and previous.get("sourceSha256") != sha256:
                require(source.meta.versionCode > previous.get("versionCode", 0), "Changed source bytes require a versionCode higher than the published baseline")
            require(record.get("sourceSha256") == sha256, "Manifest source hash does not match")
            require(record.get("versionCode") == source.meta.versionCode, "Manifest source version does not match")
            review = record.get("review") or {}
            require(bool(review.get("reviewer")) and bool(review.get("comment")), "An identified maintainer review and comment are required")
            reviewed_at = timestamp(review.get("reviewedAt"), "reviewedAt")
            require(reviewed_at <= now + timedelta(minutes=5), "Review date is in the future")
            evidence = read_json(checked_evidence_path(root, record.get("evidenceFile")))
            validate_evidence(evidence, key, sha256, source.meta.versionCode, source.meta.versionName, now, max_age_days)
            require(reviewed_at >= timestamp(evidence["generatedAt"], "generatedAt"), "Maintainer review must follow the evidence run")
            accepted.append(path)
            log(f"approved: {key} sha256={sha256}")
        except (AdmissionError, KeyError, TypeError) as error:
            raise AdmissionError(f"{key}: {error}") from error
    require(bool(accepted), "No approved sources; publication is blocked and the online repository must be preserved")
    return accepted


def build_release(
    source_dir: str | Path = "extensions",
    manifest_path: str | Path = "release-manifest.json",
    to_dir: str | Path = "repository/v2",
    *,
    check_only: bool = False,
    max_age_days: int = 7,
    log: Callable[[str], None] = print,
) -> int:
    """Check admission first, then format only the accepted source bytes."""
    try:
        target = Path(to_dir).resolve()
        original_sources = Path(source_dir).resolve()
        repository_root = Path(manifest_path).resolve().parent
        require(not (target == original_sources or target in original_sources.parents or original_sources in target.parents), "Source and output directories must not overlap")
        require(not (target == repository_root or target in repository_root.parents), "Output directory must not replace the repository")
        accepted = check_release(source_dir, manifest_path, max_age_days=max_age_days, log=log)
        if check_only:
            log(f"Release admission passed for {len(accepted)} sources (no output written)")
            return 0
        with tempfile.TemporaryDirectory(prefix="ebjer-approved-") as temp:
            selected = Path(temp) / "extensions"
            selected.mkdir()
            approved_hashes = {record["sourceSha256"] for record in read_json(Path(manifest_path))["sources"] if record.get("status") == "approved"}
            for index, path in enumerate(accepted):
                content = path.read_bytes()
                # Keep the admission decision bound to the exact copied bytes.
                require(hashlib.sha256(content).hexdigest() in approved_hashes, "Source changed after admission; rerun acceptance")
                (selected / f"{index}.js").write_bytes(content)
            return parse_extensions(selected, to_dir)
    except (AdmissionError, ChannelError, OSError, ValueError, TypeError) as error:
        log(f"error: {error}")
        return 1
