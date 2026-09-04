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
// This is the eraser's visual identity: the trail drawn on the board uses the
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

// Standalone text element types: 'newText' (whiteboard) and 'geoText' (the
// zoom-resistant map variant). They render identically and share every text
// code path (properties toolbar, group apply, history revert, clipboard) — the
// only difference is geoText's per-frame counter-scale. Use this everywhere a
// "is this standalone text?" decision is made so both stay in lockstep.
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
// out (0 = fully fixed on screen, 1 = scales with the world).
export const DEFAULT_GEO_RESIST = 0.9
export const DEFAULT_GEO_RING_RADIUS = 22

// Default "pin" icon embedded inside a point. Consumers can override per-point
// via metadata.svgIcon. currentColor lets the point recolor it to its stroke.
export const DEFAULT_PIN_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="currentColor"/></svg>'

// Point categories. A point's `metadata.category` drives its look: a filled
// rounded-square pin in `bg`, a white (or dark, for ghost) icon, and a hard
// offset shadow — see PointFactory.buildPointVisual. Icon colors are baked into
// each svgIcon so the factory interprets them as-is (no recolor). Built into
// craftbase behind `geoObjectsEnabled` (mirroring GEO_TYPE_DEFAULTS); a consumer
// can override the catalog via the `pointCategories` Board prop.
//
// IMPORTANT: svgIcon path data must avoid SVG arc commands (`a`/`A`). Two.js's
// `interpret()` (used to render the pin on the board) parses numbers with a
// generic regex that can't split packed arc flags (e.g. `a6 6 0 0012 0` reads
// `0012` as one number), producing NaN vertices and a blank icon. The browser
// renders arcs fine — so the toolbar chip looks right while the board pin is
// empty. Stick to M/L/C/Q/Z paths plus <line>/<circle>/<rect>/<polygon>.
export interface PointCategory {
    id: string
    label: string
    /** Pin background (the category color). */
    bg: string
    /** Icon tint baked into svgIcon — for the legend/picker chip. */
    icon: string
    /** Optional outline — only the light "ghost" pin uses it. */
    border?: string
    /** 24x24-viewBox icon with colors already baked in. */
    svgIcon: string
}

export const POINT_CATEGORIES: Record<string, PointCategory> = {
    generic: {
        id: 'generic',
        label: 'Generic',
        bg: '#6B6560',
        icon: '#FFFFFF',
        svgIcon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="10" r="3.5" fill="#FFFFFF"/><path d="M12 4C8.69 4 6 6.69 6 10c0 5 6 10 6 10s6-5 6-10c0-3.31-2.69-6-6-6z" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    },
    fire: {
        id: 'fire',
        label: 'Fire',
        bg: '#E8621A',
        icon: '#FFFFFF',
        svgIcon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3C10 7 7.5 9 7.5 13.5C7.5 17 9.5 19.5 12 19.5C14.5 19.5 16.5 17 16.5 13.5C16.5 9 14 7 12 3Z" fill="#FFFFFF"/><path d="M12 11C11 12.2 10.4 13.2 10.4 14.3C10.4 15.6 11.1 16.4 12 16.4C12.9 16.4 13.6 15.6 13.6 14.3C13.6 13.2 13 12.2 12 11Z" fill="#E8621A"/></svg>',
    },
    water: {
        id: 'water',
        label: 'Water',
        bg: '#2A8BC8',
        icon: '#FFFFFF',
        svgIcon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3C10 7 7 11 7 15C7 17.8 9.2 20 12 20C14.8 20 17 17.8 17 15C17 11 14 7 12 3Z" fill="#FFFFFF"/></svg>',
    },
    nature: {
        id: 'nature',
        label: 'Nature',
        bg: '#4A9A5A',
        icon: '#FFFFFF',
        svgIcon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3L8.5 8.5L10.5 8.5L7 12.5L9.5 12.5L6 16.5L18 16.5L14.5 12.5L17 12.5L13.5 8.5L15.5 8.5Z" fill="#FFFFFF"/><line x1="12" y1="16" x2="12" y2="20.5" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/></svg>',
    },
    alert: {
        id: 'alert',
        label: 'Alert',
        bg: '#D03030',
        icon: '#FFFFFF',
        svgIcon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 5L3 19h18L12 5z" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/><line x1="12" y1="10" x2="12" y2="14" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#FFFFFF"/></svg>',
    },
    infra: {
        id: 'infra',
        label: 'Infra',
        bg: '#1A1612',
        icon: '#FFFFFF',
        svgIcon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><line x1="12" y1="4" x2="6" y2="20" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="4" x2="18" y2="20" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="11" x2="16" y2="11" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/><line x1="7" y1="15.5" x2="17" y2="15.5" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/><line x1="12" y1="2" x2="12" y2="5" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="5.5" x2="15" y2="5.5" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/></svg>',
    },
    ghost: {
        id: 'ghost',
        label: 'Ghost',
        bg: '#FFFCF5',
        icon: '#1A1612',
        border: '#C4B89A',
        svgIcon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="#1A1612"/><circle cx="12" cy="12" r="6" fill="none" stroke="#C4901A" stroke-width="1.5"/></svg>',
    },
}

export const DEFAULT_POINT_CATEGORY = 'generic'

// The catalog svgs carry only a viewBox (so Two.js can scale them freely). For
// HTML rendering (the category picker chip, the tooltip mini-pin) inject an
// explicit pixel size so they render at a known size regardless of CSS/purge.
export function sizedCategoryIcon(svg: string, px: number): string {
    return svg.replace('<svg ', `<svg width="${px}" height="${px}" `)
}

// Per-type initial defaults for new geo objects (distinct, map-appropriate
// colors from the prototypes). Users recolor afterward via the properties
// toolbar. Kept client-side so geo creation doesn't depend on a DB round-trip.
export const GEO_TYPE_DEFAULTS: Record<
    GeoObjectType,
    { stroke: string; linewidth: number }
> = {
    point: { stroke: '#C4501A', linewidth: 3 },
    area: { stroke: '#A32D2D', linewidth: 2 },
    route: { stroke: '#3B82F6', linewidth: 3 },
}

// Minimum vertices required to finish a multi-click draw. Shared by the geo
// area/route tools and the generic curved line (which reuses the same machinery).
export const GEO_MIN_VERTICES: Record<
    'area' | 'route' | 'curvedLine',
    number
> = {
    area: 3,
    route: 2,
    curvedLine: 2,
}

// Default ink for strokes. Pure black so it flips cleanly to white on a theme
// toggle (see themeColorFlip): #000 in light, #fff in dark.
export const PENCIL_DEFAULT_COLOR = '#000'
export const SHAPE_DEFAULT_STROKE = '#000'

// Draft persistence
export const DRAFT_STORAGE_KEY = 'craftbase_local_draft'
export const DRAFT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000
export const BACKGROUND_BOARD_STORAGE_KEY = 'craftbase_background_board_id'
export const STORAGE_QUOTA_ERROR_NAME = 'QuotaExceededError'

// First-visit welcome sketch: once dismissed (user added their first element),
// never seed again for this browser profile.
export const WELCOME_DISMISSED_KEY = 'craftbase_welcome_dismissed'

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
// painting them — the lever against the pan/zoom paint cost on dense boards.
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
