#!/usr/bin/env python3
"""Freeze the current Tier C dataset as a baseline snapshot."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = PROJECT_ROOT / "public" / "data" / "tier-c.json"
BASELINES_DIR = PROJECT_ROOT / "baselines"
PUBLIC_META_PATH = PROJECT_ROOT / "public" / "data" / "tier-c-baseline.meta.json"


def main() -> None:
    if not DATASET_PATH.exists():
        raise SystemExit(f"Dataset not found: {DATASET_PATH}. Run build:data first.")

    BASELINES_DIR.mkdir(parents=True, exist_ok=True)

    payload = DATASET_PATH.read_bytes()
    data = json.loads(payload.decode("utf-8"))

    digest = hashlib.sha256(payload).hexdigest()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    snapshot_name = f"tier-c-baseline-{stamp}.json"
    snapshot_path = BASELINES_DIR / snapshot_name
    latest_path = BASELINES_DIR / "tier-c-baseline.latest.json"

    snapshot_path.write_bytes(payload)
    latest_path.write_bytes(payload)

    meta = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourcePath": str(DATASET_PATH.relative_to(PROJECT_ROOT)),
        "snapshotPath": str(snapshot_path.relative_to(PROJECT_ROOT)),
        "latestPath": str(latest_path.relative_to(PROJECT_ROOT)),
        "sha256": digest,
        "dataset": data.get("meta", {}).get("dataset", "unknown"),
        "datasetGeneratedAt": data.get("meta", {}).get("generatedAt", "unknown"),
        "counts": {
            "people": len(data.get("people", [])),
            "events": len(data.get("events", [])),
            "relationships": len(data.get("relationships", [])),
            "claims": len(data.get("claims", [])),
            "disputes": len(data.get("disputes", [])),
            "places": len(data.get("places", [])),
            "sources": len(data.get("sources", [])),
            "segments": len(data.get("sourceSegments", [])),
        },
    }

    (BASELINES_DIR / "tier-c-baseline.meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    PUBLIC_META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote baseline snapshot: {snapshot_path}")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    main()
