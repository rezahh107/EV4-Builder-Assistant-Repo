#!/usr/bin/env python3
"""Regression harness for the immutable official PR Inspector integration."""

from __future__ import annotations

import argparse
import copy
import inspect
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

EXPECTED_PROTOCOL = "v1.10.0"


def load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError(f"{path} must contain a JSON object")
    return value


def run_json(command: list[str]) -> dict[str, Any]:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise AssertionError(
            "command failed:\n"
            + " ".join(command)
            + "\nstdout:\n"
            + result.stdout
            + "\nstderr:\n"
            + result.stderr
        )
    value = json.loads(result.stdout)
    if not isinstance(value, dict):
        raise AssertionError("adapter output must be a JSON object")
    return value


def require_failure(command: list[str]) -> None:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode == 0:
        raise AssertionError("official verifier unexpectedly accepted tampering")
    if "PR_INSPECTOR_OFFICIAL_VERIFIER_FAILED" not in (
        result.stdout + result.stderr
    ):
        raise AssertionError("official verifier failure marker was absent")


def finding(case: dict[str, Any], finding_id: str = "PRF-001") -> dict[str, Any]:
    return {
        "finding_id": finding_id,
        "severity": case["severity"],
        "evidence_label": case["evidence_label"],
        "blocking": case["blocking"],
        "file_location": "src/synthetic.py:1",
        "symbol": "synthetic",
        "relevant_code": "synthetic",
        "issue": "Synthetic projection-divergence regression.",
        "failure_scenario": "The official projection must classify this case.",
        "recommended_fix": "Use the official projection result.",
        "recommended_test": "Run immutable official projection validation.",
        "evidence_refs": ["EVD-002"],
        "rule_ids": ["PRR-CORRECTNESS-001"],
    }


def handoff(finding_id: str) -> dict[str, Any]:
    return {
        "intended_recipient": "implementer_model",
        "repair_scope": "same_pull_request",
        "affected_findings": [
            {
                "finding_id": finding_id,
                "affected_rule_ids": ["PRR-CORRECTNESS-001"],
                "repair_objective": "Exercise official repair routing.",
                "smallest_safe_repair": ["Apply the bounded synthetic repair."],
                "do_not_change": ["Do not alter unrelated behavior."],
                "required_validation": ["Run official projection validation."],
                "overclaim_guards": ["Do not claim merge authorization."],
            }
        ],
    }


def external_repair() -> dict[str, Any]:
    return {
        "sources_inspected": [
            {
                "source_id": "EXTSRC-001",
                "source_type": "github_pr_review_comment",
                "author": "synthetic-reviewer",
                "is_bot": True,
                "url": None,
                "inspected": True,
            }
        ],
        "suggestions": [
            {
                "external_suggestion_id": "EXT-001",
                "source_id": "EXTSRC-001",
                "author": "synthetic-reviewer",
                "is_bot": True,
                "location": {"path": "src/synthetic.py", "line": 1},
                "claim_summary": "Synthetic accepted repair suggestion.",
                "claim_type": "bug_risk",
                "triage_decision": "accepted",
                "triage_reason": "Exercise official external-repair routing.",
                "evidence_refs": ["EVD-002"],
                "linked_finding_ids": [],
                "repair_handoff": {
                    "smallest_safe_repair": ["Apply bounded synthetic repair."],
                    "do_not_change": ["Do not alter unrelated behavior."],
                    "required_validation": ["Run official projection validation."],
                    "overclaim_guards": ["Do not claim merge authorization."],
                },
            }
        ],
    }


def base_package(args: argparse.Namespace, inspector_root: Path) -> dict[str, Any]:
    package = load(inspector_root / "fixtures/golden-green/review-package.json")
    package["review_identity"].update(
        {
            "target_repository": args.target_repository,
            "pr_number": args.pr_number,
            "base_branch": "main",
            "base_sha": args.base_sha,
            "head_branch": "governance/gov-003-004-complete-enforcement",
            "reviewed_head_sha": args.head_sha,
            "merge_base_sha": args.base_sha,
            "inspector_repository": "rezahh107/PR-Inspector",
            "inspector_commit_sha": args.expected_inspector_commit,
            "review_started": "2026-07-14T08:00:00Z",
            "review_completed": "2026-07-14T08:05:00Z",
            "review_validity": "CURRENT",
            "review_mode": "FULL",
        }
    )
    for evidence in package.get("evidence_records", []):
        evidence["reviewed_head_sha"] = args.head_sha
    package["decision"].update(
        {
            "approval_requirement": "NO_ADDITIONAL_TECHNICAL_APPROVAL",
            "technical_status": "GREEN_TECHNICALLY_READY",
            "blocking_findings_count": 0,
        }
    )
    package["findings"] = []
    package["red_gate_flags"] = []
    package["required_actions"] = []
    package["unverified_areas"] = []
    package.pop("repair_handoff", None)
    package.pop("external_review_intake", None)
    return package


