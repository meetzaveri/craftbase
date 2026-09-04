import {
    CONNECTORS_ENABLED_KEY,
    DOT_GRID_ENABLED_KEY,
    DRAG_SCANS_ENABLED_KEY,
    VIEWPORT_CULLING_ENABLED_KEY,
} from '../constants/misc'

// Live, user-toggleable feature flags backed by localStorage.
//
// Unlike build-time `BoardProps` flags (e.g. `geoObjectsEnabled`), these are
// edited at runtime from the Settings modal and must take effect on the
// already-running app. The value is cached in a module-level variable so the
// hot Two.js paths (selection-box render, hover hit-test, arrow radar — all
// living inside `addZUI`'s stale-closure DOM handlers) can read it cheaply and
// live via `getConnectorsEnabled()` without re-binding listeners or hitting
// localStorage every frame. React UI subscribes via `useConnectorsEnabled`.

// Opt-in feature: default OFF. Users enable connectors from the Settings modal.
const DEFAULT_CONNECTORS_ENABLED = false

type Listener = (enabled: boolean) => void

let cached: boolean | null = null
const listeners = new Set<Listener>()

export function getConnectorsEnabled(): boolean {
    if (cached === null) {
        const stored = localStorage.getItem(CONNECTORS_ENABLED_KEY)
        cached =
            stored === null ? DEFAULT_CONNECTORS_ENABLED : stored === 'true'
    }
    return cached
}

export function setConnectorsEnabled(enabled: boolean): void {
    cached = enabled
    try {
        localStorage.setItem(CONNECTORS_ENABLED_KEY, String(enabled))
    } catch {
        // Persistence is best-effort; an in-memory toggle still works for the
        // current session even if storage is full/blocked.
    }
    listeners.forEach((fn) => fn(enabled))
}

// Subscribe to live changes. Returns an unsubscribe fn.
export function subscribeConnectorsEnabled(fn: Listener): () => void {
    listeners.add(fn)
    return (): void => {
        listeners.delete(fn)
    }
}

// ── Dot-grid background flag ──────────────────────────────────────────────
// Same runtime/localStorage model as connectors above, with its own cache and
// listener set. Gates the parchment dot-grid background: when off the canvas
// keeps the solid parchment color but shows no dots, and
// `syncBackgroundToCamera` early-returns. React UI subscribes via
// `useDotGridEnabled`; the hot Two.js paths read `getDotGridEnabled()`.

// Opt-in feature: default OFF. Users enable the dot grid from the Settings modal.
const DEFAULT_DOT_GRID_ENABLED = false

let dotGridCached: boolean | null = null
const dotGridListeners = new Set<Listener>()

export function getDotGridEnabled(): boolean {
    if (dotGridCached === null) {
        const stored = localStorage.getItem(DOT_GRID_ENABLED_KEY)
        dotGridCached =
            stored === null ? DEFAULT_DOT_GRID_ENABLED : stored === 'true'
    }
    return dotGridCached
}

export function setDotGridEnabled(enabled: boolean): void {
    dotGridCached = enabled
    try {
        localStorage.setItem(DOT_GRID_ENABLED_KEY, String(enabled))
    } catch {
        // Persistence is best-effort; an in-memory toggle still works for the
        // current session even if storage is full/blocked.
    }
    dotGridListeners.forEach((fn) => fn(enabled))
}

// Subscribe to live changes. Returns an unsubscribe fn.
export function subscribeDotGridEnabled(fn: Listener): () => void {
    dotGridListeners.add(fn)
    return (): void => {
        dotGridListeners.delete(fn)
    }
}

// ── Drag-scan flag (perf testing) ─────────────────────────────────────────
// Same runtime/localStorage model. Gates the O(N) scene scans that ride along
// with dragging: `reanchorArrowsForShape` (per-frame, legacy move path),
// `shapeHasBoundArrows` (once per drag, CSS fast-path eligibility) and the
// hover-detect endpoint scan (per rAF). Turn OFF to measure drag/paint cost
// with the scans removed on dense boards. Connector gluing and endpoint hover
// stop working while off — this is a measurement lever, not a user feature.

// Default ON: normal behavior. Disable only for perf isolation runs.
const DEFAULT_DRAG_SCANS_ENABLED = true

let dragScansCached: boolean | null = null
const dragScansListeners = new Set<Listener>()

export function getDragScansEnabled(): boolean {
    if (dragScansCached === null) {
        const stored = localStorage.getItem(DRAG_SCANS_ENABLED_KEY)
        dragScansCached =
            stored === null ? DEFAULT_DRAG_SCANS_ENABLED : stored === 'true'
    }
    return dragScansCached
}

export function setDragScansEnabled(enabled: boolean): void {
    dragScansCached = enabled
    try {
        localStorage.setItem(DRAG_SCANS_ENABLED_KEY, String(enabled))
    } catch {
        // Persistence is best-effort; an in-memory toggle still works for the
        // current session even if storage is full/blocked.
    }
    dragScansListeners.forEach((fn) => fn(enabled))
}

// Subscribe to live changes. Returns an unsubscribe fn.
export function subscribeDragScansEnabled(fn: Listener): () => void {
    dragScansListeners.add(fn)
    return (): void => {
        dragScansListeners.delete(fn)
    }
}

// ── Viewport culling flag ─────────────────────────────────────────────────
// Same runtime/localStorage model. Gates the paint-cost optimisation that hides
// off-screen scene elements during pan/zoom (see `src/utils/viewportCulling.ts`).
// The hot camera handlers read `getViewportCullingEnabled()` cheaply per frame.

// Opt-in feature: default OFF while it's validated on real boards.
const DEFAULT_VIEWPORT_CULLING_ENABLED = true

let cullingCached: boolean | null = null
const cullingListeners = new Set<Listener>()

export function getViewportCullingEnabled(): boolean {
    if (cullingCached === null) {
        const stored = localStorage.getItem(VIEWPORT_CULLING_ENABLED_KEY)
        cullingCached =
            stored === null
                ? DEFAULT_VIEWPORT_CULLING_ENABLED
                : stored === 'true'
    }
    return cullingCached
}

export function setViewportCullingEnabled(enabled: boolean): void {
    cullingCached = enabled
    try {
        localStorage.setItem(VIEWPORT_CULLING_ENABLED_KEY, String(enabled))
    } catch {
        // Persistence is best-effort; an in-memory toggle still works for the
        // current session even if storage is full/blocked.
    }
    cullingListeners.forEach((fn) => fn(enabled))
}

// Subscribe to live changes. Returns an unsubscribe fn.
export function subscribeViewportCullingEnabled(fn: Listener): () => void {
    cullingListeners.add(fn)
    return (): void => {
        cullingListeners.delete(fn)
    }
}
