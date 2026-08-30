export const offsetHeight = 0
export const GROUP_COMPONENT = 'groupobject'

// Default canvas text font (single source of truth). Kept in sync with the
// `--font-sketch` var in App.css, the Tailwind `sketch` token, and the Google
// Fonts <link> in index.html. Every canvas-text fallback
// (`family || DEFAULT_TEXT_FONT_FAMILY`) references this so the default lives in
// exactly one place — including the welcome sketch (`SKETCH_FONT`).
export const DEFAULT_TEXT_FONT_FAMILY = 'Caveat Brush'

export const RUBBER_MODE_KEY = 'rubberMode'

// Eraser size: the eraser deletes whole elements via a point hit test, not
// pixel painting, so size is a tolerance around the cursor — a bigger size
// widens the forgiving radius for catching thin strokes/small shapes.
// Persisted like the other draw mode keys so re-opening eraser mode remembers
// the last pick.
export type EraserSize = 'small' | 'medium' | 'large'
export const ERASER_SIZE_KEY = 'eraserSize'
export const DEFAULT_ERASER_SIZE: EraserSize = 'medium'
export const ERASER_SIZES: readonly EraserSize[] = ['small', 'medium', 'large']

// On-screen DIAMETER in px of the dot the size selector shows for each size.
// This is the eraser's visual identity: the trail drawn on the canvas uses the
// exact same number, so the beam is the same circle as the swatch that was
// picked. Change it here and both move together.
export const ERASER_DOT_PX: Record<EraserSize, number> = {
    small: 6,
    medium: 10,
    large: 14,
}

// Hit-test tolerance RADIUS in px, deliberately separate from the dot above:
// the dot is what the eraser looks like, this is how far it reaches. It runs
// wider than the dot on purpose so sweeping feels forgiving rather than
// pixel-exact (small stays a bare point test).
export const ERASER_SIZE_RADIUS: Record<EraserSize, number> = {
    small: 0,
    medium: 10,
    large: 20,
}

export const VIEWPORT_KEY_PREFIX = 'craftbase_viewport_'
export const MOBILE_VIEWPORT_KEY_PREFIX = 'craftbase_mobile_viewport_'
export const VIEWPORT_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Whiteboard-only tools hidden while a geo-flavoured base (the map) is active —
// that workflow uses point/area/route + the map-side geoText instead.
// 'shapes' is the mobile drawer; rectangle/circle/diamond are its
// desktop-flattened children. 'lines' is the line/curvedLine drawer. 'text' is
// replaced by 'geoText'. Note this hides the *tools* only: shapes already drawn
// keep rendering and stay editable after a switch.
//
// 'pencil' is deliberately ABSENT: freehand is the one whiteboard tool that
// means the same thing over a map — circling a district, scribbling a route by
// hand — so it is offered on both bases. A stroke drawn here is tagged
// `objectClass: 'geo'` at creation, which is what keeps map scribbles off the
// board base and board scribbles off the map. See newCanvas's pencil commit.
export const GEO_HIDDEN_TOOLS: ReadonlySet<string> = new Set([
    'shapes',
    'rectangle',
    'circle',
    'diamond',
    'lines',
    'arrowLine',
    'text',
])

// Frames to keep re-applying geo-object visibility after a base switch or a
// store change. Element components mount lazily, so a single pass can run
// before the last geo element has landed in the Two.js scene. ~1s at 60fps.
export const GEO_VISIBILITY_RETRIES = 60

// Hard ceiling on that retry loop. The budget above is *reset* whenever the
// scene is still growing (elements mount lazily, and a big base can take well
// over a second to land), but `scene.children.length` also moves when selection
// chrome and previews come and go — so without a ceiling a user fiddling on the
// canvas could hold the loop open forever. ~10s at 60fps.
export const GEO_VISIBILITY_MAX_FRAMES = 600

// Per-base type (board / map) — a sidecar key deliberately kept OUT of the
// draft blob so the draft's size guard and rescue path are unaffected by it,
// and so a base that never touches the switcher writes nothing at all. Shares
// the viewport TTL and its sweep. See src/bases/baseStorage.ts.
export const BASE_TYPE_KEY_PREFIX = 'craftbase_base_type_'

export const componentTypes = {
    rectangle: 'rectangle',
    diamond: 'diamond',
    circle: 'circle',
    point: 'point',
    area: 'area',
    route: 'route',
} as const

// Geo objects (point/area/route) ride the same components_component pipeline as
// shapes — they're just a distinct category surfaced when a consumer opts in.
export const geoObjectTypes = {
    point: 'point',
    area: 'area',
    route: 'route',
} as const

