import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import './App.css';
import type {
  Alias,
  Claim,
  ClaimStatus,
  Dataset,
  Dispute,
  DisputeStatus,
  Event,
  LocalEdits,
  Place,
  Person,
  ReviewerAction,
  ReviewerRole,
  Relationship,
  SplitRecord,
  Source,
  SourceSegment,
  Tier,
} from './types';
import { GLOSSARY_TERMS } from './glossary';
import {
  KO_EVENT,
  KO_EVENT_TYPE_LABELS,
  KO_GLOSSARY,
  KO_GROUP_LABELS,
  KO_OFFICE_TITLE_LABELS,
  KO_PERSON,
  KO_PLACE,
  KO_PREDICATE_LABELS,
  KO_RELATION_SUMMARY,
  KO_RELATION_TYPE_LABELS,
  KO_SOURCE_LABELS,
  KO_WORK_CONTRIBUTOR,
  KO_WORK_TITLE,
} from './localization-ko';

type TabId =
  | 'overview'
  | 'people'
  | 'relationships'
  | 'family'
  | 'offices'
  | 'matrix'
  | 'map'
  | 'sources'
  | 'glossary'
  | 'editorial';

type ClaimView = Claim & {
  effectiveStatus: ClaimStatus;
  resolvedSubjectId: string;
  mergedFrom?: string;
};

type DisputeView = Dispute & {
  effectiveStatus: DisputeStatus;
};

type OfficeRow = {
  id: string;
  personId: string;
  personName: string;
  personTier: Tier;
  title: string;
  startYear: number | null;
  endYear: number | null;
  confidence: number;
  sourceId: string;
};

type MatrixWindow = {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
};

type UiLanguage = 'en' | 'ko';
type PersonActivityFilter = 'all' | 'active-year' | 'has-office' | 'has-dispute';
type ConfidenceFilter = 'all' | 'lt-0.86' | 'lt-0.9' | 'gte-0.9';
type EventTypeFilter = 'all' | string;

type ViewSnapshot = {
  activeTab: TabId;
  year: number;
  personId: string;
  eventId: string;
  claimId: string;
  glossaryId: string;
  personSearch: string;
  tierFilter: 'all' | Tier;
  personGroupFilter: string;
  personActivityFilter: PersonActivityFilter;
  eventTypeFilter: EventTypeFilter;
  reviewStatusFilter: 'all' | ClaimStatus;
  reviewSubjectFilter: 'all' | 'person' | 'relationship' | 'event';
  reviewConfidenceFilter: ConfidenceFilter;
  reviewSourceFilter: string;
  disputeFilter: 'all' | DisputeStatus;
  disputeSeverityFilter: 'all' | 'high' | 'medium' | 'low';
  disputeReasonFilter: 'all' | Dispute['reasonType'];
  showReferenceDetails: boolean;
  uiLanguage: UiLanguage;
  fieldMode: boolean;
};

type SavedView = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: ViewSnapshot;
};

type BaselineMeta = {
  createdAt: string;
  sourcePath: string;
  snapshotPath: string;
  latestPath: string;
  sha256: string;
  dataset: string;
  datasetGeneratedAt: string;
  counts: {
    people: number;
    events: number;
    relationships: number;
    claims: number;
    disputes?: number;
    places?: number;
  };
};

type TierCMeta = {
  quality?: {
    openDisputes?: number;
    nameCollisions?: Array<{ normalizedName: string; personIds: string[] }>;
    aliasCollisions?: Array<{ normalizedLabel: string; personIds: string[] }>;
    confidence?: {
      highGte090?: number;
      medium086To089?: number;
      lowLt086?: number;
      uncitedClaims?: number;
    };
  };
  focusedPass?: {
    sourceCoverage?: Array<{
      sourceId: string;
      label: string;
      totalMentions: number;
      claimCount: number;
      eventCount: number;
      relationshipCount: number;
    }>;
    personFocus?: Array<{
      personId: string;
      name: string;
      openDisputes: number;
      totalMentions: number;
    }>;
  };
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
const SAVED_VIEWS_KEY = 'hyegyong-atlas-saved-views-v1';
const REVIEWER_KEY = 'hyegyong-atlas-reviewer-v1';
const EDITORIAL_EXPORT_VERSION = '1.0.0';
const EDITOR_ACCESS_CODE = (import.meta.env.VITE_EDITOR_ACCESS_CODE as string | undefined)?.trim() ?? '';
const APP_MODE =
  ((import.meta.env.VITE_APP_MODE as string | undefined)?.toLowerCase() ?? 'editorial') === 'public'
    ? 'public'
    : 'editorial';
const BASE_URL = import.meta.env.BASE_URL;

function toBaseUrl(path: string): string {
  return `${BASE_URL}${path.replace(/^\/+/, '')}`;
}

const UI_COPY: Record<UiLanguage, Record<string, string>> = {
  en: {
    overview: 'Overview',
    people: 'People',
    relationships: 'Relationships',
    family: 'Family Tree',
    offices: 'Offices',
    matrix: 'Matrix',
    map: 'Palace Map',
    sources: 'Source Compare',
    glossary: 'Glossary',
    editorial: 'Editorial',
    crossSectionSnapshot: 'Cross-Section Snapshot',
    timelineSpine: 'Timeline Spine',
    saveView: 'Save View',
    copyLink: 'Copy Link',
    fieldMode: 'Field Mode',
    reviewer: 'Reviewer',
  },
  ko: {
    overview: '개요',
    people: '인물',
    relationships: '관계',
    family: '가계도',
    offices: '관직',
    matrix: '매트릭스',
    map: '궁궐 지도',
    sources: '출처 비교',
    glossary: '용어집',
    editorial: '편집',
    crossSectionSnapshot: '단면 스냅샷',
    timelineSpine: '타임라인',
    saveView: '뷰 저장',
    copyLink: '링크 복사',
    fieldMode: '현장 모드',
    reviewer: '검토자',
  },
};

function withOverlayLabel(primary: string, overlay: string | undefined, language: UiLanguage): string {
  if (!overlay) return primary;
  return language === 'ko' ? overlay : primary;
}

function createEmptyEdits(): LocalEdits {
  return {
    claimStatusOverrides: {},
    conflictStatusOverrides: {},
    mergeMap: {},
    addedAliases: {},
    addedPeople: [],
    addedClaims: [],
    splitRecords: [],
    reviewerActions: [],
  };
}

function normalizeEdits(input: Partial<LocalEdits> | null | undefined): LocalEdits {
  return {
    claimStatusOverrides: input?.claimStatusOverrides ?? {},
    conflictStatusOverrides: input?.conflictStatusOverrides ?? {},
    mergeMap: input?.mergeMap ?? {},
    addedAliases: input?.addedAliases ?? {},
    addedPeople: input?.addedPeople ?? [],
    addedClaims: input?.addedClaims ?? [],
    splitRecords: input?.splitRecords ?? [],
    reviewerActions: input?.reviewerActions ?? [],
  };
}

function loadEdits(): LocalEdits {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyEdits();
    const parsed = JSON.parse(raw) as LocalEdits;
    return normalizeEdits(parsed);
  } catch {
    return createEmptyEdits();
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

function getWorkLabel(source?: Source | null): string {
  if (!source) return 'Unknown source work';
  if (!source.workContributors) return source.workTitle;
  return `${source.workTitle} — ${source.workContributors}`;
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

function inferClaimMethod(claim: ClaimView): string {
  if (claim.confidence.historical === 'editorial') return 'editorial';
  const notes = claim.notes.toLowerCase();
  if (notes.includes('auto-extracted')) return 'auto-extracted';
  if (notes.includes('manual seed')) return 'manual-seed';
  if (notes.includes('manually added')) return 'editorial';
  return String(claim.confidence.historical);
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

function rangesOverlap(
  startA: number | null | undefined,
  endA: number | null | undefined,
  startB: number | null | undefined,
  endB: number | null | undefined,
): boolean {
  const loA = startA ?? -9999;
  const hiA = endA ?? 9999;
  const loB = startB ?? -9999;
  const hiB = endB ?? 9999;
  return loA <= hiB && loB <= hiA;
}

function sourceIdForSegment(segmentById: Map<string, SourceSegment>, segmentId: string | null | undefined): string | null {
  if (!segmentId) return null;
  return segmentById.get(segmentId)?.sourceId ?? null;
}

function parseYearInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const year = Number(trimmed);
  if (!Number.isFinite(year)) return null;
  return Math.trunc(year);
}

function createActionRecord(
  targetType: ReviewerAction['targetType'],
  targetId: string,
  action: string,
  by: string,
  role: ReviewerRole,
  note?: string,
): ReviewerAction {
  return {
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    targetType,
    targetId,
    action,
    by,
    role,
    at: new Date().toISOString(),
    note,
  };
}

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is SavedView =>
        !!row &&
        typeof row.id === 'string' &&
        typeof row.name === 'string' &&
        typeof row.createdAt === 'string' &&
        typeof row.updatedAt === 'string' &&
        typeof row.snapshot === 'object' &&
        row.snapshot !== null,
    );
  } catch {
    return [];
  }
}

function loadReviewerIdentity(): { name: string; role: ReviewerRole } {
  try {
    const raw = localStorage.getItem(REVIEWER_KEY);
    if (!raw) return { name: '', role: 'viewer' };
    const parsed = JSON.parse(raw) as { name?: unknown; role?: unknown };
    const role = parsed.role === 'editor' || parsed.role === 'lead' || parsed.role === 'viewer' ? parsed.role : 'viewer';
    const name = typeof parsed.name === 'string' ? parsed.name : '';
    return { name, role };
  } catch {
    return { name: '', role: 'viewer' };
  }
}