def mutate(package: dict[str, Any], case: dict[str, Any]) -> None:
    kind = case["mutation"]
    if kind == "clean":
        return
    if kind == "finding":
        item = finding(case)
        package["findings"] = [item]
        package["decision"]["blocking_findings_count"] = int(item["blocking"])
    elif kind == "partial_review":
        package["review_identity"]["review_mode"] = "PARTIAL"
    elif kind == "coverage_incomplete":
        package["scope"]["coverage_complete"] = False
        package["scope"]["scope_limit_reason"] = "Synthetic regression."
    elif kind == "high_risk_area_unreviewed":
        package["scope"]["high_risk_areas_not_reviewed"] = ["synthetic"]
    elif kind == "intent_fit_missing":
        package.pop("intent_fit", None)
    elif kind == "intent_fit_unsatisfied":
        package["intent_fit"]["intent_fit_result"] = "not_satisfied"
    elif kind == "unsupported_intent_claim":
        package["intent_fit"]["unsupported_claims"] = ["synthetic"]
    elif kind == "repair_handoff_present":
        item = finding(
            {
                "severity": "LOW",
                "evidence_label": "CODE_SUPPORTED",
                "blocking": False,
            }
        )
        package["findings"] = [item]
        package["repair_handoff"] = handoff(item["finding_id"])
    elif kind == "accepted_external_repair":
        package["external_review_intake"] = external_repair()
    elif kind == "mixed_repair_and_verify":
        item = finding(
            {
                "severity": "HIGH",
                "evidence_label": "CODE_SUPPORTED",
                "blocking": True,
            }
        )
        package["findings"] = [item]
        package["decision"]["blocking_findings_count"] = 1
        package["unverified_areas"] = ["synthetic"]
    elif kind == "approval_requirement":
        package["decision"]["approval_requirement"] = case[
            "approval_requirement"
        ]
    else:
        raise AssertionError(f"unsupported mutation: {kind}")


def adapter_project(
    adapter: Path, inspector_root: Path, package_path: Path
) -> list[str]:
    return [
        sys.executable,
        str(adapter),
        "--inspector-root",
        str(inspector_root),
        "project",
        "--package",
        str(package_path),
    ]


