export type Tier = 'A' | 'B' | 'C';

export type ClaimStatus = 'pending' | 'approved' | 'rejected';
export type DisputeStatus = 'open' | 'resolved' | 'dismissed';
export type ReviewerRole = 'viewer' | 'editor' | 'lead';

export interface MediaAsset {
  src: string;
  alt?: string;
  caption?: string;
  credit?: string;
  focalPoint?: string;
}

export interface MediaIndex {
  people?: Record<string, MediaAsset>;
  events?: Record<string, MediaAsset>;
  places?: Record<string, MediaAsset>;
  relationships?: Record<string, MediaAsset>;
  sources?: Record<string, MediaAsset>;
  sourceSegments?: Record<string, MediaAsset>;
  claims?: Record<string, MediaAsset>;
}

export interface Alias {
  id: string;
  text: string;
  language: string;
  script: string;
  type: string;
  startYear: number | null;
  endYear: number | null;
  confidence: number;
}

export interface OfficeTerm {
  title: string;
  startYear: number | null;
  endYear: number | null;
  confidence: number;
  source: string;
}

export interface Person {
  id: string;
  canonicalName: string;
  group: string;
  lifeLabel: string;
  birthYear: number | null;
  deathYear: number | null;
  reignStartYear: number | null;
  reignEndYear: number | null;
  biography: string;
  relationToHyegyong: string | null;
  tier: Tier;
  aliases: Alias[];
  officeTerms: OfficeTerm[];
  sourceSegmentIds: string[];
  activeRange: {
    startYear: number | null;
    endYear: number | null;
  };
  image?: MediaAsset;
}

export interface Source {
  id: string;
  label: string;
  path: string;
  edition: string;
  workId: string;
  workTitle: string;
  workContributors: string;
  workPublisher: string;
  workYear: string;
  workType: 'book' | 'journal' | 'derived-reference' | 'other';
  workCitation: string;
  image?: MediaAsset;
}

export interface SourceSegment {
  id: string;
  sourceId: string;
  label: string;
  excerpt: string;
  yearHint: number | null;
  image?: MediaAsset;
}

export interface Place {
  id: string;
  name: string;
  type: string;
  summary: string;
  modern: string;
  confidence: number;
  mapX?: number;
  mapY?: number;
  mapGroup?: string;
  image?: MediaAsset;
}

export interface Event {
  id: string;
  title: string;
  startYear: number;
  endYear: number;
  eventType: string;
  summary: string;
  participantIds: string[];
  placeId: string | null;
  sourceSegmentId: string;
  confidence: number;
  tier: Tier;
  image?: MediaAsset;
}

export interface Relationship {
  id: string;
  sourcePersonId: string;
  targetPersonId: string;
  relationType: string;
  startYear: number;
  endYear: number;
  summary: string;
  confidence: number;
  sourceSegmentId: string | null;
  tier: Tier;
  image?: MediaAsset;
}

export interface Claim {
  id: string;
  subjectType: 'person' | 'relationship' | 'event';
  subjectId: string;
  predicate: string;
  value: unknown;
  startYear: number | null;
  endYear: number | null;
  confidence: {
    extraction: number;
    resolution: number;
    historical: string;
  };
  status: ClaimStatus;
  sourceSegmentId: string | null;
  notes: string;
  image?: MediaAsset;
}

export interface Dispute {
  id: string;
  claimId: string;
  subjectType: 'person' | 'relationship' | 'event';
  subjectId: string;
  reasonType: 'low-confidence' | 'evidence-gap' | 'contested-framing';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  sourceIds: string[];
  sourceSegmentId: string | null;
  status: DisputeStatus;
  suggestedAction: string;
}

export interface SplitRecord {
  id: string;
  sourcePersonId: string;
  newPersonId: string;
  rationale: string;
  createdAt: string;
}

export interface ReviewerAction {
  id: string;
  targetType: 'claim' | 'dispute' | 'entity';
  targetId: string;
  action: string;
  by: string;
  role: ReviewerRole;
  at: string;
  note?: string;
}

export interface YearDensityRow {
  year: number;
  count: number;
  appearsIn: string[];
}

export interface Dataset {
  meta: {
    schemaVersion: string;
    dataset: string;
    generatedAt: string;
    generator: string;
    sourceEdition: string;
    languageCanonical: string;
    languageOverlays: string[];
  };
  yearRange: {
    startYear: number;
    endYear: number;
    focusStart: number;
    focusEnd: number;
  };
  yearDensity: YearDensityRow[];
  sources: Source[];
  sourceSegments: SourceSegment[];
  people: Person[];
  places: Place[];
  events: Event[];
  relationships: Relationship[];
  claims: Claim[];
  disputes?: Dispute[];
}

export interface LocalEdits {
  claimStatusOverrides: Record<string, ClaimStatus>;
  conflictStatusOverrides: Record<string, DisputeStatus>;
  mergeMap: Record<string, string>;
  addedAliases: Record<string, Alias[]>;
  addedPeople: Person[];
  addedClaims: Claim[];
  splitRecords: SplitRecord[];
  reviewerActions: ReviewerAction[];
}
