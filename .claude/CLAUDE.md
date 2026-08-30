# Code style

- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')
- Use `tabWidth:4` for generating code for all the files (.ts, .tsx, .yaml, .md, etc...)
- The codebase is **TypeScript** (`strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`). New files must be `.ts` or `.tsx`. Type-only imports use `import type { ... }`.
- For Two.js scene shapes (Path/Group with codebase-specific bookkeeping like `.elementData`, `._renderer`, `.lineData`, `.siblingCircle`) cast to `any` at the access site with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`. Designing strict interfaces for these is a follow-up, not Stage 12's scope.
- For DOM null-safety, use the intermediate-variable pattern: `const el = document.getElementById('x'); if (el) el.style...`

# General guidelines

For example:

- Only use absolute positioning when necessary. Opt for responsive and well structured layouts that use flexbox and grid by default
- Refactor code as you go to keep code clean
- Keep file sizes small and put helper functions and components in their own files.

# Craftbase is a standalone product, not a library

**Craftbase is its own app. It has no consumers and is not published as a dependency.**
`craftmaps` (sibling repo at `../craftmaps`) *was* the one consumer, importing craftbase
via `"craftbase": "link:../craftbase"`. **It is being torn down.** Do not design for it,
do not preserve its call site, and do not weigh "would this break craftmaps?" when
evaluating a change.

The map is now craftbase's own product identity — the base switcher (`src/baseTypes/`) —
which is exactly what made craftmaps redundant.

## Implications when editing craftbase

- **Build features *in* craftbase.** Map glue, geocoding, basemap controls, place search:
    all of it belongs here now. The old rule ("if it feels consumer-specific it belongs in
    the consumer repo") is retired — there is no consumer repo to push it to.
- **Prefer removing an extension point to maintaining it.** These props exist only because
    craftmaps needed them, and each one is now a fork in the code with no live caller:
    - `geoObjectsEnabled` — **deprecated**; only ever meant "surface the geo toolset".
        Superseded by the map base's own toolset.
    - `renderBackground` — consumer-painted backdrop slot. Superseded by `BaseTypeProvider`.
    - `onCameraChange`, `scaleToDisplay` — still harmless, but no external caller.
    Removing them is cleanup, not a breaking change. Sequence it deliberately (see
    "Base switcher" below — `geoObjectsEnabled` still drives the toolset overlay and
    `renderBackground` still gates `baseSwitcherEnabled`), but the destination is deletion.
- **`src/lib.ts` is now an internal barrel, not a public API.** Nothing outside this repo
    imports it. Adding to it no longer carries a compatibility promise; you are free to
    change or narrow exports.
- **No consumer-bundler constraints.** The `.ts`/`.tsx`-source contract, the
    `optimizeDeps.exclude` note, the tailwind-purge-across-`node_modules` rule, and the
    `link:` live-reload caveat all only mattered for craftmaps. Only this repo's own Vite
    and tailwind configs matter now.
- **Backward compatibility that still counts is *data*, not API.** Existing bases in
    localStorage and Hasura, saved viewports, exported JSON files. Those users are real.
    Keep the "no write on read", unsuffixed-viewport-key and
    `formatVersion`-never-validated guarantees described under "Bases and base types",
    and route any storage rename through `storageMigration.ts` rather than resetting.

## When in doubt

Ship it here. The question is no longer "whose repo does this belong in" but "does this
make craftbase a better standalone whiteboard".

# Code structure

Below is the craftbase project codemap with different sections talking about overview, architecture, directory structure, technology stack and key files.

## Overview

Craftbase is an minimal virtual whiteboarding tool built with React that uses Two.js for 2D canvas rendering. This document maps the codebase structure to help developers quickly locate and understand different parts of the application.

## Core Architecture

**Rendering Stack**: Base → Canvas → ElementRenderer → Component Element → Component Factory

- **Base**: The workspace, and the main container — canvas rendering, sidebar, floating toolbar. A base has a **type** (`board` / `map` / `image`) that decides the substrate it is drawn on; see "Bases and base types" below.
- **Canvas**: 2D rendering logic and user interaction controls (mouse, drag, zoom, pan)
- **Component Elements**: React functional components with attached event listeners
- **Component Factories**: Template generators that produce component definitions

The Base component uses React Context (`BaseContext`) to pass state and methods down to child components. This is the primary state management pattern used throughout the application.

## React + Two.js Stale Closure Pattern

**Critical architectural constraint**: `addZUI` in `src/newCanvas.tsx` is called **once on mount** via `useEffect([], [])`. All DOM event listeners registered inside it (mouse, dblclick, keydown, etc.) close over the initial `props` and local variables — they never see React state updates.

**Rule**: Any Two.js event handler that needs live React state **must** read from a `useRef`, not from `props` or state directly.

Pattern:

```ts
const myValueRef = useRef<MyType>(props.myValue)
useEffect(() => {
    myValueRef.current = props.myValue
}, [props.myValue])
// pass myValueRef into addZUI, read myValueRef.current inside handlers
```

This is because Two.js attaches raw DOM `addEventListener` calls outside React's reconciliation loop — React cannot re-bind them on re-render. The ref object is stable across renders; `.current` always holds the latest value at call time.

## Two.js Collection `.filter()` Pitfall

**`two.scene.children` is a Two.js `Collection`, not a plain array** — and
`.filter()` on it lies about `length`.

`Collection extends Array`, so `filter` builds its result via
`ArraySpeciesCreate` → `new Collection(0)`. That constructor treats a *numeric*
argument as an element to push, so the result starts as `[0]`. When the filter
matches nothing, nothing overwrites it:

```js
two.scene.children.filter(() => false).length // → 1, contents [0]  ✗
Array.from(two.scene.children).filter(() => false).length // → 0    ✓
```

This silently defeats `if (result.length > 0)` guards and can feed a bogus `0`
into `two.remove()` — which is one more way to land in the subtractions pitfall
below.

**Rule: `Array.from(...)` (or spread) before any `.filter()`/`.map()`/`.slice()`
on `scene.children`.** `forEach` and `find` are safe (they don't construct a new
Collection). Fixed once in `groupobject.tsx` `handleOnDeleteGroupElements`.

## Two.js scene.subtractions Pitfall

**Symptom**: `Uncaught NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is no longer a child of this node.` thrown from `_Group2.render` → `subtractions.forEach(svg.group.removeChild)`.

**Why it happens**:

- `two.remove(element)` does NOT remove SVG nodes immediately. It removes the element from `scene.children` and pushes it into `scene.subtractions`. The actual `parent.removeChild(elem)` happens on the next `two.update()`, inside the renderer's `subtractions.forEach`.
- If between `two.remove(element)` and `two.update()` the element's SVG node is detached by some other path — for example, the element was nested inside another group's SVG element which got removed — then Two.js's tracked `parentNode` no longer matches the actual DOM tree. The `removeChild` call throws.
- `scene.flagReset()` only clears `scene.subtractions` after a successful render. **If the render throws, the array stays populated, and every subsequent `two.update()` retries the same broken operation and crashes again** — this is why the same error keeps reappearing as you fix one trigger after another.

**Common triggers**:

1. Removing a parent group via `two.remove([parentGroup])`. Two.js detaches the parent's SVG node from the DOM, taking nested SVG nodes with it. Any element whose Two.js bookkeeping still says "I'm a child of scene.\_renderer.elem" is now lying.
2. Multiple `two.update()` calls firing in close succession from different sources (an event handler, an element component's cleanup, a `requestAnimationFrame` callback). Each can put the SVG in a half-reconciled state that the next one trips over.
3. React component cleanup effects calling `two.remove(group)` after we've already manually removed the same group elsewhere — double subtraction.

**Rules to avoid it**:

- **Don't compete with the element components for Two.js cleanup.** Each shape component (e.g. `rectangle.js`, `circle.js`) calls `two.remove(group)` in its `useEffect` cleanup. If you also call `two.remove` on the same elements from a parent component, you get a double-subtract. Pick one owner: either remove manually and let the cleanup be a no-op (Two.js's `Group.remove` safely skips ids it doesn't own), or do nothing and let the cleanup own it.
- **Don't call `two.update()` inside a Two.js DOM event handler that fires synchronously during another `two.update()`** (notably `blur`, which fires when Two.js detaches a focused SVG node). The outer update is mid-reconciliation; calling `two.update()` again corrupts the SVG tree.
- **If `two.update()` might throw during a tear-down path, wrap it in `try/catch` AND clear `two.scene.subtractions.length = 0; two.scene._flagSubtractions = false`** in the catch. Otherwise the bad subtraction sticks around and every future `two.update()` repeats the crash.

**Where the source lives** (when you need to verify behavior):

- `node_modules/two.js/src/renderers/svg.js` — `svg.group.removeChild` (has a `parentNode != this.elem` early-return check) and `svg.group.render` (calls `subtractions.forEach`).
- `node_modules/two.js/src/group.js` — `subtractions`/`additions` arrays, `flagReset()` clearing logic, the `splice()` helper that pushes into `subtractions` when a child is detached.

**Reference**: `src/components/elements/groupobject.tsx` `handleOnDeleteGroupElements` is the canonical example of cleanly tearing down a group with a `try/catch` + subtraction reset.

## Directory Structure

### `/src/views`

Top-level page views/routes.

- **`Base/`**: The workspace page (the canvas itself)
    - `base.tsx` - Base component with GraphQL operations; consumes `BaseContext`
    - `baseContext.ts` - The context object, in its own stable module so its identity survives HMR
    - `index.tsx` - Entry point with error boundary
    - `errorBoundary.tsx` - Error boundary wrapper

- **`Home/`**: Marketing/landing page (served at `/home`, no longer the default route)

### `/src/components`

Reusable React UI components.

- **`elements/`**: Whiteboard element components (shapes, controls, UI widgets)
    - Shape components: `circle.tsx`, `rectangle.tsx`, `diamond.tsx`
    - Arrow components: `arrowLine.tsx`, `divider.tsx`
    - Drawing: `pencil.tsx`
    - Text components: `newText.tsx`
    - Other: `groupobject.tsx`

- **`sidebar/`**: Left sidebar UI
    - `primary.tsx` - Main sidebar component; applies the current element defaults (`linewidth`, `strokeType`, `stroke`) to newly created components
    - `elementProperties.tsx` - Unified element-properties toolbar shown for the current selection. The `SETS` map declares which property sections (`fill`, `stroke`, `strokeWidth`, `strokeType`, `opacity`, `textColor`, `textSize`, `textFont`) render per element kind (`SHAPE`, `ARROW`, `PENCIL`, `TEXT`, `RECT_WITH_TEXT`, `GROUP`); `resolveSetKey()` picks the active set. This replaced the old standalone `defaults.tsx`
    - `shapesToolbar.tsx` - Shape picker toolbar (+ undo/redo); flattens the shapes drawer into a flat list for desktop
    - `menuDrawer.tsx` - Hamburger menu drawer (nav links, modal triggers)
    - `shareLinkPopup.tsx` - Share functionality popup
    - `userDetailsPopup.tsx` - User information popup
    - `sidebar.css` - Sidebar styles

    **Element defaults vs. selected-shape edits:** `src/utils/applyProperty.ts` (`createApplyProperty`) is the single mutation path behind `elementProperties.tsx`. Every property change (1) updates the matching default via `useElementDefaults` setters, then (2) if a shape is selected, applies the same change to that shape. So editing a property with nothing selected just sets the default; editing with a shape selected sets both. Defaults store `null` for `strokeType: 'solid'` (matching what `primary.tsx` feeds new shapes); DB rows store the literal `'solid'`/`'dashed'`/`'dotted'`.

    **A point's label is styled per record, off its own ladder.** The `GEO_POINT` set carries `fill` (the pin) plus `textSize` and `textFont` (the label; its colour is fixed by design). Both text keys live in `metadata.textFontSize`/`metadata.textFontFamily`, and `applyProperty` handles them in the point branch rather than the shared text path — a point's label is a bare `Two.Text` in the point's group, not a text layer, and `selectedComponent.shape.data` for a point is the _circle_, so the shared handlers would restyle nothing. Sizes resolve against `POINT_LABEL_SIZES` (14/18/24/32), not `TEXT_SIZES_ARRAY` (24–72) whose smallest step already exceeds the point default. **The style is inherited like any other text style**: both keys feed the usual `useElementDefaults` sync, and `handlePointElement` seeds a new point from them. What makes that work across two ladders is that `defaultTextSize` travels as a *label* (`'S'…'XL'`), never a pixel count — so XL picked on a geoText (72px) makes the next point the point ladder's XL (32px), via `pointLabelSizeFor`. Resolve the label through the point ladder at every creation site; never copy a pixel size across. The label is **centred by hand, not by `baseline: 'middle'`** — SVG's middle baseline centres the x-height, which left the label floating ~0.1em above the pin (2px at S, 4px at XL, and a different amount per font). It is drawn on the alphabetic baseline and offset by `capCenterOffset` (`utils/fontMetrics.ts`, cap height measured per family via canvas and cached only once the webfont is loaded), so re-place it on any size *or* family change — `applyProperty` does, and `buildPointVisual` does on every rebuild. Every read goes through `pointFontFamilyOf`/`pointFontSizeOf`, and `buildPointVisual` must be handed both — it rebuilds the pin from scratch, so anything not threaded through it (the undo rebuild in `useComponentHistory` included) silently reverts to the design default. That undo rebuild **replaces** `elementData.metadata` rather than merging it: styling an unstyled point adds a key, and reverting means removing it. Covered by `tests/e2e/point-label-text.spec.js`.

- **`common/`**: Shared utility components
    - `button.tsx` - Base button component
    - `modal.tsx`, `modalContainer.tsx` - Modal system
    - `portal.tsx` - React portal wrapper
    - `spinner.tsx`, `spinnerWithSize.tsx` - Loading indicators

- **`utils/`**: Component-specific utility functions
    - `elementRenderWrappers.tsx` - `ElementRenderWrapper` and `GroupRenderWrapper` factory functions used by Canvas to lazily mount element components

- **`modals/`**: Standalone modal components
    - `PermissionErrorModal.tsx` - Permission error modal (extracted from base.tsx)
    - `StorageLimitModal.tsx` - Storage quota exceeded modal (extracted from base.tsx)

- **`floatingToolbar.tsx`**: Floating toolbar for quick actions (every time when a user clicks component, this floating toolbar gets visible and invisible when the focus is moved away from component)

### `/src/baseTypes`

One module per base type — the substrate a base is drawn on.

- `types.ts` - `BaseType` union + the `BaseTypeProvider` interface
- `registry.ts` - `BaseType` → lazily-imported provider; `isBaseType` guard
- `boardType.ts` - Parchment whiteboard (near no-op; the CSS owns the backdrop)
- `mapType.ts` - MapLibre + CARTO Positron; dynamically imported
- `baseTypeStorage.ts` - `craftbase_base_type_<baseId>` read/write
- `zoomLimits.ts` - Per-type camera range (`BASE_TYPE_ZOOM_LIMITS`)
- `mercator.ts` - lng/lat ⇄ surface-space conversion

### `/src/factory/`

Component factory classes (.ts file under /src/factory) that generate template definitions for each element type. Each factory corresponds to a component element.

Example of factory-component relation:

- Factories (`/src/factory/`): `arrowLine.ts`, `circle.ts`, `divider.ts`, `pencil.ts`, `rectangle.ts`, `newText.ts`
- Component (`/src/components/elements/`): `arrowLine.tsx`, `circle.tsx`, `divider.tsx`, `pencil.tsx`, `rectangle.tsx`, `newText.tsx`

### `/src/store` (not in use)

Legacy Redux store files (currently unused in the project).

- **`actions/`**: Redux action creators (not in use)
- **`reducers/`**: Redux reducers (not in use)

### `/src/schema`

GraphQL schema definitions for backend communication (Hasura).

- **`queries/`**: GraphQL query definitions
- **`mutations/`**: GraphQL mutation definitions
- **`subscriptions/`**: GraphQL subscription definitions for real-time updates

### `/src/constants`

Application constants and configuration.

- `elementSchema.ts` - Element schema definitions
- `misc.ts` - Miscellaneous constants
- `exportHooks.ts` - Custom hook exports

### `/src/hooks`

Custom React hooks extracted from base.tsx and newCanvas.tsx.

- `useDrawingModes.ts` - Draw mode state (`isPencilMode`, `isArrowDrawMode`, `isTextDrawMode`, pointer toggle)
- `useElementDefaults.ts` - Element defaults (`defaultLinewidth`, `defaultStrokeType`, `defaultStrokeColor`, text defaults) and their setters
- `useMobileToolbarPanels.ts` - Mobile panel visibility state with useEffect-based auto-close logic
- `useLocalDraftPersistence.ts` - localStorage draft save/restore + storage-quota modal state
- `useComponentHistory.ts` - Undo/history stack (`historyLog`, `recordToHistoryLog`, `undoLastAction`, `clearHistory`) — `HistoryEntry` is a discriminated union (`ADD | DELETE | UPDATE_VERTICES | UPDATE_BULK | BATCH`)
- `useCanvasClipboard.ts` - Copy (Ctrl+C) and paste (Ctrl+V) logic for canvas elements

### `/src/utils`

Utility functions and helpers.

- `constants.ts` - Shared constants
- `misc.ts` - Miscellaneous utilities
- `updateVertices.ts` - Vertex update utilities
- `canvasUtils.ts` - Pure Two.js canvas helpers: `setArrowEndpointsVisible`, `applyShapeStyle`, `cloneElementData`, `resolveShapeFromPath`, `pollUntilElement`
- `drawModeUtils.ts` - localStorage draw mode helpers: `getArrowDrawMode`, `isSelectPanMode`, `clearAllDrawModes`

### `/src/icons`

SVG icon components.

### `/src/assets`

Static assets (images, fonts, etc.).

### `/src/wireframeAssets`

Wireframe-related assets.

### `/src/styles`

Global stylesheets.

## Key Files

### Root Level (`/src`)

- **`App.tsx`**: Root application component with routing (`/` → Base, `/base/:id` → Base, `/map/:id` → Base pinned to the map type, `/board/:id` → `LegacyBaseRedirect` for links shared before the rename, `/home` → Marketing). `/embeddable-whiteboard` is **retired** — craftbase is a service you come and use, not a component you embed — and the indexed URL 301s to `/home` from `public/_redirects` (above the SPA catch-all, which matches everything).
- **`newCanvas.tsx`**: Main canvas rendering logic using Two.js
- **`routes.ts`**: Application routes configuration
- **`index.tsx`**: Application entry point
- **`serviceWorker.ts`**: PWA service worker

## Data Flow

1. **User Interaction** → Canvas event listeners (mouse, drag, zoom)
2. **Component Creation** → Factory generates template → Element renderer creates Two.js object
3. **State Updates** → React Context (BaseContext) + local component state → Component re-renders
4. **Backend Sync** → GraphQL mutations fire only when `isPersisted` is true. In local mode (`/`), state lives in React + localStorage draft only.

## React Context

The **BaseContext** (declared in `src/views/Base/baseContext.ts`, provided by `src/views/Base/base.tsx`) provides:

- Component store state
- Selected component state
- Two.js instance
- Pencil mode state (from `useDrawingModes` hook)
- Toolbar visibility (from `useMobileToolbarPanels` hook)
- Element defaults — stroke/fill/text (from `useElementDefaults` hook)
- Undo/history functions — `recordToHistoryLog`, `undoLastAction` (from `useComponentHistory` hook)
- GraphQL mutation functions
- `baseId`, `isPersisted`, `persistBase`, `backgroundBaseId` (canvas-first UX)
- `activeBaseType`, `switchBaseType`, `toolset` (base-type switching)
- Other base-level state and handlers

Child components access this context via `useContext(BaseContext)`.

### Hook composition in base.tsx

`base.tsx` composes several custom hooks in this order (order matters — each may depend on the previous):

1. `useDrawingModes()` — draw mode state and setters
2. `useMobileToolbarPanels({ isMobile, selectedComponent })` — panel visibility
3. `useElementDefaults()` — element defaults (stroke/fill/text) and their setters
4. `useLocalDraftPersistence({ ..., onStorageLimitRef })` — draft persistence + quota modal
5. `useComponentHistory({ ... })` — undo stack

## Technology Stack

- **Language**: TypeScript (`strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)
- **UI Framework**: React (^18.3.1)
- **Canvas Rendering**: Two.js (custom DOM-level event handling; see Stale Closure section)
- **State Management**: React Context (BaseContext) + local component state
- **Backend**: GraphQL (Hasura) with codegen via `yarn codegen` → `src/schema/generated.ts`
- **GraphQL Client**: Apollo Client
- **Styling**: CSS + Tailwind CSS
- **Build Tool**: Vite
- **Package manager**: Yarn (v1.22.22)
- **Type-check**: `yarn typecheck` (runs `tsc --noEmit`)

