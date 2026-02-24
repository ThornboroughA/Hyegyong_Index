# Hyegyong Atlas (Tier A)

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

## Data and extraction

- Source EPUB: `../The Memoirs of Lady Hyegyong.epub`
- Generated references live in `references/`
- Tier A dataset file: `public/data/tier-a.json`
- Dataset build script: `scripts/build_tier_a_data.py`

## Commands

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
```

Rebuild dataset only:

```bash
npm run build:data
```

## Notes

- Editorial actions persist in browser `localStorage` under key `hyegyong-atlas-tier-a-edits-v1`.
- Tier A claims are seeded as `pending` to support deliberate review passes.
- English is canonical in the data model; structure is ready for Korean overlay fields.
