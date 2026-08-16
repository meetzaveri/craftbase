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

The map is now craftbase's own product identity — the base switcher (`src/bases/`) —
which is exactly what made craftmaps redundant.

## Implications when editing craftbase

- **Build features *in* craftbase.** Map glue, geocoding, basemap controls, place search:
    all of it belongs here now. The old rule ("if it feels consumer-specific it belongs in
    the consumer repo") is retired — there is no consumer repo to push it to.
- **Prefer removing an extension point to maintaining it.** These props exist only because
    craftmaps needed them, and each one is now a fork in the code with no live caller:
    - `geoObjectsEnabled` — **deprecated**; only ever meant "surface the geo toolset".
        Superseded by the map base's own toolset.
    - `renderBackground` — consumer-painted backdrop slot. Superseded by `BaseProvider`.
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
- **Backward compatibility that still counts is *data*, not API.** Existing boards in
    localStorage and Hasura, saved viewports, exported JSON files. Those users are real.
    Keep the "no write on read", legacy-viewport-key and `formatVersion`-never-validated
    guarantees described under "Base switcher".

## When in doubt

Ship it here. The question is no longer "whose repo does this belong in" but "does this
make craftbase a better standalone whiteboard".

# Code structure

Below is the craftbase project codemap with different sections talking about overview, architecture, directory structure, technology stack and key files.

## Overview

Craftbase is an minimal virtual whiteboarding tool built with React that uses Two.js for 2D canvas rendering. This document maps the codebase structure to help developers quickly locate and understand different parts of the application.

## Core Architecture

**Rendering Stack**: Board → Canvas → ElementRenderer → Component Element → Component Factory

- **Board**: Main container handling canvas rendering, sidebar, and floating toolbar
- **Canvas**: 2D rendering logic and user interaction controls (mouse, drag, zoom, pan)
- **Component Elements**: React functional components with attached event listeners
- **Component Factories**: Template generators that produce component definitions

The Board component uses React Context (`BoardContext`) to pass state and methods down to child components. This is the primary state management pattern used throughout the application.

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

- **`Board/`**: Main whiteboard page
    - `board.tsx` - Board component with `BoardContext` provider, GraphQL operations
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

- **`common/`**: Shared utility components
    - `button.tsx` - Base button component
    - `modal.tsx`, `modalContainer.tsx` - Modal system
    - `portal.tsx` - React portal wrapper
    - `spinner.tsx`, `spinnerWithSize.tsx` - Loading indicators

- **`utils/`**: Component-specific utility functions
    - `elementRenderWrappers.tsx` - `ElementRenderWrapper` and `GroupRenderWrapper` factory functions used by Canvas to lazily mount element components

- **`modals/`**: Standalone modal components
    - `PermissionErrorModal.tsx` - Permission error modal (extracted from board.tsx)
    - `StorageLimitModal.tsx` - Storage quota exceeded modal (extracted from board.tsx)

- **`floatingToolbar.tsx`**: Floating toolbar for quick actions (every time when a user clicks component, this floating toolbar gets visible and invisible when the focus is moved away from component)

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

Custom React hooks extracted from board.tsx and newCanvas.tsx.

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

- **`App.tsx`**: Root application component with routing (`/` → Board, `/board/:id` → Board, `/home` → Marketing)
- **`newCanvas.tsx`**: Main canvas rendering logic using Two.js
- **`routes.ts`**: Application routes configuration
- **`index.tsx`**: Application entry point
- **`serviceWorker.ts`**: PWA service worker

## Data Flow

1. **User Interaction** → Canvas event listeners (mouse, drag, zoom)
2. **Component Creation** → Factory generates template → Element renderer creates Two.js object
3. **State Updates** → React Context (BoardContext) + local component state → Component re-renders
4. **Backend Sync** → GraphQL mutations fire only when `isPersisted` is true. In local mode (`/`), state lives in React + localStorage draft only.

## React Context

The **BoardContext** (created in `src/views/Board/board.tsx`) provides:

- Component store state
- Selected component state
- Two.js instance
- Pencil mode state (from `useDrawingModes` hook)
- Toolbar visibility (from `useMobileToolbarPanels` hook)
- Element defaults — stroke/fill/text (from `useElementDefaults` hook)
- Undo/history functions — `recordToHistoryLog`, `undoLastAction` (from `useComponentHistory` hook)
- GraphQL mutation functions
- `boardId`, `isPersisted`, `persistBoard`, `backgroundBoardId` (canvas-first UX)
- Other board-level state and handlers

Child components access this context via `useContext(BoardContext)`.

### Hook composition in board.tsx

`board.tsx` composes several custom hooks in this order (order matters — each may depend on the previous):

1. `useDrawingModes()` — draw mode state and setters
2. `useMobileToolbarPanels({ isMobile, selectedComponent })` — panel visibility
3. `useElementDefaults()` — element defaults (stroke/fill/text) and their setters
4. `useLocalDraftPersistence({ ..., onStorageLimitRef })` — draft persistence + quota modal
5. `useComponentHistory({ ... })` — undo stack

## Technology Stack

- **Language**: TypeScript (`strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)
- **UI Framework**: React (^18.3.1)
- **Canvas Rendering**: Two.js (custom DOM-level event handling; see Stale Closure section)
- **State Management**: React Context (BoardContext) + local component state
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

- `.claude/context/floating-toolbar.md` - Floating toolbar activation and structure
- `.claude/context/undo-history.md` - Undo/history stack: action entry shapes, `recordToHistoryLog`, and `undoLastAction()` as the canonical rollback for any failed mutation
- `.claude/context/responsive-design.md` - When to use Tailwind responsive prefixes vs `useMediaQueryUtils` hook; breakpoint values for both; the core decision rule
- `.claude/context/font-guide.md` - Font system: Geist (UI chrome), Fraunces (branding/headings), Caveat Brush (canvas sketch); CSS variables, Tailwind config, and usage rules per area
- `.claude/context/reorder.md` - How reording/positioning of elements in Z-Axis (Z-order) works in craftbase
- `.claude/context/v1-readiness-roadmap.md` - the roadmpa for v1 readiness of craftbase consisting of plan and promises of data durability, API stability and operational confidence.

## Base switcher (board ⇄ map)

A **base** is the substrate the canvas is drawn on: `board` (parchment) or `map`
(OpenStreetMap). Lives in `src/bases/`, behind the `BaseProvider` interface
(`types.ts`), resolved through `registry.ts` with a dynamic import.

- **Element coordinates never change across a switch.** They stay in Two.js
  surface space; only the backdrop and the camera change. The map is slaved to
  the ZUI camera by `syncMapToZui` in `mapBase.ts` — surface (0,0) always sits
  over `anchor.lngLat`, and `mapZoom = anchor.zoom + log2(zuiScale)`. That
  equation is the whole contract; if the map drifts against the ink, it's wrong.
- **Each base owns its own viewport.** A base is a workspace, not a wallpaper:
  panning a map must not drag the whiteboard's view with it. `viewportStorage.ts`
  keys the camera per base, `board.tsx` banks the outgoing camera and restores
  the incoming one on every switch, and an unvisited base opens at identity.
  The board base deliberately keeps the **unsuffixed legacy key**
  (`craftbase_viewport_<boardId>`) so pre-bases viewports still restore.
- **Each base shows only its own content** (`geoVisibility.ts`,
  `applyBaseVisibility`): geo objects hide on the board base, `BOARD_ONLY_TYPES`
  (rectangle/circle/diamond/arrowLine/curvedLine/pencil/line/divider) hide on the
  map base, and **text stays visible on both**. Hidden via Two.js `visible`,
  never unmounted and never deleted — the records stay in the store, draft and DB.
- **Any camera change must reach `onCameraChange`.** Handlers inside `addZUI`
  do this already. Anything driving the camera from *outside* — currently only
  `ZoomControls` — must call `zui.notifyCameraChange()`, or the backdrop
  silently freezes while the canvas keeps moving.
- **Persistence:** `craftbase_base_<boardId>` (`baseStorage.ts`), a sidecar key
  mirroring the viewport-key pattern, swept by the same TTL loop in `board.tsx`.
  Never inside the draft blob, and **never written on read** — a board that has
  never touched the switcher must leave localStorage untouched, which is what
  keeps pre-bases boards byte-identical.
- **Toolbar gating:** read `toolset` from `BoardContext`, not `baseProvider`.
  `toolset` is the base's gating *unless* the deprecated `geoObjectsEnabled`
  prop overlays the geo toolset.
- **`geoObjectsEnabled` / `renderBackground` are dead weight awaiting removal.**
  Both exist only for the now-defunct craftmaps consumer. `geoObjectsEnabled`
  only ever meant "surface the geo tools" (never "use the map base" — that
  mapping would have stacked two maps), and `renderBackground` sets
  `baseSwitcherEnabled = false` because the caller owned the substrate. With no
  caller left, both branches are unreachable in practice: **delete them rather
  than extend them**, and let `toolset` come purely from the active base.
- **maplibre-gl is dynamically imported in `mapBase.ts` only** (~1MB chunk), so
  board-base users never fetch it. It needs
  `canvasContextAttributes: { preserveDrawingBuffer: true }` or PNG export
  captures a blank backdrop.
- **The basemap is CARTO Positron vector tiles** (`BASEMAP_STYLE_URL`) — OSM
  data, muted palette, no API key, attribution carried in the style's own
  TileJSON. Deliberately *not* osm.org's raster tiles: those serve one baked-in
  design capped at z19, with nothing to restyle. The style is one exported
  constant so swapping providers stays a one-line change.
- **Export:** JSON is `formatVersion: '1.1'` with `base`/`baseConfig`, and the
  version is deliberately **never validated on import** — that's what keeps 1.0
  and 1.1 files interchangeable both ways. PNG export asks the provider for a
  raster backdrop (`captureBackdrop`) and injects it as an SVG `<image>`;
  returning `null` falls back to the original parchment path.

## Port connectors (connectable arrows)

Connectors are `arrowLine` elements whose tail/head can dock onto a shape's
edge **port**.

- **Port** — a connection point floated just outside each edge midpoint
  (n/e/s/w) of a port shape's selection box. Port shapes are `rectangle`,
  `circle` and `diamond` (`PORT_SHAPE_TYPES`/`isPortShape` in
  `src/utils/shapePorts.ts` — the single gate shared by rendering, hover
  hit-test and the radar). Rendered + hit-tested in
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
  All 6 are Hasura columns (in `generated.ts` and the board-load query), so
  bindings persist in both local mode and saved boards. Reverse lookup is
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
  DELETE (`detachArrowsForDeletedShapes` in `board.tsx`) — one undo restores
  the shape and re-docks the arrows.
- **Copy/paste** — `cloneElementData` carries the 6 binding fields; the paste
  path (`rebindClonedArrow` in `useCanvasClipboard`) remaps bindings to shapes
  cloned in the same paste, keeps bindings to shapes still on the canvas, and
  clears bindings whose shape is gone — then restacks once the arrow mounts.

### Component schema (from DB)

```
{
  id: uuid, // primary key, unique, default: gen_random_uuid()
  componentType: text,
  x: integer, // default: 0
  y: integer, // default: 0
  x1: integer, // default: 100
  x2: integer, // default: 400
  y1: integer, // default: 100
  y2: integer, // default: 100
  width: integer, // default: 120
  height: integer, // default: 120
  fill: text, // default: '#f4f4f2'
  stroke: text | null,
  linewidth: integer | null,
  strokeType: text | null,
  radius: integer | null,
  iconStroke: text | null,
  textColor: text | null,
  boardId: text | null,
  boardName: text | null,
  metadata: jsonb | null,
  children: jsonb | null,
  isDummy: boolean | null,
  updatedBy: text | null,
  createdAt: bigint | null, // default: epoch()
}
```
