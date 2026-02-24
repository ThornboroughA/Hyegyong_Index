export type Tier = 'A' | 'B' | 'C';

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

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
}

export interface Source {
  id: string;
  label: string;
  path: string;
  edition: string;
}

export interface SourceSegment {
  id: string;
  sourceId: string;
  label: string;
  excerpt: string;
  yearHint: number | null;
}

export interface Place {
  id: string;
  name: string;
  type: string;
  summary: string;
  modern: string;
  confidence: number;
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
}

export interface LocalEdits {
  claimStatusOverrides: Record<string, ClaimStatus>;
  mergeMap: Record<string, string>;
  addedAliases: Record<string, Alias[]>;
  addedPeople: Person[];
  addedClaims: Claim[];
}
