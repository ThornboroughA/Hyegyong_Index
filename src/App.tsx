import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import './App.css';
import type {
  Alias,
  Claim,
  ClaimStatus,
  Dataset,
  Event,
  LocalEdits,
  Person,
  Relationship,
  SourceSegment,
  Tier,
} from './types';
import { GLOSSARY_TERMS } from './glossary';

type TabId = 'overview' | 'people' | 'relationships' | 'family' | 'glossary' | 'editorial';

type ClaimView = Claim & {
  effectiveStatus: ClaimStatus;
  resolvedSubjectId: string;
  mergedFrom?: string;
};

type LinkPattern = {
  kind: 'person' | 'glossary';
  id: string;
  display: string;
  needle: string;
  needleLower: string;
  priority: number;
};

type LinkMatch = {
  kind: 'person' | 'glossary';
  id: string;
  start: number;
  end: number;
  priority: number;
};

const STORAGE_KEY = 'hyegyong-atlas-tier-a-edits-v1';

const EMPTY_EDITS: LocalEdits = {
  claimStatusOverrides: {},
  mergeMap: {},
  addedAliases: {},
  addedPeople: [],
  addedClaims: [],
};

function loadEdits(): LocalEdits {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_EDITS;
    const parsed = JSON.parse(raw) as LocalEdits;
    return {
      claimStatusOverrides: parsed.claimStatusOverrides ?? {},
      mergeMap: parsed.mergeMap ?? {},
      addedAliases: parsed.addedAliases ?? {},
      addedPeople: parsed.addedPeople ?? [],
      addedClaims: parsed.addedClaims ?? [],
    };
  } catch {
    return EMPTY_EDITS;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isYearInRange(year: number, start: number | null | undefined, end: number | null | undefined): boolean {
  if (start == null && end == null) return true;
  if (start != null && year < start) return false;
  if (end != null && year > end) return false;
  return true;
}

function short(text: string, max = 160): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function resolveMergedId(personId: string, mergeMap: Record<string, string>): string {
  const visited = new Set<string>();
  let current = personId;
  while (mergeMap[current] && !visited.has(current)) {
    visited.add(current);
    current = mergeMap[current];
  }
  return current;
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function sortPeople(a: Person, b: Person): number {
  const tierOrder: Record<Tier, number> = { A: 0, B: 1, C: 2 };
  if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
  return a.canonicalName.localeCompare(b.canonicalName);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordBoundaryChar(char: string | undefined): boolean {
  if (!char) return true;
  return !/[\p{L}\p{N}]/u.test(char);
}

function formatClaimValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    if ('title' in value && typeof (value as { title?: unknown }).title === 'string') {
      const office = value as { title: string; startYear?: number | null; endYear?: number | null };
      return `${office.title} (${office.startYear ?? '?'}-${office.endYear ?? '?'})`;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable value]';
    }
  }
  return String(value);
}