# Workflow

- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance

## Mobile testing on local network

When testing on a real mobile device (laptop and phone on same WiFi):

1. Replace `localhost` with the laptop's LAN IP (e.g. `10.151.106.95`) in `.env`:
    ```
    VITE_GRAPHQL_ENDPOINT=http://<LAN_IP>:8080/v1/graphql
    VITE_WS_GRAPHQL_ENDPOINT=ws://<LAN_IP>:8080/v1/graphql
    ```
2. Ensure `vite.config.mjs` has `host: true` and `allowedHosts: ['<LAN_IP>']` (no `http://` prefix).
3. Restart the dev server, then open `http://<LAN_IP>:5173` on mobile.
4. **Revert `.env` before committing** — or use `.env.local` for the override so it stays out of git.

# Feature Context

See detailed notes in `.claude/context/` for feature-specific implementation details:

- `.claude/context/undo-history.md` - Undo/history stack: action entry shapes, `recordToHistoryLog`, and `undoLastAction()` as the canonical rollback for any failed mutation
- `.claude/context/responsive-design.md` - When to use Tailwind responsive prefixes vs `useMediaQueryUtils` hook; breakpoint values for both; the core decision rule
- `.claude/context/font-guide.md` - Font system: Geist (UI chrome), Fraunces (branding/headings), Caveat Brush (canvas sketch); CSS variables, Tailwind config, and usage rules per area
- `.claude/context/reorder.md` - How reording/positioning of elements in Z-Axis (Z-order) works in craftbase
- `.claude/context/viewport.md` - What tx/ty/scale mean; why `zoomSet` + `translateSurface`; how the camera persists
- `.claude/context/geo-objects-plan.md` - Original implementation plan for the geo elements (point/area/route) — partly historical
- `.claude/context/v1-readiness-roadmap.md` - The roadmap for v1 readiness of craftbase: plan and promises around data durability, API stability and operational confidence.

