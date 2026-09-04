# Geo Objects (point / area / route) — Implementation Plan

Adds a new **geo** category of element to craftbase, surfaced only when a
consumer (craftmaps) opts in via a Board prop. Three types:

- **point** — a circle ring with an embedded SVG icon (default "pin"), counter-scaled so it stays legible when zoomed out.
- **area** — a closed `Two.Path` (polygon). Editable property: **stroke**. Fill = stroke color at 0.7 opacity (light shade).
- **route** — an open `Two.Path` (polyline, `closed:false`). Editable property: **stroke** (+ width/type).

No text inside any geo object (ignore the multiline-text layer entirely).

## Decisions locked in

1. **Storage:** Reuse `components_component` + a `geoObjectType` catalog table. No parallel `geoObject` table. Geometry/vertices live in the existing `metadata` jsonb (same pattern as `pencil`).
2. **Toolbar:** When the consumer opts in, geo tools appear **alongside** the existing shape tools (additive, not a replacement).
3. **Draw interaction:** Multi-click to drop vertices with a live rubber-band preview; finish with Esc/Enter/double-click (area needs ≥3, route needs ≥2). Point is a single click-to-place.

---

## Part A — DB plan (for the craftbase-hasura-clone agent)

### A1. `components_component` — add a discriminator column

- Add `objectClass text NOT NULL DEFAULT 'shape'` (values: `'shape'` | `'geo'`).
- Existing rows are unaffected (default `'shape'`).
- Track the column in Hasura; ensure it's in the `_insert_input`, `_set_input`, and selectable for the `user` role.

### A2. New catalog table `components_geoObjectType`

Mirror `components_componentType`. Suggested columns:

| column         | type    | notes                                              |
| -------------- | ------- | -------------------------------------------------- |
| `label`        | text PK | `'point'` \| `'area'` \| `'route'`                 |
| `defaultStroke`| text    | default stroke color per type                      |
| `linewidth`    | int     | default line width                                 |
| `logo`         | text    | toolbar/icon hint (optional)                       |
| `metadata`     | jsonb   | type-specific defaults, e.g. point `{ resist: 0.9, ringRadius: 22, svgIcon: '<default pin>' }` |

Seed three rows: `point`, `area`, `route`. Track the table; grant `select` to `user`.

### A3. Geometry shape stored in `components_component.metadata`

No new columns needed beyond `objectClass`. Reuse:

- `x`, `y` → group origin (first vertex / centroid).
- `stroke`, `linewidth`, `strokeType` → existing.
- `fill` → **not stored for geo.** Area fill is always derived client-side from `stroke` at 0.7 opacity (`strokeToAreaFill`). Leave the `fill` column null/untouched for geo rows.
- `metadata` jsonb:
    - **point:** `{ svgIcon: string, resist: number, ringRadius: number }`
    - **area:** `{ vertices: [{x,y}, ...] }` (relative to group origin, closed)
    - **route:** `{ vertices: [{x,y}, ...] }` (relative to group origin, open)

### A4. Query/subscription/codegen changes

- Add `objectClass` to the select sets of: `GET_COMPONENTS_FOR_BOARD_QUERY`, `GET_COMPONENT_INFO_QUERY`, `GET_COMPONENTS_FOR_BOARD_SUBSCRIPTION`, `GET_COMPONENT_INFO_SUBSCRIPTION`. (`metadata` is already selected — that carries the vertices.)
- Add a new `GET_GEO_OBJECT_TYPES` query + subscription mirroring `GET_COMPONENT_TYPES` against `components_geoObjectType`.
- **No new insert/update/delete mutations.** `insert_components_component_one`, `update_components_component_by_pk`, and the delete mutations all carry geo rows for free once `objectClass` is tracked.
- Run `yarn codegen` after the metadata + table land so `src/schema/generated.ts` picks up `objectClass` and the new catalog type.

---

## Part B — Client plan (craftbase `src/`)

The renderer needs **zero changes**: `handleSetComponentsToRender` maps
`componentType` → `./components/elements/{type}.tsx` via the
`import.meta.glob('./components/elements/*.tsx')` (`newCanvas.tsx:50`). Dropping
in `point.tsx`/`area.tsx`/`route.tsx` registers them automatically. Insert/
update/delete, the board subscription, undo-history, clipboard, and the
localStorage draft all flow through `componentStore` and work unchanged.

### B1. Constants — `src/constants/misc.ts`

