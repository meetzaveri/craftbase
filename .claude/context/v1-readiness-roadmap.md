# Craftbase v0.7.x → v1.0 Readiness Roadmap

## Context

Craftbase sits at **v0.7.10**, which signals an alpha/beta posture. In reality the
codebase is far more mature than that number suggests: 500+ commits, TypeScript
strict mode, Sentry telemetry, disciplined CI version-gating, an E2E suite, and a
real consumer (`craftmaps`) already depending on it via `link:`. The version
number is now *understating* the product.

The question this doc answers: **what concretely must be true before we call it
v1.0 "stable"?** It defines the factors to evaluate, scores where we stand on
each, and lays out a prioritized, gap-closing roadmap. **Base export/download +
faithful re-import** is the named must-have and is treated here as a flagship
v1.0 deliverable with its design decisions already settled.

This is a **roadmap/assessment document**, not a single-feature implementation
plan. It names the work, sequences it, and points at the files involved so each
item can be split into its own task later.

---

## What "v1.0 stable" means here

Three promises a 1.0 makes that a 0.x does not:

1. **Data durability** — a user's work can be saved, moved, and restored without
   loss. (Export/import + persisted-mode parity.)
2. ~~**API stability** — the library surface (`src/lib.ts`) is committed to under
   semver; consumers like craftmaps can upgrade without surprise breakage.~~
   **Retired.** craftmaps is torn down and craftbase has no consumers; `src/lib.ts`
   is an internal barrel. See "Craftbase is a standalone product, not a library"
   in CLAUDE.md. What replaces it: **vocabulary stability** — `base` is the
   workspace, `baseType` the substrate, and storage renames go through
   `storageMigration.ts` rather than resetting anyone's local work.
3. **Operational confidence** — regressions are caught before release (CI gates +
   tests), failures are observed (telemetry), and crashes don't silently eat work.

Everything below maps to one of these three.

---

## Readiness scorecard (current state)

| Area | State | v1.0 gap |
| --- | --- | --- |
| Data export/import | ❌ none (only SVG/PNG raster export) | **Flagship gap — build it** |
| Round-trip fidelity | ⚠️ good locally; port bindings + groups don't survive persisted reload | Close the persisted-mode gaps |
| Public API (`src/lib.ts`) | ✅ stable, typed, documented | Freeze + CHANGELOG; bump to 1.0 |
| CI gates | ⚠️ E2E + version-check only; **no typecheck/build gate** | Add typecheck + build gates |
| Unit tests | ❌ none (E2E only) | Cover critical hooks/utils |
| Error resilience | ⚠️ React boundaries + Sentry; Two.js DOM handlers unguarded | Wrap canvas handlers |
| Versioning/release | ✅ VERSION-gated, auto draft-release | Single source + CHANGELOG |
| Dependencies | ✅ 0 audit vulns, resolutions pinned | Note Two.js 0.8.13 long-term risk |
| Docs | ✅ deep dev docs; ⚠️ thin user/consumer docs | Embedding guide + CHANGELOG |
| A11y / PWA | ⚠️ minimal ARIA; service worker disabled | Defer past 1.0 (non-blocking) |

Legend: ✅ ready · ⚠️ partial · ❌ missing

---

## The factors to weigh before calling it 1.0

1. **Can a user not lose their work?** Export/import + persisted-mode binding
   parity. This is the single biggest 0.x→1.0 differentiator and the stated
   priority.
2. **Will the next change break a consumer silently?** Need a typecheck/build CI
   gate and a frozen, semver-committed `src/lib.ts` with a CHANGELOG.
3. **Will a regression ship undetected?** E2E covers happy paths only; the
   mutation-heavy hooks (`useComponentHistory`, `useCanvasClipboard`,
   `applyProperty`, `useLocalDraftPersistence`) and pure utils
   (`canvasUtils`, `shapePorts`, `updateVertices`) have no unit coverage.
4. **Will a canvas crash eat the base?** Two.js DOM event handlers in
   `src/newCanvas.tsx` aren't wrapped; the documented `scene.subtractions` crash
   class is only guarded in `groupobject.tsx`. A throw there is silent data loss.
5. **Is the contract documented?** No CHANGELOG, no embedding guide for new
   consumers. A 1.0 should make breaking-change intent explicit.