function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedYear, setSelectedYear] = useState(1762);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');

  const [personSearch, setPersonSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | Tier>('all');

  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | ClaimStatus>('pending');
  const [reviewSubjectFilter, setReviewSubjectFilter] = useState<'all' | 'person' | 'relationship' | 'event'>('all');
  const [glossarySearch, setGlossarySearch] = useState('');
  const [selectedGlossaryId, setSelectedGlossaryId] = useState<string>(GLOSSARY_TERMS[0]?.id ?? '');

  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  const [aliasPersonId, setAliasPersonId] = useState('');
  const [newAliasText, setNewAliasText] = useState('');
  const [newAliasType, setNewAliasType] = useState('editorial-note');

  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonBio, setNewPersonBio] = useState('');
  const [newPersonTier, setNewPersonTier] = useState<Tier>('C');
  const [newPersonStart, setNewPersonStart] = useState('');
  const [newPersonEnd, setNewPersonEnd] = useState('');

  const [edits, setEdits] = useState<LocalEdits>(() => loadEdits());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  }, [edits]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/data/tier-a.json');
        if (!response.ok) throw new Error(`Failed to load dataset (${response.status})`);
        const next = (await response.json()) as Dataset;
        if (cancelled) return;
        setDataset(next);
        const focus = clamp(1762, next.yearRange.startYear, next.yearRange.endYear);
        setSelectedYear(focus);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown data loading error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const sourceById = useMemo(() => {
    const map = new Map<string, Dataset['sources'][number]>();
    for (const source of dataset?.sources ?? []) map.set(source.id, source);
    return map;
  }, [dataset]);

  const segmentById = useMemo(() => {
    const map = new Map<string, SourceSegment>();
    for (const segment of dataset?.sourceSegments ?? []) map.set(segment.id, segment);
    return map;
  }, [dataset]);

  const placeById = useMemo(() => {
    const map = new Map<string, Dataset['places'][number]>();
    for (const place of dataset?.places ?? []) map.set(place.id, place);
    return map;
  }, [dataset]);

  const mergedSourceIds = useMemo(() => new Set(Object.keys(edits.mergeMap)), [edits.mergeMap]);

  const allPeopleLookup = useMemo(() => {
    const map = new Map<string, Person>();
    for (const person of dataset?.people ?? []) map.set(person.id, person);
    for (const person of edits.addedPeople) map.set(person.id, person);
    return map;
  }, [dataset?.people, edits.addedPeople]);

  const resolvePersonId = useCallback(
    (personId: string): string => resolveMergedId(personId, edits.mergeMap),
    [edits.mergeMap],
  );

  const people = useMemo(() => {
    if (!dataset) return [] as Person[];

    const combined: Person[] = [...dataset.people, ...edits.addedPeople]
      .filter((person) => !mergedSourceIds.has(person.id))
      .map((person) => ({
        ...person,
        aliases: uniqueBy(
          [...person.aliases, ...(edits.addedAliases[person.id] ?? [])],
          (alias) => `${alias.text.toLowerCase()}::${alias.type}`,
        ),
      }));

    const map = new Map(combined.map((person) => [person.id, person] as const));

    for (const [sourceId, targetIdRaw] of Object.entries(edits.mergeMap)) {
      const source = allPeopleLookup.get(sourceId);
      const targetId = resolvePersonId(targetIdRaw);
      const target = map.get(targetId);
      if (!source || !target) continue;

      const mergedAlias: Alias = {
        id: `alias-${target.id}-merged-${source.id}`,
        text: source.canonicalName,
        language: 'en',
        script: 'latin',
        type: 'merged-entity',
        startYear: source.activeRange.startYear,
        endYear: source.activeRange.endYear,
        confidence: 1,
      };

      const aliasList = uniqueBy([...target.aliases, mergedAlias, ...source.aliases], (alias) => {
        return `${alias.text.toLowerCase()}::${alias.type}`;
      });
      map.set(target.id, { ...target, aliases: aliasList });
    }

    return Array.from(map.values()).sort(sortPeople);
  }, [allPeopleLookup, dataset, edits.addedAliases, edits.addedPeople, edits.mergeMap, mergedSourceIds, resolvePersonId]);

  const peopleById = useMemo(() => {
    const map = new Map<string, Person>();
    for (const person of people) map.set(person.id, person);
    return map;
  }, [people]);

  const glossaryById = useMemo(() => {
    const map = new Map(GLOSSARY_TERMS.map((term) => [term.id, term] as const));
    return map;
  }, []);

  const selectedGlossaryTerm = selectedGlossaryId ? glossaryById.get(selectedGlossaryId) ?? null : null;

  const glossaryVisibleTerms = useMemo(() => {
    const query = glossarySearch.trim().toLowerCase();
    if (!query) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter((term) => {
      if (term.term.toLowerCase().includes(query)) return true;
      if (term.definition.toLowerCase().includes(query)) return true;
      return (term.aliases ?? []).some((alias) => alias.toLowerCase().includes(query));
    });
  }, [glossarySearch]);

  const linkPatterns = useMemo(() => {
    const patterns: LinkPattern[] = [];
    const seen = new Set<string>();

    const addPattern = (pattern: LinkPattern) => {
      const normalized = pattern.needle.trim().toLowerCase();
      if (!normalized) return;
      const dedupeKey = `${pattern.kind}::${pattern.id}::${normalized}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      patterns.push({
        ...pattern,
        needle: pattern.needle.trim(),
        needleLower: normalized,
      });
    };

    const skipTitleAlias = new Set(['the king', 'his majesty', 'the present king', 'the young king', 'the late king']);

    for (const person of people) {
      addPattern({
        kind: 'person',
        id: person.id,
        display: person.canonicalName,
        needle: person.canonicalName,
        needleLower: person.canonicalName.toLowerCase(),
        priority: 3,
      });
      for (const alias of person.aliases) {
        const aliasLower = alias.text.trim().toLowerCase();
        if (!aliasLower) continue;
        if (alias.type === 'title-reference' && skipTitleAlias.has(aliasLower)) continue;
        if (alias.text.trim().length < 4) continue;
        addPattern({
          kind: 'person',
          id: person.id,
          display: person.canonicalName,
          needle: alias.text,
          needleLower: aliasLower,
          priority: alias.type === 'cross-reference' ? 4 : 2,
        });
      }
    }

    for (const term of GLOSSARY_TERMS) {
      addPattern({
        kind: 'glossary',
        id: term.id,
        display: term.term,
        needle: term.term,
        needleLower: term.term.toLowerCase(),
        priority: 1,
      });
      for (const alias of term.aliases ?? []) {
        if (alias.trim().length < 4) continue;
        addPattern({
          kind: 'glossary',
          id: term.id,
          display: term.term,
          needle: alias,
          needleLower: alias.toLowerCase(),
          priority: 1,
        });
      }
    }

    return patterns.sort((a, b) => b.needle.length - a.needle.length);
  }, [people]);

  useEffect(() => {
    if (!people.length) return;
    if (!selectedPersonId || !peopleById.has(selectedPersonId)) {
      const fallback = people.find((p) => p.tier === 'A') ?? people[0];
      setSelectedPersonId(fallback.id);
      setAliasPersonId(fallback.id);
    }
  }, [people, peopleById, selectedPersonId]);

  const relationships = useMemo(() => {
    if (!dataset) return [] as Relationship[];

    const mapped = dataset.relationships
      .map((rel) => {
        const sourceId = resolvePersonId(rel.sourcePersonId);
        const targetId = resolvePersonId(rel.targetPersonId);
        if (sourceId === targetId) return null;
        if (!peopleById.has(sourceId) || !peopleById.has(targetId)) return null;
        return {
          ...rel,
          id: `${rel.id}::${sourceId}::${targetId}`,
          sourcePersonId: sourceId,
          targetPersonId: targetId,
        };
      })
      .filter((rel): rel is Relationship => rel !== null);

    return uniqueBy(mapped, (rel) => {
      const ordered = [rel.sourcePersonId, rel.targetPersonId].sort().join('::');
      return `${ordered}::${rel.relationType}`;
    });
  }, [dataset, peopleById, resolvePersonId]);

  const events = useMemo(() => {
    if (!dataset) return [] as Event[];

    return dataset.events.map((event) => ({
      ...event,
      participantIds: uniqueBy(
        event.participantIds
          .map((personId) => resolvePersonId(personId))
          .filter((personId) => peopleById.has(personId)),
        (id) => id,
      ),
    }));
  }, [dataset, peopleById, resolvePersonId]);

  const claims = useMemo(() => {
    if (!dataset) return [] as ClaimView[];

    const combined = [...dataset.claims, ...edits.addedClaims];
    const next: ClaimView[] = [];

    for (const claim of combined) {
      let resolvedSubjectId = claim.subjectId;
      let mergedFrom: string | undefined;

      if (claim.subjectType === 'person') {
        resolvedSubjectId = resolvePersonId(claim.subjectId);
        if (!peopleById.has(resolvedSubjectId)) continue;
        if (resolvedSubjectId !== claim.subjectId) mergedFrom = claim.subjectId;
      }

      const effectiveStatus = edits.claimStatusOverrides[claim.id] ?? claim.status;

      next.push({
        ...claim,
        resolvedSubjectId,
        mergedFrom,
        effectiveStatus,
      });
    }

    return next;
  }, [dataset, edits.addedClaims, edits.claimStatusOverrides, peopleById, resolvePersonId]);

  const claimsById = useMemo(() => {
    const map = new Map<string, ClaimView>();
    for (const claim of claims) map.set(claim.id, claim);
    return map;
  }, [claims]);

  useEffect(() => {
    if (!selectedClaimId) return;
    if (!claimsById.has(selectedClaimId)) setSelectedClaimId('');
  }, [claimsById, selectedClaimId]);

  const selectedPerson = selectedPersonId ? peopleById.get(selectedPersonId) ?? null : null;

  const hyegyong = useMemo(
    () => people.find((person) => person.canonicalName === 'LADY HYEGYŎNG') ?? null,
    [people],
  );

  const hyegyongAge = hyegyong?.birthYear ? selectedYear - hyegyong.birthYear : null;

  const activePeopleAtYear = useMemo(
    () => people.filter((person) => isYearInRange(selectedYear, person.activeRange.startYear, person.activeRange.endYear)),
    [people, selectedYear],
  );

  const activeTierAPeople = useMemo(
    () => activePeopleAtYear.filter((person) => person.tier === 'A'),
    [activePeopleAtYear],
  );

  const activeRelationshipsAtYear = useMemo(
    () => relationships.filter((rel) => isYearInRange(selectedYear, rel.startYear, rel.endYear)),
    [relationships, selectedYear],
  );

  const activeEventsAtYear = useMemo(
    () => events.filter((event) => selectedYear >= event.startYear && selectedYear <= event.endYear),
    [events, selectedYear],
  );

  const nearbyEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const midpoint = Math.floor((event.startYear + event.endYear) / 2);
          return Math.abs(midpoint - selectedYear) <= 4;
        })
        .sort((a, b) => a.startYear - b.startYear),
    [events, selectedYear],
  );

  const filteredPeople = useMemo(() => {
    return people
      .filter((person) => (tierFilter === 'all' ? true : person.tier === tierFilter))
      .filter((person) => {
        if (!personSearch.trim()) return true;
        const query = personSearch.toLowerCase();
        if (person.canonicalName.toLowerCase().includes(query)) return true;
        return person.aliases.some((alias) => alias.text.toLowerCase().includes(query));
      });
  }, [people, tierFilter, personSearch]);

  const selectedPersonRelationships = useMemo(() => {
    if (!selectedPersonId) return [] as Relationship[];
    return relationships.filter(
      (rel) => rel.sourcePersonId === selectedPersonId || rel.targetPersonId === selectedPersonId,
    );
  }, [relationships, selectedPersonId]);

  const selectedPersonClaims = useMemo(
    () => claims.filter((claim) => claim.subjectType === 'person' && claim.resolvedSubjectId === selectedPersonId),
    [claims, selectedPersonId],
  );

  const networkPeople = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of activeRelationshipsAtYear) {
      ids.add(rel.sourcePersonId);
      ids.add(rel.targetPersonId);
    }
    const list = Array.from(ids)
      .map((id) => peopleById.get(id))
      .filter((person): person is Person => Boolean(person))
      .filter((person) => person.tier === 'A')
      .slice(0, 18);

    if (selectedPerson && !list.find((person) => person.id === selectedPerson.id)) {
      list.push(selectedPerson);
    }

    return uniqueBy(list, (person) => person.id);
  }, [activeRelationshipsAtYear, peopleById, selectedPerson]);

  const networkRelations = useMemo(() => {
    const ids = new Set(networkPeople.map((person) => person.id));
    return activeRelationshipsAtYear.filter(
      (rel) => ids.has(rel.sourcePersonId) && ids.has(rel.targetPersonId),
    );
  }, [networkPeople, activeRelationshipsAtYear]);

  const familyRoot = useMemo(
    () => peopleById.get(selectedPersonId) ?? hyegyong,
    [peopleById, selectedPersonId, hyegyong],
  );

  const familyEdges = useMemo(() => {
    if (!familyRoot) return [] as Relationship[];
    return relationships.filter(
      (rel) => rel.sourcePersonId === familyRoot.id || rel.targetPersonId === familyRoot.id,
    );
  }, [familyRoot, relationships]);

  const reviewClaims = useMemo(() => {
    return claims
      .filter((claim) => (reviewStatusFilter === 'all' ? true : claim.effectiveStatus === reviewStatusFilter))
      .filter((claim) => (reviewSubjectFilter === 'all' ? true : claim.subjectType === reviewSubjectFilter))
      .sort((a, b) => {
        const statusRank = (status: ClaimStatus) => (status === 'pending' ? 0 : status === 'rejected' ? 1 : 2);
        if (statusRank(a.effectiveStatus) !== statusRank(b.effectiveStatus)) {
          return statusRank(a.effectiveStatus) - statusRank(b.effectiveStatus);
        }
        return (a.startYear ?? 9999) - (b.startYear ?? 9999);
      });
  }, [claims, reviewStatusFilter, reviewSubjectFilter]);

  const selectedClaim = selectedClaimId ? claimsById.get(selectedClaimId) ?? null : null;
  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) ?? null : null;

  const evidenceSegments = useMemo(() => {
    if (!dataset) return [] as SourceSegment[];

    const segments: SourceSegment[] = [];

    if (selectedClaim?.sourceSegmentId) {
      const segment = segmentById.get(selectedClaim.sourceSegmentId);
      if (segment) segments.push(segment);
    }

    if (!segments.length && selectedEvent?.sourceSegmentId) {
      const segment = segmentById.get(selectedEvent.sourceSegmentId);
      if (segment) segments.push(segment);
    }

    if (!segments.length && selectedPerson) {
      for (const segmentId of selectedPerson.sourceSegmentIds) {
        const segment = segmentById.get(segmentId);
        if (segment) segments.push(segment);
      }
      for (const claim of selectedPersonClaims) {
        if (!claim.sourceSegmentId) continue;
        const segment = segmentById.get(claim.sourceSegmentId);
        if (segment) segments.push(segment);
      }
    }

    return uniqueBy(segments, (segment) => segment.id).slice(0, 10);
  }, [dataset, selectedClaim, selectedEvent, selectedPerson, selectedPersonClaims, segmentById]);

  const getPersonLabel = (personId: string): string => {
    return peopleById.get(personId)?.canonicalName ?? personId;
  };

  const openPersonFromText = useCallback(
    (personId: string) => {
      if (!peopleById.has(personId)) return;
      setSelectedPersonId(personId);
      setActiveTab('people');
    },
    [peopleById],
  );

  const openGlossaryFromText = useCallback((termId: string) => {
    setSelectedGlossaryId(termId);
    setActiveTab('glossary');
  }, []);

  const renderLinkedText = useCallback(
    (rawText: string, maxLen?: number): ReactNode => {
      const text = maxLen ? short(rawText, maxLen) : rawText;
      if (!text.trim()) return text;

      const matches: LinkMatch[] = [];
      const lower = text.toLowerCase();

      for (const pattern of linkPatterns) {
        const safeNeedle = pattern.needle;
        if (!safeNeedle) continue;
        const regex = new RegExp(escapeRegExp(pattern.needleLower), 'gi');
        let result: RegExpExecArray | null;
        while ((result = regex.exec(lower)) !== null) {
          const start = result.index;
          const end = start + result[0].length;
          const before = text[start - 1];
          const after = text[end];
          if (!isWordBoundaryChar(before) || !isWordBoundaryChar(after)) continue;
          matches.push({ kind: pattern.kind, id: pattern.id, start, end, priority: pattern.priority });
        }
      }

      if (!matches.length) return text;

      matches.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        if (a.priority !== b.priority) return b.priority - a.priority;
        return (b.end - b.start) - (a.end - a.start);
      });

      const selected: LinkMatch[] = [];
      let cursor = 0;
      for (const match of matches) {
        if (match.start < cursor) continue;
        selected.push(match);
        cursor = match.end;
      }

      const nodes: ReactNode[] = [];
      let current = 0;
      for (const [index, match] of selected.entries()) {
        if (current < match.start) {
          nodes.push(text.slice(current, match.start));
        }
        const label = text.slice(match.start, match.end);
        if (match.kind === 'person') {
          nodes.push(
            <button
              key={`lk-${index}-${match.kind}-${match.id}-${match.start}`}
              type="button"
              className="inline-link person"
              onClick={() => openPersonFromText(match.id)}
            >
              {label}
            </button>,
          );
        } else {
          nodes.push(
            <button
              key={`lk-${index}-${match.kind}-${match.id}-${match.start}`}
              type="button"
              className="inline-link glossary"
              onClick={() => openGlossaryFromText(match.id)}
            >
              {label}
            </button>,
          );
        }
        current = match.end;
      }
      if (current < text.length) nodes.push(text.slice(current));
      return nodes;
    },
    [linkPatterns, openGlossaryFromText, openPersonFromText],
  );

  const claimSubjectLabel = (claim: ClaimView): string => {
    if (claim.subjectType === 'person') return getPersonLabel(claim.resolvedSubjectId);
    if (claim.subjectType === 'event') return events.find((event) => event.id === claim.subjectId)?.title ?? claim.subjectId;
    if (claim.subjectType === 'relationship') {
      const rel = relationships.find((item) => item.id.startsWith(claim.subjectId));
      if (!rel) return claim.subjectId;
      return `${getPersonLabel(rel.sourcePersonId)} ↔ ${getPersonLabel(rel.targetPersonId)}`;
    }
    return claim.subjectId;
  };

  const setClaimStatus = (claimId: string, status: ClaimStatus | 'reset') => {
    setEdits((previous) => {
      const next = { ...previous, claimStatusOverrides: { ...previous.claimStatusOverrides } };
      if (status === 'reset') {
        delete next.claimStatusOverrides[claimId];
      } else {
        next.claimStatusOverrides[claimId] = status;
      }
      return next;
    });
  };

  const mergeEntities = () => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;

    const resolvedTarget = resolvePersonId(mergeTargetId);
    if (resolvedTarget === mergeSourceId) return;

    setEdits((previous) => {
      const nextMap = { ...previous.mergeMap, [mergeSourceId]: resolvedTarget };

      for (const [source, target] of Object.entries(nextMap)) {
        nextMap[source] = resolveMergedId(target, nextMap);
      }

      return {
        ...previous,
        mergeMap: nextMap,
      };
    });

    setMergeSourceId('');
  };

  const unmergeEntity = (sourceId: string) => {
    setEdits((previous) => {
      const nextMap = { ...previous.mergeMap };
      delete nextMap[sourceId];
      return { ...previous, mergeMap: nextMap };
    });
  };

  const addAlias = () => {
    if (!aliasPersonId || !newAliasText.trim()) return;

    const alias: Alias = {
      id: `alias-${aliasPersonId}-custom-${Date.now().toString(36)}`,
      text: newAliasText.trim(),
      language: 'en',
      script: 'latin',
      type: newAliasType,
      startYear: null,
      endYear: null,
      confidence: 0.7,
    };

    setEdits((previous) => {
      const current = previous.addedAliases[aliasPersonId] ?? [];
      return {
        ...previous,
        addedAliases: {
          ...previous.addedAliases,
          [aliasPersonId]: uniqueBy([...current, alias], (item) => item.text.toLowerCase()),
        },
      };
    });

    setNewAliasText('');
  };

  const addCharacter = () => {
    const name = newPersonName.trim();
    const bio = newPersonBio.trim();
    if (!name || !bio) return;

    const id = `person-custom-${Date.now().toString(36)}`;
    const startYear = newPersonStart ? Number(newPersonStart) : null;
    const endYear = newPersonEnd ? Number(newPersonEnd) : null;

    const customPerson: Person = {
      id,
      canonicalName: name,
      group: 'Editorial Additions',
      lifeLabel: [startYear, endYear].filter(Boolean).join('–') || 'custom',
      birthYear: startYear,
      deathYear: endYear,
      reignStartYear: null,
      reignEndYear: null,
      biography: bio,
      relationToHyegyong: null,
      tier: newPersonTier,
      aliases: [],
      officeTerms: [],
      sourceSegmentIds: [],
      activeRange: {
        startYear,
        endYear,
      },
    };

    const customClaim: Claim = {
      id: `clm-person-biography-${id}`,
      subjectType: 'person',
      subjectId: id,
      predicate: 'biography',
      value: bio,
      startYear,
      endYear,
      confidence: {
        extraction: 1,
        resolution: 1,
        historical: 'editorial',
      },
      status: 'pending',
      sourceSegmentId: null,
      notes: 'Manually added in Editorial Mode.',
    };

    setEdits((previous) => ({
      ...previous,
      addedPeople: [...previous.addedPeople, customPerson],
      addedClaims: [...previous.addedClaims, customClaim],
    }));

    setNewPersonName('');
    setNewPersonBio('');
    setNewPersonStart('');
    setNewPersonEnd('');
  };

  if (loading) {
    return <div className="app-shell loading">Loading Tier A dataset…</div>;
  }

  if (error || !dataset) {
    return <div className="app-shell error">{error ?? 'Failed to load data.'}</div>;
  }

  const yearMin = dataset.yearRange.startYear;
  const yearMax = dataset.yearRange.endYear;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Hyegyong Atlas</h1>
          <p>Tier A memoir reference workspace · canonical language: English</p>
        </div>
        <div className="topbar-meta">
          <span>Snapshot: {new Date(dataset.meta.generatedAt).toLocaleString()}</span>
          <span>People: {people.length}</span>
          <span>Claims: {claims.length}</span>
        </div>
      </header>

      <section className="timeline-card">
        <div className="timeline-header">
          <strong>Timeline Spine</strong>
          <span>
            Year {selectedYear}
            {hyegyongAge != null ? ` · Hyegyŏng age ${hyegyongAge}` : ''}
          </span>
        </div>
        <input
          type="range"
          min={yearMin}
          max={yearMax}
          value={selectedYear}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
        />
        <div className="year-density">
          {dataset.yearDensity.map((row) => {
            const maxCount = Math.max(...dataset.yearDensity.map((item) => item.count));
            const active = row.year === selectedYear;
            return (
              <button
                key={row.year}
                className={`year-bar ${active ? 'active' : ''}`}
                style={{ height: `${12 + (row.count / maxCount) * 38}px` }}
                title={`${row.year} · mentions: ${row.count}`}
                onClick={() => setSelectedYear(row.year)}
              />
            );
          })}
        </div>
      </section>

      <div className="workspace-grid">
        <aside className="left-nav">
          <div className="tab-list">
            {[
              ['overview', 'Overview'],
              ['people', 'People'],
              ['relationships', 'Relationships'],
              ['family', 'Family Tree'],
              ['glossary', 'Glossary'],
              ['editorial', 'Editorial'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={activeTab === id ? 'active' : ''}
                onClick={() => setActiveTab(id as TabId)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="quick-stats">
            <h3>At Year {selectedYear}</h3>
            <p>Tier A active: {activeTierAPeople.length}</p>
            <p>Relationships active: {activeRelationshipsAtYear.length}</p>
            <p>Events active: {activeEventsAtYear.length}</p>
            <p>
              Pending claims:{' '}
              {claims.filter((claim) => claim.effectiveStatus === 'pending').length}
            </p>
          </div>
        </aside>

        <main className="main-panel">
          {activeTab === 'overview' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>Cross-Section Snapshot</h2>
                <p>
                  Dynamic view of Hyegyong&apos;s world at <strong>{selectedYear}</strong>.
                  The same year drives people, relations, and events.
                </p>
              </section>

              <section className="card">
                <h3>Nearby Major Events</h3>
                <div className="event-list">
                  {(nearbyEvents.length ? nearbyEvents : events.slice(0, 8)).map((event) => (
                    <article key={event.id} className={`event-item ${selectedEventId === event.id ? 'active' : ''}`}>
                      <button
                        type="button"
                        className="event-select"
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setSelectedClaimId(`clm-event-${event.id}`);
                        }}
                      >
                        <div>
                          <strong>{event.title}</strong>
                          <span>
                            {event.startYear}
                            {event.endYear !== event.startYear ? `–${event.endYear}` : ''}
                          </span>
                        </div>
                      </button>
                      <p className="linked-block">{renderLinkedText(event.summary, 140)}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="card">
                <h3>Active Tier A Figures</h3>
                <div className="chip-grid">
                  {activeTierAPeople.map((person) => (
                    <button
                      key={person.id}
                      className={`chip ${selectedPersonId === person.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedPersonId(person.id);
                        setActiveTab('people');
                      }}
                    >
                      {person.canonicalName}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'people' && (
            <div className="split-panel">
              <div className="subpanel">
                <h2>People</h2>
                <div className="filters">
                  <input
                    value={personSearch}
                    onChange={(event) => setPersonSearch(event.target.value)}
                    placeholder="Search name or alias"
                  />
                  <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value as 'all' | Tier)}>
                    <option value="all">All tiers</option>
                    <option value="A">Tier A</option>
                    <option value="B">Tier B</option>
                    <option value="C">Tier C</option>
                  </select>
                </div>
                <div className="person-list">
                  {filteredPeople.map((person) => (
                    <button
                      key={person.id}
                      className={`person-row ${selectedPersonId === person.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedPersonId(person.id);
                        setSelectedClaimId('');
                        setSelectedEventId('');
                      }}
                    >
                      <div>
                        <strong>{person.canonicalName}</strong>
                        <span>{person.lifeLabel}</span>
                      </div>
                      <small>
                        Tier {person.tier} · {person.group}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="subpanel detail">
                {selectedPerson ? (
                  <>
                    <h2>{selectedPerson.canonicalName}</h2>
                    <p>{renderLinkedText(selectedPerson.biography)}</p>
                    <p>
                      <strong>Life:</strong> {selectedPerson.lifeLabel}
                    </p>
                    {selectedPerson.relationToHyegyong && (
                      <p>
                        <strong>Relation to Hyegyŏng:</strong> {renderLinkedText(selectedPerson.relationToHyegyong)}
                      </p>
                    )}

                    <section>
                      <h3>Aliases / Titles</h3>
                      <div className="inline-list">
                        {selectedPerson.aliases.length ? (
                          selectedPerson.aliases.map((alias) => (
                            <span key={alias.id} className="pill">
                              {alias.text}
                            </span>
                          ))
                        ) : (
                          <span className="muted">No aliases recorded.</span>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3>Office / Rank Timeline</h3>
                      <div className="office-list">
                        {selectedPerson.officeTerms.length ? (
                          selectedPerson.officeTerms.map((office, index) => (
                            <div key={`${office.title}-${index}`} className="office-row">
                              <strong>{office.title}</strong>
                              <span>
                                {office.startYear ?? '?'} - {office.endYear ?? '?'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="muted">No Tier A office terms seeded yet.</p>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3>Relationships</h3>
                      <div className="rel-list">
                        {selectedPersonRelationships.length ? (
                          selectedPersonRelationships.map((rel) => {
                            const counterpartId =
                              rel.sourcePersonId === selectedPerson.id ? rel.targetPersonId : rel.sourcePersonId;
                            return (
                              <button key={rel.id} className="relation-item">
                                <strong>{getPersonLabel(counterpartId)}</strong>
                                <span>
                                  {rel.relationType} · {rel.startYear}-{rel.endYear}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <p className="muted">No linked relationships.</p>
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  <p>Select a person.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'relationships' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>Relationship Network ({selectedYear})</h2>
                <RelationshipGraph
                  people={networkPeople}
                  relationships={networkRelations}
                  selectedPersonId={selectedPersonId}
                  onSelectPerson={(personId) => {
                    setSelectedPersonId(personId);
                    setActiveTab('people');
                  }}
                />
              </section>

              <section className="card">
                <h3>Active Relationship Rows</h3>
                <div className="table-list">
                  {activeRelationshipsAtYear.map((rel) => (
                    <div key={rel.id} className="table-row">
                      <strong>
                        {getPersonLabel(rel.sourcePersonId)} ↔ {getPersonLabel(rel.targetPersonId)}
                      </strong>
                      <span>
                        {rel.relationType} · {rel.startYear}-{rel.endYear}
                      </span>
                      <p>{renderLinkedText(rel.summary, 140)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'family' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>Family Tree Lens</h2>
                <p>
                  Focus person:
                  <select
                    value={familyRoot?.id ?? ''}
                    onChange={(event) => {
                      setSelectedPersonId(event.target.value);
                      setActiveTab('family');
                    }}
                  >
                    {people
                      .filter((person) => person.tier === 'A')
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.canonicalName}
                        </option>
                      ))}
                  </select>
                </p>
                {familyRoot ? (
                  <FamilyCards
                    root={familyRoot}
                    edges={familyEdges}
                    getPersonLabel={getPersonLabel}
                    onSelectPerson={(id) => {
                      setSelectedPersonId(id);
                      setActiveTab('people');
                    }}
                  />
                ) : (
                  <p>No family root selected.</p>
                )}
              </section>
            </div>
          )}

          {activeTab === 'glossary' && (
            <div className="split-panel">
              <div className="subpanel">
                <h2>Glossary</h2>
                <div className="filters">
                  <input
                    value={glossarySearch}
                    onChange={(event) => setGlossarySearch(event.target.value)}
                    placeholder="Search terms"
                  />
                </div>
                <div className="person-list">
                  {glossaryVisibleTerms.map((term) => (
                    <button
                      key={term.id}
                      className={`person-row ${selectedGlossaryId === term.id ? 'active' : ''}`}
                      onClick={() => setSelectedGlossaryId(term.id)}
                    >
                      <div>
                        <strong>{term.term}</strong>
                        <span>{term.category}</span>
                      </div>
                      <small>{(term.aliases ?? []).slice(0, 2).join(', ')}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="subpanel detail">
                {selectedGlossaryTerm ? (
                  <>
                    <h2>{selectedGlossaryTerm.term}</h2>
                    <p>{renderLinkedText(selectedGlossaryTerm.definition)}</p>
                    {!!selectedGlossaryTerm.aliases?.length && (
                      <section>
                        <h3>Aliases</h3>
                        <div className="inline-list">
                          {selectedGlossaryTerm.aliases.map((alias) => (
                            <span key={alias} className="pill">
                              {alias}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}
                    <section>
                      <h3>Category</h3>
                      <p className="muted">{selectedGlossaryTerm.category}</p>
                    </section>
                  </>
                ) : (
                  <p>Select a glossary term.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'editorial' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>Review Inbox</h2>
                <div className="filters review-filters">
                  <select
                    value={reviewStatusFilter}
                    onChange={(event) => setReviewStatusFilter(event.target.value as 'all' | ClaimStatus)}
                  >
                    <option value="pending">Pending only</option>
                    <option value="all">All statuses</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select
                    value={reviewSubjectFilter}
                    onChange={(event) =>
                      setReviewSubjectFilter(event.target.value as 'all' | 'person' | 'relationship' | 'event')
                    }
                  >
                    <option value="all">All subjects</option>
                    <option value="person">Person claims</option>
                    <option value="relationship">Relationship claims</option>
                    <option value="event">Event claims</option>
                  </select>
                </div>

                <div className="claim-list">
                  {reviewClaims.slice(0, 120).map((claim) => {
                    const segment = claim.sourceSegmentId ? segmentById.get(claim.sourceSegmentId) : null;
                    return (
                      <article key={claim.id} className={`claim-item status-${claim.effectiveStatus}`}>
                        <header>
                          <strong>{claimSubjectLabel(claim)}</strong>
                          <span>{claim.predicate}</span>
                        </header>
                        <p className="muted">
                          {claim.startYear ?? '?'} - {claim.endYear ?? '?'} · extraction {claim.confidence.extraction.toFixed(2)}
                          {claim.mergedFrom ? ` · merged from ${claim.mergedFrom}` : ''}
                        </p>
                        <p>{renderLinkedText(formatClaimValue(claim.value), 200)}</p>
                        {segment && (
                          <details>
                            <summary>Evidence</summary>
                            <p>{renderLinkedText(segment.excerpt)}</p>
                          </details>
                        )}
                        <div className="action-row">
                          <button onClick={() => setClaimStatus(claim.id, 'approved')}>Approve</button>
                          <button onClick={() => setClaimStatus(claim.id, 'rejected')}>Reject</button>
                          <button onClick={() => setClaimStatus(claim.id, 'reset')}>Reset</button>
                          <button
                            onClick={() => {
                              setSelectedClaimId(claim.id);
                              setActiveTab('editorial');
                            }}
                          >
                            Focus Evidence
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="card">
                <h3>Merge Entity Tool</h3>
                <p className="muted">Use for Jeongjo / Jeongjo(1)-style deduplication. Merge is reversible.</p>
                <div className="merge-grid">
                  <select value={mergeSourceId} onChange={(event) => setMergeSourceId(event.target.value)}>
                    <option value="">Source entity</option>
                    {people
                      .filter((person) => !edits.mergeMap[person.id])
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.canonicalName}
                        </option>
                      ))}
                  </select>
                  <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}>
                    <option value="">Target entity</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.canonicalName}
                      </option>
                    ))}
                  </select>
                  <button onClick={mergeEntities}>Merge</button>
                </div>

                {Object.keys(edits.mergeMap).length > 0 && (
                  <div className="merge-list">
                    {Object.entries(edits.mergeMap).map(([source, target]) => (
                      <div key={source} className="merge-row">
                        <span>
                          {allPeopleLookup.get(source)?.canonicalName ?? source} →{' '}
                          {allPeopleLookup.get(target)?.canonicalName ?? target}
                        </span>
                        <button onClick={() => unmergeEntity(source)}>Undo</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <h3>Alias Manager</h3>
                <div className="merge-grid">
                  <select value={aliasPersonId} onChange={(event) => setAliasPersonId(event.target.value)}>
                    <option value="">Select person</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.canonicalName}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newAliasText}
                    onChange={(event) => setNewAliasText(event.target.value)}
                    placeholder="New alias text"
                  />
                  <input
                    value={newAliasType}
                    onChange={(event) => setNewAliasType(event.target.value)}
                    placeholder="Alias type"
                  />
                  <button onClick={addAlias}>Add Alias</button>
                </div>

                {aliasPersonId && (
                  <div className="inline-list">
                    {(peopleById.get(aliasPersonId)?.aliases ?? []).map((alias) => (
                      <span key={alias.id} className="pill">
                        {alias.text}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <h3>Add Character</h3>
                <p className="muted">Creates an editorial person record plus pending biography claim.</p>
                <div className="add-character-grid">
                  <input
                    value={newPersonName}
                    onChange={(event) => setNewPersonName(event.target.value)}
                    placeholder="Canonical name"
                  />
                  <textarea
                    value={newPersonBio}
                    onChange={(event) => setNewPersonBio(event.target.value)}
                    placeholder="Biography summary"
                  />
                  <div className="inline-fields">
                    <select value={newPersonTier} onChange={(event) => setNewPersonTier(event.target.value as Tier)}>
                      <option value="A">Tier A</option>
                      <option value="B">Tier B</option>
                      <option value="C">Tier C</option>
                    </select>
                    <input
                      value={newPersonStart}
                      onChange={(event) => setNewPersonStart(event.target.value)}
                      placeholder="Start year"
                    />
                    <input
                      value={newPersonEnd}
                      onChange={(event) => setNewPersonEnd(event.target.value)}
                      placeholder="End year"
                    />
                    <button onClick={addCharacter}>Add Character</button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>

        <aside className="evidence-panel">
          <h3>Evidence Panel</h3>
          <p className="muted">
            {selectedClaim
              ? `Claim: ${claimSubjectLabel(selectedClaim)}`
              : selectedEvent
                ? `Event: ${selectedEvent.title}`
                : selectedPerson
                  ? `Person: ${selectedPerson.canonicalName}`
                  : 'Select an item.'}
          </p>

          <div className="evidence-list">
            {evidenceSegments.length ? (
              evidenceSegments.map((segment) => {
                const source = sourceById.get(segment.sourceId);
                return (
                  <article key={segment.id} className="evidence-item">
                    <header>
                      <strong>{segment.label}</strong>
                      <span>{source?.label ?? segment.sourceId}</span>
                    </header>
                    <p>{renderLinkedText(segment.excerpt)}</p>
                    <small>{source?.path}</small>
                  </article>
                );
              })
            ) : (
              <p className="muted">No source segment selected.</p>
            )}
          </div>

          <section className="card compact">
            <h4>Current-Year Events</h4>
            <div className="event-mini-list">
              {activeEventsAtYear.length ? (
                activeEventsAtYear.map((event) => (
                  <button
                    key={event.id}
                    className={`event-mini ${selectedEventId === event.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setSelectedClaimId(`clm-event-${event.id}`);
                    }}
                  >
                    {event.title}
                  </button>
                ))
              ) : (
                <p className="muted">No exact-year event nodes.</p>
              )}
            </div>
          </section>

          <section className="card compact">
            <h4>Places in Focus</h4>
            <div className="place-list">
              {uniqueBy(
                nearbyEvents
                  .map((event) => (event.placeId ? placeById.get(event.placeId) : null))
                  .filter((place): place is NonNullable<typeof place> => Boolean(place)),
                (place) => place.id,
              )
                .slice(0, 6)
                .map((place) => (
                  <article key={place.id}>
                    <strong>{place.name}</strong>
                    <p>{renderLinkedText(place.summary, 120)}</p>
                  </article>
                ))}
            </div>
          </section>

          <section className="card compact">
            <h4>Glossary Focus</h4>
            {selectedGlossaryTerm ? (
              <article className="glossary-focus">
                <strong>{selectedGlossaryTerm.term}</strong>
                <p>{renderLinkedText(selectedGlossaryTerm.definition, 170)}</p>
                <button type="button" className="event-mini" onClick={() => setActiveTab('glossary')}>
                  Open glossary
                </button>
              </article>
            ) : (
              <p className="muted">Click a linked term to focus glossary context.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function RelationshipGraph(props: {
  people: Person[];
  relationships: Relationship[];
  selectedPersonId: string;
  onSelectPerson: (personId: string) => void;
}) {
  const size = 520;
  const center = size / 2;
  const radius = size * 0.34;

  const nodes = props.people.map((person, index) => {
    const angle = (index / Math.max(props.people.length, 1)) * Math.PI * 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return { person, x, y };
  });

  const nodeById = new Map(nodes.map((node) => [node.person.id, node] as const));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="network-svg" role="img" aria-label="Relationship graph">
      {props.relationships.map((rel) => {
        const source = nodeById.get(rel.sourcePersonId);
        const target = nodeById.get(rel.targetPersonId);
        if (!source || !target) return null;
        return (
          <g key={rel.id}>
            <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} className="network-edge" />
          </g>
        );
      })}

      {nodes.map((node) => (
        <g key={node.person.id} className="network-node" onClick={() => props.onSelectPerson(node.person.id)}>
          <circle
            cx={node.x}
            cy={node.y}
            r={props.selectedPersonId === node.person.id ? 18 : 14}
            className={props.selectedPersonId === node.person.id ? 'selected' : ''}
          />
          <text x={node.x} y={node.y + 30} textAnchor="middle">
            {node.person.canonicalName.replace(/^KING\s+|^QUEEN\s+|^PRINCESS\s+|^PRINCE\s+|^LADY\s+/, '')}
          </text>
        </g>
      ))}
    </svg>
  );
}

