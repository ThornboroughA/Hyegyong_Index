Original prompt: okay, let's proceed to tier 3 now

## 2026-02-24

- Verified current Tier C branch compiles (`npm run build:data`, `npm run lint`, `npm run build`).
- Identified remaining Tier C completion gaps:
  - no Tier C baseline freeze script/command yet
  - no offline/PWA support yet (manifest + service worker + registration)
  - Tier C topbar/saved-view/editor controls missing dedicated CSS polish
  - README still labeled Tier A + Tier B
- In progress: implement the above and rerun full verification.

### Completed in this pass

- Added Tier C operational freeze pipeline:
  - new script `scripts/freeze_tier_c_baseline.py`
  - new npm script `freeze:tier-c`
  - generated baseline metadata + snapshot in `baselines/` and `public/data/tier-c-baseline.meta.json`
- Strengthened Tier C focused data pass in `scripts/build_tier_c_data.py`:
  - alias collision detection
  - claim confidence summary
  - source coverage summary
  - people-needing-review summary
- Added PWA/offline scaffolding:
  - `public/manifest.webmanifest`
  - `public/sw.js`
  - `public/icons/hyegyong-atlas-icon.svg`
  - service worker registration in `src/main.tsx`
  - manifest/theme wiring in `index.html`
- Polished Tier C UI/UX:
  - topbar actions/reviewer controls styling
  - saved views card styling
  - QA dashboard + focused pass card styles
  - release notes textarea styling
  - true field-mode layout behavior (single-column focus + hidden side noise)
- Added bilingual overlay extension for high-value people/events:
  - Korean labels appear in key contexts with English canonical retained
- Updated `README.md` to document Tier C scope, commands, publish-mode controls, offline behavior.

### Verification run

- `npm run build:data` passed
- `npm run freeze:tier-c` passed
- `npm run lint` passed
- `npm run build` passed

### Suggested next TODOs (for next agent)

- Add signed/authenticated backend for multi-user editorial publishing (current model is local browser state + build-time mode).
- Add Korean overlay coverage from structured translation files instead of in-code map constants.
- Add Tier C ingest import UI stubs (batch list, staged source upload placeholders) wired to future backend endpoints.
