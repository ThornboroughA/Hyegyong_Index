# Hyegyong Atlas

Interactive reference workspace for exploring *The Memoirs of Lady Hyegyong* through one synchronized timeline, with people/events/relationships, evidence traceability, and editorial review tools.

## Product Spine

- One shared timeline controls context across the full app.
- Every surfaced fact is traceable back to source passages.
- Entity work is reversible (merge/split with action history).
- English remains canonical data; Korean is an overlay.
- Public and editorial modes are separated for safe publishing.

## Current Capabilities

- Timeline spine with year density strip and linked cross-section navigation.
- People explorer with searchable aliases, biography context, office/rank timelines, and relationship drill-down.
- Relationship network and family lens views.
- Event cross-section matrix and palace/site map overlays.
- Source comparison by selected person.
- Editorial workflows:
  - claim review inbox
  - conflict/dispute queue
  - merge/split tools
  - alias manager
  - add-character workflow
  - reviewer roles, action feed, release notes export
- Saved views and shareable query-string links.
- Offline/PWA shell support.
- Optional image slots for people/events/places/relationships/sources/evidence blocks.

## Image Workflow

The app now supports visual curation through an optional media manifest:

- Manifest path: `public/data/media-index.json`
- Asset folder (recommended): `public/media/`
- Supported buckets:
  - `people`
  - `events`
  - `places`
  - `relationships`
  - `sources`
  - `sourceSegments`
  - `claims`

Each entry is keyed by canonical ID and supports:

- `src` (required)
- `alt`
- `caption`
- `credit`
- `focalPoint` (CSS object-position, e.g. `"50% 20%"`)

Example:

```json
{
  "people": {
    "person-lady-hyegyong": {
      "src": "/media/people/lady-hyegyong.jpg",
      "alt": "Portrait of Lady Hyegyong",
      "caption": "Reference portrait",
      "credit": "Collection / rights holder",
      "focalPoint": "50% 20%"
    }
  }
}
```

If no image is mapped, the UI shows a non-breaking placeholder card.

## Data + References

- Source EPUB: `../The Memoirs of Lady Hyegyong.epub`
- Generated references: `references/`
- Runtime dataset fallback order:
  - `public/data/tier-c.json`
  - `public/data/tier-b.json`
  - `public/data/tier-a.json`

## Commands

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
```

Public read-only build:

```bash
VITE_APP_MODE=public npm run build
```

Editorial build:

```bash
VITE_APP_MODE=editorial npm run build
```

Rebuild datasets:

```bash
npm run build:data
```

Freeze a baseline snapshot:

```bash
npm run freeze:tier-c
```

## Operational Notes

- Editorial state persists in browser `localStorage`.
- Export state JSON before major ingest/review sessions.
- Korean overlays are defined in `src/localization-ko.ts`.
- Service worker registers only in production builds.
- Legacy script names still use `tier-*` naming for dataset compatibility.