export type GeoObjectType = keyof typeof geoObjectTypes

export const isGeoType = (type: string | null | undefined): boolean =>
    type === geoObjectTypes.point ||
    type === geoObjectTypes.area ||
    type === geoObjectTypes.route

// Standalone text element types: 'newText' (whiteboard) and 'geoText' (the map
// variant). They render identically and share every text code path (properties
// toolbar, group apply, history revert, clipboard); the only difference is that
// geoText carries `objectClass: 'geo'`, so it shows on the map base and hides on
// the canvas. Use this everywhere a "is this standalone text?" decision is made
// so both stay in lockstep.
export const isStandaloneTextType = (
    type: string | null | undefined
): boolean => type === 'newText' || type === 'geoText'

// Draw mode localStorage keys
export const ARROW_DRAW_MODE_KEY = 'arrowDrawMode'
export const TEXT_DRAW_MODE_KEY = 'textDrawMode'
export const PENDING_SHAPE_TYPE_KEY = 'pendingShapeType'
export const PENDING_SHAPE_PROPS_KEY = 'pendingShapeProps'
export const LAST_ADDED_ELEMENT_ID_KEY = 'lastAddedElementId'
export const PENCIL_MODE_KEY = 'pencilMode'
export const PAN_MODE_KEY = 'panMode'

// Geo draw modes. AREA/ROUTE use multi-click vertex placement; POINT is a
// single click-to-place. The active geo type is stashed alongside the flag.
export const GEO_DRAW_MODE_KEY = 'geoDrawMode'
export const GEO_DRAW_TYPE_KEY = 'geoDrawType'
export const GEO_DRAW_PROPS_KEY = 'geoDrawProps'
export const GEO_POINT_PLACE_MODE_KEY = 'geoPointPlaceMode'

// Pin/point counter-scale: 1/scale^resist keeps the pin legible when zoomed
// out. apparent size ∝ scale^(1 - resist), so 0 = scales with the world and
// 1 = fully fixed on screen (see utils/counterScale.ts for the derivation).
export const DEFAULT_GEO_RESIST = 0.9

// Map text (geoText) counter-scale. Text on a map base spans 18 zoom stops
// (map zoom 1..19 against a z16 anchor), and at resist 0 an 18px label renders
// at 18 * 2^(mapZoom - 16) px — 0.3px over a county, which is why map text was
// unreadable anywhere but the anchor zoom. At 0.9 that same label stays within
// roughly 6px..22px across the whole range.
//
// This is the knob to turn when tuning legibility: 1 pins text to a constant
// screen size (true map-label behaviour), 0 restores the old scales-with-the-
// geography model. Per-record `metadata.resist` overrides it.
export const GEO_TEXT_RESIST = 0.9

// The user-facing on/off switch for the above is the `zoomResistant` column,
// not metadata: `false` means resist 0, absent/true means GEO_TEXT_RESIST. It is
// read for geoText ONLY (resolveResist in utils/counterScale.ts) — point, area,
// route and geo pencil keep the numeric metadata.resist and ignore the column.
//
// Fired when that switch is toggled from the properties panel or reverted by
// undo. ElementRenderWrapper freezes each element's props at mount, so a column
// write never reaches the component through React — this is the same escape
// hatch `standaloneTextReverted` uses.
export const GEO_TEXT_RESIST_CHANGED_EVENT = 'geoTextResistChanged'

/**
 * "Select this element" — `{ id }`. Answered by newCanvas, which owns selection.
 *
 * Paste is the caller: the clone has to take the selection off the element it
 * was copied from, and the clipboard hook has no route into the canvas's
 * pointer handling. Dispatch only after the element has actually mounted (the
 * scene group must exist).
 */
export const SELECT_COMPONENT_EVENT = 'selectComponent'

/**
 * The text-editing handshake between an element's imperative editor (the
 * `<input>`/`<textarea>` overlays in point.tsx and geoText.tsx) and the mobile
 * chrome that has to drive it.
 *
 * A phone has no Enter or Escape, so an open editor needs on-screen ✓/✗ — and
 * those buttons are React, while the editor is a DOM node created inside a
 * Two.js element component. `START`/`END` announce the editor's lifetime,
 * `COMMIT`/`CANCEL` are the two answers back. Cancel means "put back what was
 * there when the editor opened", which only the editor knows — hence a request
 * rather than a value.
 */