function queryToBool(value: string | null): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function deriveDisputesFromClaims(claims: ClaimView[], segmentById: Map<string, SourceSegment>): Dispute[] {
  const disputes: Dispute[] = [];
  const seen = new Set<string>();
  const severityRank: Record<Dispute['severity'], number> = { high: 0, medium: 1, low: 2 };
  const reasonRank: Record<Dispute['reasonType'], number> = {
    'contested-framing': 0,
    'evidence-gap': 1,
    'low-confidence': 2,
  };

  for (const claim of claims) {
    const extraction = claim.confidence.extraction;
    const notes = claim.notes.toLowerCase();
    const predicate = claim.predicate.toLowerCase();
    const isTierBNote = notes.includes('tier b');
    const candidates: Array<{
      reasonType: Dispute['reasonType'];
      severity: Dispute['severity'];
      summary: string;
      suggestedAction: string;
    }> = [];

    if (extraction < 0.86) {
      candidates.push({
        reasonType: 'low-confidence',
        severity: 'high',
        summary: 'Extraction confidence is below 0.86.',
        suggestedAction: 'Check passage context and reduce claim scope or rewrite wording.',
      });
    } else if (
      extraction < 0.9 &&
      (claim.subjectType === 'relationship' ||
        claim.subjectType === 'event' ||
        (claim.subjectType === 'person' && claim.predicate === 'office-term' && isTierBNote))
    ) {
      candidates.push({
        reasonType: 'low-confidence',
        severity: 'medium',
        summary: 'Extraction confidence is below Tier B threshold (0.90) for a high-impact claim.',
        suggestedAction: 'Confirm evidence and leave pending if confidence cannot be raised.',
      });
    }

    const isValidationNote = notes.includes('validate');
    const isManualRelationNote = notes.includes('manual seed relation');
    const isSeedChronologyNote = notes.includes('seed chronology') || notes.includes('tier b chronology expansion');
    const highImpactRelation =
      claim.subjectType === 'relationship' &&
      /(political-rivals|regency|protector|confidant|political-collaborators|adoptive-mother-son)/.test(predicate);
    const highImpactEvent =
      claim.subjectType === 'event' &&
      (notes.includes('tier b chronology expansion') ||
        extraction < 0.9 ||
        /(regency|dynastic-crisis|political-persecution|factional)/.test(predicate));

    if (isValidationNote || (isManualRelationNote && highImpactRelation) || (isSeedChronologyNote && highImpactEvent)) {
      candidates.push({
        reasonType: 'evidence-gap',
        severity: 'medium',
        summary: 'Claim notes indicate manual seeding or validation requirement on a high-impact claim.',
        suggestedAction: 'Open evidence and verify factual scope before approval.',
      });
    }

    if (
      claim.subjectType === 'relationship' &&
      /(political-rivals|regency|protector|confidant|political-collaborators)/.test(predicate)
    ) {
      candidates.push({
        reasonType: 'contested-framing',
        severity: /(political-rivals|regency)/.test(predicate) ? 'high' : 'medium',
        summary: 'Political relationship framing may be perspective-bound.',
        suggestedAction: 'Compare wording across memoir sections and mark only stable claims as approved.',
      });
    }

    if (!candidates.length) continue;

    candidates.sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] || reasonRank[a.reasonType] - reasonRank[b.reasonType],
    );
    const chosen = candidates[0];
    const id = `dsp-${claim.id}-${chosen.reasonType}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const sourceId = sourceIdForSegment(segmentById, claim.sourceSegmentId);
    disputes.push({
      id,
      claimId: claim.id,
      subjectType: claim.subjectType,
      subjectId: claim.subjectId,
      reasonType: chosen.reasonType,
      severity: chosen.severity,
      summary: chosen.summary,
      sourceIds: sourceId ? [sourceId] : [],
      sourceSegmentId: claim.sourceSegmentId,
      status: 'open',
      suggestedAction: chosen.suggestedAction,
    });
  }

  return disputes.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));
}

function App() {
  const editorialEnabled = APP_MODE === 'editorial';
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
  const [personGroupFilter, setPersonGroupFilter] = useState<string>('all');
  const [personActivityFilter, setPersonActivityFilter] = useState<PersonActivityFilter>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>('all');

  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | ClaimStatus>('pending');
  const [reviewSubjectFilter, setReviewSubjectFilter] = useState<'all' | 'person' | 'relationship' | 'event'>('all');
  const [reviewConfidenceFilter, setReviewConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [reviewSourceFilter, setReviewSourceFilter] = useState<string>('all');
  const [disputeFilter, setDisputeFilter] = useState<'all' | DisputeStatus>('open');
  const [disputeSeverityFilter, setDisputeSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [disputeReasonFilter, setDisputeReasonFilter] = useState<'all' | Dispute['reasonType']>('all');
  const [glossarySearch, setGlossarySearch] = useState('');
  const [selectedGlossaryId, setSelectedGlossaryId] = useState<string>(GLOSSARY_TERMS[0]?.id ?? '');
  const [showReferenceDetails, setShowReferenceDetails] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('en');
  const [fieldMode, setFieldMode] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [stateMessage, setStateMessage] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [baselineMeta, setBaselineMeta] = useState<BaselineMeta | null>(null);

  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews());
  const [newSavedViewName, setNewSavedViewName] = useState('');
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRole, setReviewerRole] = useState<ReviewerRole>('viewer');
  const [editorUnlockInput, setEditorUnlockInput] = useState('');
  const [editorUnlocked, setEditorUnlocked] = useState(!EDITOR_ACCESS_CODE);

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

  const [splitSourceId, setSplitSourceId] = useState('');
  const [splitName, setSplitName] = useState('');
  const [splitStartYear, setSplitStartYear] = useState('');
  const [splitEndYear, setSplitEndYear] = useState('');
  const [splitRationale, setSplitRationale] = useState('');

  const [edits, setEdits] = useState<LocalEdits>(() => loadEdits());
  const queryHydratedRef = useRef(false);
  const showDeepReference = editorialEnabled && showReferenceDetails;
  const canEdit = editorialEnabled && editorUnlocked && reviewerRole !== 'viewer';
  const canLead = canEdit && reviewerRole === 'lead';
  const t = useCallback(
    (key: string, fallback: string) => {
      return UI_COPY[uiLanguage]?.[key] ?? fallback;
    },
    [uiLanguage],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  }, [edits]);

  useEffect(() => {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    const identity = loadReviewerIdentity();
    setReviewerName(identity.name);
    setReviewerRole(identity.role);
  }, []);

  useEffect(() => {
    localStorage.setItem(REVIEWER_KEY, JSON.stringify({ name: reviewerName.trim(), role: reviewerRole }));
  }, [reviewerName, reviewerRole]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const candidates = ['data/tier-c.json', 'data/tier-b.json', 'data/tier-a.json'].map(toBaseUrl);
        let next: Dataset | null = null;
        let lastStatus: number | null = null;
        for (const path of candidates) {
          const response = await fetch(path);
          if (!response.ok) {
            lastStatus = response.status;
            continue;
          }
          next = (await response.json()) as Dataset;
          break;
        }
        if (!next) throw new Error(`Failed to load dataset (${lastStatus ?? 'no response'})`);
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

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const datasetId = dataset?.meta.dataset ?? '';
        const candidates =
          datasetId === 'hyegyong-tier-c'
            ? ['data/tier-c-baseline.meta.json', 'data/tier-b-baseline.meta.json', 'data/tier-a-baseline.meta.json']
            : datasetId === 'hyegyong-tier-b'
              ? ['data/tier-b-baseline.meta.json', 'data/tier-a-baseline.meta.json']
              : ['data/tier-a-baseline.meta.json', 'data/tier-b-baseline.meta.json'];
        const baseCandidates = candidates.map(toBaseUrl);
        let payload: BaselineMeta | null = null;
        for (const path of baseCandidates) {
          const response = await fetch(path);
          if (!response.ok) continue;
          payload = (await response.json()) as BaselineMeta;
          break;
        }
        if (!cancelled) setBaselineMeta(payload);
      } catch {
        if (!cancelled) setBaselineMeta(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [dataset?.meta.dataset]);

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

  const getGlossaryOverlay = useCallback(
    (termId: string) => {
      if (uiLanguage !== 'ko') return null;
      return KO_GLOSSARY[termId] ?? null;
    },
    [uiLanguage],
  );

  const getGlossaryTermText = useCallback(
    (termId: string, fallback: string) => {
      const overlay = getGlossaryOverlay(termId);
      return overlay?.term ?? fallback;
    },
    [getGlossaryOverlay],
  );

  const getGlossaryDefinitionText = useCallback(
    (termId: string, fallback: string) => {
      const overlay = getGlossaryOverlay(termId);
      return overlay?.definition ?? fallback;
    },
    [getGlossaryOverlay],
  );

  const getGlossaryAliases = useCallback(
    (termId: string, fallback: string[] | undefined) => {
      const overlay = getGlossaryOverlay(termId);
      if (overlay?.aliases?.length) return overlay.aliases;
      return fallback ?? [];
    },
    [getGlossaryOverlay],
  );

  const getGlossaryCategoryText = useCallback(
    (termId: string, fallback: string) => {
      const overlay = getGlossaryOverlay(termId);
      return overlay?.category ?? fallback;
    },
    [getGlossaryOverlay],
  );

  const glossaryVisibleTerms = useMemo(() => {
    const query = glossarySearch.trim().toLowerCase();
    if (!query) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter((term) => {
      const termText = getGlossaryTermText(term.id, term.term).toLowerCase();
      const definitionText = getGlossaryDefinitionText(term.id, term.definition).toLowerCase();
      if (term.term.toLowerCase().includes(query)) return true;
      if (term.definition.toLowerCase().includes(query)) return true;
      if (termText.includes(query)) return true;
      if (definitionText.includes(query)) return true;
      const aliases = new Set<string>([...(term.aliases ?? []), ...getGlossaryAliases(term.id, term.aliases)]);
      return Array.from(aliases).some((alias) => alias.toLowerCase().includes(query));
    });
  }, [
    getGlossaryAliases,
    getGlossaryDefinitionText,
    getGlossaryTermText,
    glossarySearch,
  ]);

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
      const koName = KO_PERSON[person.id]?.name;
      if (koName && koName.trim().length >= 2) {
        addPattern({
          kind: 'person',
          id: person.id,
          display: koName,
          needle: koName,
          needleLower: koName.toLowerCase(),
          priority: 4,
        });
      }
    }

    for (const term of GLOSSARY_TERMS) {
      const koOverlay = KO_GLOSSARY[term.id];
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
      if (koOverlay?.term && koOverlay.term.trim().length >= 2) {
        addPattern({
          kind: 'glossary',
          id: term.id,
          display: koOverlay.term,
          needle: koOverlay.term,
          needleLower: koOverlay.term.toLowerCase(),
          priority: 2,
        });
      }
      for (const alias of koOverlay?.aliases ?? []) {
        if (alias.trim().length < 2) continue;
        addPattern({
          kind: 'glossary',
          id: term.id,
          display: koOverlay?.term ?? term.term,
          needle: alias,
          needleLower: alias.toLowerCase(),
          priority: 2,
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

  const disputes = useMemo(() => {
    if (!dataset) return [] as DisputeView[];
    const seeded = dataset.disputes?.length ? dataset.disputes : deriveDisputesFromClaims(claims, segmentById);
    return seeded.map((dispute) => ({
      ...dispute,
      effectiveStatus: edits.conflictStatusOverrides[dispute.id] ?? dispute.status,
    }));
  }, [claims, dataset, edits.conflictStatusOverrides, segmentById]);

  const personGroupOptions = useMemo(
    () => ['all', ...Array.from(new Set(people.map((person) => person.group))).sort((a, b) => a.localeCompare(b))],
    [people],
  );

  const eventTypeOptions = useMemo(
    () => ['all', ...Array.from(new Set(events.map((event) => event.eventType))).sort((a, b) => a.localeCompare(b))],
    [events],
  );

  const personHasOpenDispute = useMemo(() => {
    const ids = new Set<string>();
    for (const dispute of disputes) {
      if (dispute.effectiveStatus !== 'open') continue;
      const claim = claimsById.get(dispute.claimId);
      if (!claim) continue;
      if (claim.subjectType === 'person') ids.add(claim.resolvedSubjectId);
      if (claim.subjectType === 'event') {
        const event = events.find((item) => item.id === claim.subjectId);
        for (const id of event?.participantIds ?? []) ids.add(id);
      }
      if (claim.subjectType === 'relationship') {
        const rel = relationships.find((item) => item.id.startsWith(claim.subjectId));
        if (!rel) continue;
        ids.add(rel.sourcePersonId);
        ids.add(rel.targetPersonId);
      }
    }
    return ids;
  }, [claimsById, disputes, events, relationships]);

  useEffect(() => {
    if (!selectedClaimId) return;
    if (!claimsById.has(selectedClaimId)) setSelectedClaimId('');
  }, [claimsById, selectedClaimId]);

  useEffect(() => {
    if (!editorialEnabled && activeTab === 'editorial') {
      setActiveTab('overview');
    }
  }, [activeTab, editorialEnabled]);

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
  const activeTierBPeople = useMemo(
    () => activePeopleAtYear.filter((person) => person.tier === 'B'),
    [activePeopleAtYear],
  );

  const activeRelationshipsAtYear = useMemo(
    () => relationships.filter((rel) => isYearInRange(selectedYear, rel.startYear, rel.endYear)),
    [relationships, selectedYear],
  );

  const activeEventsAtYear = useMemo(
    () =>
      events
        .filter((event) => (eventTypeFilter === 'all' ? true : event.eventType === eventTypeFilter))
        .filter((event) => selectedYear >= event.startYear && selectedYear <= event.endYear),
    [events, eventTypeFilter, selectedYear],
  );

  const nearbyEvents = useMemo(
    () =>
      events
        .filter((event) => (eventTypeFilter === 'all' ? true : event.eventType === eventTypeFilter))
        .filter((event) => {
          const midpoint = Math.floor((event.startYear + event.endYear) / 2);
          return Math.abs(midpoint - selectedYear) <= 4;
        })
        .sort((a, b) => a.startYear - b.startYear),
    [events, eventTypeFilter, selectedYear],
  );

  const officeRows = useMemo(() => {
    const rows: OfficeRow[] = [];
    for (const person of people) {
      for (const [index, office] of person.officeTerms.entries()) {
        rows.push({
          id: `off-${person.id}-${index}-${office.title}`,
          personId: person.id,
          personName: person.canonicalName,
          personTier: person.tier,
          title: office.title,
          startYear: office.startYear,
          endYear: office.endYear,
          confidence: office.confidence,
          sourceId: office.source,
        });
      }
    }
    return rows.sort((a, b) => {
      const yearA = a.startYear ?? 9999;
      const yearB = b.startYear ?? 9999;
      if (yearA !== yearB) return yearA - yearB;
      return a.personName.localeCompare(b.personName);
    });
  }, [people]);

  const activeOfficeRows = useMemo(
    () => officeRows.filter((row) => isYearInRange(selectedYear, row.startYear, row.endYear)),
    [officeRows, selectedYear],
  );

  const matrixWindows = useMemo(() => {
    const base = Math.floor(selectedYear / 10) * 10;
    const windows: MatrixWindow[] = [
      {
        id: `w-${base - 10}`,
        label: `${base - 10}s`,
        startYear: base - 10,
        endYear: base - 1,
      },
      {
        id: `w-${base}`,
        label: `${base}s`,
        startYear: base,
        endYear: base + 9,
      },
      {
        id: `w-${base + 10}`,
        label: `${base + 10}s`,
        startYear: base + 10,
        endYear: base + 19,
      },
    ];
    return windows;
  }, [selectedYear]);

  const matrixPeople = useMemo(() => {
    const withScore = activePeopleAtYear
      .filter((person) => person.tier !== 'C')
      .map((person) => {
        const eventScore = events.filter((event) => event.participantIds.includes(person.id)).length * 2;
        const relationScore = relationships.filter(
          (rel) => rel.sourcePersonId === person.id || rel.targetPersonId === person.id,
        ).length;
        const officeScore = officeRows.filter((office) => office.personId === person.id).length;
        return { person, score: eventScore + relationScore + officeScore };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 14);
    return withScore.map((item) => item.person);
  }, [activePeopleAtYear, events, officeRows, relationships]);

  const sourceCoverageRows = useMemo(() => {
    if (!dataset) return [] as Array<{
      source: Source;
      claimCount: number;
      eventCount: number;
      relationshipCount: number;
      excerpt: string;
      yearSpan: string;
    }>;

    const selected = selectedPersonId ? peopleById.get(selectedPersonId) ?? null : null;
    if (!selected) return [];

    const rows = dataset.sources
      .map((source) => {
        const sourceSegmentIds = new Set(
          dataset.sourceSegments.filter((segment) => segment.sourceId === source.id).map((segment) => segment.id),
        );

        const personClaims = claims.filter(
          (claim) =>
            claim.subjectType === 'person' &&
            claim.resolvedSubjectId === selected.id &&
            !!claim.sourceSegmentId &&
            sourceSegmentIds.has(claim.sourceSegmentId),
        );

        const sourceEvents = events.filter((event) => {
          if (!event.participantIds.includes(selected.id)) return false;
          if (!event.sourceSegmentId) return false;
          return sourceSegmentIds.has(event.sourceSegmentId);
        });

        const sourceRels = relationships.filter((rel) => {
          const touchesPerson = rel.sourcePersonId === selected.id || rel.targetPersonId === selected.id;
          if (!touchesPerson || !rel.sourceSegmentId) return false;
          return sourceSegmentIds.has(rel.sourceSegmentId);
        });

        const years: number[] = [];
        for (const claim of personClaims) {
          if (claim.startYear != null) years.push(claim.startYear);
          if (claim.endYear != null) years.push(claim.endYear);
        }
        for (const event of sourceEvents) {
          years.push(event.startYear, event.endYear);
        }
        for (const rel of sourceRels) {
          years.push(rel.startYear, rel.endYear);
        }

        const excerpt =
          dataset.sourceSegments.find((segment) => sourceSegmentIds.has(segment.id) && segment.excerpt.trim())?.excerpt ?? '';
        const yearSpan = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : 'n/a';

        return {
          source,
          claimCount: personClaims.length,
          eventCount: sourceEvents.length,
          relationshipCount: sourceRels.length,
          excerpt,
          yearSpan,
        };
      })
      .filter((row) => row.claimCount + row.eventCount + row.relationshipCount > 0)
      .sort(
        (a, b) =>
          b.claimCount + b.eventCount + b.relationshipCount - (a.claimCount + a.eventCount + a.relationshipCount),
      );

    return rows;
  }, [claims, dataset, events, peopleById, relationships, selectedPersonId]);

  const filteredPeople = useMemo(() => {
    return people
      .filter((person) => (tierFilter === 'all' ? true : person.tier === tierFilter))
      .filter((person) => (personGroupFilter === 'all' ? true : person.group === personGroupFilter))
      .filter((person) => {
        if (personActivityFilter === 'all') return true;
        if (personActivityFilter === 'active-year') {
          return isYearInRange(selectedYear, person.activeRange.startYear, person.activeRange.endYear);
        }
        if (personActivityFilter === 'has-office') {
          return person.officeTerms.length > 0;
        }
        if (personActivityFilter === 'has-dispute') {
          return personHasOpenDispute.has(person.id);
        }
        return true;
      })
      .filter((person) => {
        if (!personSearch.trim()) return true;
        const query = personSearch.toLowerCase();
        if (person.canonicalName.toLowerCase().includes(query)) return true;
        if ((KO_PERSON[person.id]?.name ?? '').toLowerCase().includes(query)) return true;
        return person.aliases.some((alias) => alias.text.toLowerCase().includes(query));
      });
  }, [people, tierFilter, personGroupFilter, personActivityFilter, selectedYear, personHasOpenDispute, personSearch]);

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
      .filter((claim) => {
        if (reviewConfidenceFilter === 'all') return true;
        if (reviewConfidenceFilter === 'lt-0.86') return claim.confidence.extraction < 0.86;
        if (reviewConfidenceFilter === 'lt-0.9') return claim.confidence.extraction < 0.9;
        if (reviewConfidenceFilter === 'gte-0.9') return claim.confidence.extraction >= 0.9;
        return true;
      })
      .filter((claim) => {
        if (reviewSourceFilter === 'all') return true;
        if (!claim.sourceSegmentId) return false;
        const sourceId = segmentById.get(claim.sourceSegmentId)?.sourceId;
        return sourceId === reviewSourceFilter;
      })
      .sort((a, b) => {
        const statusRank = (status: ClaimStatus) => (status === 'pending' ? 0 : status === 'rejected' ? 1 : 2);
        if (statusRank(a.effectiveStatus) !== statusRank(b.effectiveStatus)) {
          return statusRank(a.effectiveStatus) - statusRank(b.effectiveStatus);
        }
        return (a.startYear ?? 9999) - (b.startYear ?? 9999);
      });
  }, [claims, reviewConfidenceFilter, reviewSourceFilter, reviewStatusFilter, reviewSubjectFilter, segmentById]);

  const reviewDisputes = useMemo(() => {
    const severityRank: Record<Dispute['severity'], number> = { high: 0, medium: 1, low: 2 };
    return disputes
      .filter((dispute) => (disputeFilter === 'all' ? true : dispute.effectiveStatus === disputeFilter))
      .filter((dispute) => (disputeSeverityFilter === 'all' ? true : dispute.severity === disputeSeverityFilter))
      .filter((dispute) => (disputeReasonFilter === 'all' ? true : dispute.reasonType === disputeReasonFilter))
      .sort((a, b) => {
        if (severityRank[a.severity] !== severityRank[b.severity]) {
          return severityRank[a.severity] - severityRank[b.severity];
        }
        return a.id.localeCompare(b.id);
      });
  }, [disputeFilter, disputeReasonFilter, disputeSeverityFilter, disputes]);

  const qaMetrics = useMemo(() => {
    const pendingClaims = claims.filter((claim) => claim.effectiveStatus === 'pending').length;
    const openDisputes = disputes.filter((dispute) => dispute.effectiveStatus === 'open').length;
    const highDisputes = disputes.filter(
      (dispute) => dispute.effectiveStatus === 'open' && dispute.severity === 'high',
    ).length;
    const uncitedClaims = claims.filter((claim) => !claim.sourceSegmentId).length;

    const aliasOwnerByText = new Map<string, Set<string>>();
    for (const person of people) {
      for (const alias of person.aliases) {
        const key = alias.text.trim().toLowerCase();
        if (!key) continue;
        const owners = aliasOwnerByText.get(key) ?? new Set<string>();
        owners.add(person.id);
        aliasOwnerByText.set(key, owners);
      }
    }
    const duplicateAliasLabels = Array.from(aliasOwnerByText.entries()).filter(([, owners]) => owners.size > 1).length;

    return {
      pendingClaims,
      openDisputes,
      highDisputes,
      uncitedClaims,
      duplicateAliasLabels,
      savedViews: savedViews.length,
      reviewerActions: edits.reviewerActions.length,
      splits: edits.splitRecords.length,
      merges: Object.keys(edits.mergeMap).length,
    };
  }, [claims, disputes, people, savedViews.length, edits.reviewerActions.length, edits.splitRecords.length, edits.mergeMap]);

  const reviewerSummary = useMemo(() => {
    const byReviewer = new Map<string, { reviewer: string; actions: number; lastAt: string }>();
    for (const action of edits.reviewerActions) {
      const current = byReviewer.get(action.by) ?? { reviewer: action.by, actions: 0, lastAt: action.at };
      current.actions += 1;
      if (action.at > current.lastAt) current.lastAt = action.at;
      byReviewer.set(action.by, current);
    }
    return Array.from(byReviewer.values()).sort((a, b) => b.actions - a.actions);
  }, [edits.reviewerActions]);

  const releaseNotesDraft = useMemo(() => {
    const approved = claims.filter((claim) => claim.effectiveStatus === 'approved').length;
    const rejected = claims.filter((claim) => claim.effectiveStatus === 'rejected').length;
    const resolvedDisputes = disputes.filter((dispute) => dispute.effectiveStatus === 'resolved').length;
    const dismissedDisputes = disputes.filter((dispute) => dispute.effectiveStatus === 'dismissed').length;
    const openDisputes = disputes.filter((dispute) => dispute.effectiveStatus === 'open').length;
    const now = new Date().toISOString();
    const sourceWork = getWorkLabel(dataset?.sources?.[0] ?? null);
    return [
      `# Hyegyong Atlas Release Notes`,
      '',
      `- Generated: ${now}`,
      `- Dataset: ${dataset?.meta.dataset ?? 'unknown'}`,
      `- Source Work: ${sourceWork}`,
      '',
      `## Editorial Outcomes`,
      `- Claim decisions: ${approved} approved, ${rejected} rejected, ${qaMetrics.pendingClaims} pending`,
      `- Dispute decisions: ${resolvedDisputes} resolved, ${dismissedDisputes} dismissed, ${openDisputes} open`,
      `- Entity operations: ${qaMetrics.merges} merges, ${qaMetrics.splits} split candidates, ${edits.addedPeople.length} added people`,
      '',
      `## Quality Signals`,
      `- Uncited claims: ${qaMetrics.uncitedClaims}`,
      `- High-severity open disputes: ${qaMetrics.highDisputes}`,
      `- Duplicate alias labels: ${qaMetrics.duplicateAliasLabels}`,
      '',
      `## Operational Notes`,
      `- Saved views in circulation: ${qaMetrics.savedViews}`,
      `- Reviewer actions logged: ${qaMetrics.reviewerActions}`,
      `- Reviewer cohort size: ${reviewerSummary.length}`,
    ].join('\n');
  }, [
    claims,
    dataset?.meta.dataset,
    dataset?.sources,
    disputes,
    edits.addedPeople.length,
    qaMetrics,
    reviewerSummary.length,
  ]);

  const tierCMeta = useMemo(() => {
    const raw = (dataset as Dataset & { tierC?: unknown })?.tierC;
    if (!raw || typeof raw !== 'object') return null;
    return raw as TierCMeta;
  }, [dataset]);

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

  const getSourceMetaBySegmentId = useCallback(
    (segmentId: string | null | undefined) => {
      if (!segmentId) return null;
      const segment = segmentById.get(segmentId);
      if (!segment) return null;
      const source = sourceById.get(segment.sourceId);
      return { segment, source };
    },
    [segmentById, sourceById],
  );
  const selectedClaimSourceMeta = getSourceMetaBySegmentId(selectedClaim?.sourceSegmentId);
  const selectedPersonSourceMeta = getSourceMetaBySegmentId(selectedPerson?.sourceSegmentIds?.[0] ?? null);

  const getGroupLabel = useCallback(
    (group: string) => {
      if (uiLanguage !== 'ko') return group;
      return KO_GROUP_LABELS[group] ?? group;
    },
    [uiLanguage],
  );

  const getPersonDisplay = useCallback(
    (person: Person | null | undefined): string => {
      if (!person) return '';
      return withOverlayLabel(person.canonicalName, KO_PERSON[person.id]?.name, uiLanguage);
    },
    [uiLanguage],
  );

  const getGraphPersonLabel = useCallback(
    (person: Person): string => {
      if (uiLanguage === 'ko') return KO_PERSON[person.id]?.name ?? person.canonicalName;
      return person.canonicalName.replace(/^KING\\s+|^QUEEN\\s+|^PRINCESS\\s+|^PRINCE\\s+|^LADY\\s+/, '');
    },
    [uiLanguage],
  );

  const getPersonBiographyText = useCallback(
    (person: Person | null | undefined): string => {
      if (!person) return '';
      if (uiLanguage !== 'ko') return person.biography;
      return KO_PERSON[person.id]?.biography ?? person.biography;
    },
    [uiLanguage],
  );

  const getPersonRelationText = useCallback(
    (person: Person | null | undefined): string | null => {
      if (!person) return null;
      if (uiLanguage !== 'ko') return person.relationToHyegyong ?? null;
      return KO_PERSON[person.id]?.relationToHyegyong ?? person.relationToHyegyong ?? null;
    },
    [uiLanguage],
  );

  const getEventDisplay = useCallback(
    (event: Event | null | undefined): string => {
      if (!event) return '';
      return withOverlayLabel(event.title, KO_EVENT[event.id]?.title, uiLanguage);
    },
    [uiLanguage],
  );

  const getEventSummaryText = useCallback(
    (event: Event | null | undefined): string => {
      if (!event) return '';
      if (uiLanguage !== 'ko') return event.summary;
      return KO_EVENT[event.id]?.summary ?? event.summary;
    },
    [uiLanguage],
  );

  const getEventTypeLabel = useCallback(
    (eventType: string): string => {
      if (uiLanguage !== 'ko') return eventType;
      return KO_EVENT_TYPE_LABELS[eventType] ?? eventType;
    },
    [uiLanguage],
  );

  const getOfficeTitleLabel = useCallback(
    (officeTitle: string): string => {
      if (uiLanguage !== 'ko') return officeTitle;
      return KO_OFFICE_TITLE_LABELS[officeTitle] ?? officeTitle;
    },
    [uiLanguage],
  );

  const getRelationTypeLabel = useCallback(
    (relationType: string): string => {
      if (uiLanguage !== 'ko') return relationType;
      return KO_RELATION_TYPE_LABELS[relationType] ?? relationType;
    },
    [uiLanguage],
  );

  const getRelationshipSummaryText = useCallback(
    (relationship: Relationship): string => {
      if (uiLanguage !== 'ko') return relationship.summary;
      const baseId = relationship.id.split('::')[0];
      return KO_RELATION_SUMMARY[baseId] ?? relationship.summary;
    },
    [uiLanguage],
  );

  const getPredicateLabel = useCallback(
    (predicate: string): string => {
      if (uiLanguage !== 'ko') return predicate;
      return KO_PREDICATE_LABELS[predicate] ?? getRelationTypeLabel(predicate);
    },
    [getRelationTypeLabel, uiLanguage],
  );

  const getPlaceDisplay = useCallback(
    (place: Place | null | undefined): string => {
      if (!place) return '';
      return withOverlayLabel(place.name, KO_PLACE[place.id]?.name, uiLanguage);
    },
    [uiLanguage],
  );

  const getPlaceSummaryText = useCallback(
    (place: Place | null | undefined): string => {
      if (!place) return '';
      if (uiLanguage !== 'ko') return place.summary;
      return KO_PLACE[place.id]?.summary ?? place.summary;
    },
    [uiLanguage],
  );

  const getSourceLabel = useCallback(
    (source: Source | null | undefined): string => {
      if (!source) return '';
      if (uiLanguage !== 'ko') return source.label;
      return KO_SOURCE_LABELS[source.id] ?? source.label;
    },
    [uiLanguage],
  );

  const getWorkLabelLocalized = useCallback(
    (source?: Source | null): string => {
      if (uiLanguage !== 'ko') return getWorkLabel(source);
      if (!source) return '알 수 없는 출처 저작';
      return `${KO_WORK_TITLE} - ${KO_WORK_CONTRIBUTOR}`;
    },
    [uiLanguage],
  );

  const formatClaimValueLocalized = useCallback(
    (value: unknown): string => {
      if (!value || typeof value !== 'object') return formatClaimValue(value);
      if ('title' in value && typeof (value as { title?: unknown }).title === 'string') {
        const office = value as { title: string; startYear?: number | null; endYear?: number | null };
        const localizedTitle = getOfficeTitleLabel(office.title);
        return `${localizedTitle} (${office.startYear ?? '?'}-${office.endYear ?? '?'})`;
      }
      return formatClaimValue(value);
    },
    [getOfficeTitleLabel],
  );

  const getPersonLabel = (personId: string): string => {
    const person = peopleById.get(personId);
    return person ? getPersonDisplay(person) : personId;
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
    if (claim.subjectType === 'event') {
      const event = events.find((item) => item.id === claim.subjectId);
      return getEventDisplay(event) || claim.subjectId;
    }
    if (claim.subjectType === 'relationship') {
      const rel = relationships.find((item) => item.id.startsWith(claim.subjectId));
      if (!rel) return claim.subjectId;
      return `${getPersonLabel(rel.sourcePersonId)} ↔ ${getPersonLabel(rel.targetPersonId)}`;
    }
    return claim.subjectId;
  };

  const captureViewSnapshot = useCallback((): ViewSnapshot => {
    return {
      activeTab,
      year: selectedYear,
      personId: selectedPersonId,
      eventId: selectedEventId,
      claimId: selectedClaimId,
      glossaryId: selectedGlossaryId,
      personSearch,
      tierFilter,
      personGroupFilter,
      personActivityFilter,
      eventTypeFilter,
      reviewStatusFilter,
      reviewSubjectFilter,
      reviewConfidenceFilter,
      reviewSourceFilter,
      disputeFilter,
      disputeSeverityFilter,
      disputeReasonFilter,
      showReferenceDetails,
      uiLanguage,
      fieldMode,
    };
  }, [
    activeTab,
    disputeFilter,
    disputeReasonFilter,
    disputeSeverityFilter,
    eventTypeFilter,
    fieldMode,
    personActivityFilter,
    personGroupFilter,
    personSearch,
    reviewConfidenceFilter,
    reviewSourceFilter,
    reviewStatusFilter,
    reviewSubjectFilter,
    selectedClaimId,
    selectedEventId,
    selectedGlossaryId,
    selectedPersonId,
    selectedYear,
    showReferenceDetails,
    tierFilter,
    uiLanguage,
  ]);

  const applyViewSnapshot = useCallback(
    (snapshot: Partial<ViewSnapshot>) => {
      if (snapshot.activeTab) setActiveTab(snapshot.activeTab);
      if (typeof snapshot.year === 'number') {
        if (dataset) {
          setSelectedYear(clamp(snapshot.year, dataset.yearRange.startYear, dataset.yearRange.endYear));
        } else {
          setSelectedYear(snapshot.year);
        }
      }
      if (typeof snapshot.personId === 'string') setSelectedPersonId(snapshot.personId);
      if (typeof snapshot.eventId === 'string') setSelectedEventId(snapshot.eventId);
      if (typeof snapshot.claimId === 'string') setSelectedClaimId(snapshot.claimId);
      if (typeof snapshot.glossaryId === 'string') setSelectedGlossaryId(snapshot.glossaryId);
      if (typeof snapshot.personSearch === 'string') setPersonSearch(snapshot.personSearch);
      if (snapshot.tierFilter) setTierFilter(snapshot.tierFilter);
      if (typeof snapshot.personGroupFilter === 'string') setPersonGroupFilter(snapshot.personGroupFilter);
      if (snapshot.personActivityFilter) setPersonActivityFilter(snapshot.personActivityFilter);
      if (typeof snapshot.eventTypeFilter === 'string') setEventTypeFilter(snapshot.eventTypeFilter);
      if (snapshot.reviewStatusFilter) setReviewStatusFilter(snapshot.reviewStatusFilter);
      if (snapshot.reviewSubjectFilter) setReviewSubjectFilter(snapshot.reviewSubjectFilter);
      if (snapshot.reviewConfidenceFilter) setReviewConfidenceFilter(snapshot.reviewConfidenceFilter);
      if (typeof snapshot.reviewSourceFilter === 'string') setReviewSourceFilter(snapshot.reviewSourceFilter);
      if (snapshot.disputeFilter) setDisputeFilter(snapshot.disputeFilter);
      if (snapshot.disputeSeverityFilter) setDisputeSeverityFilter(snapshot.disputeSeverityFilter);
      if (snapshot.disputeReasonFilter) setDisputeReasonFilter(snapshot.disputeReasonFilter);
      if (typeof snapshot.showReferenceDetails === 'boolean') setShowReferenceDetails(snapshot.showReferenceDetails);
      if (snapshot.uiLanguage) setUiLanguage(snapshot.uiLanguage);
      if (typeof snapshot.fieldMode === 'boolean') setFieldMode(snapshot.fieldMode);
    },
    [dataset],
  );

  const applySavedView = (viewId: string) => {
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    applyViewSnapshot(view.snapshot);
    setShareMessage(`Loaded view: ${view.name}`);
  };

  const saveCurrentView = () => {
    const baseName = newSavedViewName.trim();
    const name = baseName || `${activeTab} @ ${selectedYear}`;
    const now = new Date().toISOString();
    const snapshot = captureViewSnapshot();
    const next: SavedView = {
      id: `view-${Date.now().toString(36)}`,
      name,
      createdAt: now,
      updatedAt: now,
      snapshot,
    };
    setSavedViews((previous) => [next, ...previous].slice(0, 40));
    setNewSavedViewName('');
    setShareMessage(`Saved view: ${name}`);
  };

  const deleteSavedView = (viewId: string) => {
    setSavedViews((previous) => previous.filter((view) => view.id !== viewId));
  };

  const shareUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('y', String(selectedYear));
    if (selectedPersonId) params.set('p', selectedPersonId);
    if (selectedEventId) params.set('e', selectedEventId);
    if (selectedClaimId) params.set('c', selectedClaimId);
    if (selectedGlossaryId) params.set('g', selectedGlossaryId);
    if (personSearch.trim()) params.set('ps', personSearch.trim());
    if (tierFilter !== 'all') params.set('tier', tierFilter);
    if (personGroupFilter !== 'all') params.set('grp', personGroupFilter);
    if (personActivityFilter !== 'all') params.set('pact', personActivityFilter);
    if (eventTypeFilter !== 'all') params.set('etype', eventTypeFilter);
    if (reviewStatusFilter !== 'pending') params.set('rs', reviewStatusFilter);
    if (reviewSubjectFilter !== 'all') params.set('rsub', reviewSubjectFilter);
    if (reviewConfidenceFilter !== 'all') params.set('rcf', reviewConfidenceFilter);
    if (reviewSourceFilter !== 'all') params.set('rsrc', reviewSourceFilter);
    if (disputeFilter !== 'open') params.set('df', disputeFilter);
    if (disputeSeverityFilter !== 'all') params.set('dsev', disputeSeverityFilter);
    if (disputeReasonFilter !== 'all') params.set('dr', disputeReasonFilter);
    if (uiLanguage !== 'en') params.set('lang', uiLanguage);
    if (fieldMode) params.set('fm', '1');
    if (showReferenceDetails) params.set('deep', '1');
    const query = params.toString();
    const base = `${window.location.origin}${window.location.pathname}`;
    return query ? `${base}?${query}` : base;
  }, [
    activeTab,
    disputeFilter,
    disputeReasonFilter,
    disputeSeverityFilter,
    eventTypeFilter,
    fieldMode,
    personActivityFilter,
    personGroupFilter,
    personSearch,
    reviewConfidenceFilter,
    reviewSourceFilter,
    reviewStatusFilter,
    reviewSubjectFilter,
    selectedClaimId,
    selectedEventId,
    selectedGlossaryId,
    selectedPersonId,
    selectedYear,
    showReferenceDetails,
    tierFilter,
    uiLanguage,
  ]);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage('Share link copied.');
    } catch {
      setShareMessage('Unable to copy link automatically.');
    }
  };

  const appendReviewerAction = useCallback(
    (previous: LocalEdits, targetType: ReviewerAction['targetType'], targetId: string, action: string, note?: string) => {
      const by = reviewerName.trim() || 'anonymous';
      const row = createActionRecord(targetType, targetId, action, by, reviewerRole, note);
      return {
        ...previous,
        reviewerActions: [row, ...previous.reviewerActions].slice(0, 600),
      };
    },
    [reviewerName, reviewerRole],
  );

  useEffect(() => {
    if (!dataset || queryHydratedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const year = Number(params.get('y'));
    const tab = params.get('tab') as TabId | null;
    const lang = params.get('lang');
    const snapshot: Partial<ViewSnapshot> = {
      activeTab: tab ?? undefined,
      year: Number.isFinite(year) ? year : undefined,
      personId: params.get('p') ?? undefined,
      eventId: params.get('e') ?? undefined,
      claimId: params.get('c') ?? undefined,
      glossaryId: params.get('g') ?? undefined,
      personSearch: params.get('ps') ?? undefined,
      tierFilter: (params.get('tier') as 'all' | Tier | null) ?? undefined,
      personGroupFilter: params.get('grp') ?? undefined,
      personActivityFilter: (params.get('pact') as PersonActivityFilter | null) ?? undefined,
      eventTypeFilter: (params.get('etype') as EventTypeFilter | null) ?? undefined,
      reviewStatusFilter: (params.get('rs') as 'all' | ClaimStatus | null) ?? undefined,
      reviewSubjectFilter: (params.get('rsub') as 'all' | 'person' | 'relationship' | 'event' | null) ?? undefined,
      reviewConfidenceFilter: (params.get('rcf') as ConfidenceFilter | null) ?? undefined,
      reviewSourceFilter: params.get('rsrc') ?? undefined,
      disputeFilter: (params.get('df') as 'all' | DisputeStatus | null) ?? undefined,
      disputeSeverityFilter: (params.get('dsev') as 'all' | 'high' | 'medium' | 'low' | null) ?? undefined,
      disputeReasonFilter: (params.get('dr') as 'all' | Dispute['reasonType'] | null) ?? undefined,
      uiLanguage: (lang === 'ko' || lang === 'en' ? lang : undefined) as UiLanguage | undefined,
      fieldMode: queryToBool(params.get('fm')),
      showReferenceDetails: queryToBool(params.get('deep')),
    };
    applyViewSnapshot(snapshot);
    queryHydratedRef.current = true;
  }, [applyViewSnapshot, dataset]);

  useEffect(() => {
    if (!queryHydratedRef.current) return;
    const url = new URL(window.location.href);
    if (url.href === shareUrl) return;
    window.history.replaceState(null, '', shareUrl);
  }, [shareUrl]);

  const setClaimStatus = (claimId: string, status: ClaimStatus | 'reset') => {
    if (!canEdit) return;
    setEdits((previous) => {
      let next = { ...previous, claimStatusOverrides: { ...previous.claimStatusOverrides } };
      if (status === 'reset') {
        delete next.claimStatusOverrides[claimId];
      } else {
        next.claimStatusOverrides[claimId] = status;
      }
      next = appendReviewerAction(next, 'claim', claimId, status === 'reset' ? 'reset-status' : status);
      return next;
    });
  };

  const setDisputeStatus = (disputeId: string, status: DisputeStatus | 'reset') => {
    if (!canEdit) return;
    setEdits((previous) => {
      let next = { ...previous, conflictStatusOverrides: { ...previous.conflictStatusOverrides } };
      if (status === 'reset') {
        delete next.conflictStatusOverrides[disputeId];
      } else {
        next.conflictStatusOverrides[disputeId] = status;
      }
      next = appendReviewerAction(next, 'dispute', disputeId, status === 'reset' ? 'reset-status' : status);
      return next;
    });
  };

  const mergeEntities = () => {
    if (!canEdit) return;
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;

    const resolvedTarget = resolvePersonId(mergeTargetId);
    if (resolvedTarget === mergeSourceId) return;

    setEdits((previous) => {
      const nextMap = { ...previous.mergeMap, [mergeSourceId]: resolvedTarget };

      for (const [source, target] of Object.entries(nextMap)) {
        nextMap[source] = resolveMergedId(target, nextMap);
      }

      return appendReviewerAction(
        {
        ...previous,
        mergeMap: nextMap,
        },
        'entity',
        `${mergeSourceId}->${resolvedTarget}`,
        'merge-entity',
      );
    });

    setMergeSourceId('');
  };

  const unmergeEntity = (sourceId: string) => {
    if (!canEdit) return;
    setEdits((previous) => {
      const nextMap = { ...previous.mergeMap };
      delete nextMap[sourceId];
      return appendReviewerAction({ ...previous, mergeMap: nextMap }, 'entity', sourceId, 'unmerge-entity');
    });
  };

  const addAlias = () => {
    if (!canEdit) return;
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
      return appendReviewerAction(
        {
        ...previous,
        addedAliases: {
          ...previous.addedAliases,
          [aliasPersonId]: uniqueBy([...current, alias], (item) => item.text.toLowerCase()),
        },
        },
        'entity',
        aliasPersonId,
        'add-alias',
        alias.text,
      );
    });

    setNewAliasText('');
  };

  const addCharacter = () => {
    if (!canEdit) return;
    const name = newPersonName.trim();
    const bio = newPersonBio.trim();
    if (!name || !bio) return;

    const id = `person-custom-${Date.now().toString(36)}`;
    const startYear = parseYearInput(newPersonStart);
    const endYear = parseYearInput(newPersonEnd);

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

    setEdits((previous) =>
      appendReviewerAction(
        {
          ...previous,
          addedPeople: [...previous.addedPeople, customPerson],
          addedClaims: [...previous.addedClaims, customClaim],
        },
        'entity',
        customPerson.id,
        'add-person',
        customPerson.canonicalName,
      ),
    );

    setNewPersonName('');
    setNewPersonBio('');
    setNewPersonStart('');
    setNewPersonEnd('');
  };

  const splitEntity = () => {
    if (!canEdit) return;
    const sourceId = splitSourceId;
    const name = splitName.trim();
    if (!sourceId || !name) return;

    const sourcePerson = peopleById.get(sourceId);
    if (!sourcePerson) return;

    const startYear = parseYearInput(splitStartYear) ?? sourcePerson.activeRange.startYear;
    const endYear = parseYearInput(splitEndYear) ?? sourcePerson.activeRange.endYear;
    const rationale = splitRationale.trim() || `Split candidate carved from ${sourcePerson.canonicalName}.`;

    const personId = `person-split-${Date.now().toString(36)}`;
    const splitRecordId = `split-${Date.now().toString(36)}`;
    const splitPerson: Person = {
      id: personId,
      canonicalName: name,
      group: 'Editorial Splits',
      lifeLabel: [startYear, endYear].filter((value) => value != null).join('–') || 'split-candidate',
      birthYear: startYear ?? null,
      deathYear: endYear ?? null,
      reignStartYear: null,
      reignEndYear: null,
      biography: `Split candidate from ${sourcePerson.canonicalName}. ${rationale}`,
      relationToHyegyong: sourcePerson.relationToHyegyong,
      tier: sourcePerson.tier,
      aliases: [
        {
          id: `alias-${personId}-from-source`,
          text: sourcePerson.canonicalName,
          language: 'en',
          script: 'latin',
          type: 'split-origin',
          startYear: sourcePerson.activeRange.startYear,
          endYear: sourcePerson.activeRange.endYear,
          confidence: 0.7,
        },
      ],
      officeTerms: [],
      sourceSegmentIds: sourcePerson.sourceSegmentIds.slice(0, 1),
      activeRange: {
        startYear: startYear ?? null,
        endYear: endYear ?? null,
      },
    };

    const splitClaim: Claim = {
      id: `clm-split-${personId}`,
      subjectType: 'person',
      subjectId: personId,
      predicate: 'split-from',
      value: {
        fromPersonId: sourcePerson.id,
        fromName: sourcePerson.canonicalName,
        rationale,
      },
      startYear: startYear ?? null,
      endYear: endYear ?? null,
      confidence: {
        extraction: 1,
        resolution: 0.7,
        historical: 'editorial',
      },
      status: 'pending',
      sourceSegmentId: sourcePerson.sourceSegmentIds[0] ?? null,
      notes: 'Tier B split workflow candidate. Review before canonical adoption.',
    };

    const splitRecord: SplitRecord = {
      id: splitRecordId,
      sourcePersonId: sourcePerson.id,
      newPersonId: personId,
      rationale,
      createdAt: new Date().toISOString(),
    };

    setEdits((previous) =>
      appendReviewerAction(
        {
          ...previous,
          addedPeople: [...previous.addedPeople, splitPerson],
          addedClaims: [...previous.addedClaims, splitClaim],
          splitRecords: [...previous.splitRecords, splitRecord],
        },
        'entity',
        `${sourcePerson.id}->${splitPerson.id}`,
        'split-entity',
        rationale,
      ),
    );

    setSelectedPersonId(personId);
    setSplitSourceId('');
    setSplitName('');
    setSplitStartYear('');
    setSplitEndYear('');
    setSplitRationale('');
  };

  const undoSplit = (recordId: string) => {
    if (!canEdit) return;
    setEdits((previous) => {
      const record = previous.splitRecords.find((item) => item.id === recordId);
      if (!record) return previous;
      return appendReviewerAction(
        {
        ...previous,
        splitRecords: previous.splitRecords.filter((item) => item.id !== recordId),
        addedPeople: previous.addedPeople.filter((person) => person.id !== record.newPersonId),
        addedClaims: previous.addedClaims.filter((claim) => claim.subjectId !== record.newPersonId),
        },
        'entity',
        recordId,
        'undo-split',
      );
    });
  };

  const exportEditorialState = () => {
    if (!canEdit) return;
    if (!dataset) return;

    const payload = {
      version: EDITORIAL_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      dataset: dataset.meta.dataset,
      datasetGeneratedAt: dataset.meta.generatedAt,
      edits: normalizeEdits(edits),
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hyegyong-editorial-state-${stamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStateError(null);
    setStateMessage('Editorial state exported.');
  };

  const resetEditorialState = () => {
    if (!canEdit) return;
    setEdits(createEmptyEdits());
    setStateError(null);
    setStateMessage('Editorial state reset to empty.');
  };

  const importEditorialState = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setStateError(null);
    setStateMessage(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid state file format.');
      }

      const maybe = parsed as {
        dataset?: unknown;
        edits?: Partial<LocalEdits>;
      };

      const importedDataset = typeof maybe.dataset === 'string' ? maybe.dataset : null;
      const editsPayload =
        maybe.edits && typeof maybe.edits === 'object'
          ? normalizeEdits(maybe.edits)
          : normalizeEdits(parsed as Partial<LocalEdits>);

      setEdits(editsPayload);

      if (dataset && importedDataset && importedDataset !== dataset.meta.dataset) {
        setStateError(
          `Imported state dataset (${importedDataset}) differs from current dataset (${dataset.meta.dataset}). State was still loaded.`,
        );
      } else {
        setStateMessage('Editorial state imported.');
      }
    } catch (err) {
      setStateError(err instanceof Error ? err.message : 'Failed to import state file.');
    } finally {
      event.target.value = '';
    }
  };

  const unlockEditorial = () => {
    if (!editorialEnabled) return;
    if (!EDITOR_ACCESS_CODE) {
      setEditorUnlocked(true);
      setStateError(null);
      setStateMessage('Editorial authoring unlocked.');
      return;
    }
    if (editorUnlockInput.trim() === EDITOR_ACCESS_CODE) {
      setEditorUnlocked(true);
      setEditorUnlockInput('');
      setStateError(null);
      setStateMessage('Editorial authoring unlocked.');
      return;
    }
    setStateError('Editorial access code is incorrect.');
  };

  const lockEditorial = () => {
    if (!editorialEnabled) return;
    if (!EDITOR_ACCESS_CODE) return;
    setEditorUnlocked(false);
    setStateMessage('Editorial authoring locked.');
  };

  const exportReleaseNotes = () => {
    if (!canLead) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([releaseNotesDraft], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hyegyong-release-notes-${stamp}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setShareMessage('Release notes exported.');
  };

  useEffect(() => {
    if (!shareMessage) return;
    const handle = window.setTimeout(() => setShareMessage(null), 2800);
    return () => window.clearTimeout(handle);
  }, [shareMessage]);

  if (loading) {
    return <div className="app-shell loading">Loading atlas dataset…</div>;
  }

  if (error || !dataset) {
    return <div className="app-shell error">{error ?? 'Failed to load data.'}</div>;
  }

  const yearMin = dataset.yearRange.startYear;
  const yearMax = dataset.yearRange.endYear;
  const primaryWorkSource = dataset.sources[0];
  const primaryWorkLabel = primaryWorkSource ? getWorkLabelLocalized(primaryWorkSource) : dataset.meta.sourceEdition;
  const tierLabel =
    dataset.meta.dataset === 'hyegyong-tier-c'
      ? 'Tier C reference workspace'
      : dataset.meta.dataset === 'hyegyong-tier-b'
        ? 'Tier B reference workspace'
        : 'Tier A reference workspace';

  return (
    <div className={`app-shell ${fieldMode ? 'field-mode' : ''}`}>
      <header className="topbar">
        <div>
          <h1>Hyegyong Atlas</h1>
          <p>
            {tierLabel} · canonical language: English
          </p>
        </div>
        <div className="topbar-side">
          <div className="topbar-meta">
            <span title={primaryWorkSource?.workCitation ?? dataset.meta.sourceEdition}>
              {uiLanguage === 'ko' ? '출처 저작' : 'Source Work'}: {primaryWorkLabel}
            </span>
            <span>Dataset: {dataset.meta.dataset}</span>
            <span>Snapshot: {new Date(dataset.meta.generatedAt).toLocaleString()}</span>
            <span>Network: {isOnline ? 'online' : 'offline'}</span>
            <span>People: {people.length}</span>
            <span>Claims: {claims.length}</span>
          </div>
          <div className="topbar-actions">
            <select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UiLanguage)}>
              <option value="en">EN</option>
              <option value="ko">KO</option>
            </select>
            <button type="button" onClick={() => setFieldMode((previous) => !previous)}>
              {t('fieldMode', 'Field Mode')}: {fieldMode ? 'ON' : 'OFF'}
            </button>
            <input
              value={newSavedViewName}
              onChange={(event) => setNewSavedViewName(event.target.value)}
              placeholder="Saved view name"
            />
            <button type="button" onClick={saveCurrentView}>
              {t('saveView', 'Save View')}
            </button>
            <button type="button" onClick={copyShareLink}>
              {t('copyLink', 'Copy Link')}
            </button>
          </div>
          {editorialEnabled && (
            <div className="reviewer-controls">
              <input
                value={reviewerName}
                onChange={(event) => setReviewerName(event.target.value)}
                placeholder={`${t('reviewer', 'Reviewer')} name`}
              />
              <select value={reviewerRole} onChange={(event) => setReviewerRole(event.target.value as ReviewerRole)}>
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="lead">lead</option>
              </select>
              {!!EDITOR_ACCESS_CODE && !editorUnlocked && (
                <>
                  <input
                    value={editorUnlockInput}
                    onChange={(event) => setEditorUnlockInput(event.target.value)}
                    placeholder="Editorial access code"
                    type="password"
                  />
                  <button type="button" onClick={unlockEditorial}>
                    Unlock
                  </button>
                </>
              )}
              {!!EDITOR_ACCESS_CODE && editorUnlocked && (
                <button type="button" onClick={lockEditorial}>
                  Lock
                </button>
              )}
            </div>
          )}
          {shareMessage && <p className="state-message ok topbar-msg">{shareMessage}</p>}
        </div>
      </header>

      <section className="timeline-card">
        <div className="timeline-header">
          <strong>{t('timelineSpine', 'Timeline Spine')}</strong>
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
              ['overview', t('overview', 'Overview')],
              ['people', t('people', 'People')],
              ['relationships', t('relationships', 'Relationships')],
              ['family', t('family', 'Family Tree')],
              ['offices', t('offices', 'Offices')],
              ['matrix', t('matrix', 'Matrix')],
              ['map', t('map', 'Palace Map')],
              ['sources', t('sources', 'Source Compare')],
              ['glossary', t('glossary', 'Glossary')],
              ...(editorialEnabled ? ([['editorial', t('editorial', 'Editorial')]] as const) : ([] as const)),
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
            <p>
              Mode:{' '}
              {editorialEnabled
                ? canEdit
                  ? `Editorial (${reviewerRole})`
                  : 'Editorial (view-only)'
                : 'Public (read-only)'}
            </p>
            <p>Tier A people active: {activeTierAPeople.length}</p>
            <p>Tier B people active: {activeTierBPeople.length}</p>
            <p>Relationships active: {activeRelationshipsAtYear.length}</p>
            <p>Events active: {activeEventsAtYear.length}</p>
            <p>Offices active: {activeOfficeRows.length}</p>
            <p>Open disputes: {disputes.filter((dispute) => dispute.effectiveStatus === 'open').length}</p>
            <p>
              Pending claims:{' '}
              {claims.filter((claim) => claim.effectiveStatus === 'pending').length}
            </p>
            <select value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value as EventTypeFilter)}>
              {eventTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? (uiLanguage === 'ko' ? '모든 사건 유형' : 'All event types') : getEventTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div className="saved-views-card">
            <h3>Saved Views</h3>
            <div className="saved-view-list">
              {savedViews.length ? (
                savedViews.slice(0, 8).map((view) => (
                  <div key={view.id} className="saved-view-row">
                    <button type="button" className="saved-view-open" onClick={() => applySavedView(view.id)}>
                      {view.name}
                    </button>
                    <button type="button" className="saved-view-delete" onClick={() => deleteSavedView(view.id)}>
                      x
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">No saved views yet.</p>
              )}
            </div>
          </div>
        </aside>

        <main className="main-panel">
          {activeTab === 'overview' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>{t('crossSectionSnapshot', 'Cross-Section Snapshot')}</h2>
                <p>
                  Dynamic view of Hyegyong&apos;s world at <strong>{selectedYear}</strong>.
                  The same year drives people, relations, and events.
                </p>
              </section>

              <section className="card">
                <h3>Nearby Major Events</h3>
                <div className="event-list">
                  {(nearbyEvents.length ? nearbyEvents : events.slice(0, 8)).map((event) => {
                    const eventMeta = getSourceMetaBySegmentId(event.sourceSegmentId);
                    return (
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
                            <strong>{getEventDisplay(event)}</strong>
                            <span>
                              {event.startYear}
                              {event.endYear !== event.startYear ? `–${event.endYear}` : ''}
                            </span>
                          </div>
                        </button>
                        <p className="linked-block">{renderLinkedText(getEventSummaryText(event), 140)}</p>
                        <SourceReference
                          source={eventMeta?.source}
                          sectionLabel={getSourceLabel(eventMeta?.source)}
                          language={uiLanguage}
                          workLabel={getWorkLabelLocalized(eventMeta?.source)}
                        />
                        {showDeepReference && (
                          <ProvenanceTags
                            items={[
                              { label: 'Event', value: event.id },
                              { label: 'Work', value: getWorkLabelLocalized(eventMeta?.source) },
                              { label: 'Section', value: getSourceLabel(eventMeta?.source) || 'unknown' },
                              { label: 'Path', value: eventMeta?.source?.path ?? 'n/a' },
                              { label: 'Segment', value: eventMeta?.segment?.id ?? 'n/a' },
                              { label: 'Method', value: 'seeded-event' },
                              { label: 'Confidence', value: event.confidence.toFixed(2) },
                            ]}
                          />
                        )}
                      </article>
                    );
                  })}
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
                      {getPersonDisplay(person)}
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
                  <select value={personGroupFilter} onChange={(event) => setPersonGroupFilter(event.target.value)}>
                    {personGroupOptions.map((group) => (
                      <option key={group} value={group}>
                        {group === 'all' ? (uiLanguage === 'ko' ? '모든 집단' : 'All groups') : getGroupLabel(group)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={personActivityFilter}
                    onChange={(event) => setPersonActivityFilter(event.target.value as PersonActivityFilter)}
                  >
                    <option value="all">All activity</option>
                    <option value="active-year">Active at selected year</option>
                    <option value="has-office">Has office/rank terms</option>
                    <option value="has-dispute">Linked to open dispute</option>
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
                        <strong>{getPersonDisplay(person)}</strong>
                        <span>{person.lifeLabel}</span>
                      </div>
                      <small>
                        Tier {person.tier} · {getGroupLabel(person.group)}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="subpanel detail">
                {selectedPerson ? (
                  <>
                    <h2>{getPersonDisplay(selectedPerson)}</h2>
                    <p>{renderLinkedText(getPersonBiographyText(selectedPerson))}</p>
                    <SourceReference
                      source={selectedPersonSourceMeta?.source}
                      sectionLabel={getSourceLabel(selectedPersonSourceMeta?.source)}
                      language={uiLanguage}
                      workLabel={getWorkLabelLocalized(selectedPersonSourceMeta?.source)}
                    />
                    <p>
                      <strong>Life:</strong> {selectedPerson.lifeLabel}
                    </p>
                    {getPersonRelationText(selectedPerson) && (
                      <p>
                        <strong>{uiLanguage === 'ko' ? '혜경궁과의 관계:' : 'Relation to Hyegyŏng:'}</strong>{' '}
                        {renderLinkedText(getPersonRelationText(selectedPerson) ?? '')}
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
                              <strong>{getOfficeTitleLabel(office.title)}</strong>
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
                                  {getRelationTypeLabel(rel.relationType)} · {rel.startYear}-{rel.endYear}
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
                  getNodeLabel={getGraphPersonLabel}
                  onSelectPerson={(personId) => {
                    setSelectedPersonId(personId);
                    setActiveTab('people');
                  }}
                />
              </section>

              <section className="card">
                <h3>Active Relationship Rows</h3>
                <div className="table-list">
                  {activeRelationshipsAtYear.map((rel) => {
                    const relMeta = getSourceMetaBySegmentId(rel.sourceSegmentId);
                    return (
                      <div key={rel.id} className="table-row">
                        <strong>
                          {getPersonLabel(rel.sourcePersonId)} ↔ {getPersonLabel(rel.targetPersonId)}
                        </strong>
                        <span>
                          {getRelationTypeLabel(rel.relationType)} · {rel.startYear}-{rel.endYear}
                        </span>
                        <p>{renderLinkedText(getRelationshipSummaryText(rel), 140)}</p>
                        <SourceReference
                          source={relMeta?.source}
                          sectionLabel={getSourceLabel(relMeta?.source)}
                          language={uiLanguage}
                          workLabel={getWorkLabelLocalized(relMeta?.source)}
                        />
                        {showDeepReference && (
                          <ProvenanceTags
                            items={[
                              { label: 'Relationship', value: rel.id },
                              { label: 'Work', value: getWorkLabelLocalized(relMeta?.source) },
                              { label: 'Section', value: getSourceLabel(relMeta?.source) || 'unknown' },
                              { label: 'Path', value: relMeta?.source?.path ?? 'n/a' },
                              { label: 'Segment', value: relMeta?.segment?.id ?? 'n/a' },
                              { label: 'Method', value: 'seeded-relationship' },
                              { label: 'Confidence', value: rel.confidence.toFixed(2) },
                            ]}
                          />
                        )}
                      </div>
                    );
                  })}
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
                          {getPersonDisplay(person)}
                        </option>
                      ))}
                  </select>
                </p>
                {familyRoot ? (
                  <FamilyCards
                    root={familyRoot}
                    edges={familyEdges}
                    getPersonLabel={getPersonLabel}
                    getRelationLabel={getRelationTypeLabel}
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

          {activeTab === 'offices' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>Office / Rank Timeline</h2>
                <p>
                  Offices visible at <strong>{selectedYear}</strong>:{' '}
                  <strong>{activeOfficeRows.length}</strong>. Click a row to open the person profile.
                </p>
                <OfficeTimeline
                  rows={officeRows}
                  yearRange={dataset.yearRange}
                  selectedYear={selectedYear}
                  getPersonLabel={getPersonLabel}
                  getOfficeTitleLabel={getOfficeTitleLabel}
                  onSelectPerson={(personId) => {
                    setSelectedPersonId(personId);
                    setActiveTab('people');
                  }}
                />
              </section>

              <section className="card">
                <h3>Active Offices This Year</h3>
                <div className="table-list">
                  {activeOfficeRows.length ? (
                    activeOfficeRows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="table-row office-row"
                        onClick={() => {
                          setSelectedPersonId(row.personId);
                          setActiveTab('people');
                        }}
                      >
                        <strong>{getPersonLabel(row.personId)}</strong>
                        <span>
                          {getOfficeTitleLabel(row.title)} · {row.startYear ?? '?'}-{row.endYear ?? '?'}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="muted">No office terms overlap this year.</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'matrix' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>Event Cross-Section Matrix</h2>
                <p>
                  Matrix columns are decade windows around {selectedYear}. Cells combine event, relationship, and office
                  activity for rapid parallel comparison.
                </p>
                <CrossSectionMatrix
                  people={matrixPeople}
                  windows={matrixWindows}
                  events={events}
                  relationships={relationships}
                  officeRows={officeRows}
                  getPersonLabel={getPersonDisplay}
                  onSelectPerson={(personId) => {
                    setSelectedPersonId(personId);
                    setActiveTab('people');
                  }}
                />
              </section>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>Palace / Site Map Overlay</h2>
                <p>
                  Spatial quick-view for discussions like "she would have been here" at year {selectedYear}. Nodes show
                  memoir-linked palace and punishment sites.
                </p>
                <PalaceMap
                  places={dataset.places}
                  events={events}
                  selectedYear={selectedYear}
                  selectedEventId={selectedEventId}
                  getEventLabel={getEventDisplay}
                  getPlaceLabel={getPlaceDisplay}
                  onSelectEvent={(eventId) => {
                    setSelectedEventId(eventId);
                    setSelectedClaimId(`clm-event-${eventId}`);
                  }}
                />
              </section>
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>Source Comparison</h2>
                <p>
                  Cross-section by section/source for the selected person. This is Tier B scaffolding for future
                  multi-book comparison.
                </p>
                {selectedPerson ? (
                  <h3>{getPersonDisplay(selectedPerson)}</h3>
                ) : (
                  <p className="muted">Select a person to compare source coverage.</p>
                )}
                <div className="table-list">
                  {sourceCoverageRows.length ? (
                    sourceCoverageRows.map((row) => (
                      <article key={row.source.id} className="table-row source-coverage-row">
                        <strong>{getSourceLabel(row.source)}</strong>
                        <span>
                          Claims {row.claimCount} · Events {row.eventCount} · Relationships {row.relationshipCount}
                        </span>
                        <span>Years: {row.yearSpan}</span>
                        <SourceReference
                          source={row.source}
                          sectionLabel={getSourceLabel(row.source)}
                          language={uiLanguage}
                          workLabel={getWorkLabelLocalized(row.source)}
                        />
                        <p>{renderLinkedText(row.excerpt, 180)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="muted">No source rows for this person yet.</p>
                  )}
                </div>
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
                        <strong>{getGlossaryTermText(term.id, term.term)}</strong>
                        <span>{getGlossaryCategoryText(term.id, term.category)}</span>
                      </div>
                      <small>{getGlossaryAliases(term.id, term.aliases).slice(0, 2).join(', ')}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="subpanel detail">
                {selectedGlossaryTerm ? (
                  <>
                    <h2>{getGlossaryTermText(selectedGlossaryTerm.id, selectedGlossaryTerm.term)}</h2>
                    <p>{renderLinkedText(getGlossaryDefinitionText(selectedGlossaryTerm.id, selectedGlossaryTerm.definition))}</p>
                    {!!getGlossaryAliases(selectedGlossaryTerm.id, selectedGlossaryTerm.aliases).length && (
                      <section>
                        <h3>{uiLanguage === 'ko' ? '별칭' : 'Aliases'}</h3>
                        <div className="inline-list">
                          {getGlossaryAliases(selectedGlossaryTerm.id, selectedGlossaryTerm.aliases).map((alias) => (
                            <span key={alias} className="pill">
                              {alias}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}
                    <section>
                      <h3>{uiLanguage === 'ko' ? '분류' : 'Category'}</h3>
                      <p className="muted">{getGlossaryCategoryText(selectedGlossaryTerm.id, selectedGlossaryTerm.category)}</p>
                    </section>
                  </>
                ) : (
                  <p>Select a glossary term.</p>
                )}
              </div>
            </div>
          )}

          {editorialEnabled && activeTab === 'editorial' && (
            <div className="panel-scroll">
              <section className="card">
                <h2>State Management</h2>
                <p className="muted">
                  Export or import editorial state before major ingest/review passes so merge, split, and alias decisions
                  remain portable.
                </p>
                <div className="action-row">
                  <button type="button" onClick={exportEditorialState}>
                    Export State JSON
                  </button>
                  <label className="file-upload">
                    Import State JSON
                    <input type="file" accept="application/json,.json" onChange={importEditorialState} />
                  </label>
                  <button type="button" onClick={resetEditorialState}>
                    Reset Local State
                  </button>
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={showReferenceDetails}
                    onChange={(event) => setShowReferenceDetails(event.target.checked)}
                  />
                  Show full provenance details in cards
                </label>
                {stateMessage && <p className="state-message ok">{stateMessage}</p>}
                {stateError && <p className="state-message error">{stateError}</p>}

                <div className="baseline-meta">
                  <h3>Dataset Baseline</h3>
                  {baselineMeta ? (
                    <>
                      <p className="muted">Created: {new Date(baselineMeta.createdAt).toLocaleString()}</p>
                      <p className="muted">Dataset: {baselineMeta.dataset}</p>
                      <p className="muted">SHA-256: {baselineMeta.sha256.slice(0, 16)}…</p>
                      <p className="muted">
                        Counts: {baselineMeta.counts.people} people · {baselineMeta.counts.events} events ·{' '}
                        {baselineMeta.counts.relationships} relationships · {baselineMeta.counts.claims} claims
                        {typeof baselineMeta.counts.disputes === 'number' ? ` · ${baselineMeta.counts.disputes} disputes` : ''}
                        {typeof baselineMeta.counts.places === 'number' ? ` · ${baselineMeta.counts.places} places` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="muted">
                      No frozen baseline metadata found yet. Run <code>npm run freeze:tier-c</code> (or tier-specific{' '}
                      <code>freeze:tier-b</code> / <code>freeze:tier-a</code>).
                    </p>
                  )}
                </div>
              </section>

              <section className="card">
                <h2>Tier C QA Dashboard</h2>
                <div className="qa-grid">
                  <article>
                    <strong>{qaMetrics.pendingClaims}</strong>
                    <span>Pending claims</span>
                  </article>
                  <article>
                    <strong>{qaMetrics.openDisputes}</strong>
                    <span>Open disputes</span>
                  </article>
                  <article>
                    <strong>{qaMetrics.highDisputes}</strong>
                    <span>High-severity disputes</span>
                  </article>
                  <article>
                    <strong>{qaMetrics.uncitedClaims}</strong>
                    <span>Uncited claims</span>
                  </article>
                  <article>
                    <strong>{qaMetrics.duplicateAliasLabels}</strong>
                    <span>Duplicate alias labels</span>
                  </article>
                  <article>
                    <strong>{qaMetrics.reviewerActions}</strong>
                    <span>Reviewer actions</span>
                  </article>
                </div>
                <p className="muted">
                  Saved views: {qaMetrics.savedViews} · Merges: {qaMetrics.merges} · Split candidates: {qaMetrics.splits}
                </p>
                {tierCMeta?.focusedPass && (
                  <details className="focused-pass-card">
                    <summary>Focused data pass signals</summary>
                    <p className="muted">
                      Alias collisions: {tierCMeta.quality?.aliasCollisions?.length ?? 0} · Name collisions:{' '}
                      {tierCMeta.quality?.nameCollisions?.length ?? 0}
                    </p>
                    <div className="focused-pass-grid">
                      <article>
                        <h4>Top Sources</h4>
                        <div className="table-list">
                          {(tierCMeta.focusedPass.sourceCoverage ?? []).slice(0, 5).map((row) => (
                            <div key={row.sourceId} className="table-row">
                              <strong>{row.label}</strong>
                              <span>
                                {row.totalMentions} total · C{row.claimCount} E{row.eventCount} R{row.relationshipCount}
                              </span>
                            </div>
                          ))}
                        </div>
                      </article>
                      <article>
                        <h4>People Needing Review</h4>
                        <div className="table-list">
                          {(tierCMeta.focusedPass.personFocus ?? []).slice(0, 5).map((row) => (
                            <div key={row.personId} className="table-row">
                              <strong>{getPersonLabel(row.personId)}</strong>
                              <span>
                                open disputes {row.openDisputes} · mentions {row.totalMentions}
                              </span>
                            </div>
                          ))}
                        </div>
                      </article>
                    </div>
                  </details>
                )}
              </section>

              <section className="card">
                <h2>Reviewer Activity</h2>
                <div className="table-list">
                  {reviewerSummary.length ? (
                    reviewerSummary.map((row) => (
                      <div key={row.reviewer} className="table-row">
                        <strong>{row.reviewer}</strong>
                        <span>
                          {row.actions} actions · last {new Date(row.lastAt).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No reviewer actions logged yet.</p>
                  )}
                </div>
                {!!edits.reviewerActions.length && (
                  <details>
                    <summary>Recent actions</summary>
                    <div className="table-list">
                      {edits.reviewerActions.slice(0, 20).map((action) => (
                        <div key={action.id} className="table-row">
                          <strong>
                            {action.by} ({action.role})
                          </strong>
                          <span>
                            {action.action} · {action.targetType}:{action.targetId}
                          </span>
                          <small>{new Date(action.at).toLocaleString()}</small>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>

              <section className="card">
                <h2>Release Notes Draft</h2>
                <p className="muted">Auto-generated from current dataset + editorial state.</p>
                <textarea className="release-notes-box" readOnly value={releaseNotesDraft} />
                <div className="action-row">
                  <button type="button" onClick={exportReleaseNotes} disabled={!canLead}>
                    Export Release Notes (.md)
                  </button>
                  {!canLead && <span className="muted">Lead role required to export.</span>}
                </div>
              </section>

              <section className="card">
                <h2>Conflict Resolution Queue</h2>
                <div className="filters review-filters">
                  <select
                    value={disputeFilter}
                    onChange={(event) => setDisputeFilter(event.target.value as 'all' | DisputeStatus)}
                  >
                    <option value="open">Open only</option>
                    <option value="all">All statuses</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <select
                    value={disputeSeverityFilter}
                    onChange={(event) =>
                      setDisputeSeverityFilter(event.target.value as 'all' | 'high' | 'medium' | 'low')
                    }
                  >
                    <option value="all">All severities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={disputeReasonFilter}
                    onChange={(event) => setDisputeReasonFilter(event.target.value as 'all' | Dispute['reasonType'])}
                  >
                    <option value="all">All reasons</option>
                    <option value="contested-framing">Contested framing</option>
                    <option value="evidence-gap">Evidence gap</option>
                    <option value="low-confidence">Low confidence</option>
                  </select>
                </div>

                <div className="claim-list">
                  {reviewDisputes.slice(0, 120).map((dispute) => {
                    const claim = claimsById.get(dispute.claimId);
                    const sourceMeta = getSourceMetaBySegmentId(dispute.sourceSegmentId);
                    return (
                      <article key={dispute.id} className={`claim-item dispute-item severity-${dispute.severity}`}>
                        <header>
                          <strong>{claim ? claimSubjectLabel(claim) : dispute.subjectId}</strong>
                          <span>{dispute.reasonType}</span>
                        </header>
                        <div className="action-row action-row-top">
                          <button onClick={() => setDisputeStatus(dispute.id, 'resolved')}>Resolve</button>
                          <button onClick={() => setDisputeStatus(dispute.id, 'dismissed')}>Dismiss</button>
                          <button onClick={() => setDisputeStatus(dispute.id, 'reset')}>Reset</button>
                          {claim && (
                            <button
                              onClick={() => {
                                setSelectedClaimId(claim.id);
                              }}
                            >
                              Focus Claim
                            </button>
                          )}
                        </div>
                        <p className="muted">
                          Severity {dispute.severity} · status {dispute.effectiveStatus}
                        </p>
                        <p>{renderLinkedText(dispute.summary)}</p>
                        <SourceReference
                          source={sourceMeta?.source}
                          sectionLabel={getSourceLabel(sourceMeta?.source)}
                          language={uiLanguage}
                          workLabel={getWorkLabelLocalized(sourceMeta?.source)}
                        />
                        <p className="muted">{dispute.suggestedAction}</p>
                      </article>
                    );
                  })}
                  {!reviewDisputes.length && <p className="muted">No disputes in this filter.</p>}
                </div>
              </section>

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
                  <select
                    value={reviewConfidenceFilter}
                    onChange={(event) => setReviewConfidenceFilter(event.target.value as ConfidenceFilter)}
                  >
                    <option value="all">Any confidence</option>
                    <option value="lt-0.86">&lt; 0.86</option>
                    <option value="lt-0.9">&lt; 0.90</option>
                    <option value="gte-0.9">≥ 0.90</option>
                  </select>
                  <select value={reviewSourceFilter} onChange={(event) => setReviewSourceFilter(event.target.value)}>
                    <option value="all">All source sections</option>
                    {dataset.sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {getSourceLabel(source)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="claim-list">
                  {reviewClaims.slice(0, 120).map((claim) => {
                    const segment = claim.sourceSegmentId ? segmentById.get(claim.sourceSegmentId) : null;
                    const source = segment ? sourceById.get(segment.sourceId) : null;
                    const method = inferClaimMethod(claim);
                    return (
                      <article key={claim.id} className={`claim-item status-${claim.effectiveStatus}`}>
                        <header>
                          <strong>{claimSubjectLabel(claim)}</strong>
                          <span>{getPredicateLabel(claim.predicate)}</span>
                        </header>
                        <div className="action-row action-row-top">
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
                        <p className="muted">
                          {claim.startYear ?? '?'} - {claim.endYear ?? '?'} · extraction {claim.confidence.extraction.toFixed(2)}
                          {claim.mergedFrom ? ` · merged from ${claim.mergedFrom}` : ''}
                        </p>
                        <SourceReference
                          source={source}
                          sectionLabel={getSourceLabel(source)}
                          language={uiLanguage}
                          workLabel={getWorkLabelLocalized(source)}
                        />
                        {showDeepReference && (
                          <ProvenanceTags
                            items={[
                              { label: 'Claim', value: claim.id },
                              { label: 'Work', value: getWorkLabelLocalized(source) },
                              { label: 'Section', value: getSourceLabel(source) || 'unknown' },
                              { label: 'Path', value: source?.path ?? 'n/a' },
                              { label: 'Segment', value: segment?.id ?? 'n/a' },
                              { label: 'Method', value: method },
                              { label: 'Extraction', value: claim.confidence.extraction.toFixed(2) },
                              { label: 'Resolution', value: claim.confidence.resolution.toFixed(2) },
                              { label: 'Status', value: claim.effectiveStatus },
                            ]}
                          />
                        )}
                        <p>{renderLinkedText(formatClaimValueLocalized(claim.value), 200)}</p>
                        {segment && (
                          <details>
                            <summary>Evidence</summary>
                            <p>{renderLinkedText(segment.excerpt)}</p>
                          </details>
                        )}
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
                          {getPersonDisplay(person)}
                        </option>
                      ))}
                  </select>
                  <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}>
                    <option value="">Target entity</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {getPersonDisplay(person)}
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
                          {getPersonDisplay(allPeopleLookup.get(source)) || source} →{' '}
                          {getPersonDisplay(allPeopleLookup.get(target)) || target}
                        </span>
                        <button onClick={() => unmergeEntity(source)}>Undo</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <h3>Split Entity Tool</h3>
                <p className="muted">
                  Create a candidate person when one canonical entity appears conflated. This does not delete source
                  data; it creates a reviewable split record.
                </p>
                <div className="add-character-grid">
                  <select value={splitSourceId} onChange={(event) => setSplitSourceId(event.target.value)}>
                    <option value="">Source entity</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {getPersonDisplay(person)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={splitName}
                    onChange={(event) => setSplitName(event.target.value)}
                    placeholder="New canonical name"
                  />
                  <textarea
                    value={splitRationale}
                    onChange={(event) => setSplitRationale(event.target.value)}
                    placeholder="Split rationale (why this should be a separate person)"
                  />
                  <div className="inline-fields">
                    <input
                      value={splitStartYear}
                      onChange={(event) => setSplitStartYear(event.target.value)}
                      placeholder="Start year"
                    />
                    <input
                      value={splitEndYear}
                      onChange={(event) => setSplitEndYear(event.target.value)}
                      placeholder="End year"
                    />
                    <button type="button" onClick={splitEntity}>
                      Create Split Candidate
                    </button>
                  </div>
                </div>
                {!!edits.splitRecords.length && (
                  <div className="merge-list">
                    {edits.splitRecords.map((record) => (
                      <div key={record.id} className="merge-row">
                        <span>
                          {getPersonDisplay(allPeopleLookup.get(record.sourcePersonId)) || record.sourcePersonId} →{' '}
                          {getPersonDisplay(allPeopleLookup.get(record.newPersonId)) || record.newPersonId}
                        </span>
                        <button type="button" onClick={() => undoSplit(record.id)}>
                          Undo Split
                        </button>
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
                        {getPersonDisplay(person)}
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
                ? `Event: ${getEventDisplay(selectedEvent)}`
                : selectedPerson
                  ? `Person: ${getPersonDisplay(selectedPerson)}`
                  : 'Select an item.'}
          </p>
          {selectedClaim && (
            <SourceReference
              source={selectedClaimSourceMeta?.source}
              sectionLabel={getSourceLabel(selectedClaimSourceMeta?.source)}
              language={uiLanguage}
              workLabel={getWorkLabelLocalized(selectedClaimSourceMeta?.source)}
            />
          )}
          {selectedClaim && (
            showDeepReference && (
              <ProvenanceTags
                items={[
                  { label: 'Claim', value: selectedClaim.id },
                  {
                    label: 'Method',
                    value: inferClaimMethod(selectedClaim),
                  },
                  { label: 'Status', value: selectedClaim.effectiveStatus },
                  { label: 'Extraction', value: selectedClaim.confidence.extraction.toFixed(2) },
                  { label: 'Resolution', value: selectedClaim.confidence.resolution.toFixed(2) },
                ]}
              />
            )
          )}

          <div className="evidence-list">
            {evidenceSegments.length ? (
              evidenceSegments.map((segment) => {
                const source = sourceById.get(segment.sourceId);
                return (
                  <article key={segment.id} className="evidence-item">
                    <header>
                      <strong>{segment.label}</strong>
                      <span>{getSourceLabel(source) || segment.sourceId}</span>
                    </header>
                    <SourceReference
                      source={source}
                      sectionLabel={getSourceLabel(source)}
                      language={uiLanguage}
                      workLabel={getWorkLabelLocalized(source)}
                    />
                    {showDeepReference && (
                      <ProvenanceTags
                        items={[
                          { label: 'Work', value: getWorkLabelLocalized(source) },
                          { label: 'Section', value: getSourceLabel(source) || 'unknown' },
                          { label: 'Path', value: source?.path ?? 'n/a' },
                          { label: 'Segment', value: segment.id },
                        ]}
                      />
                    )}
                    <p>{renderLinkedText(segment.excerpt)}</p>
                    {showDeepReference && <small>{source?.path}</small>}
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
                    {getEventDisplay(event)}
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
                    <strong>{getPlaceDisplay(place)}</strong>
                    <p>{renderLinkedText(getPlaceSummaryText(place), 120)}</p>
                    <SourceReference
                      source={primaryWorkSource}
                      sectionLabel={uiLanguage === 'ko' ? 'Tier A 회고록 기반 초기 모델' : 'Tier A memoir-derived seed model'}
                      language={uiLanguage}
                      workLabel={getWorkLabelLocalized(primaryWorkSource)}
                    />
                  </article>
                ))}
            </div>
          </section>

          <section className="card compact">
            <h4>Glossary Focus</h4>
            {selectedGlossaryTerm ? (
              <article className="glossary-focus">
                <strong>{getGlossaryTermText(selectedGlossaryTerm.id, selectedGlossaryTerm.term)}</strong>
                <p>{renderLinkedText(getGlossaryDefinitionText(selectedGlossaryTerm.id, selectedGlossaryTerm.definition), 170)}</p>
                <button type="button" className="event-mini" onClick={() => setActiveTab('glossary')}>
                  {uiLanguage === 'ko' ? '용어집 열기' : 'Open glossary'}
                </button>
              </article>
            ) : (
              <p className="muted">
                {uiLanguage === 'ko' ? '링크된 용어를 누르면 용어집 맥락이 표시됩니다.' : 'Click a linked term to focus glossary context.'}
              </p>
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
  getNodeLabel: (person: Person) => string;
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
            {props.getNodeLabel(node.person)}
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
  getRelationLabel: (relationType: string) => string;
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
        <span>{props.getRelationLabel(edge.relationType)}</span>
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

function OfficeTimeline(props: {
  rows: OfficeRow[];
  yearRange: Dataset['yearRange'];
  selectedYear: number;
  getPersonLabel: (personId: string) => string;
  getOfficeTitleLabel: (officeTitle: string) => string;
  onSelectPerson: (personId: string) => void;
}) {
  const minYear = props.yearRange.startYear;
  const maxYear = props.yearRange.endYear;
  const span = Math.max(1, maxYear - minYear);
  const visibleRows = props.rows.slice(0, 120);

  return (
    <div className="office-timeline">
      {visibleRows.map((row) => {
        const start = row.startYear ?? minYear;
        const end = row.endYear ?? maxYear;
        const left = ((start - minYear) / span) * 100;
        const width = Math.max(2, ((Math.max(end, start) - start + 1) / span) * 100);
        const active = isYearInRange(props.selectedYear, row.startYear, row.endYear);
        return (
          <button
            key={row.id}
            type="button"
            className={`office-timeline-row ${active ? 'active' : ''}`}
            onClick={() => props.onSelectPerson(row.personId)}
          >
            <span className="office-person-label">{props.getPersonLabel(row.personId)}</span>
            <div className="office-track">
              <span className="office-bar" style={{ left: `${left}%`, width: `${width}%` }} />
              <small className="office-title">
                {props.getOfficeTitleLabel(row.title)} ({row.startYear ?? '?'}-{row.endYear ?? '?'})
              </small>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CrossSectionMatrix(props: {
  people: Person[];
  windows: MatrixWindow[];
  events: Event[];
  relationships: Relationship[];
  officeRows: OfficeRow[];
  getPersonLabel: (person: Person) => string;
  onSelectPerson: (personId: string) => void;
}) {
  return (
    <div className="matrix-shell">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>Person</th>
            {props.windows.map((window) => (
              <th key={window.id}>{window.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.people.map((person) => (
            <tr key={person.id}>
              <td>
                <button type="button" className="inline-link person" onClick={() => props.onSelectPerson(person.id)}>
                  {props.getPersonLabel(person)}
                </button>
              </td>
              {props.windows.map((window) => {
                const eventCount = props.events.filter(
                  (event) =>
                    event.participantIds.includes(person.id) &&
                    rangesOverlap(event.startYear, event.endYear, window.startYear, window.endYear),
                ).length;

                const relationCount = props.relationships.filter(
                  (rel) =>
                    (rel.sourcePersonId === person.id || rel.targetPersonId === person.id) &&
                    rangesOverlap(rel.startYear, rel.endYear, window.startYear, window.endYear),
                ).length;

                const officeCount = props.officeRows.filter(
                  (office) =>
                    office.personId === person.id &&
                    rangesOverlap(office.startYear, office.endYear, window.startYear, window.endYear),
                ).length;

                const score = eventCount * 2 + relationCount + officeCount;
                return (
                  <td key={`${person.id}-${window.id}`}>
                    <button
                      type="button"
                      className={`matrix-cell ${score > 0 ? 'hot' : ''}`}
                      onClick={() => props.onSelectPerson(person.id)}
                      title={`Events: ${eventCount}, Relationships: ${relationCount}, Offices: ${officeCount}`}
                    >
                      <strong>{score}</strong>
                      <small>E{eventCount} · R{relationCount} · O{officeCount}</small>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PalaceMap(props: {
  places: Place[];
  events: Event[];
  selectedYear: number;
  selectedEventId: string;
  getEventLabel: (event: Event) => string;
  getPlaceLabel: (place: Place) => string;
  onSelectEvent: (eventId: string) => void;
}) {
  const mapPlaces = props.places.filter(
    (place): place is Place & { mapX: number; mapY: number } =>
      typeof place.mapX === 'number' && typeof place.mapY === 'number',
  );

  const placeById = new Map(mapPlaces.map((place) => [place.id, place] as const));
  const focusEvents = props.events.filter((event) => {
    if (!event.placeId || !placeById.has(event.placeId)) return false;
    return Math.abs(event.startYear - props.selectedYear) <= 10 || isYearInRange(props.selectedYear, event.startYear, event.endYear);
  });

  const eventsByPlace = new Map<string, Event[]>();
  for (const event of focusEvents) {
    if (!event.placeId) continue;
    const existing = eventsByPlace.get(event.placeId) ?? [];
    existing.push(event);
    eventsByPlace.set(event.placeId, existing);
  }

  return (
    <div className="palace-map-shell">
      <svg viewBox="0 0 100 100" className="palace-map-svg" role="img" aria-label="Palace and site map">
        <rect x="0" y="0" width="100" height="100" className="map-bg" />
        <rect x="30" y="30" width="26" height="24" className="map-zone seoul" />
        <rect x="62" y="56" width="24" height="24" className="map-zone suwon" />
        <rect x="5" y="10" width="24" height="84" className="map-zone exile" />

        {mapPlaces.map((place) => {
          const count = eventsByPlace.get(place.id)?.length ?? 0;
          const hasSelectedEvent = (eventsByPlace.get(place.id) ?? []).some((event) => event.id === props.selectedEventId);
          return (
            <g key={place.id} className={`map-node ${hasSelectedEvent ? 'selected' : ''}`}>
              <circle cx={place.mapX} cy={place.mapY} r={count ? 2.5 + Math.min(2.5, count * 0.6) : 2.2} />
              <text x={place.mapX + 1.6} y={place.mapY - 1.4}>
                {props.getPlaceLabel(place)}
              </text>
              {count > 0 && (
                <text x={place.mapX} y={place.mapY + 0.9} textAnchor="middle" className="map-count">
                  {count}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="event-mini-list">
        {focusEvents.length ? (
          focusEvents
            .sort((a, b) => a.startYear - b.startYear)
            .slice(0, 14)
            .map((event) => (
              <button
                key={event.id}
                className={`event-mini ${props.selectedEventId === event.id ? 'active' : ''}`}
                onClick={() => props.onSelectEvent(event.id)}
              >
                {event.startYear}: {props.getEventLabel(event)}
              </button>
            ))
        ) : (
          <p className="muted">No mapped events near this year window.</p>
        )}
      </div>
    </div>
  );
}

export default App;

function SourceReference(props: {
  source?: Source | null;
  sectionLabel?: string;
  language?: UiLanguage;
  workLabel?: string;
}) {
  const workLabel = props.workLabel ?? getWorkLabel(props.source);
  const section = props.sectionLabel ?? props.source?.label;
  const citation = props.source?.workCitation;
  const prefix = props.language === 'ko' ? '출처 저작' : 'Source Work';
  const sectionPrefix = props.language === 'ko' ? '섹션' : 'Section';

  return (
    <p className="source-reference" title={citation ?? workLabel}>
      <strong>{prefix}:</strong> {workLabel}
      {section ? <span> · {sectionPrefix}: {section}</span> : null}
    </p>
  );
}

function ProvenanceTags(props: { items: Array<{ label: string; value: string }> }) {
  const visible = props.items.filter((item) => item.value && item.value.trim().length > 0);
  if (!visible.length) return null;
  return (
    <div className="provenance-tags">
      {visible.map((item) => (
        <span key={`${item.label}:${item.value}`} className="provenance-tag">
          <strong>{item.label}:</strong> {item.value}
        </span>
      ))}
    </div>
  );
}