- Extend `componentTypes` with `point`, `area`, `route`.
- Add a `geoObjectTypes = { point, area, route }` set and a helper `isGeoType(t)`.
- Add `GEO_DRAW_MODE_KEY` (multi-click area/route) and reuse `PENDING_SHAPE_TYPE_KEY` / `LAST_ADDED_ELEMENT_ID_KEY` for point placement.
- Add `DEFAULT_PIN_SVG` string and `DEFAULT_GEO_RESIST = 0.9`.

### B2. Generic counter-scale util — `src/utils/counterScale.ts` (new)

```ts
// pin/point stays legible when the world zooms out.
// resist=0 → fully fixed on screen; resist=1 → scales with world.
export function computeCounterScale(zuiScale: number, resist = 0.9): number {
    return 1 / Math.pow(zuiScale, resist)
}
```

### B3. Color helper — `src/utils/misc.ts`

Add `strokeToAreaFill(stroke: string): string` → returns the stroke color as
rgba with alpha `0.7` (handle `#rgb`/`#rrggbb`/`rgb()/rgba()`; fall back to the
input). Used so an area's fill is a light shade of its stroke, and so editing
stroke re-derives fill.

### B4. Factories — `src/factory/{point,area,route}.ts` (new)

Model on `circle.ts` / `pencil.ts` (extend `Main`, return `{ group, <shape> }`).

- **point.ts:** `two.makeGroup()` containing (1) a ring `Two.Circle(0,0,ringRadius)` with `fill='transparent'`, `stroke=props.stroke`, and (2) the SVG icon embedded via `two.interpret(svgNode)` (parse `metadata.svgIcon || DEFAULT_PIN_SVG`), centered, recolored to stroke. Group translation = `x,y`.
- **area.ts:** `new Two.Path(anchors, true, false)` from `metadata.vertices`; `stroke=props.stroke`, `linewidth`, `fill=strokeToAreaFill(stroke)`. Group at `x,y`.
- **route.ts:** `new Two.Path(anchors, false, false)`; `noFill()`, `stroke`, `linewidth`, `cap='round'`, `join='round'`. Group at `x,y`.

### B5. Element components — `src/components/elements/{point,area,route}.tsx` (new)

Model on `circle.tsx` (mount factory in `useEffect([],[])`, set
`group.elementData`, handle `parentGroup` for group membership, wire
`.dragger-picker` + `data-component-id` + `data-linewidth`, `two.remove(group)`
cleanup, pointer-events effect on draw modes). No `applyShapeText` calls.

- **point.tsx extra:** subscribe to the `zoomChanged` CustomEvent (`{ detail: { scale } }`, dispatched at `newCanvas.tsx:1886` & `:2217`) and on each event set `group.scale = computeCounterScale(scale, resist)` then `two.update()`. Read initial scale from the camera once on mount. (Uses a window event listener, so no stale-closure issue — it re-reads each fire.)
- **area.tsx extra:** the stroke effect must update **both** `path.stroke` and `path.fill = strokeToAreaFill(stroke)`.
- Update effects react to `props.stroke`, `props.linewidth`, `props.strokeType`, and `props.metadata` (vertex changes from undo) — rebuild vertices from `metadata.vertices` (frozen-props rule: store-driven updates mutate Two.js directly).

### B6. Toolbar — opt-in geo tools

- **BoardProps** (`src/types/board.ts`): add `geoObjectsEnabled?: boolean` (default-free, no-op when omitted). Thread through `BoardContext` (board.tsx) so the sidebar can read it. `BoardProps` is already exported from `lib.ts` — no new export needed.
- **`src/utils/constants.ts`:** add a `geoElementData: PrimaryElement[]` (point/area/route with new icons). Add three icons to `wireframeAssets/` (pin, polygon, polyline) imported `?react`.
- **`shapesToolbar.tsx`:** when `geoObjectsEnabled`, append `geoElementData` to `allElements` (additive, after the existing shape/arrow/pencil/text tools). Clicking calls the existing `addElement(name)` + `setCurrentElementInBoard(name)`.

### B7. `addElement` — `src/components/sidebar/primary.tsx`

Add cases to the `switch (label)`:

- **`point`:** build `shapeData` from the geoObjectType catalog (`objectClass:'geo'`, `componentType:'point'`, `metadata:{ svgIcon: DEFAULT_PIN_SVG, resist: DEFAULT_GEO_RESIST, ringRadius }`, `stroke: defaultStrokeColor`). Use the **single-click place** path (same as text-draw: pre-create the lazy element, set `LAST_ADDED_ELEMENT_ID_KEY`, enter a point-place mode; canvas positions it on the click).
- **`area` / `route`:** enter **multi-click `GEO_DRAW_MODE`**. Store the geo type in localStorage; do **not** pre-create the row. The canvas collects vertices and creates the component on finish. Build defaults (stroke/linewidth) from the catalog.

