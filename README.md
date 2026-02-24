# Hyegyong Atlas (Tier A + Tier B + Tier C)

Interactive reference web app for exploring *The Memoirs of Lady Hyegyong* with a shared timeline, people graph, and editorial review workflow.

## Tier A scope implemented

- Timeline spine (global year control)
- Cross-section snapshot at selected year
- People explorer (Tier A/B/C aware)
- Person detail view with aliases, office terms, and relationship rows
- Basic relationship graph (time-filtered)
- Family-tree lens (relationship cards centered on selected person)
- Inline cross-linking in prose:
  - person-name links (canonical names + supported aliases)
  - glossary-term links
- Glossary tab with searchable historical terms
- Evidence panel with source-linked excerpts
- Editorial mode:
  - claim review inbox (`pending` / `approved` / `rejected`)
  - entity merge tool
  - alias manager
  - add-character workflow
  - state management (export/import/reset editorial decisions)

## Tier B scope implemented

- Office/rank timeline view (cross-person bars + active-year slice)
- Event cross-section matrix (parallel people/time windows)
- Palace/site map overlays with event hotspots
- Source comparison panel (section-level coverage by selected person)
- Conflict/dispute queue with resolve/dismiss/reset workflow
- Split entity workflow (create/undo split candidates with audit records)
- Tier B memoir-derived data expansion:
  - additional events
  - additional office terms
  - map coordinates for key locations
  - seeded dispute flags

## Tier C scope implemented

- Advanced operational filters:
  - person group/activity filters
  - event-type filter
  - review inbox confidence/source filters
  - dispute reason/severity filters
- Saved views and shareable query-string links
- Multi-reviewer workflow scaffolding:
  - reviewer identity + role (`viewer` / `editor` / `lead`)
  - action log feed
  - lead-gated release notes export
- Publication-safe editorial controls:
  - public build excludes editorial tab
  - optional editorial unlock code (`VITE_EDITOR_ACCESS_CODE`)
- Tier C QA dashboard:
  - quality counters
  - focused data-pass summaries (top sources + people needing review)
- Mobile-friendly field mode toggle
- Offline/PWA support:
  - manifest + service worker caching for app shell and dataset files
- Bilingual framework extension:
  - English canonical data
  - Korean overlay for high-value people/events in key UI contexts

## Data and extraction

- Source EPUB: `../The Memoirs of Lady Hyegyong.epub`
- Generated references live in `references/`
- Tier A dataset file: `public/data/tier-a.json`
- Tier B dataset file: `public/data/tier-b.json`
- Tier C dataset file: `public/data/tier-c.json`
- Dataset build scripts:
  - `scripts/build_tier_a_data.py`
  - `scripts/build_tier_b_data.py`
  - `scripts/build_tier_c_data.py`

## Commands

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
```

Public read-only build (no editorial tab):

```bash
VITE_APP_MODE=public npm run build
```

Editor/studio build (authoring enabled):

```bash
VITE_APP_MODE=editorial npm run build
```

Rebuild dataset only:

```bash
npm run build:data
```

Tier-specific dataset builds:

```bash
npm run build:data:tier-a
npm run build:data:tier-b
npm run build:data:tier-c
```

Freeze a Tier A baseline snapshot:

```bash
npm run freeze:tier-a
```

This writes:

- `baselines/tier-a-baseline-<timestamp>.json`
- `baselines/tier-a-baseline.latest.json`
- `baselines/tier-a-baseline.meta.json`
- `public/data/tier-a-baseline.meta.json` (for in-app baseline display)

Freeze a Tier B baseline snapshot:

```bash
npm run freeze:tier-b
```

This writes:

- `baselines/tier-b-baseline-<timestamp>.json`
- `baselines/tier-b-baseline.latest.json`
- `baselines/tier-b-baseline.meta.json`
- `public/data/tier-b-baseline.meta.json` (for in-app baseline display)

Freeze a Tier C baseline snapshot:

```bash
npm run freeze:tier-c
```

This writes:

- `baselines/tier-c-baseline-<timestamp>.json`
- `baselines/tier-c-baseline.latest.json`
- `baselines/tier-c-baseline.meta.json`
- `public/data/tier-c-baseline.meta.json` (for in-app baseline display)

## Notes

- Editorial actions persist in browser `localStorage` under key `hyegyong-atlas-tier-a-edits-v1`.
- The app loads `public/data/tier-b.json` first and falls back to `public/data/tier-a.json` if Tier B is missing.
- The app loads `public/data/tier-c.json` first and falls back to Tier B, then Tier A.
- Tier B conflict/dispute generation is intentionally focused (one highest-priority dispute per claim, with stricter thresholds for medium-confidence flags).
- Tier C focused pass computes extra operational metadata (`tierC.quality` + `tierC.focusedPass`) from the memoir-only dataset.
- Export editorial state JSON before major ingest/review passes so decisions can be restored on another machine/browser.
- Tier A claims are seeded as `pending` to support deliberate review passes.
- English is canonical in the data model; structure is ready for Korean overlay fields.
- Production/public safety:
  - use `VITE_APP_MODE=public` for read-only publication
  - use `VITE_APP_MODE=editorial` (default) for authoring builds
  - set `VITE_EDITOR_ACCESS_CODE=<code>` to require unlock before edits
- Installability/offline:
  - build includes `manifest.webmanifest` and `sw.js`
  - service worker registers only in production builds
- Evidence and review entries use two provenance layers:
  - `Source Work` (book/journal-level citation, e.g., Haboush translation of *The Memoirs of Lady Hyegyong*)
  - `Section` + `Path` + `Segment` (within-work provenance for extracted passages)