export const TEXT_EDIT_START_EVENT = 'textEditStart'
export const TEXT_EDIT_END_EVENT = 'textEditEnd'
export const TEXT_EDIT_COMMIT_EVENT = 'commitTextEdit'
export const TEXT_EDIT_CANCEL_EVENT = 'cancelTextEdit'
// The generic point: a small filled circle with an editable label beside it.
// One design, no categories. POINT_RADIUS is the circle radius in surface units
// at scale 1 — the group counter-scales (DEFAULT_GEO_RESIST above), so the pin
// stays legible zoomed out. POINT_LABEL_GAP is the clear space between the
// circle's edge and the start of the label.
//
// POINT_COLOR is the circle's shipped colour and the only part the user can
// change. The label is fixed black by design, so a point's name always reads as
// the same annotation ink no matter how the pin itself is coloured. '#000' (not
// '#000000') matches the black the rest of the canvas defaults to — see
// PENCIL_DEFAULT_COLOR — which is also the form themeColorFlip pairs with white.
//
// Points only ever render over the map base, and the basemap has no dark
// variant, so black stays readable in either theme. Ship a dark basemap and
// this needs to become theme-derived ink instead.
export const POINT_RADIUS = 10
export const POINT_LABEL_GAP = 5
export const POINT_COLOR = '#FF5630'
export const POINT_LABEL_COLOR = '#000'
export const POINT_LABEL_FONT_SIZE = 18

// The point label's own size ladder, deliberately tighter than the whiteboard's
// TEXT_SIZES_ARRAY (24–72): a point's label is an annotation hanging off a 10px
// pin, and the whiteboard ladder's SMALLEST step is already larger than the
// design default. `M` is POINT_LABEL_FONT_SIZE, so a point that has never been
// touched reads as M in the toolbar. No mobile variant — a point counter-scales
// to a constant apparent size, so one ladder covers both.
export const POINT_LABEL_SIZES: { label: string; value: number }[] = [
    { label: 'S', value: 14 },
    { label: 'M', value: POINT_LABEL_FONT_SIZE },
    { label: 'L', value: 24 },
    { label: 'XL', value: 32 },
]

/**
 * The point-label size a toolbar size *label* means.
 *
 * The label is the unit the text defaults travel in (`defaultTextSize` is
 * `'S' | 'M' | 'L' | 'XL'`, not a pixel count), which is what lets one default
 * be shared across ladders: pick XL on a map label and a new point comes out at
 * the point ladder's XL, not the whiteboard's 72px. An unknown label falls back
 * to the design default.
 */
export function pointLabelSizeFor(label: string | null | undefined): number {
    return (
        POINT_LABEL_SIZES.find((s) => s.label === label)?.value ??
        POINT_LABEL_FONT_SIZE
    )
}

// Per-type initial defaults for new geo objects (distinct, map-appropriate
// colors from the prototypes). Users recolor afterward via the properties
// toolbar. Kept client-side so geo creation doesn't depend on a DB round-trip.
export const GEO_TYPE_DEFAULTS: Record<
    GeoObjectType,
    { stroke: string; linewidth: number }
> = {
    point: { stroke: POINT_COLOR, linewidth: 3 },
    area: { stroke: '#A32D2D', linewidth: 2 },
    route: { stroke: '#3B82F6', linewidth: 3 },
}

// The map circle is componentType 'circle' + objectClass 'geo' — not a type of
// its own — so it cannot live in GEO_TYPE_DEFAULTS, which is keyed by
// GeoObjectType. Its fill is deliberately NOT the shared `defaultFill`: that
// default is the whiteboard's pale shape fill, which at 50% over a basemap is
// invisible. Stroke is not listed because a new map circle takes its fill as
// its stroke, so the two read as one mark until the user separates them.
export const GEO_CIRCLE_DEFAULTS = {
    fill: '#A32D2D',
    linewidth: 2,
    opacity: 0.5,
} as const

// Multi-click draw preview (area / route / curvedLine): the dots and rubber-band
// are a *drawing aid*, so they are sized in SCREEN pixels and divided by the
// live camera scale before going into the scene. Without that they are plain
// surface-space marks, and on the map base — where zooming out drives the ZUI
// scale far below 1 — a 4px dot and a 2px line render sub-pixel and effectively
// disappear at the exact zoom levels where a route is easiest to trace.
//
// GEO_PREVIEW_MIN_STROKE_PX is a floor, not a replacement: a user who picked a
// fat stroke still previews it fat.
export const GEO_PREVIEW_DOT_PX = 5
export const GEO_PREVIEW_MIN_STROKE_PX = 3
// Opacity for the committed segments vs. the live rubber-band to the cursor.
// The rubber-band stays lighter so it reads as provisional, but not so light
// that it vanishes against a busy basemap.
export const GEO_PREVIEW_SEGMENT_OPACITY = 0.85
export const GEO_PREVIEW_RUBBER_OPACITY = 0.6

