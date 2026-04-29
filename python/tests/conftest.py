from __future__ import annotations

import os
from pathlib import Path


FEATURES_ONLY = os.getenv("FEATURES_ONLY", "").strip()


def iter_feature_files(root: str = "tests/features") -> list[Path]:
    base = Path(root)
    if not base.exists():
        return []
    all_features = sorted(base.rglob("*.feature"))
    if not FEATURES_ONLY:
        return all_features
    selected = {item.strip() for item in FEATURES_ONLY.split(",") if item.strip()}
    return [path for path in all_features if path.as_posix() in selected or path.name in selected]
