#!/usr/bin/env python3
"""Build Tier A seed dataset for Hyegyong Atlas from extracted references."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REFERENCES_DIR = PROJECT_ROOT / "references"
OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "tier-a.json"

PRINCIPAL_PATH = REFERENCES_DIR / "principal-persons.md"
MEMOIR_FLOW_PATH = REFERENCES_DIR / "memoir-flow.md"
YEAR_INDEX_PATH = REFERENCES_DIR / "year-index.md"

TIER_A_NAMES = {
    "LADY HYEGYŎNG",
    "PRINCE SADO",
    "KING YŎNGJO",
    "KING CHŎNGJO",
    "KING SUNJO",
    "HONG PONGHAN",
    "HONG NAGIM",
    "QUEEN CHŎNGSUN",
    "LADY SŎNHŬI",
    "PRINCESS HWAWAN",
    "CHŎNG HUGYŎM",
    "QUEEN DOWAGER INWŎN",
    "QUEEN CHŎNGSŎNG",
    "QUEEN HYOŬI",
    "LADY KASUN",
    "HONG KUGYŎNG",
    "KIM KWIJU",
    "KIM CHONGSU",
    "MADAME YI",
    "PINGAE",
    "PRINCESS HWAP’YŎNG",
}

ALIAS_SEED = {
    "KING CHŎNGJO": ["Grand Heir", "the King", "the late King"],
    "KING SUNJO": ["the present King", "the young King"],
    "KING YŎNGJO": ["His Majesty"],
    "PRINCESS HWAWAN": ["Madame Chŏng"],
    "LADY HYEGYŎNG": ["Hyegyonggung Hong Ssi"],
    "PRINCE SADO": ["Crown Prince Sado"],
}

MANUAL_OFFICES = {
    "LADY HYEGYŎNG": [
        {
            "title": "Crown Princess Consort",
            "startYear": 1744,
            "endYear": 1762,
            "confidence": 0.95,
            "source": "src_principal_people",
        }
    ],
    "PRINCE SADO": [
        {
            "title": "Heir Apparent (Crown Prince)",
            "startYear": 1736,
            "endYear": 1762,
            "confidence": 0.95,
            "source": "src_principal_people",
        },
        {
            "title": "Prince-Regent",
            "startYear": 1749,
            "endYear": 1762,
            "confidence": 0.9,
            "source": "src_principal_people",
        },
    ],
    "KING YŎNGJO": [
        {
            "title": "King of Joseon",
            "startYear": 1724,
            "endYear": 1776,
            "confidence": 0.95,
            "source": "src_principal_people",
        }
    ],
    "KING CHŎNGJO": [
        {
            "title": "Crown Prince",
            "startYear": 1762,
            "endYear": 1776,
            "confidence": 0.95,
            "source": "src_principal_people",
        },
        {
            "title": "Regent",
            "startYear": 1775,
            "endYear": 1776,
            "confidence": 0.92,
            "source": "src_principal_people",
        },
        {
            "title": "King of Joseon",
            "startYear": 1776,
            "endYear": 1800,
            "confidence": 0.95,
            "source": "src_principal_people",
        },
    ],
    "KING SUNJO": [
        {
            "title": "King of Joseon",
            "startYear": 1800,
            "endYear": 1834,
            "confidence": 0.95,
            "source": "src_principal_people",
        }
    ],
    "QUEEN CHŎNGSUN": [
        {
            "title": "Queen Consort",
            "startYear": 1759,
            "endYear": 1776,
            "confidence": 0.9,
            "source": "src_principal_people",
        },
        {
            "title": "Dowager Regent",
            "startYear": 1800,
            "endYear": 1804,
            "confidence": 0.95,
            "source": "src_principal_people",
        },
    ],
    "HONG PONGHAN": [
        {
            "title": "Senior Court Official",
            "startYear": 1744,
            "endYear": 1778,
            "confidence": 0.8,
            "source": "src_principal_people",
        }
    ],
}

MANUAL_RELATIONSHIPS = [
    {
        "source": "LADY HYEGYŎNG",
        "target": "PRINCE SADO",
        "type": "spouse",
        "startYear": 1744,
        "endYear": 1762,
        "summary": "Marriage formed the core dynastic tie between the Hong family and the royal line.",
        "confidence": 0.96,
    },
    {
        "source": "LADY HYEGYŎNG",
        "target": "KING CHŎNGJO",
        "type": "mother-son",
        "startYear": 1752,
        "endYear": 1800,
        "summary": "Hyegyong's son Jeongjo became central to her political and personal survival.",
        "confidence": 0.97,
    },
    {
        "source": "LADY HYEGYŎNG",
        "target": "KING SUNJO",
        "type": "grandmother-grandson",
        "startYear": 1790,
        "endYear": 1815,
        "summary": "Late memoirs are explicitly addressed to Sunjo as dynastic testimony.",
        "confidence": 0.95,
    },
    {
        "source": "LADY HYEGYŎNG",
        "target": "HONG PONGHAN",
        "type": "daughter-father",
        "startYear": 1735,
        "endYear": 1778,
        "summary": "Hyegyong repeatedly frames her life through filial ties to her father.",
        "confidence": 0.96,
    },
    {
        "source": "LADY HYEGYŎNG",
        "target": "MADAME YI",
        "type": "daughter-mother",
        "startYear": 1735,
        "endYear": 1755,
        "summary": "Her mother's death becomes a major emotional and narrative turning point.",
        "confidence": 0.95,
    },
    {
        "source": "PRINCE SADO",
        "target": "KING YŎNGJO",
        "type": "son-father",
        "startYear": 1735,
        "endYear": 1762,
        "summary": "The father-son rupture drives the Imo-year catastrophe.",
        "confidence": 0.96,
    },
    {
        "source": "PRINCE SADO",
        "target": "LADY SŎNHŬI",
        "type": "son-mother",
        "startYear": 1735,
        "endYear": 1762,
        "summary": "Lady Sŏnhŭi is a key maternal and court figure in Sado-era narrative episodes.",
        "confidence": 0.9,
    },
    {
        "source": "KING CHŎNGJO",
        "target": "KING YŎNGJO",
        "type": "grandson-grandfather",
        "startYear": 1752,
        "endYear": 1776,
        "summary": "Jeongjo's succession is shaped by his grandfather's court and decisions.",
        "confidence": 0.92,
    },
    {
        "source": "KING CHŎNGJO",
        "target": "QUEEN HYOŬI",
        "type": "spouse",
        "startYear": 1762,
        "endYear": 1800,
        "summary": "Jeongjo's queen from the Kim lineage appears in succession and court context.",
        "confidence": 0.9,
    },
    {
        "source": "KING CHŎNGJO",
        "target": "LADY KASUN",
        "type": "consort",
        "startYear": 1787,
        "endYear": 1800,
        "summary": "Lady Kasun bears Sunjo and becomes central in late-dynastic continuity.",
        "confidence": 0.92,
    },
    {
        "source": "KING SUNJO",
        "target": "LADY KASUN",
        "type": "son-mother",
        "startYear": 1790,
        "endYear": 1834,
        "summary": "Sunjo's maternal line becomes key during minority rule and regency politics.",
        "confidence": 0.93,
    },
    {
        "source": "KING SUNJO",
        "target": "QUEEN CHŎNGSUN",
        "type": "regency",
        "startYear": 1800,
        "endYear": 1804,
        "summary": "Queen Chŏngsun ruled as dowager regent during Sunjo's minority.",
        "confidence": 0.96,
    },
    {
        "source": "QUEEN CHŎNGSUN",
        "target": "KIM KWIJU",
        "type": "siblings",
        "startYear": 1745,
        "endYear": 1786,
        "summary": "Kim Kwiju's factional activity is tied to Queen Chŏngsun's family network.",
        "confidence": 0.9,
    },
    {
        "source": "PRINCESS HWAWAN",
        "target": "CHŎNG HUGYŎM",
        "type": "adoptive-mother-son",
        "startYear": 1750,
        "endYear": 1776,
        "summary": "Hugyŏm's power rose through Princess Hwawan's position at court.",
        "confidence": 0.92,
    },
    {
        "source": "HONG PONGHAN",
        "target": "HONG NAGIM",
        "type": "father-son",
        "startYear": 1741,
        "endYear": 1778,
        "summary": "Hong Nagim was Hyegyong's third brother and central in late memoir politics.",
        "confidence": 0.9,
    },
    {
        "source": "LADY HYEGYŎNG",
        "target": "HONG NAGIM",
        "type": "siblings",
        "startYear": 1741,
        "endYear": 1801,
        "summary": "Hong Nagim's execution in 1801 is a major trauma in late memoirs.",
        "confidence": 0.93,
    },
    {
        "source": "LADY HYEGYŎNG",
        "target": "QUEEN CHŎNGSUN",
        "type": "political-rivals",
        "startYear": 1800,
        "endYear": 1804,
        "summary": "Hyegyong frames the regency years as a period of intensified persecution.",
        "confidence": 0.85,
    },
    {
        "source": "HONG PONGHAN",
        "target": "KING CHŎNGJO",
        "type": "protector",
        "startYear": 1762,
        "endYear": 1778,
        "summary": "Hong Ponghan appears as a protector of Jeongjo after the 1762 crisis.",
        "confidence": 0.88,
    },
    {
        "source": "HONG KUGYŎNG",
        "target": "KING CHŎNGJO",
        "type": "confidant",
        "startYear": 1776,
        "endYear": 1781,
        "summary": "Hong Kugyŏng consolidated early Jeongjo authority before his own fall.",
        "confidence": 0.9,
    },
    {
        "source": "KIM CHONGSU",
        "target": "HONG KUGYŎNG",
        "type": "political-collaborators",
        "startYear": 1776,
        "endYear": 1781,
        "summary": "Kim Chongsu collaborated with and later turned against Hong Kugyŏng.",
        "confidence": 0.88,
    },
    {
        "source": "KIM KWIJU",
        "target": "HONG PONGHAN",
        "type": "political-rivals",
        "startYear": 1760,
        "endYear": 1778,
        "summary": "The Kim-Hong rivalry is a recurrent political axis in the memoirs.",
        "confidence": 0.86,
    },
]

MANUAL_PLACES = [
    {
        "id": "pl-changdeok",
        "name": "Ch'angdŏk Palace",
        "type": "palace",
        "summary": "Primary Joseon palace setting for many inner-court events in the memoir narrative.",
        "modern": "Seoul",
        "confidence": 0.8,
    },
    {
        "id": "pl-changgyeong",
        "name": "Ch'anggyŏng Palace",
        "type": "palace",
        "summary": "Frequent setting for royal residences, mourning spaces, and political tensions.",
        "modern": "Seoul",
        "confidence": 0.8,
    },
    {
        "id": "pl-choseung-pavilion",
        "name": "Chŏsŭng Pavilion",
        "type": "palace-building",
        "summary": "Prince Sado's early residence, presented as formative in the 1805 memoir.",
        "modern": "Palace precinct (historic)",
        "confidence": 0.9,
    },
    {
        "id": "pl-hyeollyung",
        "name": "Hyŏllyung Tomb",
        "type": "tomb",
        "summary": "Reinterment site for Prince Sado, central to Jeongjo's filial statecraft.",
        "modern": "Suwon",
        "confidence": 0.9,
    },
    {
        "id": "pl-hwaseong",
        "name": "Hwasŏng",
        "type": "fortress-city",
        "summary": "Jeongjo's monumental urban and memorial project linked to Sado's tomb.",
        "modern": "Suwon",
        "confidence": 0.9,
    },
    {
        "id": "pl-kopyeong",
        "name": "Kop'yŏng-dong",
        "type": "residence",
        "summary": "Hyegyong's stated birthplace in the 1795 memoir opening.",
        "modern": "Seoul (historic district)",
        "confidence": 0.92,
    },
]

MANUAL_EVENTS = [
    {
        "id": "evt-1735-birth-hyegyong",
        "title": "Birth of Lady Hyegyŏng",
        "startYear": 1735,
        "endYear": 1735,
        "type": "personal",
        "summary": "Hyegyong records her birth at Kop'yŏng-dong, opening her life chronology.",
        "participants": ["LADY HYEGYŎNG", "HONG PONGHAN", "MADAME YI"],
        "place": "pl-kopyeong",
        "source": "src_1795",
        "evidence": "I was born ... in the ... ŭlmyo year (1735).",
        "confidence": 0.95,
    },
    {
        "id": "evt-1744-marriage",
        "title": "Hyegyŏng selected and married into the palace",
        "startYear": 1744,
        "endYear": 1744,
        "type": "dynastic",
        "summary": "Hyegyong is selected as bride of Crown Prince Sado and enters palace life.",
        "participants": ["LADY HYEGYŎNG", "PRINCE SADO", "KING YŎNGJO"],
        "place": "pl-changdeok",
        "source": "src_1795",
        "evidence": "... it was I who was selected as the bride of the Crown Prince.",
        "confidence": 0.95,
    },
    {
        "id": "evt-1752-birth-jeongjo",
        "title": "Birth of Jeongjo",
        "startYear": 1752,
        "endYear": 1752,
        "type": "dynastic",
        "summary": "Prince Sado and Lady Hyegyong's son is born; he later reigns as Jeongjo.",
        "participants": ["KING CHŎNGJO", "LADY HYEGYŎNG", "PRINCE SADO"],
        "place": "pl-changgyeong",
        "source": "src_principal_people",
        "evidence": "Prince Sado's son born of Lady Hyegyŏng in 1752.",
        "confidence": 0.94,
    },
    {
        "id": "evt-1757-double-loss",
        "title": "Deaths of Queen Chŏngsŏng and Queen Dowager Inwŏn",
        "startYear": 1757,
        "endYear": 1757,
        "type": "court",
        "summary": "Two key senior queens die in close succession, deepening court instability.",
        "participants": ["QUEEN CHŎNGSŎNG", "QUEEN DOWAGER INWŎN", "PRINCE SADO", "KING YŎNGJO"],
        "place": "pl-changgyeong",
        "source": "src_1805",
        "evidence": "The Two Highnesses' passing ... left the palace empty and desolate.",
        "confidence": 0.89,
    },
    {
        "id": "evt-1761-pingae-killed",
        "title": "Pingae killed during Sado's violent decline",
        "startYear": 1761,
        "endYear": 1761,
        "type": "court",
        "summary": "Pingae, Sado's favored consort, is killed amid escalating disorder.",
        "participants": ["PINGAE", "PRINCE SADO", "LADY HYEGYŎNG"],
        "place": "pl-changgyeong",
        "source": "src_principal_people",
        "evidence": "In 1761 Sado, in madness, beat her to death.",
        "confidence": 0.93,
    },
    {
        "id": "evt-1762-imo-tragedy",
        "title": "Imo-year tragedy (death of Prince Sado)",
        "startYear": 1762,
        "endYear": 1762,
        "type": "dynastic-crisis",
        "summary": "Sado is ordered into the rice chest and dies; memoir tradition revolves around this rupture.",
        "participants": ["PRINCE SADO", "KING YŎNGJO", "LADY HYEGYŎNG", "KING CHŎNGJO"],
        "place": "pl-changdeok",
        "source": "src_1805",
        "evidence": "The tragedy of the imo year (1762) is unparalleled.",
        "confidence": 0.98,
    },
    {
        "id": "evt-1776-jeongjo-accession",
        "title": "Jeongjo accedes to throne",
        "startYear": 1776,
        "endYear": 1776,
        "type": "dynastic",
        "summary": "Following Yŏngjo's death, Jeongjo's accession reshapes factional alignments.",
        "participants": ["KING CHŎNGJO", "KING YŎNGJO", "LADY HYEGYŎNG"],
        "place": "pl-changdeok",
        "source": "src_principal_people",
        "evidence": "... succeeded to the throne in 1776 upon the death of Yŏngjo.",
        "confidence": 0.95,
    },
    {
        "id": "evt-1789-reinterment",
        "title": "Reinterment of Sado at Hyŏllyung",
        "startYear": 1789,
        "endYear": 1789,
        "type": "memorial-statecraft",
        "summary": "Jeongjo moves Sado's tomb, initiating a major filial-political project.",
        "participants": ["KING CHŎNGJO", "LADY HYEGYŎNG", "PRINCE SADO"],
        "place": "pl-hyeollyung",
        "source": "src_1802",
        "evidence": "... he carried out reinterment, changing the name of the tomb to Hyŏllyung Tomb.",
        "confidence": 0.94,
    },
    {
        "id": "evt-1795-hwaseong-visit",
        "title": "1795 Hwasŏng visit and public filial ceremonies",
        "startYear": 1795,
        "endYear": 1795,
        "type": "memorial-statecraft",
        "summary": "Jeongjo takes Hyegyong to Sado's tomb and stages large commemorative ceremonies.",
        "participants": ["KING CHŎNGJO", "LADY HYEGYŎNG"],
        "place": "pl-hwaseong",
        "source": "src_1802",
        "evidence": "In the spring of ŭlmyo (1795), he took me to the Prince's tomb ...",
        "confidence": 0.93,
    },
    {
        "id": "evt-1800-jeongjo-death",
        "title": "Death of Jeongjo and accession of Sunjo",
        "startYear": 1800,
        "endYear": 1800,
        "type": "dynastic",
        "summary": "Jeongjo's death creates a regency period and a crisis phase in late memoirs.",
        "participants": ["KING CHŎNGJO", "KING SUNJO", "QUEEN CHŎNGSUN", "LADY HYEGYŎNG"],
        "place": "pl-changdeok",
        "source": "src_principal_people",
        "evidence": "King Chŏngjo ... died in 1800.",
        "confidence": 0.95,
    },
    {
        "id": "evt-1801-execution-hong-nagim",
        "title": "Execution of Hong Nagim",
        "startYear": 1801,
        "endYear": 1801,
        "type": "political-persecution",
        "summary": "Hyegyong's third brother is executed, central to the 1802 memoir's tone.",
        "participants": ["HONG NAGIM", "LADY HYEGYŎNG", "KING SUNJO"],
        "place": "pl-changdeok",
        "source": "src_principal_people",
        "evidence": "In 1801, he was accused of having converted to Catholicism, and executed.",
        "confidence": 0.9,
    },
    {
        "id": "evt-1802-memoir",
        "title": "Memoir of 1802 composed for future vindication",
        "startYear": 1802,
        "endYear": 1802,
        "type": "textual",
        "summary": "Hyegyong writes to preserve testimony for Sunjo and future redress.",
        "participants": ["LADY HYEGYŎNG", "KING SUNJO", "LADY KASUN"],
        "place": "pl-changdeok",
        "source": "src_1802",
        "evidence": "... I will entrust these writings to Lady Kasun ... after my death.",
        "confidence": 0.93,
    },
    {
        "id": "evt-1805-memoir",
        "title": "Memoir of 1805 finalized",
        "startYear": 1805,
        "endYear": 1805,
        "type": "textual",
        "summary": "Hyegyong's final memoir presents a full account of the 1762 catastrophe.",
        "participants": ["LADY HYEGYŎNG", "KING SUNJO", "PRINCE SADO", "KING YŎNGJO"],
        "place": "pl-changdeok",
        "source": "src_1805",
        "evidence": "... resisting death and weeping blood, I wrote this record.",
        "confidence": 0.94,
    },
]


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    stripped = stripped.lower()
    stripped = re.sub(r"[^a-z0-9]+", " ", stripped)
    return " ".join(stripped.split())


def slug(value: str) -> str:
    value = normalize_text(value)
    value = value.replace(" ", "-")
    return value.strip("-")


def parse_year_value(token: str) -> Optional[int]:
    token = token.strip()
    if token.isdigit():
        return int(token)
    return None


def parse_life(life: str) -> Dict[str, Optional[int]]:
    out: Dict[str, Optional[int]] = {
        "birthYear": None,
        "deathYear": None,
        "reignStartYear": None,
        "reignEndYear": None,
    }

    cleaned = life.strip()
    if cleaned.startswith("r."):
        years = re.findall(r"(\d{4})", cleaned)
        if len(years) >= 2:
            out["reignStartYear"] = int(years[0])
            out["reignEndYear"] = int(years[1])
        return out

    if cleaned.startswith("d."):
        year = re.search(r"(\d{4})", cleaned)
        if year:
            out["deathYear"] = int(year.group(1))
        return out

    if cleaned.lower() in {"dates unknown", "date unknown"}:
        return out

    span = re.search(r"(\d{4})\s*[–-]\s*(\d{4}|\?)", cleaned)
    if span:
        out["birthYear"] = int(span.group(1))
        if span.group(2).isdigit():
            out["deathYear"] = int(span.group(2))
        return out

    years = re.findall(r"(\d{4})", cleaned)
    if len(years) == 1:
        out["birthYear"] = int(years[0])
    return out


def parse_principal_people() -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    lines = PRINCIPAL_PATH.read_text(encoding="utf-8").splitlines()
    people: List[Dict[str, Any]] = []
    alias_redirects: Dict[str, str] = {}
    category = "Uncategorized"

    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue

        content = stripped[2:].strip()
        if not content:
            continue

        if content.isupper() and content.startswith("THE "):
            category = content.replace("THE ", "").title()
            continue

        see_match = re.match(r"([^\.]+)\.\s*See\s+([^\.]+)\.?$", content)
        if see_match:
            alias_redirects[see_match.group(1).strip()] = see_match.group(2).strip()
            continue

        entry_match = re.match(r"([^\.\(]+?)\s*\(([^\)]+)\)\.\s*(.+)$", content)
        if not entry_match:
            continue

        name = entry_match.group(1).strip()
        life = entry_match.group(2).strip()
        biography = entry_match.group(3).strip()

        life_parts = parse_life(life)

        relation_match = re.search(r"Lady Hyegy[ŏo]ng.?s\s+([^\.]+)", biography, re.IGNORECASE)
        relation_to_hyegyong = relation_match.group(1).strip() if relation_match else None

        person = {
            "id": "",
            "canonicalName": name,
            "group": category,
            "lifeLabel": life,
            "birthYear": life_parts["birthYear"],
            "deathYear": life_parts["deathYear"],
            "reignStartYear": life_parts["reignStartYear"],
            "reignEndYear": life_parts["reignEndYear"],
            "biography": biography,
            "relationToHyegyong": relation_to_hyegyong,
            "tier": "C",
            "aliases": [],
            "officeTerms": [],
            "sourceSegmentIds": [],
        }
        people.append(person)

    people.sort(key=lambda p: normalize_text(p["canonicalName"]))

    for index, person in enumerate(people, start=1):
        person["id"] = f"person-{index:03d}"
        if person["canonicalName"] in TIER_A_NAMES:
            person["tier"] = "A"
        elif person["group"] in {"Yi Royal Family", "Hong Family"}:
            person["tier"] = "B"
        else:
            person["tier"] = "C"

    return people, alias_redirects


def parse_year_index() -> List[Dict[str, Any]]:
    lines = YEAR_INDEX_PATH.read_text(encoding="utf-8").splitlines()
    rows: List[Dict[str, Any]] = []
    for line in lines:
        if not line.startswith("| "):
            continue
        if "---" in line or "Year" in line:
            continue

        parts = [cell.strip() for cell in line.strip("|").split("|")]
        if len(parts) < 3:
            continue
        year = parse_year_value(parts[0])
        if year is None:
            continue
        count_token = re.search(r"(\d+)", parts[1])
        if not count_token:
            continue
        rows.append(
            {
                "year": year,
                "count": int(count_token.group(1)),
                "appearsIn": [piece.strip() for piece in parts[2].split(";")],
            }
        )
    return rows


def parse_memoir_flow() -> Dict[str, Dict[str, Any]]:
    text = MEMOIR_FLOW_PATH.read_text(encoding="utf-8")
    memoirs: Dict[str, Dict[str, Any]] = {}

    blocks = re.split(r"\n##\s+\d+\.\s+", text)
    for block in blocks[1:]:
        lines = [ln.strip() for ln in block.strip().splitlines() if ln.strip()]
        if not lines:
            continue
        title = lines[0]
        source = None
        year_range = None
        opening = None
        for ln in lines[1:]:
            if ln.startswith("- Source:"):
                source = ln.replace("- Source:", "").strip().strip("`")
            elif ln.startswith("- Year range in text:"):
                year_range = ln.replace("- Year range in text:", "").strip()
            elif ln.startswith("- Opening movement:"):
                opening = ln.replace("- Opening movement:", "").strip()

        memoirs[title] = {
            "source": source,
            "yearRangeLabel": year_range,
            "openingMovement": opening,
        }

    return memoirs


def make_sources(memoir_flow: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    sources = [
        {
            "id": "src_principal_people",
            "label": "Principal Persons",
            "path": "references/principal-persons.md",
            "edition": "The Memoirs of Lady Hyegyong (UC Press, 2013 ebook)",
        },
        {
            "id": "src_year_index",
            "label": "Year Index",
            "path": "references/year-index.md",
            "edition": "Generated from memoir chapters",
        },
        {
            "id": "src_memoir_flow",
            "label": "Memoir Flow Guide",
            "path": "references/memoir-flow.md",
            "edition": "Generated from memoir chapters",
        },
    ]

    source_map = {
        "The Memoir of 1795": "src_1795",
        "The Memoir of 1801": "src_1801",
        "The Memoir of 1802": "src_1802",
        "The Memoir of 1805": "src_1805",
    }

    for title, source_id in source_map.items():
        chapter_path = memoir_flow.get(title, {}).get("source")
        sources.append(
            {
                "id": source_id,
                "label": title,
                "path": chapter_path or "",
                "edition": "Memoir chapter",
            }
        )

    return sources


def person_lookup(people: List[Dict[str, Any]]) -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    for person in people:
        lookup[normalize_text(person["canonicalName"])] = person["id"]
    return lookup


def attach_aliases(people: List[Dict[str, Any]], alias_redirects: Dict[str, str]) -> None:
    by_name = {normalize_text(p["canonicalName"]): p for p in people}

    for canonical_name, aliases in ALIAS_SEED.items():
        person = by_name.get(normalize_text(canonical_name))
        if not person:
            continue
        for alias in aliases:
            person["aliases"].append(
                {
                    "id": f"alias-{person['id']}-{slug(alias)}",
                    "text": alias,
                    "language": "en",
                    "script": "latin",
                    "type": "title-reference",
                    "startYear": None,
                    "endYear": None,
                    "confidence": 0.82,
                }
            )

    for alias_name, target_name in alias_redirects.items():
        target = by_name.get(normalize_text(target_name))
        if not target:
            continue
        target["aliases"].append(
            {
                "id": f"alias-{target['id']}-{slug(alias_name)}",
                "text": alias_name,
                "language": "en",
                "script": "latin",
                "type": "cross-reference",
                "startYear": None,
                "endYear": None,
                "confidence": 0.95,
            }
        )


def attach_offices(people: List[Dict[str, Any]]) -> None:
    by_name = {normalize_text(p["canonicalName"]): p for p in people}
    for name, offices in MANUAL_OFFICES.items():
        person = by_name.get(normalize_text(name))
        if not person:
            continue
        person["officeTerms"].extend(offices)


def build_source_segments(
    people: List[Dict[str, Any]], memoir_flow: Dict[str, Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    segments: List[Dict[str, Any]] = []
    principal_lines = PRINCIPAL_PATH.read_text(encoding="utf-8").splitlines()
    raw_by_name: Dict[str, str] = {}

    for line in principal_lines:
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        content = stripped[2:].strip()
        if "." not in content:
            continue
        if content.upper().startswith("THE "):
            continue
        name = content.split(".", 1)[0]
        name = re.sub(r"\s*\([^\)]+\)$", "", name).strip()
        raw_by_name[normalize_text(name)] = content

    segment_map: Dict[str, str] = {}
    for person in people:
        key = normalize_text(person["canonicalName"])
        raw_line = raw_by_name.get(key)
        if not raw_line:
            continue

        segment_id = f"seg-{person['id']}-principal"
        segment = {
            "id": segment_id,
            "sourceId": "src_principal_people",
            "label": f"Principal Persons: {person['canonicalName']}",
            "excerpt": raw_line,
            "yearHint": person["birthYear"] or person["reignStartYear"],
        }
        segments.append(segment)
        segment_map[person["id"]] = segment_id

    for title, details in memoir_flow.items():
        segment_id = f"seg-{slug(title)}-opening"
        segments.append(
            {
                "id": segment_id,
                "sourceId": {
                    "The Memoir of 1795": "src_1795",
                    "The Memoir of 1801": "src_1801",
                    "The Memoir of 1802": "src_1802",
                    "The Memoir of 1805": "src_1805",
                }.get(title, "src_memoir_flow"),
                "label": f"{title}: Opening movement",
                "excerpt": details.get("openingMovement") or "",
                "yearHint": None,
            }
        )

    return segments, segment_map


def compute_active_range(person: Dict[str, Any]) -> Dict[str, Optional[int]]:
    candidates: List[int] = []
    for field in ("birthYear", "reignStartYear"):
        value = person.get(field)
        if isinstance(value, int):
            candidates.append(value)
    for office in person.get("officeTerms", []):
        if isinstance(office.get("startYear"), int):
            candidates.append(office["startYear"])

    start = min(candidates) if candidates else None

    end_candidates: List[int] = []
    for field in ("deathYear", "reignEndYear"):
        value = person.get(field)
        if isinstance(value, int):
            end_candidates.append(value)
    for office in person.get("officeTerms", []):
        if isinstance(office.get("endYear"), int):
            end_candidates.append(office["endYear"])

    end = max(end_candidates) if end_candidates else None
    return {"startYear": start, "endYear": end}


def build_relationships(
    people: List[Dict[str, Any]], source_segments: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    lookup = person_lookup(people)
    segment_by_person = {
        person["id"]: f"seg-{person['id']}-principal"
        for person in people
        if any(seg["id"] == f"seg-{person['id']}-principal" for seg in source_segments)
    }
    relationships: List[Dict[str, Any]] = []

    for rel in MANUAL_RELATIONSHIPS:
        source_id = lookup.get(normalize_text(rel["source"]))
        target_id = lookup.get(normalize_text(rel["target"]))
        if not source_id or not target_id:
            continue
        relation_id = f"rel-{source_id}-{target_id}-{slug(rel['type'])}"
        source_segment_id = segment_by_person.get(source_id) or segment_by_person.get(target_id)

        relationships.append(
            {
                "id": relation_id,
                "sourcePersonId": source_id,
                "targetPersonId": target_id,
                "relationType": rel["type"],
                "startYear": rel["startYear"],
                "endYear": rel["endYear"],
                "summary": rel["summary"],
                "confidence": rel["confidence"],
                "sourceSegmentId": source_segment_id,
                "tier": "A"
                if (
                    next((p for p in people if p["id"] == source_id), {}).get("tier") == "A"
                    or next((p for p in people if p["id"] == target_id), {}).get("tier") == "A"
                )
                else "B",
            }
        )

    return relationships


def build_events(
    people: List[Dict[str, Any]],
    source_segments: List[Dict[str, Any]],
    places: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    lookup = person_lookup(people)
    place_ids = {place["id"] for place in places}
    events: List[Dict[str, Any]] = []
    new_segments: List[Dict[str, Any]] = []

    for event in MANUAL_EVENTS:
        participant_ids = []
        for name in event["participants"]:
            person_id = lookup.get(normalize_text(name))
            if person_id:
                participant_ids.append(person_id)

        place_id = event["place"] if event["place"] in place_ids else None
        seg_id = f"seg-{event['id']}-evidence"
        new_segments.append(
            {
                "id": seg_id,
                "sourceId": event["source"],
                "label": event["title"],
                "excerpt": event["evidence"],
                "yearHint": event["startYear"],
            }
        )

        events.append(
            {
                "id": event["id"],
                "title": event["title"],
                "startYear": event["startYear"],
                "endYear": event["endYear"],
                "eventType": event["type"],
                "summary": event["summary"],
                "participantIds": participant_ids,
                "placeId": place_id,
                "sourceSegmentId": seg_id,
                "confidence": event["confidence"],
                "tier": "A",
            }
        )

    source_segments.extend(new_segments)
    return events, source_segments


def build_claims(
    people: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    claims: List[Dict[str, Any]] = []

    for person in people:
        seg_id = f"seg-{person['id']}-principal"
        claims.append(
            {
                "id": f"clm-person-biography-{person['id']}",
                "subjectType": "person",
                "subjectId": person["id"],
                "predicate": "biography",
                "value": person["biography"],
                "startYear": person["birthYear"] or person["reignStartYear"],
                "endYear": person["deathYear"] or person["reignEndYear"],
                "confidence": {
                    "extraction": 0.93,
                    "resolution": 0.95,
                    "historical": "memoir-edition",
                },
                "status": "pending",
                "sourceSegmentId": seg_id,
                "notes": "Auto-extracted from Principal Persons list.",
            }
        )

        for office_index, office in enumerate(person.get("officeTerms", []), start=1):
            claims.append(
                {
                    "id": f"clm-office-{person['id']}-{office_index}",
                    "subjectType": "person",
                    "subjectId": person["id"],
                    "predicate": "office-term",
                    "value": office,
                    "startYear": office.get("startYear"),
                    "endYear": office.get("endYear"),
                    "confidence": {
                        "extraction": office.get("confidence", 0.8),
                        "resolution": 0.9,
                        "historical": "memoir-edition",
                    },
                    "status": "pending",
                    "sourceSegmentId": seg_id,
                    "notes": "Seed office term for timeline exploration.",
                }
            )

    for rel in relationships:
        claims.append(
            {
                "id": f"clm-relationship-{rel['id']}",
                "subjectType": "relationship",
                "subjectId": rel["id"],
                "predicate": rel["relationType"],
                "value": rel["summary"],
                "startYear": rel["startYear"],
                "endYear": rel["endYear"],
                "confidence": {
                    "extraction": rel["confidence"],
                    "resolution": 0.9,
                    "historical": "memoir-edition",
                },
                "status": "pending",
                "sourceSegmentId": rel.get("sourceSegmentId"),
                "notes": "Manual seed relation; validate with chapter evidence during review.",
            }
        )

    for event in events:
        claims.append(
            {
                "id": f"clm-event-{event['id']}",
                "subjectType": "event",
                "subjectId": event["id"],
                "predicate": "event-summary",
                "value": event["summary"],
                "startYear": event["startYear"],
                "endYear": event["endYear"],
                "confidence": {
                    "extraction": event["confidence"],
                    "resolution": 0.9,
                    "historical": "memoir-edition",
                },
                "status": "pending",
                "sourceSegmentId": event.get("sourceSegmentId"),
                "notes": "Tier A seed chronology claim.",
            }
        )

    return claims


def main() -> None:
    people, alias_redirects = parse_principal_people()
    year_density = parse_year_index()
    memoir_flow = parse_memoir_flow()

    sources = make_sources(memoir_flow)

    attach_aliases(people, alias_redirects)
    attach_offices(people)

    source_segments, person_segment_map = build_source_segments(people, memoir_flow)

    for person in people:
        if person["id"] in person_segment_map:
            person["sourceSegmentIds"].append(person_segment_map[person["id"]])
        person["activeRange"] = compute_active_range(person)

    places = MANUAL_PLACES

    relationships = build_relationships(people, source_segments)
    events, source_segments = build_events(people, source_segments, places)
    claims = build_claims(people, relationships, events)

    years = [row["year"] for row in year_density]
    year_range = {
        "startYear": min(years) if years else 1689,
        "endYear": max(years) if years else 1805,
        "focusStart": 1735,
        "focusEnd": 1805,
    }

    dataset = {
        "meta": {
            "schemaVersion": "0.1.0",
            "dataset": "hyegyong-tier-a",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "generator": "scripts/build_tier_a_data.py",
            "sourceEdition": "The Memoirs of Lady Hyegyong (UC Press translation)",
            "languageCanonical": "en",
            "languageOverlays": ["ko"],
        },
        "yearRange": year_range,
        "yearDensity": year_density,
        "sources": sources,
        "sourceSegments": source_segments,
        "people": people,
        "places": places,
        "events": events,
        "relationships": relationships,
        "claims": claims,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {OUTPUT_PATH}")
    print(
        "Counts -> people: {people}, events: {events}, relationships: {rels}, claims: {claims}".format(
            people=len(people),
            events=len(events),
            rels=len(relationships),
            claims=len(claims),
        )
    )


if __name__ == "__main__":
    main()