function FamilyCards(props: {
  root: Person;
  edges: Relationship[];
  getPersonLabel: (id: string) => string;
  onSelectPerson: (id: string) => void;
}) {
  const parents = props.edges.filter((edge) => /mother|father|son-mother|daughter|grand/.test(edge.relationType));
  const spouse = props.edges.filter((edge) => /spouse|consort/.test(edge.relationType));
  const siblings = props.edges.filter((edge) => /siblings/.test(edge.relationType));
  const political = props.edges.filter((edge) => /rivals|confidant|regency|protector|collaborators/.test(edge.relationType));

  const renderEdge = (edge: Relationship) => {
    const counterpart = edge.sourcePersonId === props.root.id ? edge.targetPersonId : edge.sourcePersonId;
    return (
      <button key={edge.id} className="family-item" onClick={() => props.onSelectPerson(counterpart)}>
        <strong>{props.getPersonLabel(counterpart)}</strong>
        <span>{edge.relationType}</span>
        <small>
          {edge.startYear}-{edge.endYear}
        </small>
      </button>
    );
  };

  return (
    <div className="family-grid">
      <section>
        <h4>Parents / Descendants</h4>
        {parents.length ? parents.map(renderEdge) : <p className="muted">No seeded links.</p>}
      </section>
      <section>
        <h4>Spouse / Consort</h4>
        {spouse.length ? spouse.map(renderEdge) : <p className="muted">No seeded links.</p>}
      </section>
      <section>
        <h4>Siblings / Kin</h4>
        {siblings.length ? siblings.map(renderEdge) : <p className="muted">No seeded links.</p>}
      </section>
      <section>
        <h4>Political Ties</h4>
        {political.length ? political.map(renderEdge) : <p className="muted">No seeded links.</p>}
      </section>
    </div>
  );
}

export default App;