def adapter_verify(
    args: argparse.Namespace,
    adapter: Path,
    inspector_root: Path,
    directory: Path,
    repository_payload: Path,
    commit_payload: Path,
) -> list[str]:
    return [
        sys.executable,
        str(adapter),
        "--inspector-root",
        str(inspector_root),
        "verify",
        "--review-directory",
        str(directory),
        "--repository-payload",
        str(repository_payload),
        "--commit-payload",
        str(commit_payload),
        "--expected-commit-sha",
        args.expected_inspector_commit,
        "--live-repository",
        args.target_repository,
        "--live-pr-number",
        str(args.pr_number),
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspector-root", required=True)
    parser.add_argument("--repository-payload", required=True)
    parser.add_argument("--commit-payload", required=True)
    parser.add_argument("--expected-inspector-commit", required=True)
    parser.add_argument("--target-repository", required=True)
    parser.add_argument("--pr-number", required=True, type=int)
    parser.add_argument("--base-sha", required=True)
    parser.add_argument("--head-sha", required=True)
    parser.add_argument(
        "--adapter", default="scripts/verify-pr-inspector-bundle.py"
    )
    parser.add_argument(
        "--cases", default="tests/governance/pr-inspector-projection-cases.json"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    inspector_root = Path(args.inspector_root).resolve()
    adapter = Path(args.adapter).resolve()
    repository_payload = Path(args.repository_payload).resolve()
    commit_payload = Path(args.commit_payload).resolve()
    sys.path.insert(0, str(inspector_root))

    import pr_inspector.decision_projection as projection_module
    import pr_inspector.review_provenance as provenance_module
    from pr_inspector.decision_projection import project_decision
    from pr_inspector.derived_outputs import build_review_artifacts
    from pr_inspector.official_review import (
        github_pull_request_head_source,
        verify_completed_review,
    )
    from pr_inspector.render import canonical_json_bytes
    from pr_inspector.review_provenance import (
        event_evidence_fields,
        verify_github_commit_payload,
        verify_review_directory,
    )

    for module in (projection_module, provenance_module):
        module_path = Path(inspect.getfile(module)).resolve()
        if inspector_root != module_path and inspector_root not in module_path.parents:
            raise AssertionError("official module was not imported from checkout")
    if (inspector_root / "CURRENT_VERSION").read_text().strip() != EXPECTED_PROTOCOL:
        raise AssertionError("immutable inspector protocol mismatch")

    cases = load(Path(args.cases))["cases"]
    if len(cases) != 20 or len({item["case_id"] for item in cases}) != 20:
        raise AssertionError("exactly 20 unique official projection cases required")
    package_base = base_package(args, inspector_root)

    with tempfile.TemporaryDirectory(prefix="ev4-official-inspector-") as raw:
        temp = Path(raw)
        for case in cases:
            package = copy.deepcopy(package_base)
            mutate(package, case)
            package_path = temp / f"{case['case_id']}.json"
            package_path.write_text(
                json.dumps(
                    package,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                    allow_nan=False,
                )
                + "\n",
                encoding="utf-8",
            )
            adapter_output = run_json(
                adapter_project(adapter, inspector_root, package_path)
            )["projection"]
            official_output = project_decision(package)
            if adapter_output != official_output:
                raise AssertionError(
                    f"{case['case_id']}: adapter differs from official projection"
                )
            if official_output["technical_status"] != case[
                "expected_technical_status"
            ]:
                raise AssertionError(f"{case['case_id']}: status mismatch")
            if official_output["next_action"]["kind"] != case[
                "expected_next_action_kind"
            ]:
                raise AssertionError(f"{case['case_id']}: action mismatch")

        package = copy.deepcopy(package_base)
        package_bytes = canonical_json_bytes(package)
        directory = temp / "official-positive-review"
        directory.mkdir()
        (directory / "review-package.json").write_bytes(package_bytes)
        for name, text in build_review_artifacts(
            package, review_package_bytes=package_bytes
        ).items():
            (directory / name).write_text(text, encoding="utf-8")

        verify_command = adapter_verify(
            args,
            adapter,
            inspector_root,
            directory,
            repository_payload,
            commit_payload,
        )
        adapter_evidence = run_json(verify_command)
        verified_commit = verify_github_commit_payload(
            load(repository_payload),
            load(commit_payload),
            expected_commit_sha=args.expected_inspector_commit,
        )
        official_evidence = verify_review_directory(directory, verified_commit)
        if adapter_evidence["event_evidence_fields"] != event_evidence_fields(
            official_evidence
        ):
            raise AssertionError("adapter provenance differs from official output")
        for key in (
            "target_repository",
            "pr_number",
            "reviewed_head_sha",
            "review_validity",
            "technical_status",
            "approval_requirement",
            "next_action_kind",
        ):
            if adapter_evidence[key] != getattr(official_evidence, key):
                raise AssertionError(f"official evidence mismatch: {key}")

        source = github_pull_request_head_source(
            args.target_repository,
            args.pr_number,
            token=os.environ.get("GITHUB_TOKEN"),
            api_version="2022-11-28",
        )
        completion = verify_completed_review(directory, head_source=source)
        projection = completion.decision_projection()
        stable_completion = {
            "protocol_version": completion.protocol_version,
            "target_repository": completion.target_repository,
            "pr_number": completion.pr_number,
            "reviewed_head_sha": completion.reviewed_head_sha,
            "review_package_canonical_sha256": completion.review_package_canonical_sha256,
            "review_package_file_sha256": completion.review_package_file_sha256,
            "decision_projection_sha256": completion.decision_projection_sha256,
            "artifact_manifest_sha256": completion.artifact_manifest_sha256,
            "technical_status": projection["technical_status"],
            "approval_requirement": projection["approval_requirement"],
            "next_action_kind": projection["next_action"]["kind"],
        }
        for key, expected in stable_completion.items():
            if adapter_evidence["completion"][key] != expected:
                raise AssertionError(f"official completion mismatch: {key}")
        receipt = adapter_evidence["completion"]["target_head_receipt_sha256"]
        if not isinstance(receipt, str) or re.fullmatch(r"[0-9a-f]{64}", receipt) is None:
            raise AssertionError("official live-head receipt is not a SHA-256")

        projection_path = directory / "DECISION_PROJECTION.json"
        original = projection_path.read_text(encoding="utf-8")
        tampered = json.loads(original)
        tampered["technical_status"] = "YELLOW_CHANGES_OR_VERIFICATION_REQUIRED"
        projection_path.write_text(
            json.dumps(tampered, sort_keys=True, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        require_failure(verify_command)
        projection_path.write_text(original, encoding="utf-8")

        wrong_repository = load(repository_payload)
        wrong_repository["id"] = 1
        wrong_path = temp / "wrong-repository.json"
        wrong_path.write_text(json.dumps(wrong_repository) + "\n")
        require_failure(
            adapter_verify(
                args,
                adapter,
                inspector_root,
                directory,
                wrong_path,
                commit_payload,
            )
        )

    print("Official PR Inspector immutable integration regression passed.")
    print(f"projection_cases={len(cases)}")
    print("official_positive_synthetic_verification=true")
    print("official_projection_function=pr_inspector.decision_projection.project_decision")
    print("official_completion_function=pr_inspector.official_review.verify_completed_review")
    print("official_provenance_functions=verify_github_commit_payload,verify_review_directory,event_evidence_fields")
    print("local_projection_replica=false")
    print("local_evidence_id_replica=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
