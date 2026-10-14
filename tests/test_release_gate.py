"""Release admission: real playback evidence, stale bytes and safe packaging."""

import copy
import hashlib
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from communityjsextensioneasybangumi.parser_v2 import parse_extensions
from communityjsextensioneasybangumi.release_gate import (
    AdmissionError, KEYWORDS, build_release, check_release,
)


class ReleaseGateTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.source_dir = self.root / "extensions"
        self.source_dir.mkdir()
        self.source = self.source_dir / "source.js"
        self.source.write_text("// @key test.a\n// @label A\n// @versionName 1.0\n// @versionCode 1\n// @libVersion 15\n\nfunction test() {}\n", encoding="utf-8")
        self.sha256 = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.now = datetime.now(timezone.utc)
        self.generated = (self.now - timedelta(seconds=5)).isoformat()
        self.manifest = {
            "schemaVersion": 1,
            "sources": [{"key": "test.a", "status": "approved", "sourceSha256": self.sha256,
                         "versionCode": 1, "evidenceFile": "acceptance/evidence/run.json",
                         "review": {"reviewer": "maintainer", "reviewedAt": self.now.isoformat(), "comment": "Reviewed device evidence"}}],
        }
        self.evidence = {
            "schemaVersion": 1, "protocolVersion": "source-acceptance-v1", "generatedAt": self.generated,
            "context": {"device": {"model": "houji", "serial": "device-serial", "apiLevel": 35, "isPhysicalDevice": True},
                        "app": {"packageName": "test.app", "versionName": "6.1.3", "versionCode": 115, "buildType": "debug", "gitCommit": "abc123"},
                        "repositoryEnvironment": "dev", "network": "wifi"},
            "config": {"keywords": list(KEYWORDS), "minimumProgressMs": 3000},
            "results": [{"key": "test.a", "versionName": "1.0", "versionCode": 1, "sourceSha256": self.sha256,
                         "playBudgetExhausted": False, "minimumProgressMs": 3000,
                         "totalLineCount": 1,
                         "startedAt": (self.now - timedelta(seconds=40)).isoformat(), "finishedAt": (self.now - timedelta(seconds=10)).isoformat(),
                         "verdict": "PASS", "acceptance": "SEARCH_PLAYABLE",
                         "steps": [{"step": name, "verdict": "PASS"} for name in ("HOME", "SEARCH", "PLAY")],
                         "searchAttempts": [{"keyword": KEYWORDS[0], "status": "RESULTS", "resultCount": 2}],
                         "selection": {"route": "SEARCH_RESULT", "keyword": KEYWORDS[0], "cartoonId": "cartoon-1", "title": "孤独摇滚", "resultIndex": 0},
                         "lineAttempts": [{"lineIndex": 0, "lineId": "line-1", "episodeId": "episode-1", "status": "PASS", "firstFrame": True, "progressMs": 3100, "videoWidth": 1920, "videoHeight": 1080}]}],
        }
        self.result = self.evidence["results"][0]
        self.baseline = {"schemaVersion": 1, "sources": []}
        self.save()

    def tearDown(self):
        self.temp.cleanup()

    def save(self):
        (self.root / "release-manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")
        (self.root / "release-baseline.json").write_text(json.dumps(self.baseline), encoding="utf-8")
        evidence_path = self.root / "acceptance/evidence/run.json"
        evidence_path.parent.mkdir(parents=True, exist_ok=True)
        evidence_path.write_text(json.dumps(self.evidence), encoding="utf-8")

    def check(self):
        self.save()
        return check_release(self.source_dir, self.root / "release-manifest.json", now=self.now, log=lambda _: None)

    def assert_rejected(self, message):
        with self.assertRaisesRegex(AdmissionError, message):
            self.check()

    def add_verification(self, step="SEARCH", **changes):
        self.evidence["config"].update(maxManualAttempts=3, manualTimeoutMs=600_000)
        for name, elapsed in (("HOME", 1000), ("SEARCH", 2000), ("PLAY", 6000)):
            next(row for row in self.result["steps"] if row["step"] == name)["elapsedMs"] = elapsed
        self.result["searchAttempts"][0].update(pageKey=1, elapsedMs=2000)
        self.result["lineAttempts"][0]["elapsedMs"] = 6000
        start = round(datetime.fromisoformat(self.result["startedAt"]).timestamp() * 1000)
        event = {"sourceKey": "test.a", "step": step, "type": "WEB_VIEW", "attempt": 1,
                 "requestedAt": start + 5000, "respondedAt": start + 15000, "waitMs": 10000,
                 "decision": "COMPLETED", "retryOutcome": "SUCCEEDED"}
        if step == "SEARCH":
            event.update(keyword=KEYWORDS[0], searchPageKey=1)
        else:
            event.update(cartoonId="cartoon-1", lineIndex=0, lineId="line-1", episodeId="episode-1")
        event.update(changes)
        self.result["verificationEvents"] = [event]
        self.result["manualWaitMs"] = event["waitMs"]
        return event

    def test_approved_source_passes_and_build_uses_original_bytes(self):
        self.assertEqual(self.check(), [self.source])
        out = self.root / "repository/v2"
        self.assertEqual(build_release(self.source_dir, self.root / "release-manifest.json", out, log=lambda _: None), 0)
        self.assertEqual((out / "test.a.js").read_bytes(), self.source.read_bytes())
        entry = json.loads((out / "index.jsonl").read_text())
        self.assertEqual(set(entry), {"key", "url", "label", "versionCode", "versionName", "cover"})

    def test_home_fallback_requires_all_normal_empty_searches(self):
        self.result["acceptance"] = "HOME_PLAYABLE_SEARCH_EMPTY"
        self.result["verdict"] = "SUSPECT"
        self.result["steps"][1]["verdict"] = "SUSPECT"
        self.result["searchAttempts"] = [{"keyword": keyword, "status": "EMPTY", "resultCount": 0} for keyword in KEYWORDS]
        self.result["selection"] = {"route": "HOME_FALLBACK", "cartoonId": "cartoon-1", "title": "首页首项", "resultIndex": 0, "homePageLabel": "首页"}
        self.assertEqual(self.check(), [self.source])
        self.result["searchAttempts"][0]["status"] = "ERROR"
        self.assert_rejected("completed normally")

    def test_each_line_can_be_tried_until_one_plays(self):
        self.result["totalLineCount"] = 2
        failed = copy.deepcopy(self.result["lineAttempts"][0])
        failed.update(status="NO_FIRST_FRAME", firstFrame=False, progressMs=0)
        self.result["lineAttempts"][0]["lineIndex"] = 1
        self.result["lineAttempts"].insert(0, failed)
        self.assertEqual(self.check(), [self.source])

    def test_v1_evidence_without_optional_total_line_count_is_supported(self):
        del self.result["totalLineCount"]
        self.assertEqual(self.check(), [self.source])

    def test_v1_without_verification_fields_remains_supported(self):
        self.assertNotIn("verificationEvents", self.result)
        self.assertEqual(self.check(), [self.source])
        self.result.update(verificationEvents=[], manualWaitMs=0)
        self.assertEqual(self.check(), [self.source])

    def test_completed_search_and_play_handoffs_require_actual_results(self):
        for step in ("SEARCH", "PLAY"):
            with self.subTest(step=step):
                self.add_verification(step)
                self.assertEqual(self.check(), [self.source])
        self.result["lineAttempts"][0]["firstFrame"] = False
        self.assert_rejected("decoded video frame")
        self.result["lineAttempts"][0]["firstFrame"] = True
        self.result["searchAttempts"][0]["status"] = "VERIFICATION_REQUIRED"
        self.assert_rejected("Final search must contain results")

    def test_verification_can_repeat_only_until_the_same_request_succeeds(self):
        event = self.add_verification()
        first = dict(event, requestedAt=event["requestedAt"] - 4000,
                     respondedAt=event["requestedAt"] - 1000, waitMs=3000,
                     retryOutcome="VERIFICATION_REQUIRED")
        event["attempt"] = 2
        self.result["verificationEvents"].insert(0, first)
        self.result["manualWaitMs"] += 3000
        self.assertEqual(self.check(), [self.source])
        first["retryOutcome"] = "SUCCEEDED"
        self.assert_rejected("Only another verification challenge")

    def test_verified_empty_search_keeps_the_normal_alias_and_home_fallback_rules(self):
        self.add_verification()
        self.result["acceptance"], self.result["verdict"] = "HOME_PLAYABLE_SEARCH_EMPTY", "SUSPECT"
        self.result["steps"][1]["verdict"] = "SUSPECT"
        self.result["searchAttempts"] = [{"keyword": keyword, "status": "EMPTY", "resultCount": 0,
                                          "pageKey": 1, "elapsedMs": 500} for keyword in KEYWORDS]
        self.result["selection"] = {"route": "HOME_FALLBACK", "cartoonId": "cartoon-1", "title": "首页首项", "resultIndex": 0, "homePageLabel": "首页"}
        self.assertEqual(self.check(), [self.source])
        self.result["searchAttempts"][0]["status"] = "ERROR"
        self.assert_rejected("completed normally")

    def test_verification_events_follow_request_order_without_overlapping_waits(self):
        search = self.add_verification()
        play = dict(search, step="PLAY", requestedAt=search["respondedAt"] + 1000,
                    respondedAt=search["respondedAt"] + 2000, waitMs=1000,
                    keyword=None, searchPageKey=None, cartoonId="cartoon-1",
                    lineIndex=0, lineId="line-1", episodeId="episode-1")
        self.result["verificationEvents"].append(play)
        self.result["manualWaitMs"] += 1000
        self.assertEqual(self.check(), [self.source])
        play["requestedAt"] = search["respondedAt"] - 1
        self.assert_rejected("Invalid or overlapping")
        play["requestedAt"] = search["respondedAt"] + 1000
        search["requestedAt"], play["requestedAt"] = play["requestedAt"], search["requestedAt"]
        search["respondedAt"], play["respondedAt"] = play["respondedAt"], search["respondedAt"]
        search["waitMs"], play["waitMs"] = play["waitMs"], search["waitMs"]
        self.result["verificationEvents"].reverse()
        self.assert_rejected("protocol order")

    def test_verification_submission_skip_cancel_and_timeout_do_not_grant_pass(self):
        for decision in ("SKIPPED", "CANCELLED", "EXPIRED", "UNAVAILABLE", "ATTEMPT_LIMIT", "REQUEST_MISMATCH"):
            with self.subTest(decision=decision):
                self.add_verification(decision=decision)
                self.assert_rejected("Unresolved, skipped or cancelled")
        for outcome in ("NOT_RETRIED", "VERIFICATION_REQUIRED", "ERROR", "TIMEOUT"):
            with self.subTest(outcome=outcome):
                self.add_verification(retryOutcome=outcome)
                self.assert_rejected("original request|unresolved|real completed search")

    def test_verification_context_cannot_be_replaced_or_cross_sources(self):
        for changes, message in (({"sourceKey": "test.other"}, "source does not match"),
                                 ({"keyword": KEYWORDS[1]}, "one logical search"),
                                 ({"searchPageKey": 2}, "same search page"),
                                 ({"cartoonId": "other-cartoon"}, "playback context"),
                                 ({"step": "HOME"}, "Only search and play-info"),
                                 ({"type": "ANYTHING"}, "Unknown verification")):
            with self.subTest(changes=changes):
                self.add_verification(**changes)
                self.assert_rejected(message)
        for changes, message in (({"cartoonId": "other-cartoon"}, "selected cartoon"),
                                 ({"lineIndex": 1}, "line index"),
                                 ({"lineId": "line-2"}, "same line and first episode"),
                                 ({"episodeId": "episode-2"}, "same line and first episode"),
                                 ({"keyword": KEYWORDS[0]}, "search context")):
            with self.subTest(changes=changes):
                self.add_verification("PLAY", **changes)
                self.assert_rejected(message)

    def test_retry_limits_are_finite_and_cannot_skip_attempt_numbers(self):
        for attempt in (0, 2, 4, True):
            with self.subTest(attempt=attempt):
                self.add_verification(attempt=attempt)
                self.assert_rejected("consecutive and bounded")
        for maximum in (0, 4, True, None):
            with self.subTest(maximum=maximum):
                self.add_verification()
                self.evidence["config"]["maxManualAttempts"] = maximum
                self.assert_rejected("between 1 and 3")

    def test_human_wait_must_match_timestamps_deadline_and_total(self):
        event = self.add_verification()
        event["waitMs"] = 5000
        self.assert_rejected("does not match its timestamps")
        self.add_verification()
        self.result["manualWaitMs"] = 20000
        self.assert_rejected("sum of verification waits")
        self.add_verification()
        self.evidence["config"]["manualTimeoutMs"] = 9999
        self.assert_rejected("human deadline")
        event = self.add_verification()
        event["respondedAt"] = round(self.now.timestamp() * 1000)
        self.assert_rejected("Invalid or overlapping")

    def test_human_wait_is_not_machine_budget_or_player_progress(self):
        self.add_verification("PLAY")
        self.result["lineAttempts"][0]["elapsedMs"] = 100
        self.assert_rejected("Human waiting cannot substitute")
        self.add_verification("PLAY")
        self.result["steps"][2]["elapsedMs"] = 25000
        self.assert_rejected("Active step time and manual wait")
        self.add_verification("PLAY")
        self.result["lineAttempts"][0]["elapsedMs"] = 8000
        self.assert_rejected("Attempt time exceeds")

    def test_unresolved_line_cannot_hide_behind_another_playable_line(self):
        failed = dict(self.result["lineAttempts"][0], status="VERIFICATION_REQUIRED", firstFrame=False, progressMs=0)
        self.result["lineAttempts"][0]["lineIndex"] = 1
        self.result["lineAttempts"].insert(0, failed)
        self.result["totalLineCount"] = 2
        self.assert_rejected("Unresolved verification")

    def test_resolved_verification_preserves_failed_line_before_next_real_success(self):
        for outcome in ("ERROR", "TIMEOUT", "SUCCEEDED"):
            with self.subTest(outcome=outcome):
                self.result["lineAttempts"] = self.result["lineAttempts"][-1:]
                self.result["lineAttempts"][0].update(lineIndex=0, lineId="line-1")
                self.add_verification("PLAY", retryOutcome=outcome)
                failed = dict(self.result["lineAttempts"][0], status=outcome if outcome != "SUCCEEDED" else "NO_FIRST_FRAME",
                              firstFrame=False, progressMs=0, elapsedMs=1000)
                self.result["lineAttempts"][0].update(lineIndex=1, lineId="line-2", elapsedMs=5000)
                self.result["lineAttempts"].insert(0, failed)
                self.result["totalLineCount"] = 2
                self.assertEqual(self.check(), [self.source])

    def test_unbound_or_malformed_verification_time_is_rejected(self):
        self.result["manualWaitMs"] = 1000
        self.assert_rejected("requires verification event")
        for field, value in (("requestedAt", True), ("respondedAt", "later"), ("waitMs", -1)):
            with self.subTest(field=field):
                self.add_verification(**{field: value})
                self.assert_rejected("nonnegative integer milliseconds")

    def test_unlisted_legacy_artifacts_also_require_a_version_bump(self):
        self.baseline["legacyArtifacts"] = [{"key": "test.a", "sourceSha256": "0" * 64, "versionCode": 1}]
        self.assert_rejected("versionCode higher")

    def test_pending_history_is_not_auto_approved_and_output_is_preserved(self):
        self.manifest["sources"][0]["status"] = "pending"
        self.save()
        out = self.root / "repository/v2"
        out.mkdir(parents=True)
        (out / "index.jsonl").write_text("old repository", encoding="utf-8")
        self.assertEqual(build_release(self.source_dir, self.root / "release-manifest.json", out, log=lambda _: None), 1)
        self.assertEqual((out / "index.jsonl").read_text(), "old repository")

    def test_release_output_cannot_replace_its_input_sources(self):
        content = self.source.read_bytes()
        self.assertEqual(build_release(self.source_dir, self.root / "release-manifest.json", self.source_dir, log=lambda _: None), 1)
        self.assertEqual(self.source.read_bytes(), content)

    def test_budget_exhaustion_and_incomplete_steps_are_not_approved(self):
        self.result["playBudgetExhausted"] = True
        self.assert_rejected("budget exhaustion")
        self.result["playBudgetExhausted"] = False
        self.result["steps"].append(copy.deepcopy(self.result["steps"][0]))
        self.assert_rejected("Exactly one")

    def test_source_change_invalidates_manifest(self):
        self.source.write_bytes(self.source.read_bytes() + b"// changed\n")
        self.assert_rejected("Manifest source hash")

    def test_changed_bytes_require_a_higher_version_code(self):
        self.baseline["sources"] = [{"key": "test.a", "sourceSha256": "0" * 64, "versionCode": 1}]
        self.assert_rejected("versionCode higher")
        self.baseline["sources"][0]["versionCode"] = 0
        self.assertEqual(self.check(), [self.source])

    def test_evidence_hash_and_version_must_match(self):
        self.result["sourceSha256"] = "0" * 64
        self.assert_rejected("Evidence source hash")
        self.result["sourceSha256"] = self.sha256
        self.result["versionCode"] = 2
        self.assert_rejected("Evidence source version")

    def test_head_reachability_or_player_ready_cannot_replace_video_progress(self):
        for field, value, message in (("firstFrame", False, "decoded video frame"), ("progressMs", 0, "advance"), ("videoWidth", 0, "dimensions")):
            with self.subTest(field=field):
                line = self.result["lineAttempts"][0]
                original = line[field]
                line[field] = value
                self.assert_rejected(message)
                line[field] = original

    def test_emulator_and_missing_device_serial_are_rejected(self):
        self.evidence["context"]["device"]["isPhysicalDevice"] = False
        self.assert_rejected("physical Android device")
        self.evidence["context"]["device"]["isPhysicalDevice"] = True
        self.evidence["context"]["device"]["serial"] = ""
        self.assert_rejected("serial and model")

    def test_evidence_expires_after_seven_days(self):
        self.evidence["generatedAt"] = (self.now - timedelta(days=8)).isoformat()
        self.assert_rejected("stale")

    def test_search_error_and_manual_verification_cannot_be_promoted(self):
        self.result["acceptance"] = "HOME_PLAYABLE_SEARCH_UNAVAILABLE"
        self.assert_rejected("automatic release acceptance")
        self.result["acceptance"] = "MANUAL_VERIFICATION_REQUIRED"
        self.assert_rejected("automatic release acceptance")

    def test_first_result_and_keyword_order_are_required(self):
        self.result["selection"]["resultIndex"] = 1
        self.assert_rejected("first result")
        self.result["selection"]["resultIndex"] = 0
        self.result["searchAttempts"][0]["keyword"] = KEYWORDS[1]
        self.assert_rejected("protocol order")

    def test_evidence_path_cannot_escape_repository(self):
        self.manifest["sources"][0]["evidenceFile"] = "../run.json"
        self.assert_rejected("inside the repository")

    def test_new_source_cannot_bypass_manifest(self):
        (self.source_dir / "new.js").write_text(self.source.read_text().replace("test.a", "test.new"), encoding="utf-8")
        self.assert_rejected("register new sources as pending")


class SafeParserTest(unittest.TestCase):
    def test_error_duplicate_or_unsafe_target_preserves_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "extensions"
            source.mkdir()
            out = root / "repository"
            out.mkdir()
            old = out / "index.jsonl"
            old.write_text("old", encoding="utf-8")
            (source / "bad.js").write_text("// @key test.a\n", encoding="utf-8")
            self.assertEqual(parse_extensions(source, out), 1)
            self.assertEqual(old.read_text(), "old")
            self.assertEqual(parse_extensions(source, source), 1)

    def test_blocked_sources_are_not_distributed_even_by_direct_url(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "extensions"
            source.mkdir()
            body = "// @key test.a\n// @label A\n// @versionName 1\n// @versionCode 1\n// @libVersion 15\n"
            (source / "ok.js").write_text(body, encoding="utf-8")
            (source / "blocked.js").write_text(body.replace("test.a", "test.blocked") + "// @blocked true\n", encoding="utf-8")
            out = root / "repository"
            self.assertEqual(parse_extensions(source, out), 0)
            self.assertEqual(sorted(p.name for p in out.iterdir()), ["index.jsonl", "test.a.js"])


if __name__ == "__main__":
    unittest.main()