A11y, offline/PWA, and a Two.js replacement are **explicitly out of scope for
1.0** — track them for 1.x.

---

## Roadmap (prioritized)

### P0 — Flagship: Base export / import (the named requirement)

**Goal:** Download a base to a file and re-import it with identical structure,
properties, and resilience.

**Format — versioned, branded JSON (`.craftbase`):**

> **Status: shipped, and the format has moved on.** It is now `1.1` and carries
> `baseType` / `baseTypeConfig`. `formatVersion` is written but **deliberately
> never validated on import**, which is what keeps files interchangeable in both
> directions — the importer reads only `components` and `viewport`. A pre-rename
> file whose records carry `boardId` still opens: the field is ignored and both
> apply paths stamp their own. Don't add a version check; it would be the
> compatibility break, not the fix.

```jsonc
{
  "formatVersion": "1.1",       // written, never validated on import
  "app": "craftbase",
  "appVersion": "0.9.1",        // read from VERSION/package.json at export time
  "exportedAt": 1718000000000,
  "viewport": { "scale": 1, "tx": 0, "ty": 0 },  // restored on import
  "baseType": "board",          // 'board' | 'map'
  "baseTypeConfig": null,       // { mapAnchor } on the map type
  "components": { "<id>": { /* ComponentRecord */ } }
}
```

The `components` payload is the **same canonical `ComponentStore`**
(`Record<string, ComponentRecord>`, `src/types/base.ts:69`) the localStorage
draft already serializes in `useLocalDraftPersistence.ts:143`. We are reusing the
proven serialization, not inventing a parallel one — this is why round-trip
fidelity is already high for shapes, arrows, dividers, pencil (vertex `metadata`),
and text (multiline `content` with `\n`).

**Export — new util, mirrors existing download utils:**

