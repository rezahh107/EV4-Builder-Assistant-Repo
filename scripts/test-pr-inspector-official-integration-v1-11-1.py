#!/usr/bin/env python3
"""Regression harness for the immutable PR Inspector v1.11.1 integration."""

from __future__ import annotations

import argparse
import copy
import importlib.util
import inspect
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

EXPECTED_PROTOCOL = "v1.11.1"
EXPECTED_API_VERSION = "2026-03-10"
TARGET_REPOSITORY_ID = 1282136475
LEGACY_HARNESS = Path(__file__).with_name("test-pr-inspector-official-integration.py")


def load_legacy():
    spec = importlib.util.spec_from_file_location("ev4_pr_inspector_legacy_harness", LEGACY_HARNESS)
    if spec is None or spec.loader is None:
        raise AssertionError("unable to load legacy projection helpers")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.EXPECTED_PROTOCOL = EXPECTED_PROTOCOL
    return module


def run_json(command: list[str]) -> dict:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise AssertionError(
            "command failed:\n" + " ".join(command)
            + "\nstdout:\n" + result.stdout + "\nstderr:\n" + result.stderr
        )
    value = json.loads(result.stdout)
    if not isinstance(value, dict):
        raise AssertionError("adapter output must be a JSON object")
    return value


def require_failure(command: list[str]) -> None:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode == 0:
        raise AssertionError("official verifier unexpectedly accepted tampering")
    if "PR_INSPECTOR_OFFICIAL_VERIFIER_FAILED" not in result.stdout + result.stderr:
        raise AssertionError("official verifier failure marker was absent")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspector-root", required=True)
    parser.add_argument("--expected-inspector-commit", required=True)
    parser.add_argument("--target-repository", required=True)
    parser.add_argument("--pr-number", required=True, type=int)
    parser.add_argument("--base-sha", required=True)
    parser.add_argument("--head-sha", required=True)
    parser.add_argument("--adapter", default="scripts/verify-pr-inspector-bundle.py")
    parser.add_argument("--cases", default="tests/governance/pr-inspector-projection-cases.json")
    return parser.parse_args()


def adapter_verify(args: argparse.Namespace, adapter: Path, root: Path, directory: Path) -> list[str]:
    return [
        sys.executable, str(adapter), "--inspector-root", str(root), "verify",
        "--review-directory", str(directory),
        "--expected-commit-sha", args.expected_inspector_commit,
        "--live-repository", args.target_repository,
        "--live-pr-number", str(args.pr_number),
        "--github-api-version", EXPECTED_API_VERSION,
    ]