## Bases and base types

A **base** is the workspace: the thing a user opens, draws on, shares and
persists. It is the entity behind `bases.base` in Postgres, `/base/:id` in the
URL, and `BaseContext` in React.

A base has a **type** — the substrate it is drawn on. Three exist in the design:
`board` (parchment whiteboard, labelled **Whiteboard** in the UI), `map`
(OpenStreetMap) and `image` (still to be built). Types live in `src/baseTypes/`
behind the `BaseTypeProvider` interface (`types.ts`), resolved through
`registry.ts` with a dynamic import.

Keep the two words apart. "Base" never means the backdrop; "base type" never
means the document. `BaseType` is the union, `base.type` is the column,
`activeBaseType` is the context value, `baseTypeSwitcher.tsx` is the control.

- **Element coordinates never change when the type changes.** They stay in
  Two.js surface space; only the backdrop and the camera move. The map is slaved
  to the ZUI camera by `syncMapToZui` in `mapType.ts` — surface (0,0) always
  sits over `anchor.lngLat`, and `mapZoom = anchor.zoom + log2(zuiScale)`. That
  equation is the whole contract; if the map drifts against the ink, it's wrong.
- **Each base type owns its own viewport.** A type is a workspace, not a
  wallpaper: panning a map must not drag the whiteboard's view with it.
  `viewportStorage.ts` keys the camera per type, `base.tsx` banks the outgoing
  camera and restores the incoming one on every switch, and an unvisited type
  opens at identity. The board type deliberately keeps the **unsuffixed key**
  (`craftbase_viewport_<baseId>`), which is also why the board → base rename
  left these keys alone: they never carried the word "board".
