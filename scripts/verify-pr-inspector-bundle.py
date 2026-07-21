#!/usr/bin/env python3
"""Thin adapter over the immutable PR Inspector v1.11.1 implementation.

No decision, routing, provenance, transport, or evidence-ID logic is reimplemented.
The adapter calls the official operational GitHub transport, provenance verifier,
completion boundary, and projection functions from the immutable checkout.
"""

from __future__ import annotations

import argparse
import inspect
import json
import os
import sys
from pathlib import Path
from typing import Any

EXPECTED_PROTOCOL = "v1.11.1"
DEFAULT_GITHUB_API_VERSION = "2026-03-10"
INSPECTOR_REPOSITORY = "rezahh107/PR-Inspector"


def load_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot load JSON object from {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def emit(value: dict[str, Any]) -> None:
    print(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False))


def configure_checkout(root_value: str) -> dict[str, Any]:
    root = Path(root_value).resolve()
    if not root.is_dir():
        raise ValueError("immutable PR Inspector checkout is missing")
    sys.path.insert(0, str(root))

    import yaml
    import pr_inspector.decision_projection as projection_module
    import pr_inspector.governance as governance_module
    import pr_inspector.official_review as official_module
    import pr_inspector.review_provenance as provenance_module

    modules = {
        "decision_projection": projection_module,
        "governance": governance_module,
        "official_review": official_module,
        "review_provenance": provenance_module,
    }
    module_paths: dict[str, str] = {}
    for name, module in modules.items():
        module_path = Path(inspect.getfile(module)).resolve()
        if root != module_path and root not in module_path.parents:
            raise ValueError(f"{name} was not imported from the immutable checkout")
        module_paths[name] = str(module_path)

    current_version = (root / "CURRENT_VERSION").read_text(encoding="utf-8").strip()
    manifest = yaml.safe_load((root / "protocol-manifest.yaml").read_text(encoding="utf-8"))
    active_version = manifest.get("active_version") if isinstance(manifest, dict) else None
    if current_version != EXPECTED_PROTOCOL:
        raise ValueError(f"CURRENT_VERSION must equal {EXPECTED_PROTOCOL}, received {current_version}")
    if active_version != EXPECTED_PROTOCOL:
        raise ValueError(f"active_version must equal {EXPECTED_PROTOCOL}, received {active_version}")
    trust = load_object(root / f"protocols/{EXPECTED_PROTOCOL}/trust/INSPECTOR_TRUST_POLICY.json")
    if trust.get("protocol_version") != EXPECTED_PROTOCOL:
        raise ValueError("Inspector trust policy protocol mismatch")
    if trust.get("github_api_version") != DEFAULT_GITHUB_API_VERSION:
        raise ValueError("Inspector trust policy GitHub API version mismatch")
    return {
        "root": str(root),
        "module_paths": dict(sorted(module_paths.items())),
        "current_version": current_version,
        "active_version": active_version,
        "github_api_version": trust["github_api_version"],
    }


def project(args: argparse.Namespace) -> None:
    checkout = configure_checkout(args.inspector_root)
    from pr_inspector.decision_projection import project_decision
    emit({
        "official_boundary": "pr_inspector.decision_projection.project_decision",
        "inspector_checkout": checkout,
        "projection": project_decision(load_object(Path(args.package))),
    })


def verify(args: argparse.Namespace) -> None:
    checkout = configure_checkout(args.inspector_root)
    from pr_inspector.governance import fetch_github_api_response
    from pr_inspector.official_review import github_pull_request_head_source, verify_completed_review
    from pr_inspector.review_provenance import event_evidence_fields, verify_github_commit_payload, verify_review_directory

    token = os.environ.get(args.github_token_env)
    repository_url = f"https://api.github.com/repos/{INSPECTOR_REPOSITORY}"
    commit_url = f"{repository_url}/commits/{args.expected_commit_sha}"
    repository_response = fetch_github_api_response(
        repository_url, token=token, api_version=args.github_api_version
    )
    commit_response = fetch_github_api_response(
        commit_url, token=token, api_version=args.github_api_version
    )
    inspector_commit = verify_github_commit_payload(
        repository_response,
        commit_response,
        expected_commit_sha=args.expected_commit_sha,
    )

    review_directory = Path(args.review_directory)
    evidence = verify_review_directory(review_directory, inspector_commit)
    event_fields = event_evidence_fields(evidence)
    source = github_pull_request_head_source(
        args.live_repository,
        args.live_pr_number,
        token=token,
        api_version=args.github_api_version,
    )
    completion = verify_completed_review(review_directory, head_source=source)
    completion_projection = completion.decision_projection()

    emit({
        "official_commit_transport": "pr_inspector.governance.fetch_github_api_response",
        "official_completion_boundary": "pr_inspector.official_review.verify_completed_review",
        "official_provenance_boundary": "pr_inspector.review_provenance.verify_review_directory",
        "official_provenance_function": "pr_inspector.review_provenance.event_evidence_fields",
        "inspector_checkout": checkout,
        "event_evidence_fields": event_fields,
        "completion": {
            "protocol_version": completion.protocol_version,
            "target_repository": completion.target_repository,
            "pr_number": completion.pr_number,
            "reviewed_head_sha": completion.reviewed_head_sha,
            "review_package_canonical_sha256": completion.review_package_canonical_sha256,
            "review_package_file_sha256": completion.review_package_file_sha256,
            "decision_projection_sha256": completion.decision_projection_sha256,
            "artifact_manifest_sha256": completion.artifact_manifest_sha256,
            "target_head_receipt_sha256": completion.target_head_receipt_sha256,
            "technical_status": completion_projection["technical_status"],
            "approval_requirement": completion_projection["approval_requirement"],
            "next_action_kind": completion_projection["next_action"]["kind"],
        },
        "target_repository": evidence.target_repository,
        "pr_number": evidence.pr_number,
        "reviewed_head_sha": evidence.reviewed_head_sha,
        "review_validity": evidence.review_validity,
        "technical_status": evidence.technical_status,
        "approval_requirement": evidence.approval_requirement,
        "next_action_kind": evidence.next_action_kind,
    })


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspector-root", required=True)
    commands = parser.add_subparsers(dest="command", required=True)

    projection = commands.add_parser("project")
    projection.add_argument("--package", required=True)
    projection.set_defaults(handler=project)

    verification = commands.add_parser("verify")
    verification.add_argument("--review-directory", required=True)
    verification.add_argument("--expected-commit-sha", required=True)
    verification.add_argument("--live-repository", required=True)
    verification.add_argument("--live-pr-number", required=True, type=int)
    verification.add_argument("--github-api-version", default=DEFAULT_GITHUB_API_VERSION)
    verification.add_argument("--github-token-env", default="GITHUB_TOKEN")
    verification.set_defaults(handler=verify)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        args.handler(args)
    except Exception as exc:
        print(
            "PR_INSPECTOR_OFFICIAL_VERIFIER_FAILED:"
            f"{type(exc).__name__}:{exc}",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