def main() -> int:
    args = parse_args()
    root = Path(args.inspector_root).resolve()
    adapter = Path(args.adapter).resolve()
    legacy = load_legacy()
    sys.path.insert(0, str(root))

    import pr_inspector.decision_projection as projection_module
    import pr_inspector.governance as governance_module
    import pr_inspector.review_provenance as provenance_module
    from pr_inspector.decision_projection import project_decision
    from pr_inspector.derived_outputs import build_review_artifacts
    from pr_inspector.governance import fetch_github_api_response, github_response_payload
    from pr_inspector.official_review import github_pull_request_head_source, verify_completed_review
    from pr_inspector.render import canonical_json_bytes
    from pr_inspector.review_provenance import event_evidence_fields, verify_github_commit_payload, verify_review_directory

    for module in (projection_module, governance_module, provenance_module):
        module_path = Path(inspect.getfile(module)).resolve()
        if root != module_path and root not in module_path.parents:
            raise AssertionError("official module was not imported from immutable checkout")
    if (root / "CURRENT_VERSION").read_text(encoding="utf-8").strip() != EXPECTED_PROTOCOL:
        raise AssertionError("immutable inspector protocol mismatch")
    trust = json.loads((root / f"protocols/{EXPECTED_PROTOCOL}/trust/INSPECTOR_TRUST_POLICY.json").read_text(encoding="utf-8"))
    if trust.get("github_api_version") != EXPECTED_API_VERSION:
        raise AssertionError("immutable inspector GitHub API version mismatch")

    cases = legacy.load(Path(args.cases))["cases"]
    if len(cases) != 20 or len({item["case_id"] for item in cases}) != 20:
        raise AssertionError("exactly 20 unique official projection cases required")
    package_base = legacy.base_package(args, root)
    package_base["review_identity"]["target_repository_id"] = TARGET_REPOSITORY_ID
    package_base["review_identity"]["head_branch"] = "docs/reconcile-project-gate-authority"

    token = os.environ.get("GITHUB_TOKEN")
    repository_url = "https://api.github.com/repos/rezahh107/PR-Inspector"
    commit_url = f"{repository_url}/commits/{args.expected_inspector_commit}"
    repository_response = fetch_github_api_response(
        repository_url, token=token, api_version=EXPECTED_API_VERSION
    )
    commit_response = fetch_github_api_response(
        commit_url, token=token, api_version=EXPECTED_API_VERSION
    )
    verified_commit = verify_github_commit_payload(
        repository_response,
        commit_response,
        expected_commit_sha=args.expected_inspector_commit,
    )

    with tempfile.TemporaryDirectory(prefix="ev4-official-inspector-v1-11-1-") as raw:
        temp = Path(raw)
        for case in cases:
            package = copy.deepcopy(package_base)
            legacy.mutate(package, case)
            package_path = temp / f"{case['case_id']}.json"
            package_path.write_text(
                json.dumps(package, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n",
                encoding="utf-8",
            )
            adapter_projection = run_json(
                legacy.adapter_project(adapter, root, package_path)
            )["projection"]
            official_projection = project_decision(package)
            if adapter_projection != official_projection:
                raise AssertionError(f"{case['case_id']}: adapter differs from official projection")

        package = copy.deepcopy(package_base)
        package_bytes = canonical_json_bytes(package)
        directory = temp / "official-positive-review"
        directory.mkdir()
        (directory / "review-package.json").write_bytes(package_bytes)
        for name, text in build_review_artifacts(
            package, review_package_bytes=package_bytes
        ).items():
            (directory / name).write_text(text, encoding="utf-8")

        verify_command = adapter_verify(args, adapter, root, directory)
        adapter_evidence = run_json(verify_command)
        official_evidence = verify_review_directory(directory, verified_commit)
        if adapter_evidence["event_evidence_fields"] != event_evidence_fields(official_evidence):
            raise AssertionError("adapter provenance differs from official output")
        for key in (
            "target_repository", "pr_number", "reviewed_head_sha", "review_validity",
            "technical_status", "approval_requirement", "next_action_kind",
        ):
            if adapter_evidence[key] != getattr(official_evidence, key):
                raise AssertionError(f"official evidence mismatch: {key}")

        source = github_pull_request_head_source(
            args.target_repository,
            args.pr_number,
            token=token,
            api_version=EXPECTED_API_VERSION,
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
        projection_path.write_text(json.dumps(tampered, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
        require_failure(verify_command)
        projection_path.write_text(original, encoding="utf-8")

        try:
            verify_github_commit_payload(
                github_response_payload(repository_response),
                github_response_payload(commit_response),
                expected_commit_sha=args.expected_inspector_commit,
            )
        except Exception:
            pass
        else:
            raise AssertionError("copied GitHub JSON unexpectedly satisfied sealed provenance")

    print("Official PR Inspector v1.11.1 immutable integration regression passed.")
    print(f"projection_cases={len(cases)}")
    print("official_positive_synthetic_verification=true")
    print("official_transport=fetch_github_api_response")
    print("copied_json_provenance_rejected=true")
    print("official_projection_function=pr_inspector.decision_projection.project_decision")
    print("official_completion_function=pr_inspector.official_review.verify_completed_review")
    print("official_provenance_functions=verify_github_commit_payload,verify_review_directory,event_evidence_fields")
    print("local_projection_replica=false")
    print("local_evidence_id_replica=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