// Minimum vertices required to finish a multi-click draw. Shared by the geo
// area/route tools and the generic curved line (which reuses the same machinery).
export const GEO_MIN_VERTICES: Record<'area' | 'route' | 'curvedLine', number> =
    {
        area: 3,
        route: 2,
        curvedLine: 2,
    }

// Default ink for strokes. Pure black so it flips cleanly to white on a theme
// toggle (see themeColorFlip): #000 in light, #fff in dark.
export const PENCIL_DEFAULT_COLOR = '#000'
export const SHAPE_DEFAULT_STROKE = '#000'

// Draft persistence
// Bumped whenever a localStorage key or payload shape changes; drives the
// one-shot migration in src/utils/storageMigration.ts.
export const STORAGE_VERSION_KEY = 'craftbase_storage_version'
export const STORAGE_VERSION = 2

export const DRAFT_STORAGE_KEY = 'craftbase_local_draft'
export const DRAFT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000
export const BACKGROUND_BASE_STORAGE_KEY = 'craftbase_background_base_id'
export const STORAGE_QUOTA_ERROR_NAME = 'QuotaExceededError'

// First-visit welcome sketch: once dismissed (user added their first element),
// never seed again for this browser profile.
export const WELCOME_DISMISSED_KEY = 'craftbase_welcome_dismissed'

// One-shot tip pointing at the "Zoom resistant" switch, shown under the primary
// toolbar the first time a user zooms a map base that has text on it. Same
// convention as WELCOME_DISMISSED_KEY: set once, never shown again.
export const GEO_TEXT_ZOOM_HINT_DISMISSED_KEY =
    'craftbase_geo_text_zoom_hint_dismissed'

// Stable identity for the local (unsaved) base at `/`.
//
// `localBaseId` normally comes from the local draft, which keys the viewport and
// base-type sidecars. But a draft only exists once the user has DRAWN something
// — so someone who lands on `/`, switches to the map base and picks a starting
// city has nothing to carry that id across a refresh, and would be asked the
// same question again on every reload.
//
// This key is claimed lazily: nothing writes it just for visiting `/`. It is
// written the first time an answer worth remembering is stored against the
// local base (see `rememberLocalBaseId` in base.tsx), which keeps an untouched
// visit byte-identical in localStorage, exactly like the base-type sidecar.
export const LOCAL_BASE_ID_KEY = 'craftbase_local_base_id'

// Feature-flag preference: connectable arrows / shape edge ports. User-toggled
// in the Settings modal, persisted in localStorage, read live (see
// `src/utils/featureFlags.ts`). Defaults to enabled.
export const CONNECTORS_ENABLED_KEY = 'craftbase_connectors_enabled'

// Feature-flag preference: parchment dot-grid background. User-toggled in the
// Settings modal, persisted in localStorage, read live (see
// `src/utils/featureFlags.ts`). Defaults to disabled.
export const DOT_GRID_ENABLED_KEY = 'craftbase_dot_grid_enabled'

// Perf-testing flag: the O(N) per-frame scene scans that ride along with
// dragging — `reanchorArrowsForShape` (legacy move path), `shapeHasBoundArrows`
// (CSS fast-path eligibility) and the hover-detect endpoint scan. Disable to
// isolate their cost from the Two.js render/paint cost during stress tests.
// Read live (see `src/utils/featureFlags.ts`). Defaults to enabled.
export const DRAG_SCANS_ENABLED_KEY = 'craftbase_drag_scans_enabled'

// Feature-flag preference: viewport culling. Hides scene elements whose
// screen-space bounds fall outside the viewport so the SVG renderer skips
// painting them — the lever against the pan/zoom paint cost on dense bases.
// Read live (see `src/utils/featureFlags.ts`). Defaults to disabled.
export const VIEWPORT_CULLING_ENABLED_KEY = 'craftbase_viewport_culling_enabled'

// Canvas rendering constants
export const HOVER_THRESHOLD = 15
export const HOVER_COLOR = 'rgba(196, 144, 26, 0.7)'
export const SELECTION_PREVIEW_STROKE = '#505F79'
export const DEFAULT_PREVIEW_OPACITY = 0.6
export const LINE_HEIGHT_MULTIPLIER = 1.6
export const PENCIL_DISTANCE_THROTTLE = 3
export const DEFAULT_TEXT_SIZE = 36
