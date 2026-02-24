#!/usr/bin/env python3
"""Build Tier C dataset from Tier B with operations metadata and release scaffolding."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TIER_B_PATH = PROJECT_ROOT / "public" / "data" / "tier-b.json"
OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "tier-c.json"


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    stripped = stripped.lower()
    stripped = re.sub(r"[^a-z0-9]+", " ", stripped)
    return " ".join(stripped.split())


def find_name_collisions(people: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_key: Dict[str, List[str]] = {}
    for person in people:
        key = normalize_text(str(person.get("canonicalName", "")))
        if not key:
            continue
        by_key.setdefault(key, []).append(str(person.get("id", "")))

    collisions: List[Dict[str, Any]] = []
    for key, ids in sorted(by_key.items()):
        if len(ids) <= 1:
            continue
        collisions.append({"normalizedName": key, "personIds": ids})
    return collisions


def find_alias_collisions(people: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_key: Dict[str, set[str]] = {}
    for person in people:
        person_id = str(person.get("id", ""))
        if not person_id:
            continue
        candidates = [str(person.get("canonicalName", ""))]
        for alias in person.get("aliases", []) or []:
            text = str(alias.get("text", "")).strip()
            if text:
                candidates.append(text)

        for text in candidates:
            key = normalize_text(text)
            if not key:
                continue
            if key not in by_key:
                by_key[key] = set()
            by_key[key].add(person_id)

    collisions: List[Dict[str, Any]] = []
    for key, person_ids in sorted(by_key.items()):
        if len(person_ids) <= 1:
            continue
        collisions.append({"normalizedLabel": key, "personIds": sorted(person_ids)})
    return collisions


def build_confidence_summary(claims: List[Dict[str, Any]]) -> Dict[str, Any]:
    high = 0
    medium = 0
    low = 0
    missing_source = 0

    for claim in claims:
        confidence = float(((claim.get("confidence") or {}).get("extraction")) or 0.0)
        if confidence >= 0.90:
            high += 1
        elif confidence >= 0.86:
            medium += 1
        else:
            low += 1

        if not claim.get("sourceSegmentId"):
            missing_source += 1

    return {
        "highGte090": high,
        "medium086To089": medium,
        "lowLt086": low,
        "uncitedClaims": missing_source,
    }


def build_source_coverage(dataset: Dict[str, Any]) -> List[Dict[str, Any]]:
    sources = dataset.get("sources", []) or []
    segments = dataset.get("sourceSegments", []) or []
    claims = dataset.get("claims", []) or []
    events = dataset.get("events", []) or []
    relationships = dataset.get("relationships", []) or []

    segment_by_source: Dict[str, set[str]] = {}
    for segment in segments:
        source_id = str(segment.get("sourceId", ""))
        segment_id = str(segment.get("id", ""))
        if not source_id or not segment_id:
            continue
        if source_id not in segment_by_source:
            segment_by_source[source_id] = set()
        segment_by_source[source_id].add(segment_id)

    rows: List[Dict[str, Any]] = []
    for source in sources:
        source_id = str(source.get("id", ""))
        if not source_id:
            continue
        segment_ids = segment_by_source.get(source_id, set())

        claim_count = sum(
            1
            for claim in claims
            if claim.get("sourceSegmentId") and str(claim.get("sourceSegmentId")) in segment_ids
        )
        event_count = sum(
            1
            for event in events
            if event.get("sourceSegmentId") and str(event.get("sourceSegmentId")) in segment_ids
        )
        relationship_count = sum(
            1
            for rel in relationships
            if rel.get("sourceSegmentId") and str(rel.get("sourceSegmentId")) in segment_ids
        )

        rows.append(
            {
                "sourceId": source_id,
                "label": str(source.get("label", source_id)),
                "workId": str(source.get("workId", "")),
                "workTitle": str(source.get("workTitle", "")),
                "segmentCount": len(segment_ids),
                "claimCount": claim_count,
                "eventCount": event_count,
                "relationshipCount": relationship_count,
                "totalMentions": claim_count + event_count + relationship_count,
            }
        )

    rows.sort(key=lambda row: (-int(row["totalMentions"]), str(row["sourceId"])))
    return rows


def build_person_focus(dataset: Dict[str, Any], open_disputes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    people = dataset.get("people", []) or []
    events = dataset.get("events", []) or []
    relationships = dataset.get("relationships", []) or []
    claims = dataset.get("claims", []) or []

    person_stats: Dict[str, Dict[str, Any]] = {}
    for person in people:
        person_id = str(person.get("id", ""))
        if not person_id:
            continue
        person_stats[person_id] = {
            "personId": person_id,
            "name": str(person.get("canonicalName", person_id)),
            "tier": str(person.get("tier", "C")),
            "personClaims": 0,
            "eventMentions": 0,
            "relationshipMentions": 0,
            "openDisputes": 0,
            "totalMentions": 0,
        }

    for claim in claims:
        if claim.get("subjectType") != "person":
            continue
        person_id = str(claim.get("subjectId", ""))
        if person_id in person_stats:
            person_stats[person_id]["personClaims"] += 1

    for event in events:
        for person_id in event.get("participantIds", []) or []:
            person_id_text = str(person_id)
            if person_id_text in person_stats:
                person_stats[person_id_text]["eventMentions"] += 1

    for rel in relationships:
        source_id = str(rel.get("sourcePersonId", ""))
        target_id = str(rel.get("targetPersonId", ""))
        if source_id in person_stats:
            person_stats[source_id]["relationshipMentions"] += 1
        if target_id in person_stats:
            person_stats[target_id]["relationshipMentions"] += 1

    claim_by_id = {str(claim.get("id", "")): claim for claim in claims}
    for dispute in open_disputes:
        claim_id = str(dispute.get("claimId", ""))
        claim = claim_by_id.get(claim_id)
        if not claim:
            continue
        subject_type = str(claim.get("subjectType", ""))
        if subject_type == "person":
            person_id = str(claim.get("subjectId", ""))
            if person_id in person_stats:
                person_stats[person_id]["openDisputes"] += 1

    rows: List[Dict[str, Any]] = []
    for row in person_stats.values():
        row["totalMentions"] = row["personClaims"] + row["eventMentions"] + row["relationshipMentions"]
        rows.append(row)

    rows.sort(
        key=lambda row: (
            -int(row["openDisputes"]),
            -int(row["totalMentions"]),
            str(row["name"]),
        )
    )
    return rows[:20]


def build_release_note_seed(dataset: Dict[str, Any]) -> Dict[str, Any]:
    people = dataset.get("people", [])
    events = dataset.get("events", [])
    claims = dataset.get("claims", [])
    disputes = dataset.get("disputes", [])

    counts_by_tier: Dict[str, int] = {"A": 0, "B": 0, "C": 0}
    for person in people:
        tier = str(person.get("tier", "C"))
        if tier in counts_by_tier:
            counts_by_tier[tier] += 1

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "title": "Tier C Seed Snapshot",
        "summary": [
            "Tier C initialized from Tier B memoir-only dataset.",
            "No supplemental external sources ingested yet.",
            "Operational metadata scaffold prepared for multi-source cycles.",
        ],
        "counts": {
            "people": len(people),
            "events": len(events),
            "claims": len(claims),
            "disputes": len(disputes),
            "peopleByTier": counts_by_tier,
        },
    }


def main() -> None:
    if not TIER_B_PATH.exists():
        raise FileNotFoundError(f"Missing Tier B dataset at {TIER_B_PATH}")

    dataset = json.loads(TIER_B_PATH.read_text(encoding="utf-8"))
    if not isinstance(dataset, dict):
        raise ValueError("Tier B dataset root is not an object.")

    people = dataset.get("people", [])
    claims = dataset.get("claims", [])
    disputes = dataset.get("disputes", [])
    open_disputes = [row for row in disputes if row.get("status") == "open"]
    collisions = find_name_collisions(people)
    alias_collisions = find_alias_collisions(people)

    dataset["meta"]["schemaVersion"] = "0.3.0"
    dataset["meta"]["dataset"] = "hyegyong-tier-c"
    dataset["meta"]["generatedAt"] = datetime.now(timezone.utc).isoformat()
    dataset["meta"]["generator"] = "scripts/build_tier_c_data.py"

    dataset["tierC"] = {
        "sourceScope": "memoir-only (single EPUB)",
        "ingestion": {
            "currentBatches": [
                {
                    "id": "batch-memoirs-haboush-seed",
                    "sourceWorkId": "wrk-memoirs-lady-hyegyong-haboush",
                    "sourceCount": 1,
                    "status": "published",
                    "notes": "Tier A/B seeded from memoir references extracted from EPUB.",
                }
            ],
            "pendingBatches": [],
            "nextSourceTemplate": {
                "expectedTypes": ["epub", "pdf", "journal-article"],
                "requiredFields": ["workId", "workTitle", "contributors", "publisher", "year", "citation"],
            },
        },
        "quality": {
            "openDisputes": len(open_disputes),
            "nameCollisions": collisions,
            "aliasCollisions": alias_collisions,
            "confidence": build_confidence_summary(claims),
        },
        "focusedPass": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sourceCoverage": build_source_coverage(dataset),
            "personFocus": build_person_focus(dataset, open_disputes),
        },
        "releaseNotesSeed": build_release_note_seed(dataset),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {OUTPUT_PATH}")
    print(
        "Tier C summary -> people: {people}, events: {events}, claims: {claims}, disputes: {disputes}, collisions: {collisions}".format(
            people=len(dataset.get("people", [])),
            events=len(dataset.get("events", [])),
            claims=len(dataset.get("claims", [])),
            disputes=len(dataset.get("disputes", [])),
            collisions=len(collisions),
        )
    )


if __name__ == "__main__":
    main()