- Add `src/utils/exportBase.ts` next to the existing
  `exportSelectionAsSvg.ts` / `exportViewport.ts` (reuse their Blob +
  anchor-download pattern; don't reinvent the download mechanics).
- Source the store from `stateRefForComponentStore` (BaseContext) so it's
  current; filter out transient `groupobject` and welcome-sketch seeds exactly as
  the draft save does (`useLocalDraftPersistence.ts:135`).
- Pull `viewport` from the same camera state `onCameraChange` reports.

**Import — new util + UI entry:**

- Add `src/utils/importBase.ts`: file-picker → `JSON.parse` → **validate**
  (`formatVersion`, each record has a known `componentType` + required geometry).
  Reject/skip malformed records, mirroring the defensive skip already in
  `persistBase()`. Surface a count of skipped items.
- **Import behavior: ask each time** — on import, prompt the user to choose
  *Open as new canvas* (replace store, fresh `localBaseId`) vs *Merge into
  current* (re-key every imported id to a fresh UUID to avoid collisions, append
  with `position = max+1`). Reuse the existing modal system
  (`components/common/modal.tsx`).
- Restore `viewport` after the store loads.

**UI:** add "Export canvas" / "Import canvas" entries to the hamburger menu
(`src/components/sidebar/menuDrawer.tsx`) — same place the existing share/raster
actions live. Available in **both local and persisted mode**.

**Known round-trip gaps to resolve as part of this item:**

- **Port-connector bindings** (`tailShapeId/tailEdge/headShapeId/headEdge`) live
  on `ComponentRecord` and serialize fine for **local mode**, so a JSON export
  *does* round-trip them — but they are **not Hasura columns**, so a
  persisted-base (`/base/:id`) reload still drops them. Decision point: the
  export feature gives bindings durability *through the file* even before the DB
  catches up. Full persisted-mode parity is P1 below.
- **Groups are flattened** — `groupobject` is transient and excluded from the
  store, so import restores individual elements without the group wrapper. This
  matches today's reload behavior; acceptable for 1.0. Note it in docs.

**Verification:** build each element type (rectangle, circle, diamond, arrow with
a docked port, divider, pencil, multiline text, and — with `geoObjectsEnabled` —
point/area/route/geoText), export, reload to a clean canvas, import, and confirm
geometry/style/text/vertices/viewport match. Add a Playwright spec under
`tests/e2e/` (e.g. `export-import.spec.js`) that round-trips a representative
base and asserts the store is equivalent.

### P1 — Persisted-mode binding parity (closes the durability gap) — ✅ DONE

> **Status: shipped.** All 6 binding columns (`tail`/`head` × `ShapeId`/`Edge`/
> `PortIndex`) are live Hasura columns, present in `generated.ts` and in
> `GET_COMPONENTS_FOR_BASE_QUERY`. See "Port connectors" in CLAUDE.md. The
> original plan text is kept below for context.

Make port connectors survive a saved-base reload: `ALTER TABLE
components.component` to add the 4 nullable binding columns, track them in Hasura,
`yarn codegen`, and add them to `GET_COMPONENTS_FOR_BASE_QUERY` +
`INSERT_BULK_COMPONENTS` / `UPDATE_COMPONENT_INFO`. (Pre-documented in CLAUDE.md
"Persisted-mode caveat".) After this, both file-export and DB-persist agree.

### P2 — CI quality gates (cheap, high-leverage)

- Add a `yarn typecheck` + `yarn build` job gating PRs to main (today neither
  blocks — TS errors can ship). Wire into the existing
  `.github/workflows/e2e-deploy-preview.yml` or a new `ci.yml`.
- Optional: a pre-commit hook (husky) running typecheck locally.

### P3 — Unit test coverage for critical paths

Stand up Vitest (config already present in `vite.config.mjs`, currently unused).
Target the mutation-heavy hooks and pure utils that E2E can't isolate:
`useComponentHistory`, `useCanvasClipboard`, `applyProperty`,
`useLocalDraftPersistence`, plus `canvasUtils`, `shapePorts`, `updateVertices`,
and the new `exportBoard`/`importBoard` round-trip. Aim ~60% on `src/` excluding
factory templates.

### P4 — Crash resilience on the canvas

Wrap the Two.js DOM event-listener callbacks in `src/newCanvas.tsx` in
try/catch + Sentry capture, applying the canonical `scene.subtractions` reset from
`groupobject.tsx` `handleOnDeleteGroupElements` so a single bad handler can't
corrupt the scene or silently lose the base.

### P5 — Release hygiene & API freeze (the 1.0 ceremony)

- Add `CHANGELOG.md` (hand-curated highlights + the auto-generated commit list the
  draft-release flow already produces).
- Consolidate the version source — keep `VERSION` and `package.json` in sync (or
  derive one from the other) so there's a single truth.
- Review and **freeze `src/lib.ts`**: confirm every export is intentional and
  document semver intent. Add a short "Embedding craftbase" section to the README
  using the craftmaps integration as the worked example.
- Bump to **1.0.0**.

### Out of scope for 1.0 (track for 1.x)

A11y/keyboard-nav pass + axe-core in E2E; enabling the service worker / offline
PWA; evaluating a Two.js (0.8.13, unmaintained since 2021) replacement or wrapper.

---

## Suggested sequencing

P0 (export/import) and P2 (CI gates) can start in parallel — P2 is ~an afternoon
and immediately protects everything after it. P0 is the headline feature. P1
(DB parity) naturally follows P0 since both touch the persistence path. P3/P4
harden, P5 is the final ceremony before flipping the version. Realistic window to
1.0 with focused effort: **~2 weeks**, the export/import feature being the bulk.

## Critical files

- `src/types/base.ts` — `ComponentRecord` / `ComponentStore` (export payload shape)
- `src/hooks/useLocalDraftPersistence.ts` — serialization pattern to reuse + transient-filter rules
- `src/utils/exportSelectionAsSvg.ts`, `src/utils/exportViewport.ts` — download/Blob pattern to mirror
- `src/views/Base/base.tsx` — `persistBase()` defensive-skip pattern; store ref + camera state
- `src/components/sidebar/menuDrawer.tsx` — menu entry points for Export/Import
- `src/components/common/modal.tsx` — import "open vs merge" prompt
- `src/schema/{queries,mutations}/index.ts` + `src/schema/generated.ts` — P1 binding-column work
- `.github/workflows/e2e-deploy-preview.yml` — P2 CI gate
- `vite.config.mjs` — P3 Vitest (already scaffolded)
- `src/newCanvas.tsx` — P4 handler guards
- `VERSION`, `package.json`, `src/lib.ts`, `README.md` — P5 ceremony