### B8. Canvas draw lifecycle — `src/newCanvas.tsx`

Mirror the existing `SCENARIO_ARROW_DRAW` / `SCENARIO_TEXT_DRAW` / `SCENARIO_DRAW_SHAPE` branches in the mousedown scenario switch (~line 812).

- **Point (single click):** add a scenario that, like `SCENARIO_TEXT_DRAW`, positions the lazily-mounted point element at `toSurface(e)`, calls `updateComponentVertices`, clears the place-mode keys, and lets the standard insert/persist + history(ADD) run.
- **Area/Route (multi-click `GEO_DRAW_MODE`):**
    - mousedown → push a vertex (surface coords); draw a small dot + connecting line (preview overlay, like the example's `currentDots`/`currentLines`).
    - mousemove → rubber-band preview line from last vertex to cursor.
    - dblclick / Enter / Esc → finish: validate count (area ≥3, route ≥2 else cancel + clear preview); compute group origin (first vertex), convert vertices to relative, build `shapeData` (`objectClass:'geo'`, type, `metadata.vertices`, stroke/linewidth, fill for area), then route through the **same** store-add + insert(if persisted) + `recordToHistoryLog({type:'ADD'})` path the other shapes use. Clear all preview artifacts and `GEO_DRAW_MODE_KEY`.
    - Add the geo draw mode to the early-return guards that suppress hover/selection while another draw mode is active (alongside the `ARROW_DRAW_MODE_KEY` / `PENDING_SHAPE_TYPE_KEY` checks, e.g. `newCanvas.tsx:345`, `:2631`).

### B9. Element properties — `src/components/sidebar/elementProperties.tsx`

- Add to `SETS`: `GEO_POINT: ['stroke']`, `GEO_AREA: ['stroke']`, `GEO_ROUTE: ['stroke','strokeWidth','strokeType']`. Add matching labels in the title map.
- In `resolveSetKey`, map `componentType` `point`→`GEO_POINT`, `area`→`GEO_AREA`, `route`→`GEO_ROUTE` (both selected-component and arrow/draw-mode branches).
- In `src/utils/applyProperty.ts` (`createApplyProperty`, the single mutation path): when the selected element is an **area** and `stroke` changes, also set `fill = strokeToAreaFill(stroke)` on the **Two.js path only** — do **not** add `fill` to the persisted `_set`. Fill is never stored for geo; it's re-derived from `stroke` on every render (B5/area.tsx).

### B10. Clipboard / draft (follow-up within scope)

- `useCanvasClipboard.ts` + the copy/paste vertex remap in `newCanvas.tsx` (~line 2523, currently special-cased for `pencil`) need the same relative-vertex remap for `area`/`route` `metadata.vertices`. Point copies as-is.
- The localStorage draft already serializes `metadata`, so vertices persist for free — verify round-trip.

### B11. GraphQL client files — `src/schema/{queries,subscriptions,mutations}/index.ts`

- Add `GET_GEO_OBJECT_TYPES` (query + subscription) mirroring `GET_COMPONENT_TYPES`.
- Add `objectClass` to the component query/subscription select sets (matches A4).
- Fetch the geoObjectType catalog in `board.tsx` next to `getComponentTypesData` and expose via context for `primary.tsx`'s `addElement` defaults.
- Re-run `yarn codegen` after the DB lands; then `yarn typecheck`.

---

## Build order

1. DB: `objectClass` column + `geoObjectType` table + seed (Part A). → `yarn codegen`.
2. Client foundation: constants, `counterScale.ts`, `strokeToAreaFill`, factories, element components (B1–B5). Renderable via store even before toolbar wiring.
3. Toolbar + prop + `addElement` (B6–B7).
4. Canvas draw lifecycle (B8) — point first (simpler), then area/route multi-click.
5. Properties (B9), clipboard/draft (B10), GraphQL/codegen (B11).
6. `yarn typecheck`; manual verify in craftmaps (it sets `geoObjectsEnabled`).

## Open items to confirm later

- Point icon swap UI (default pin ships first; arbitrary SVG import is future).
- Whether point should be resizable (counter-scale + resize interaction needs thought) — default: not resizable, drag-to-move only.
- Whether `geoObjectsEnabled` should be a finer-grained config (e.g. `enabledGeoTypes: string[]`) — boolean ships first.