- **Each base type shows only its own content** (`geoVisibility.ts`,
  `applyBaseTypeVisibility`): geo objects hide on the board type, and
  `BOARD_ONLY_TYPES` (rectangle/circle/diamond/arrowLine/curvedLine/pencil/
  line/divider) hide on the map type. Hidden via Two.js `visible`, never
  unmounted and never deleted — the records stay in the store, draft and DB.
- **The map circle is the board circle plus `objectClass`.** A circle drawn on
  a map base is `componentType: 'circle'` carrying `objectClass: 'geo'` — not a
  fourth geo type. It reuses the factory, the component, the resize adapter,
  undo, clipboard and export wholesale; the column is the entire
  differentiator, exactly as it already is for the pencil. The visibility rule
  needed no change: `objectClass === 'geo'` is tested *before* the
  `BOARD_ONLY_TYPES` set that contains `'circle'`. What diverges is per-record
  and deliberate: created at `GEO_CIRCLE_DEFAULTS` (50% opacity, stroke seeded
  from fill, its own saturated fill that does **not** sync `defaultFill` — a
  map circle's colour is its identity on the basemap, not a shape preference);
  no opacity control (the `GEO_CIRCLE` set simply omits the section, same
  mechanism as point/area/route); no inner text and no connector ports; and its
  **stroke** counter-scales via `isStrokeScaled` while its geometry stays
  world-scaled, so a 5km radius stays 5km while the ring stays readable from z4
  to z18. In the toolbar it is a child of the `geoShapes` drawer alongside Area
  — flattened to a flat button on desktop by `DESKTOP_FLATTENED_DRAWERS`,
  a drawer on mobile. That flattening now runs over `toolset.extraTools` too,
  and it runs *after* `hiddenTools`, which is what lets a tool named `'circle'`
  survive on a base whose `GEO_HIDDEN_TOOLS` contains `'circle'`. Covered by
  `tests/e2e/map-circle.spec.js`.
- **Text is scoped per record, not per type.** The same `newText` type is
  authorable on more than one base type, so `buildTextShapeData` (`base.tsx`)
  stamps `metadata.baseTypeScope` with the authoring type and that pin outranks
  every type-level rule. Text used to be universal, which meant whiteboard text
  leaked onto the map while map text (`geoText`, flagged `objectClass: 'geo'`)
  correctly stayed put — the same gesture producing two different scopes.
  Records written before the stamp are caught by a legacy rule: a bare
  `newText` can only have been authored on the board base, because `'text'` is
  in `GEO_HIDDEN_TOOLS` so map text is always `geoText`. Covered by
  `tests/e2e/text-base-type-scope.spec.js`.
- **The visibility rules are still binary against `'board'`, and that is the
  known blocker for the image type.** `objectClass === 'geo'` resolves to
  `type !== 'board'`, so geo objects would appear on an image base; and
  `BOARD_ONLY_TYPES` resolves to `type === 'board'`, so shapes would hide on
  one. `metadata.baseTypeScope` is the mechanism that scales — it is the
  highest-precedence rule and it is per-record — but it currently has one
  writer (`welcomeSketch.ts`). Make it universal before building the image type.
- **`baseTypeScope` keeps a legacy read.** `scopedBaseType` accepts the old
  `metadata.baseScope` spelling because that field lives on rows already in
  Hasura, which `storageMigration.ts` cannot reach. It is the single deliberate
  back-compat read in the codebase; everything else speaks one vocabulary.
- **Any camera change must reach `onCameraChange`.** Handlers inside `addZUI`
  do this already. Anything driving the camera from *outside* — currently only
  `ZoomControls` — must call `zui.notifyCameraChange()`, or the backdrop
  silently freezes while the canvas keeps moving.
- **Persistence:** `craftbase_base_type_<baseId>` (`baseTypeStorage.ts`), a
  sidecar key mirroring the viewport-key pattern, swept by the same TTL loop in
  `base.tsx`. Never inside the draft blob, and **never written on read** — a
  base that has never touched the switcher must leave localStorage untouched.
- **Toolbar gating:** read `toolset` from `BaseContext`, not the provider.
  `toolset` is the type's gating *unless* the deprecated `geoObjectsEnabled`
  prop overlays the geo toolset.
- **`geoObjectsEnabled` / `renderBackground` are dead weight awaiting removal.**
  Both exist only for the now-defunct craftmaps consumer. `geoObjectsEnabled`
  only ever meant "surface the geo tools" (never "use the map" — that mapping
  would have stacked two maps), and `renderBackground` sets
  `baseTypeSwitcherEnabled = false` because the caller owned the substrate.
  With no caller left, both branches are unreachable in practice: **delete them
  rather than extend them**, and let `toolset` come purely from the active type.
- **maplibre-gl is dynamically imported in `mapType.ts` only** (~1MB chunk), so
  whiteboard users never fetch it. It needs
  `canvasContextAttributes: { preserveDrawingBuffer: true }` or PNG export
  captures a blank backdrop.
- **The basemap is CARTO Positron vector tiles** (`BASEMAP_STYLE_URL`) — OSM
  data, muted palette, no API key, attribution carried in the style's own
  TileJSON. Deliberately *not* osm.org's raster tiles: those serve one baked-in
  design capped at z19, with nothing to restyle. The style is one exported
  constant so swapping providers stays a one-line change.
- **Export:** JSON is `formatVersion: '1.1'` with `baseType`/`baseTypeConfig`,
  and the version is deliberately **never validated on import** — that's what
  keeps files interchangeable both ways. The importer reads only `components`
  and `viewport`, so a pre-rename file carrying `boardId` still opens: the field
  is ignored and both apply paths stamp their own. PNG export asks the provider
  for a raster backdrop (`captureBaseTypeBackdrop`) and injects it as an SVG
  `<image>`; returning `null` falls back to the parchment path.

## Storage migration

`src/utils/storageMigration.ts` runs once at boot from `src/index.tsx`, guarded
by `craftbase_storage_version`. It exists so the board → base rename did not
wipe local work: it moves `craftbase_base_<id>` → `craftbase_base_type_<id>`
(reshaping `base` → `type`), moves `craftbase_background_board_id` →
`craftbase_background_base_id`, remaps `boardId`/`boardName` → `baseId`/`baseName`
inside the draft, and drops the dead `lastOpenBoard`.

Rules: every step is independently try/caught (a corrupt entry costs that entry,
never the boot), and **no read path anywhere else carries a fallback**. Bump
`STORAGE_VERSION` and add a step for any future storage rename. Covered by
`tests/e2e/storage-migration.spec.js`.

## Port connectors (connectable arrows)

Connectors are `arrowLine` elements whose tail/head can dock onto a shape's
edge **port**.

- **Port** — a connection point floated just outside each edge midpoint
  (n/e/s/w) of a port shape's selection box. Port shapes are `rectangle`,
  `circle` and `diamond` (`PORT_SHAPE_TYPES`/`isPortShape` in
  `src/utils/shapePorts.ts` — the single gate shared by rendering, hover
  hit-test and the radar). `isPortShape` takes the whole **record**, not a bare
  `componentType`, because it must also exclude `objectClass: 'geo'`: the map
  circle shares `componentType: 'circle'` with the whiteboard one, and ports on
  a map base would have nothing to dock (`arrowLine` is hidden there).
  Rendered + hit-tested in
  `src/canvas/selectionController.ts`; geometry in `src/utils/shapePorts.ts`
  (`getShapePortPoint`, bbox-based, so circle ports sit on the cardinal points
  and diamond ports on the tips). Clicking a port pulls out a connector whose
  tail is pinned there (`startPortConnector` in `src/newCanvas.tsx`).
- **Nearby-port radar** — while an arrow endpoint is being dragged, the cursor
  is the probe: `findNearestPort` (`shapePorts.ts`) finds the closest port in
  range (`PORT_RADAR_RADIUS`), which the controller highlights with the amber
  pulsing `portGlow` ring + the dashed `nearbyPortExpectedShape` skeleton around
  the candidate shape (shape-true silhouette: rectangle/ellipse/diamond
  variants). A **one-off magnetic snap** glues the endpoint to that
  port; pulling past the threshold releases it (never forced). On release while
  docked, the binding is committed (`updatePortRadar`/`applyPendingPortConnection`).
- **Binding columns** — attachment is stored as 6 fields on the arrow row:
  `tailShapeId`/`tailEdge`/`tailPortIndex` and `headShapeId`/`headEdge`/
  `headPortIndex` (`*Edge` = `n/e/s/w-resize`; `*PortIndex` = fan slot among
  connectors stacked on the same port, reassigned by `restackPortConnectors`).
  All 6 are Hasura columns (in `generated.ts` and the base-load query), so
  bindings persist in both local mode and saved bases. Reverse lookup is
  derived by scanning the store (no shape-side columns).
  `reanchorArrowsForShape`/`persistBoundArrows` keep a docked endpoint glued when
  the bound shape moves/resizes.
- **The `restackPorts` event** — the generic "re-glue these ports" command:
  `window.dispatchEvent(new CustomEvent('restackPorts', { detail: { ports:
  [{shapeId, edge}] } }))`. The listener in `newCanvas` polls for the shape
  (fresh mounts) then runs `restackPortConnectors`, which re-anchors every
  docked endpoint to the shape's current edge and reassigns fan indices
  (persisted with `skipHistory`). Dispatched by: `useComponentHistory`
  (binding reverts, position/size reverts, arrow insert/remove),
  `groupobject.tsx` `commitGroupMove` (a group move relocates member ports;
  connectors crossing the group boundary must re-glue), and the clipboard
  (paste of a bound arrow, after its mount).
- **Undo/redo** — binding changes ride `UPDATE_BULK`/`BATCH` entries;
  `useComponentHistory` mirrors all 6 fields onto `elementData` and fires
  `restackPorts` for every touched port. Deleting a shape detaches its docked
  arrows (bindings cleared, arrows kept) as one `BATCH` with the shape's
  DELETE (`detachArrowsForDeletedShapes` in `base.tsx`) — one undo restores
  the shape and re-docks the arrows.
- **Copy/paste** — `cloneElementData` carries the 6 binding fields; the paste
  path (`rebindClonedArrow` in `useCanvasClipboard`) remaps bindings to shapes
  cloned in the same paste, keeps bindings to shapes still on the canvas, and
  clears bindings whose shape is gone — then restacks once the arrow mounts.

### DB schema

Two tables matter. Types below are the real Postgres types — the previous
version of this block was stale (it said `text`/`integer` where the columns are
`uuid`/`float8`). Regenerate `src/schema/generated.ts` with `yarn codegen` after
any change; never hand-edit it.

**`bases.base`** — the workspace. Root field `bases_base`.

```
{
  id: uuid,               // primary key, default: gen_random_uuid()
  type: bases_base_type,  // FK -> bases.base_type(value); NOT NULL, default 'board'
  name: text | null,
  isPublic: boolean,      // NOT NULL; flipped by the share flow
  createdAt: bigint,      // NOT NULL
  createdBy: text | null,
  createdByEmail: text | null,
  updatedAt: bigint,      // NOT NULL
  updatedBy: text | null,
  components: jsonb | null,   // legacy blob, superseded by components.component
  comments: jsonb | null,
  subscribersData: jsonb,     // NOT NULL
  allowViewBy: jsonb | null,
  allowUpdateBy: jsonb | null,
  allowDeleteBy: jsonb | null,
}
```

**`bases.base_type`** — a Hasura *enum table* (`set_table_is_enum`), which is
what makes `type` surface as the GraphQL enum `bases_base_type_enum` rather than
a bare String. Adding a fourth type is one `INSERT`, not a constraint swap.

```
{ value: text primary key, comment: text }   // 'board' | 'map' | 'image'
```

**`components.component`** — the elements on a base. Root field
`components_component`; object relationship `base` points back to `bases.base`.

```
{
  id: uuid,               // primary key, default: gen_random_uuid()
  componentType: text,    // NOT NULL
  objectClass: text,      // 'geo' marks the geo toolset's output
  zoomResistant: boolean | null, // geoText ONLY; see "Zoom resistance" below
  baseId: uuid,           // NOT NULL, FK -> bases.base(id)
  baseName: text | null,
  x: float8, y: float8,
  x1: float8, x2: float8, y1: float8, y2: float8,
  width: float8, height: float8,
  fill: text,             // NOT NULL, default '#f4f4f2'
  stroke: text | null,
  linewidth: float8 | null,
  strokeType: text | null,
  radius: float8 | null,
  iconStroke: text | null,
  textColor: text | null,
  opacity: float | null,
  position: integer,      // NOT NULL; Z-order (see reorder.md)
  metadata: jsonb | null, // polymorphic: vertex array for pencil/route/area/
                          // curvedLine; object for text/point; carries baseTypeScope
  children: jsonb | null,
  isDummy: boolean | null,
  createdBy: text,        // NOT NULL
  updatedBy: text | null,
  createdAt: bigint | null,
  // Port connector bindings — see "Port connectors" above
  tailShapeId: uuid | null, tailEdge: text | null, tailPortIndex: integer,
  headShapeId: uuid | null, headEdge: text | null, headPortIndex: integer,
}
```

Note `metadata` is a union type Postgres cannot constrain and Hasura types as
opaque `jsonb`; the client branches on `Array.isArray(metadata)` in several
places. Splitting the vertex array into its own column is a known follow-up.

## Zoom resistance

Geo elements counter-scale against the ZUI camera so they stay legible when the
world zooms out: `apparentSize ∝ zuiScale^(1 - resist)`
(`utils/counterScale.ts`). **`resolveResist(item)` is the single reader** — use
it rather than reaching for the fields yourself, or a live element and the
detached copy in a group overlay will disagree.

Two inputs, and they are not interchangeable:

- **`metadata.resist`** — the numeric strength, and the _only_ mechanism for
  `point` / `area` / `route` / geo `pencil` / geo `circle`. Point and geoText
  counter-scale the whole group; area/route/geo-pencil/geo-circle counter-scale
  stroke width only (`GROUP_SCALED_TYPES` vs `isStrokeScaled` — don't unify
  them). Two of those five are decided by `objectClass`, not `componentType`:
  pencil and circle are offered on every base, so only the column says whether
  a given one was drawn on a map.
- **`zoomResistant` (column)** — the user-facing on/off switch, surfaced as
  **Zoom resistant** in the `GEO_TEXT` property set. Read for **`geoText` only**;
  `false` forces resist 0 (the label scales with the map), `null`/absent/`true`
  means `GEO_TEXT_RESIST`. Every other `componentType` ignores the column.

It is **per record, never a default**. `applyProperty` deliberately skips the
`useElementDefaults` sync for this key (same as `opacity`), so turning it off on
one label does not follow the selection onto the next or onto newly created
text. Two labels on one map run two different models through the same
`zoomChanged` broadcast.

Because `ElementRenderWrapper` freezes element props at mount, a column write
never reaches a live `geoText` through React. The toggle and its undo/redo both
announce `GEO_TEXT_RESIST_CHANGED_EVENT` with `{ id, resist }`; the component
filters on `id` and re-scales against the current camera. Two more consequences
of it being a column rather than a metadata key: `cloneElementData` must name it
explicitly or paste drops it, and the `prevProps` snapshot in
`updateComponentBulkPropertiesInLocalStore` needs the `undefined → true`
fallback or the first undo is a no-op. Covered by
`tests/e2e/geo-text-zoom-resist.spec.js`.

## Canvas interaction invariants

Rules that live in more than one file, each of which had drifted at least once.

- **The camera input model belongs to the base type, not to the app.** Both
  handlers branch on `activeBaseTypeRef` inside `addZUI` (`newCanvas.tsx`). On
  the **map** base the wheel only ever zooms and a drag over empty canvas pans,
  with `shift`+drag left as the only box-select — the idiom of every mapping
  product anyone arrives from. On the **board** base a plain wheel pans, a
  modifier (`cmd`/`ctrl`/`shift`) zooms, and a drag marquees — the idiom of
  Figma, Miro and Excalidraw. Neither is the "real" one; changing either means
  reading both, which is why `map-wheel-zoom.spec.js` asserts each against the
  other. Three things hang off this. The pan branch is reached from the
  `shape === null` arm of mousedown, **after** the selection clearing, so a
  click that never moves still deselects and a drag that starts on an element
  still moves that element. `beginMousePan` binds to `window`, not
  `domElement`, so a release outside the canvas still ends the pan. And the
  wheel listener is `{ passive: false }` and calls `preventDefault()`
  unconditionally: the SVG is a fixed full-viewport surface with nothing behind
  it to scroll, and without it `ctrl`+wheel page-zooms the browser and Safari
  reads a horizontal two-finger swipe as back-navigation. The legacy
  `mousewheel` alias is deliberately **not** bound alongside `wheel` — a
  browser firing both would now double-apply the zoom.
- **A wheel event's units are per-browser and per-device.** `wheelZoomStep`
  (`utils/wheelZoom.ts`) is the single reader. It prefers `wheelDeltaY` where it
  exists, because that is what shipped and it is *not* a fixed multiple of
  `deltaY` (a discrete notch reports 120 against a `deltaY` of 100; a trackpad
  reports 3x) — deriving one from the other changes the feel of one device to
  fix the other. Firefox sets neither and reports LINE units, which worked out
  to a ~0.3% zoom per notch: survivable while zoom was a modifier gesture,
  not once the bare wheel became the map's primary control. The step is clamped
  because macOS trackpads keep emitting inertial events after the fingers lift,
  and one of those can otherwise cross several zoom levels in a frame.
- **The absolute-vertex-metadata family owns its geometry in `metadata`, not
  in `x`/`y`.** pencil, area, route and curvedLine store ABSOLUTE vertex coords
  and their factories rebuild the path as `metadata - (x, y)`, so `x`/`y` is
  only the origin those vertices were made relative to. Two consequences, both
  of which shipped as bugs: **moving one must shift the vertex array too** (in
  the same store write, so one undo reverts both) — persisting the new origin
  alone is worse than persisting nothing, because the factory then subtracts the
  new origin from the old vertices and the shape lands back where the drag
  started; and **anything asking "where is it?" must ask the vertices**, which
  is why paste positions these types off `vertexMetadataCenter` rather than
  `x`/`y` (that is wherever the first click happened to fall). `hasAbsoluteVertexMetadata`
  / `shiftVertexMetadata` / `vertexMetadataCenter` (`utils/vertexMetadata.ts`)
  are the shared readers — reach for the type list there, never a fresh
  `componentType === 'area' || ...` chain, which is how curvedLine ended up with
  a move fix its three siblings never got.
- **Bare-canvas clicks clear the selection from the hit test, not from the DOM.**
  "Selected" is drawn by three owners — the controller's box, the element-owned
  chrome that answers `clearSelector` (geoText, point) and the React
  `selectedComponent` behind the properties toolbar and area/route's vertex
  handles — and the `shape === null` branch of mousedown clears all three. It
  used to clear only the first, leaving the rest to a
  `lastChild?.id === 'two-0'` test that matched only when the press landed on
  the wrapper div rather than the SVG or the map canvas: hence deselecting an
  area took two clicks and a route three.
- **Deleting a record does NOT unmount its element component.** This is the one
  most likely to bite. `handleSetComponentsToRender` only ever *adds* wrappers,
  and `ElementRenderWrapper` snapshots its record at mount — so dropping the row
  from `componentStore` leaves the element painted on the canvas until a reload.
  **Every delete path must pair the store write with its own `two.remove`**, and
  the mobile trash button does (`removeFromScene` in `mobileDeleteButton.tsx`).
  Element cleanups still remove their own group for real unmounts; that path is
  guarded on the group still being in the scene, per the `scene.subtractions`
  note above.
- **Pan mode navigates; it never authors.** `newCanvas`'s `dblclick` returns
  early under `isPanMode()`, and `point.tsx` / `geoText.tsx` repeat the guard
  inside their editors — their dblclick listeners are bound to their own SVG
  nodes and never reach the canvas handler. A tool whose whole job is moving the
  view must not drop the user into a text field.
- **The move-drag fast path writes the SVG `transform` ATTRIBUTE**, not
  `style.transform`, and sets no `will-change`. Both work on desktop; the CSS
  pair (a promoted layer on an SVG `<g>`) is what made elements vanish for the
  length of a drag on mobile. Because it writes the same attribute Two.js
  renders, `clearCssMove` must flag `_flagMatrix` on the element (and the
  selection chrome) or Two.js sees a clean node and leaves the last drag frame
  standing. The win being protected is skipping the full-scene `two.update()`
  per frame — never the compositing.
- **Paste moves the selection to the clone.** The clipboard clears the source's
  chrome and dispatches `SELECT_COMPONENT_EVENT` once the clone has mounted;
  `newCanvas` answers it — `selectionController.attach` for the shapes it owns,
  a synthetic `click` plus `buildToolbarState` for everything that draws its own
  chrome (arrows, lines, the geo family).
- **A live `linewidth` edit on a geo stroke must be counter-scaled.** route /
  area / geo-pencil paint `linewidth * computeCounterScale(scale, resist)`;
  writing the raw value onto the path made the widest step hairline-thin below
  the anchor until the next `zoomChanged` re-applied the factor. `applyProperty`
  scales what it paints and persists the logical width (`isStrokeScaled`).
- **Mobile text editing is driven by events, not refs.** The editors are DOM
  overlays built inside element components; the ✓/✗ and ✏️ are React
  (`mobileTextControls.tsx`). They talk through `TEXT_EDIT_START/END` (editor →
  chrome) and `TEXT_EDIT_COMMIT/CANCEL` (chrome → editor), and the buttons act
  on **click** while cancelling the **press**: the press must not blur the
  editor (blur is what commits, so ✗ would become ✓), and acting on the press
  ended the edit mid-gesture, letting the tap's own click land on the delete
  button that had just re-mounted in that slot.
- **Menu entries are base-type aware.** "Search a place" appears only on a map
  base (and only on mobile, where the top bar has no room for the field);
  **Settings** appears only off it, because both of its switches are board-only
  — connector ports live on rectangle/circle/diamond, which `BOARD_ONLY_TYPES`
  hides on a map, and the dot grid is the parchment backdrop the map replaces.
- **Tooltips are mouse-and-keyboard only.** `Tooltip` opens on `pointerenter`
  with `pointerType === 'mouse'` and on `:focus-visible`, never on touch: a tap
  fires the compatibility mouse sequence and then leaves the element hovered
  with no `mouseleave` to follow, so a tapped button's bubble stayed up for the
  session. Gating on the pointer rather than on a device check keeps a
  touchscreen laptop right — cursor gets hints, finger does not. A global
  `pointerdown`/`scroll`/`blur` sweep closes any bubble that does get open, so a
  stuck tooltip is not a state this component can reach. Covered by
  `tests/e2e/tooltip-touch.spec.js`.
- **An open modal owns the screen.** `Modal`'s backdrop carries `z-index: 1000`
  — it has to out-stack the canvas chrome (10–20) and the toast (50), or the
  dimmed page still takes clicks.
- **Place search has two faces, one brain.** `usePlaceSearch` owns the debounce
  and abort; `placeSearch.tsx` is the desktop top-bar field and
  `placeSearchModal.tsx` (opened from the menu) is the mobile one. Landing
  somewhere new — a search pick, or either answer to the first-run prompt —
  ends in `enterPanMode()`.

Covered by `tests/e2e/map-mobile-controls.spec.js`,
`tests/e2e/canvas-interaction-fixes.spec.js`,
`tests/e2e/geo-move-paste-select.spec.js` and
`tests/e2e/map-wheel-zoom.spec.js` — the last is the only spec in the suite
that drives a real `wheel` event or a real camera drag. Every other zoom test
reaches in through `window.__cbZui` plus a synthetic `zoomChanged`, and would
pass no matter what the input handlers did.
