#!/usr/bin/env python3
"""Build Tier B dataset by extending Tier A with office, spatial, and dispute depth."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TIER_A_PATH = PROJECT_ROOT / "public" / "data" / "tier-a.json"
OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "tier-b.json"

PLACE_PATCHES = {
    "pl-changdeok": {"mapX": 43, "mapY": 44, "mapGroup": "Seoul Core"},
    "pl-changgyeong": {"mapX": 50, "mapY": 40, "mapGroup": "Seoul Core"},
    "pl-choseung-pavilion": {"mapX": 48, "mapY": 36, "mapGroup": "Seoul Core"},
    "pl-hyeollyung": {"mapX": 71, "mapY": 70, "mapGroup": "Suwon Axis"},
    "pl-hwaseong": {"mapX": 76, "mapY": 64, "mapGroup": "Suwon Axis"},
    "pl-kopyeong": {"mapX": 38, "mapY": 48, "mapGroup": "Seoul Core"},
}

ADDITIONAL_PLACES = [
    {
        "id": "pl-kanghwa",
        "name": "Kanghwa Island",
        "type": "island-exile-site",
        "summary": "Place of banishment in late-eighteenth-century court punishment politics.",
        "modern": "Incheon region",
        "confidence": 0.88,
        "mapX": 16,
        "mapY": 20,
        "mapGroup": "Exile Sites",
    },
    {
        "id": "pl-naju",
        "name": "Naju",
        "type": "provincial-settlement",
        "summary": "Southwestern relocation site used in elite punishment and containment.",
        "modern": "South Jeolla",
        "confidence": 0.85,
        "mapX": 26,
        "mapY": 84,
        "mapGroup": "Exile Sites",
    },
    {
        "id": "pl-huksan",
        "name": "Hŭksan Island",
        "type": "island-exile-site",
        "summary": "Remote banishment destination for politically disgraced elites.",
        "modern": "Southwestern coast",
        "confidence": 0.85,
        "mapX": 11,
        "mapY": 91,
        "mapGroup": "Exile Sites",
    },
]

TIER_B_OFFICES = {
    "HONG INHAN": [
        {
            "title": "Minister of the Right",
            "startYear": 1774,
            "endYear": 1774,
            "confidence": 0.9,
            "source": "src_principal_people",
        },
        {
            "title": "Minister of the Left",
            "startYear": 1775,
            "endYear": 1775,
            "confidence": 0.9,
            "source": "src_principal_people",
        },
    ],
    "CHŎNG HUGYŎM": [
        {
            "title": "Palace power broker",
            "startYear": 1766,
            "endYear": 1776,
            "confidence": 0.78,
            "source": "src_principal_people",
        }
    ],
    "HONG KUGYŎNG": [
        {
            "title": "Royal confidant",
            "startYear": 1776,
            "endYear": 1781,
            "confidence": 0.86,
            "source": "src_principal_people",
        }
    ],
    "KIM KWIJU": [
        {
            "title": "Kyŏngju Kim faction leader",
            "startYear": 1760,
            "endYear": 1786,
            "confidence": 0.74,
            "source": "src_principal_people",
        }
    ],
    "LADY KASUN": [
        {
            "title": "Royal secondary consort",
            "startYear": 1787,
            "endYear": 1805,
            "confidence": 0.82,
            "source": "src_principal_people",
        }
    ],
}

TIER_B_EVENTS = [
    {
        "id": "evt-1759-queen-chongsun-marriage",
        "title": "Royal wedding of Queen Chŏngsun",
        "startYear": 1759,
        "endYear": 1759,
        "eventType": "court",
        "summary": "King Yŏngjo's marriage to Queen Chŏngsun restructures late-court family blocs.",
        "participants": ["QUEEN CHŎNGSUN", "KING YŎNGJO"],
        "placeId": "pl-changdeok",
        "sourceId": "src_principal_people",
        "evidence": "The royal wedding took place in 1759.",
        "confidence": 0.9,
        "tier": "B",
    },
    {
        "id": "evt-1775-regency-opposition",
        "title": "Opposition to Chŏngjo's regency",
        "startYear": 1775,
        "endYear": 1775,
        "eventType": "factional",
        "summary": "Hong Inhan's opposition signals high-risk conflict in the transition before accession.",
        "participants": ["HONG INHAN", "KING CHŎNGJO"],
        "placeId": "pl-changdeok",
        "sourceId": "src_principal_people",
        "evidence": "He opposed Chŏngjo’s regency in 1775.",
        "confidence": 0.88,
        "tier": "B",
    },
    {
        "id": "evt-1778-hwawan-banishment",
        "title": "Princess Hwawan stripped and banished",
        "startYear": 1778,
        "endYear": 1778,
        "eventType": "factional-punishment",
        "summary": "Chŏngjo strips Princess Hwawan's title and sends her to Kanghwa Island.",
        "participants": ["PRINCESS HWAWAN", "KING CHŎNGJO"],
        "placeId": "pl-kanghwa",
        "sourceId": "src_principal_people",
        "evidence": "In 1778, under official pressure, Chŏngjo stripped her of her royal title ... and banished her to Kanghwa Island.",
        "confidence": 0.9,
        "tier": "B",
    },
    {
        "id": "evt-1781-hong-kugyeong-fall",
        "title": "Fall of Hong Kugyŏng",
        "startYear": 1781,
        "endYear": 1781,
        "eventType": "factional-punishment",
        "summary": "Hong Kugyŏng loses influence and ends in banishment after his political ascent.",
        "participants": ["HONG KUGYŎNG", "KING CHŎNGJO"],
        "placeId": None,
        "sourceId": "src_principal_people",
        "evidence": "Though he helped Chŏngjo to consolidate his power, he became too powerful ... and he died in banishment.",
        "confidence": 0.86,
        "tier": "B",
    },
    {
        "id": "evt-1784-kim-kwiju-relocation",
        "title": "Kim Kwiju permitted relocation to Naju",
        "startYear": 1784,
        "endYear": 1784,
        "eventType": "factional-punishment",
        "summary": "After banishment, Kim Kwiju is allowed to settle in Naju where he later dies.",
        "participants": ["KIM KWIJU"],
        "placeId": "pl-naju",
        "sourceId": "src_principal_people",
        "evidence": "In 1784 he was allowed to settle in Naju, where he died of illness.",
        "confidence": 0.86,
        "tier": "B",
    },
    {
        "id": "evt-1800-1804-dowager-regency",
        "title": "Dowager regency under Queen Chŏngsun",
        "startYear": 1800,
        "endYear": 1804,
        "eventType": "regency",
        "summary": "Queen Chŏngsun governs during Sunjo's minority; late memoir grievances intensify.",
        "participants": ["QUEEN CHŎNGSUN", "KING SUNJO", "LADY HYEGYŎNG"],
        "placeId": "pl-changdeok",
        "sourceId": "src_principal_people",
        "evidence": "For four years from 1800 to 1804, she was the dowager regent to the minor king, Sunjo.",
        "confidence": 0.92,
        "tier": "B",
    },
    {
        "id": "evt-1801-catholic-persecutions",
        "title": "1801 executions tied to Catholic persecutions",
        "startYear": 1801,
        "endYear": 1801,
        "eventType": "political-persecution",
        "summary": "Hong Nagim and Prince Ŭnŏn are executed in overlapping persecution campaigns.",
        "participants": ["HONG NAGIM", "PRINCE ŬNŎN", "KING SUNJO"],
        "placeId": "pl-changdeok",
        "sourceId": "src_principal_people",
        "evidence": "In 1801, he was accused of having converted to Catholicism, and executed.",
        "confidence": 0.89,
        "tier": "B",
    },
]


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    stripped = stripped.lower()
    stripped = re.sub(r"[^a-z0-9]+", " ", stripped)
    return " ".join(stripped.split())


def slug(value: str) -> str:
    return normalize_text(value).replace(" ", "-").strip("-")


def people_lookup(people: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    lookup: Dict[str, Dict[str, Any]] = {}
    for person in people:
        lookup[normalize_text(person["canonicalName"])] = person
        for alias in person.get("aliases", []):
            text = alias.get("text")
            if isinstance(text, str) and text.strip():
                lookup.setdefault(normalize_text(text), person)
    return lookup


def office_key(office: Dict[str, Any]) -> Tuple[str, Optional[int], Optional[int]]:
    return (
        str(office.get("title", "")).strip().lower(),
        office.get("startYear"),
        office.get("endYear"),
    )


def add_spatial_data(places: List[Dict[str, Any]]) -> None:
    existing_ids = {place["id"] for place in places}

    for place in places:
        patch = PLACE_PATCHES.get(place["id"])
        if patch:
            place.update(patch)

    for place in ADDITIONAL_PLACES:
        if place["id"] not in existing_ids:
            places.append(place)


def add_tier_b_offices(people: List[Dict[str, Any]]) -> int:
    lookup = people_lookup(people)
    added = 0

    for canonical_name, offices in TIER_B_OFFICES.items():
        person = lookup.get(normalize_text(canonical_name))
        if not person:
            continue
        existing = {office_key(item) for item in person.get("officeTerms", [])}
        for office in offices:
            key = office_key(office)
            if key in existing:
                continue
            person.setdefault("officeTerms", []).append(office)
            existing.add(key)
            added += 1

    # High-precision extraction of "Minister of ..." offices with explicit years.
    for person in people:
        bio = str(person.get("biography", ""))
        existing = {office_key(item) for item in person.get("officeTerms", [])}
        for match in re.finditer(r"(Minister of the [A-Za-z'ŏŎŭŬ\-\s]+?)\s+in\s+(\d{4})", bio):
            title = " ".join(match.group(1).split())
            year = int(match.group(2))
            office = {
                "title": title,
                "startYear": year,
                "endYear": year,
                "confidence": 0.84,
                "source": "src_principal_people",
            }
            key = office_key(office)
            if key in existing:
                continue
            person.setdefault("officeTerms", []).append(office)
            existing.add(key)
            added += 1

    return added


def add_tier_b_events(dataset: Dict[str, Any]) -> Tuple[int, int]:
    people = dataset["people"]
    events = dataset["events"]
    segments = dataset["sourceSegments"]
    claims = dataset["claims"]

    person_by_name = people_lookup(people)
    event_ids = {event["id"] for event in events}
    segment_ids = {segment["id"] for segment in segments}
    claim_ids = {claim["id"] for claim in claims}
    place_ids = {place["id"] for place in dataset["places"]}

    added_events = 0
    added_claims = 0

    for event in TIER_B_EVENTS:
        if event["id"] in event_ids:
            continue

        participant_ids: List[str] = []
        for name in event["participants"]:
            person = person_by_name.get(normalize_text(name))
            if person:
                participant_ids.append(person["id"])

        seg_id = f"seg-{event['id']}-evidence"
        if seg_id not in segment_ids:
            segments.append(
                {
                    "id": seg_id,
                    "sourceId": event["sourceId"],
                    "label": event["title"],
                    "excerpt": event["evidence"],
                    "yearHint": event["startYear"],
                }
            )
            segment_ids.add(seg_id)

        events.append(
            {
                "id": event["id"],
                "title": event["title"],
                "startYear": event["startYear"],
                "endYear": event["endYear"],
                "eventType": event["eventType"],
                "summary": event["summary"],
                "participantIds": participant_ids,
                "placeId": event["placeId"] if event["placeId"] in place_ids else None,
                "sourceSegmentId": seg_id,
                "confidence": event["confidence"],
                "tier": event["tier"],
            }
        )
        added_events += 1
        event_ids.add(event["id"])

        claim_id = f"clm-event-{event['id']}"
        if claim_id not in claim_ids:
            claims.append(
                {
                    "id": claim_id,
                    "subjectType": "event",
                    "subjectId": event["id"],
                    "predicate": "event-summary",
                    "value": event["summary"],
                    "startYear": event["startYear"],
                    "endYear": event["endYear"],
                    "confidence": {
                        "extraction": event["confidence"],
                        "resolution": 0.88,
                        "historical": "memoir-edition",
                    },
                    "status": "pending",
                    "sourceSegmentId": seg_id,
                    "notes": "Tier B chronology expansion (memoir-derived).",
                }
            )
            added_claims += 1
            claim_ids.add(claim_id)

    return added_events, added_claims


def add_missing_office_claims(dataset: Dict[str, Any]) -> int:
    people = dataset["people"]
    claims = dataset["claims"]

    existing = set()
    for claim in claims:
        if claim.get("predicate") != "office-term":
            continue
        value = claim.get("value")
        if not isinstance(value, dict):
            continue
        existing.add(
            (
                claim.get("subjectId"),
                str(value.get("title", "")).strip().lower(),
                value.get("startYear"),
                value.get("endYear"),
            )
        )

    added = 0
    for person in people:
        segment_ids = person.get("sourceSegmentIds") or [None]
        segment_id = segment_ids[0]
        for office in person.get("officeTerms", []):
            key = (
                person["id"],
                str(office.get("title", "")).strip().lower(),
                office.get("startYear"),
                office.get("endYear"),
            )
            if key in existing:
                continue

            title_slug = slug(str(office.get("title", "office"))) or "office"
            start = office.get("startYear") if office.get("startYear") is not None else "na"
            end = office.get("endYear") if office.get("endYear") is not None else "na"
            claim_id = f"clm-office-{person['id']}-tb-{title_slug}-{start}-{end}"

            claims.append(
                {
                    "id": claim_id,
                    "subjectType": "person",
                    "subjectId": person["id"],
                    "predicate": "office-term",
                    "value": office,
                    "startYear": office.get("startYear"),
                    "endYear": office.get("endYear"),
                    "confidence": {
                        "extraction": office.get("confidence", 0.78),
                        "resolution": 0.86,
                        "historical": "memoir-edition",
                    },
                    "status": "pending",
                    "sourceSegmentId": segment_id,
                    "notes": "Tier B office-depth expansion from memoir person gloss.",
                }
            )
            existing.add(key)
            added += 1

    return added


def build_disputes(dataset: Dict[str, Any]) -> List[Dict[str, Any]]:
    claims = dataset["claims"]
    segment_by_id = {segment["id"]: segment for segment in dataset["sourceSegments"]}
    disputes: List[Dict[str, Any]] = []
    seen = set()
    severity_order = {"high": 0, "medium": 1, "low": 2}
    reason_order = {"contested-framing": 0, "evidence-gap": 1, "low-confidence": 2}

    for claim in claims:
        claim_id = claim["id"]
        extraction = float(claim.get("confidence", {}).get("extraction", 0))
        notes = str(claim.get("notes", "")).lower()
        predicate = str(claim.get("predicate", "")).lower()
        subject_type = str(claim.get("subjectType", ""))
        source_segment_id = claim.get("sourceSegmentId")
        source_id = None
        if source_segment_id:
            source_id = segment_by_id.get(source_segment_id, {}).get("sourceId")
        source_ids = [source_id] if source_id else []
        is_tier_b_note = "tier b" in notes

        reasons: List[Tuple[str, str, str, str]] = []

        if extraction < 0.86:
            reasons.append(
                (
                    "low-confidence",
                    "high",
                    "Claim extraction confidence is below 0.86 and should be reviewed against passage context.",
                    "Verify wording against source segment and adjust confidence or claim scope.",
                )
            )
        elif extraction < 0.9 and (
            subject_type in {"relationship", "event"}
            or (subject_type == "person" and predicate == "office-term" and is_tier_b_note)
        ):
            reasons.append(
                (
                    "low-confidence",
                    "medium",
                    "Claim extraction confidence is below Tier B threshold (0.90) for a high-impact claim.",
                    "Check whether claim should remain pending or be narrowed to a tighter statement.",
                )
            )

        is_validation_note = "validate" in notes
        is_manual_relation_note = "manual seed relation" in notes
        is_seed_chronology_note = "seed chronology" in notes or "tier b chronology expansion" in notes
        high_impact_relation = (
            subject_type == "relationship"
            and re.search(
                r"political-rivals|regency|protector|confidant|political-collaborators|adoptive-mother-son",
                predicate,
            )
            is not None
        )
        high_impact_event = (
            subject_type == "event"
            and (
                "tier b chronology expansion" in notes
                or extraction < 0.9
                or re.search(r"regency|dynastic-crisis|political-persecution|factional", predicate)
                is not None
            )
        )

        if (
            is_validation_note
            or (is_manual_relation_note and high_impact_relation)
            or (is_seed_chronology_note and high_impact_event)
        ):
            reasons.append(
                (
                    "evidence-gap",
                    "medium",
                    "Claim notes indicate manual seeding or explicit validation requirement on a high-impact claim.",
                    "Open the evidence passage and confirm citation fidelity before approval.",
                )
            )

        contested_match = re.search(
            r"political-rivals|regency|protector|confidant|political-collaborators",
            predicate,
        )
        if subject_type == "relationship" and contested_match:
            reasons.append(
                (
                    "contested-framing",
                    "high" if re.search(r"political-rivals|regency", predicate) else "medium",
                    "Political relationship framing may be perspective-bound within memoir rhetoric.",
                    "Compare adjacent memoir chapters and mark as resolved only with stable wording.",
                )
            )

        if not reasons:
            continue

        reasons.sort(
            key=lambda row: (
                severity_order.get(row[1], 9),
                reason_order.get(row[0], 9),
            )
        )
        reason_type, severity, summary, action = reasons[0]
        dispute_id = f"dsp-{claim_id}-{reason_type}"
        if dispute_id in seen:
            continue
        seen.add(dispute_id)
        disputes.append(
            {
                "id": dispute_id,
                "claimId": claim_id,
                "subjectType": claim.get("subjectType"),
                "subjectId": claim.get("subjectId"),
                "reasonType": reason_type,
                "severity": severity,
                "summary": summary,
                "sourceIds": source_ids,
                "sourceSegmentId": source_segment_id,
                "status": "open",
                "suggestedAction": action,
            }
        )

    disputes.sort(
        key=lambda row: (
            severity_order.get(str(row.get("severity")), 3),
            str(row.get("subjectType", "")),
            str(row.get("claimId", "")),
        )
    )
    return disputes


def enrich_relationship_tiers(dataset: Dict[str, Any]) -> None:
    people_by_id = {person["id"]: person for person in dataset["people"]}
    for rel in dataset["relationships"]:
        source_tier = people_by_id.get(rel.get("sourcePersonId"), {}).get("tier")
        target_tier = people_by_id.get(rel.get("targetPersonId"), {}).get("tier")
        if source_tier == "B" or target_tier == "B":
            if rel.get("tier") == "A":
                rel["tier"] = "B"


def main() -> None:
    if not TIER_A_PATH.exists():
        raise FileNotFoundError(f"Missing Tier A dataset at {TIER_A_PATH}")

    dataset = json.loads(TIER_A_PATH.read_text(encoding="utf-8"))
    if not isinstance(dataset, dict):
        raise ValueError("Tier A dataset root is not an object.")

    add_spatial_data(dataset["places"])
    added_offices = add_tier_b_offices(dataset["people"])
    office_claims = add_missing_office_claims(dataset)
    added_events, event_claims = add_tier_b_events(dataset)
    enrich_relationship_tiers(dataset)

    dataset["disputes"] = build_disputes(dataset)
    dataset["meta"]["schemaVersion"] = "0.2.0"
    dataset["meta"]["dataset"] = "hyegyong-tier-b"
    dataset["meta"]["generatedAt"] = datetime.now(timezone.utc).isoformat()
    dataset["meta"]["generator"] = "scripts/build_tier_b_data.py"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {OUTPUT_PATH}")
    print(
        "Tier B additions -> offices: {offices}, officeClaims: {office_claims}, events: {events}, eventClaims: {event_claims}, disputes: {disputes}".format(
            offices=added_offices,
            office_claims=office_claims,
            events=added_events,
            event_claims=event_claims,
            disputes=len(dataset["disputes"]),
        )
    )


if __name__ == "__main__":
    main()
