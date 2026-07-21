#!/usr/bin/env python3
"""Run the existing immutable integration harness against PR Inspector v1.11.1."""

from __future__ import annotations

import importlib.util
from pathlib import Path


LEGACY_HARNESS = Path(__file__).with_name("test-pr-inspector-official-integration.py")
spec = importlib.util.spec_from_file_location("ev4_pr_inspector_integration_harness", LEGACY_HARNESS)
if spec is None or spec.loader is None:
    raise SystemExit("unable to load PR Inspector integration harness")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.EXPECTED_PROTOCOL = "v1.11.1"
_original_base_package = module.base_package


def _v1_11_1_base_package(args, inspector_root):
    package = _original_base_package(args, inspector_root)
    package["review_identity"]["target_repository_id"] = 1282136475
    return package


module.base_package = _v1_11_1_base_package

if __name__ == "__main__":
    raise SystemExit(module.main())
