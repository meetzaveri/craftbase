// newCanvas: 2600+ lines of Two.js + ZUI canvas logic with multiple internal
// state machines (pencil velocity tracking, scenario dispatch, drag/draw/
// arrow/text/group selectors). The stale-closure pattern from CLAUDE.md is
// pervasive — many handlers close over refs that are reassigned post-mount.
//
// Two.js scene shapes carry codebase-specific bookkeeping (.elementData,
// ._renderer, .lineData, .siblingCircle, .direction, …) that's set ad-hoc
// across factories, element components, and this file. Per migration
// convention, those access sites use `any` casts; component props, hook
// params, and event handler signatures get real types.
import React, {
    useEffect,
    useState,
    useRef,
    useCallback,
    Suspense,
    type MutableRefObject,
    type ReactNode,
} from 'react'
import Two from 'two.js'

import { ZUI } from 'two.js/extras/jsm/zui'
import { useBaseContext } from './views/Base/baseContext'
import { useMediaQueryUtils } from './constants/exportHooks'
import { BASE_ROOT_ID } from './hooks/useActiveBaseType'
import { readViewport, writeViewport } from './utils/viewportStorage'
import type { StoredViewport } from './utils/viewportStorage'
import { isUrlBasePath } from './utils/baseRoutes'
import type { BaseType, MapAnchor } from './baseTypes/types'

import {
    GROUP_COMPONENT,
    componentTypes,
    RUBBER_MODE_KEY,
    VIEWPORT_KEY_PREFIX,
    MOBILE_VIEWPORT_KEY_PREFIX,
    VIEWPORT_TTL_MS,
    ARROW_DRAW_MODE_KEY,
    TEXT_DRAW_MODE_KEY,
    PENDING_SHAPE_TYPE_KEY,
    PENDING_SHAPE_PROPS_KEY,
    LAST_ADDED_ELEMENT_ID_KEY,
    PENCIL_MODE_KEY,
    PENCIL_DEFAULT_COLOR,
    SHAPE_DEFAULT_STROKE,
    HOVER_THRESHOLD,
    HOVER_COLOR,
    SELECTION_PREVIEW_STROKE,
    DEFAULT_PREVIEW_OPACITY,
    LINE_HEIGHT_MULTIPLIER,
    PENCIL_DISTANCE_THROTTLE,
    DEFAULT_TEXT_SIZE,
    GEO_DRAW_MODE_KEY,
    GEO_DRAW_TYPE_KEY,
    GEO_DRAW_PROPS_KEY,
    GEO_POINT_PLACE_MODE_KEY,
    SELECT_COMPONENT_EVENT,
    GEO_MIN_VERTICES,
    DEFAULT_GEO_RESIST,
    GEO_PREVIEW_DOT_PX,
    GEO_PREVIEW_MIN_STROKE_PX,
    GEO_PREVIEW_SEGMENT_OPACITY,
    GEO_PREVIEW_RUBBER_OPACITY,
    DEFAULT_TEXT_FONT_FAMILY,
    ERASER_SIZE_KEY,
    ERASER_SIZE_RADIUS,
    ERASER_DOT_PX,
    DEFAULT_ERASER_SIZE,
    type EraserSize,
} from './constants/misc'
import { createEraserTrail } from './utils/eraserTrail'
import Spinner from './components/common/spinner'

// Shared lazy-element glob (single source of truth) so the chunk warmed by
// prefetchElementModule is the exact one React.lazy mounts here.
import { elementModules } from './elementModules'

import Loader from './components/utils/loader'
import SelectionController, {
    buildToolbarState,
    PORT_GAP,
    PORT_RADAR_RADIUS,
    SELECTION_PADDING,
} from './canvas/selectionController'
import { updateX1Y1Vertices, updateX2Y2Vertices } from './utils/updateVertices'
import {
    getShapePortPoint,
    findNearestPort,
    getStackedPortPoint,
    PORT_TAIL_STACK_GAP,
} from './utils/shapePorts'
import { generateUUID } from './utils/misc'
import {
    hasAbsoluteVertexMetadata,
    shiftVertexMetadata,
} from './utils/vertexMetadata'
import {
    getConnectorsEnabled,
    subscribeConnectorsEnabled,
    getDotGridEnabled,
    subscribeDotGridEnabled,
    getDragScansEnabled,
    getViewportCullingEnabled,
} from './utils/featureFlags'
import {
    cullToViewport,
    uncullViewport,
    CULLED_FLAG,
} from './utils/viewportCulling'
import {
    createDrawPreview,
    updateDrawPreview,
    removeDrawPreview,
    type DrawPreviewKind,
} from './utils/drawPreviewOverlay'
import {
    velocityToLinewidth,
    smoothLinewidth,
    simplifyWithLinewidth,
    chaikinSmooth,
} from './utils/pencilHelper'
import {
    setArrowEndpointsVisible,
    pollUntilElement,
    cloneElementData,
    resolveShapeFromPath,
    findShapeTextLayer,
    getShapeTextNodes,
    applyShapeText,
    shapeTextStyleFromMeta,
    getGroupFill,
} from './utils/canvasUtils'
import { growShapeToFitText, usableTextWidth } from './utils/shapeTextFit'
import {
    flipThemeColor,
    themeDefaultInk,
    isFillableShapeType,
    isStrokeFlippableType,
    paintShapeFill,
    paintElementStroke,
} from './utils/themeColorFlip'
import { isSelectPanMode, isPanMode } from './utils/drawModeUtils'
import { scheduleRender } from './utils/renderScheduler'
import { installRenderOrigin } from './canvas/renderOrigin'
import { isRecordVisibleOnBaseType } from './utils/geoVisibility'
import { SELECTION_CHROME_ATTR } from './utils/svgExportShared'
import { computeCounterScale } from './utils/counterScale'
import { zoomLimitsForBaseType } from './baseTypes/zoomLimits'
import { lngLatToSurface, scaleForMapZoom } from './baseTypes/mercator'
import { useCanvasClipboard } from './hooks/useCanvasClipboard'
import type { HistoryEntry } from './hooks/useComponentHistory'
import { exportSelectionAsSvg } from './utils/exportSelectionAsSvg'
import CanvasContextMenu from './components/canvasContextMenu'
import PerfOverlay from './components/dev/PerfOverlay'
import {
    ElementRenderWrapper,
    GroupRenderWrapper,
} from './components/utils/elementRenderWrappers'
import type {
    CameraChangeEvent,
    ComponentRecord,
    ComponentStore,
    SelectedComponent,
    CurrentElement,
} from './types/base'

/**
 * One lazy component per element *type*, not per element.
 *
 * `React.lazy()` returns a NEW component type on every call, and each one
 * suspends and resolves independently — so calling it per element made a base
 * of N elements resolve N Suspense boundaries in N separate commits, spreading
 * the mount across hundreds of frames. Every one of those frames triggered a
 * full O(scene) Two.js render (the SVG renderer walks every child on each
 * update), which is O(frames × N) work.
 *
 * Keyed by componentType, the ~10 element modules resolve once and React can
 * commit the elements in far fewer passes.
 */
const lazyElementCache = new Map<string, React.ComponentType<unknown>>()

const getLazyElement = (
    componentType: string,
    moduleLoader: () => Promise<{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        default: React.ComponentType<any>
    }>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): React.ComponentType<any> => {
    const cached = lazyElementCache.get(componentType)
    if (cached) return cached
    const lazy = React.lazy(moduleLoader)
    lazyElementCache.set(componentType, lazy as React.ComponentType<unknown>)
    return lazy
}

// A plain `line` shares the arrow's group structure (line + two endpoint
// circles) and the entire arrow-draw / endpoint-edit machinery, so anywhere we
// manage endpoint-handle visibility or read vertex coords for selection &
// copy/paste, both types apply. Port/connector logic stays arrowLine-only
// (plain lines never dock to shapes), so those guards keep their literal
// 'arrowLine' check.
const isLineLikeType = (t?: string | null): boolean =>
    t === 'arrowLine' || t === 'line'

interface CanvasProps {
    pointerToggle: boolean
    isPencilMode: boolean
    selectPanMode: boolean
    baseId: string
    selectedComponent: SelectedComponent | null
    lastAddedElement: ComponentRecord | null
    componentStore: ComponentStore
    defaultLinewidth: number
    defaultStrokeType: string | null
    defaultStrokeColor: string
    defaultTextSize: number
    onCameraChange?: (event: CameraChangeEvent) => void
    renderBackground?: () => ReactNode
    // Bridge: Canvas owns reorderSelected (needs reconcileZOrder + live zui
    // selection); it publishes the function here so base.tsx can expose a
    // stable wrapper through BaseContext for the properties toolbar.
    reorderSelectedRef?: MutableRefObject<
        ((op: 'front' | 'forward' | 'backward' | 'back') => void) | null
    >
    // Bridge: Canvas owns fitToContent (lives on the live zui handle); it
    // publishes it here so base.tsx can expose a stable wrapper through
    // BaseContext for the "Go to content" button. Returns whether a fit ran.
    fitToContentRef?: MutableRefObject<(() => boolean) | null>
    /**
     * Where a shared map base should open, for a recipient who has never
     * opened it. The georeference (`anchor`) plus the view to land on, both
     * from the base row.
     *
     * Non-null only when the row carries all six geo columns — anchor and
     * landing are written together, so a partial set means a hand-edited row
     * and is ignored rather than half-applied.
     */
    initialMapLanding?: {
        anchor: MapAnchor
        lngLat: [number, number]
        zoom: number
    } | null
}

// Shape of the handle addZUI returns and Canvas stores in state. The
// remaining fields are accessed via `as any` at call sites (see resetDragState
// usage etc.) where Two.js internals leak through.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZuiHandle = any

// Local callback signatures (defined inside Canvas, consumed by addZUI).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpdateToGlobalStateFn = (newShapeData: any, oldShapeData: any) => void
type UpdateComponentVerticesFn = (id: string, x: number, y: number) => void
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetOnGroupHandlerFn = (obj: any) => void

/**
 * @typedef {Object} elementData
 * @property {string} baseId
 * @property {string} componentType
 * @property {string} fill
 * @property {Object} handleDeleteComponent //function
 * @property {number} height
 * @property {number} id // component's id
 * @property {boolean} isDummy
 * @property {boolean} isGroupSelector
 * @property {Object} itemData // the data which we recieve from database
 * @property {Object} metadata
 * @property {number} prevY // the value of prev Y coordinate used to diff
 * @property {number} prevX // the value of prev X coordinate used to diff
 * @property {string} textColor
 * @property {Object} twoJSInstance // the main Two.js instance
 * @property {number} width
 * @property {number} x
 * @property {number} y
 */

let isDrawing: boolean = false
// True only while a pencil stroke is mid-flight (mousedown → mouseup). An
// in-progress stroke isn't committed to the history log until mouseup, so
// undo/redo must be blocked during this window — otherwise Ctrl+Z would pop the
// previously committed element and the redo stack gets clobbered when the
// current stroke commits, losing that earlier element for good.
let isPencilStrokeActive: boolean = false
// Length (surface units) of the segment a click-without-drag becomes, so the
// pencil's round caps paint it as a dot. See the dot branch in the pencil
// mouseup handler.
const PENCIL_DOT_SEGMENT = 0.5
let defaultLinewidthValue: number = 1
let defaultStrokeTypeValue: string | null = null
let defaultStrokeColorValue: string = PENCIL_DEFAULT_COLOR
// Live default text size (px) for shape-with-text. Module-level + synced via
// useEffect so the once-bound addZUI DOM handlers read the latest value
// (same stale-closure escape hatch as defaultLinewidthValue).
let defaultTextSizeValue: number = DEFAULT_TEXT_SIZE

// --- z-order reconcile helpers ------------------------------------------
//
// The persistable element groups inside `two.scene.children` are the ones we
// reorder. Everything else (selection-box overlay, preview dots/lines, the
// transient `groupobject` group) must be left untouched. An element group is
// identified by carrying `elementData.id` that maps to a live store record and
// is not the transient GROUP_COMPONENT. The selection overlay is a plain group
// with no `elementData`, so it's excluded automatically.
const isReorderableElementChild = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    child: any,
    store: ComponentStore
): boolean => {
    const id = child?.elementData?.id
    if (!id) return false
    if (child.elementData.componentType === GROUP_COMPONENT) return false
    return Object.prototype.hasOwnProperty.call(store, id)
}

// Stable ordering key for a record: position asc (back→front), tie-broken by
// createdAt then id so legacy/duplicate positions still sort deterministically
// (and neighbour-swap stays meaningful). Used by both the reconcile comparator
// and the reorder handlers so they agree on "the element above/below".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const compareByZOrder = (a: any, b: any): number => {
    const pa = Number.isFinite(a?.position) ? a.position : 0
    const pb = Number.isFinite(b?.position) ? b.position : 0
    if (pa !== pb) return pa - pb
    const ca = Number.isFinite(a?.createdAt) ? a.createdAt : 0
    const cb = Number.isFinite(b?.createdAt) ? b.createdAt : 0
    if (ca !== cb) return ca - cb
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''))
}

function addZUI(
    props: CanvasProps,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    two: any,
    updateToGlobalState: UpdateToGlobalStateFn,
    updateComponentVertices: UpdateComponentVerticesFn,
    setOnGroupHandler: SetOnGroupHandlerFn,
    addToLocalComponentStore: (
        id: string,
        type: string,
        componentInfo: ComponentRecord,
        skipHistory?: boolean
    ) => void,
    setSelectedComponentInBase: (component: SelectedComponent | null) => void,
    setArrowDrawModeOff: () => void,
    setTextDrawModeOff: () => void,
    setPointerElement: (
        element: CurrentElement | null,
        options?: { select?: boolean }
    ) => void,
    updateComponentBulkPropertiesInLocalStore: (
        id: string,
        update: Partial<ComponentRecord>,
        skipDbWrite?: boolean
    ) => void,
    deleteComponentFromLocalStore: (id: string) => void,
    isPencilModeRef: MutableRefObject<boolean>,
    createTextAtSurfaceRef: MutableRefObject<
        ((x: number, y: number) => void) | null
    >,
    onCameraChangeRef: MutableRefObject<
        ((event: CameraChangeEvent) => void) | undefined
    >,
    // Live active base. addZUI runs once on mount, so the base a viewport is
    // saved under must be read through a ref — a captured value would keep
    // writing the camera to whichever type the base loaded with.
    activeBaseTypeRef: MutableRefObject<BaseType>
): ZuiHandle {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let shape: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastSelectedShape: any = null
    // Tracks the GroupedObjectWrapper's Two.js group while it has DOM focus.
    // Set/cleared by groupFocused/groupBlurred custom events.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeGroupRef: { current: any } = { current: null }
    const domElement: HTMLElement = two.renderer.domElement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zui: any = new ZUI(two.scene, domElement)
    const mouse = new Two.Vector()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let touches: Record<string, any> = {}
    let distance = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastTouch: any = null
    let touchStartX = 0
    let touchStartY = 0
    let twoFingerMidX = 0
    let twoFingerMidY = 0
    let lastTapTime = 0
    let lastTapX = 0
    let lastTapY = 0
    // Wheel has no gesture-end event, so "is the user still zooming/scrolling"
    // is tracked with a trailing timer. Used to suppress the hover hit-test
    // mid-gesture, where its result is thrown away anyway.
    let isWheeling = false
    let wheelSettleTimer: number | null = null
    // rAF gate for hoverDetectMove: pointers fire faster than we paint, and the
    // hover scan is O(scene). At most one scan per frame.
    let hoverFrame: number | null = null
    let hoverPendingEvent: MouseEvent | null = null
    // Viewport culling settle timer: cull runs on every camera change; once the
    // gesture stops, unhide everything so the at-rest canvas is fully painted.
    let cullSettleTimer: number | null = null

    // Called from every camera handler (pan/zoom, mouse + touch) right before
    // the batched render. Hides off-screen elements so the browser paints only
    // the visible slice, then arms a timer to reveal them all once motion stops.
    // A no-op (beyond the flag read) when culling is disabled.
    function cullOnCameraChange(): void {
        if (!getViewportCullingEnabled()) return
        cullToViewport(two)
        if (cullSettleTimer !== null) window.clearTimeout(cullSettleTimer)
        cullSettleTimer = window.setTimeout(() => {
            cullSettleTimer = null
            uncullViewport(two)
            scheduleRender(two)
        }, 200)
    }
    // Single-finger pan-mode state: when the toolbar pan button is active,
    // a one-finger touchstart begins panning the surface (instead of routing
    // to a synthetic mousedown). Cleared on touchend.
    let isSinglePanning = false
    let panLastX = 0
    let panLastY = 0
    // Desktop pan-mode: grab-and-drag with the mouse translates the surface
    // (mirrors the single-finger touch pan above). Set on mousedown while pan
    // mode is active, cleared on mouseup.
    let isMousePanning = false
    let mousePanLastX = 0
    let mousePanLastY = 0
    let dragging = false
    let isResizeEvent = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentPath: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastAddedPath: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paths: any[] = []

    // Velocity-based pencil state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pencilGroup: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pencilPath: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pencilRawPoints: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastPencilPoint: any = null
    let lastPencilTime = 0
    let lastPencilLinewidth: number | null = null

    let viewportSaveTimer: ReturnType<typeof setTimeout> | null = null
    let scenario: string | null = null
    const SCENARIO_JUST_ADDED_ELEMENT = 'justAddedElement'
    const SCENARIO_PENCIL_MODE = 'pencilMode'
    const SCENARIO_ARROW_DRAW = 'arrowDraw'
    const SCENARIO_DRAW_SHAPE = 'drawShape'
    const SCENARIO_TEXT_DRAW = 'textDraw'
    const SCENARIO_RUBBER_MODE = 'rubberMode'
    const SCENARIO_GEO_POINT = 'geoPoint'
    const SCENARIO_GEO_DRAW = 'geoDraw'
    const SCENARIO_DEFAULT = null

    const pendingDeletionSet = new Set<string>()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let arrowDrawElement: any = null
    // Source shape of a port-pulled connector, so the radar excludes its own
    // ports (a connector can't dock back onto the shape it departed). Null for
    // free arrows drawn from the toolbar.
    let arrowDrawTailShapeId: string | null = null
    // Stacking state for a port-pulled connector: the source port anchor, its
    // edge, and this connector's slot among the arrows already leaving that port
    // (0 = first, no fan). The tail is re-fanned every mousemove so its offset
    // direction tracks whichever quadrant the head is dragged into.
    let arrowDrawTailPort: {
        anchor: { x: number; y: number }
        edge: string
        index: number
    } | null = null
    // Phase-2 magnetic snap: while an arrow endpoint is being dragged and the
    // radar has it magnetically docked on a port, this holds the would-be
    // binding. It's recomputed every mousemove frame (null when not docked) and
    // committed on release — so if the user pulls away before letting go, no
    // connection is made.
    let pendingPortConnection: {
        arrowId: string
        endpoint: 'head' | 'tail'
        edge: string
        shapeId: string
    } | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let textDrawElement: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let drawOrigin: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let drawCurrentCoords: any = null
    // The shape-creation preview is a DOM overlay (see drawPreviewOverlay), not
    // a Two.js scene child — so growing it never repaints the scene SVG. These
    // hold the drag's start corner in *client* (screen) coords for the overlay.
    let drawPreviewActive = false
    let drawScreenOriginX = 0
    let drawScreenOriginY = 0
    // Fast move-drag: while dragging a non-rotated element (including the group
    // overlay, whose member copies + selector chrome share its node) we write
    // that element's own SVG `transform` attribute per frame instead of mutating
    // its Two.js position and calling a full-scene two.update(). The rest of the
    // scene SVG is never touched, so the drag stays smooth regardless of zoom or
    // element count. The real position is written once on mouseup, so all the
    // existing move/persist/history logic still runs. (The name is historical:
    // this wrote `style.transform` + `will-change` until that combination turned
    // out to make elements vanish mid-drag on mobile — see cssMoveTransform.)
    let cssMoveActive = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cssMoveEl: any = null
    let cssMoveNode: SVGGraphicsElement | null = null
    let cssMoveChrome: {
        node: SVGGraphicsElement
        baseX: number
        baseY: number
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shape: any
    } | null = null
    let cssMoveBaseX = 0
    let cssMoveBaseY = 0
    let cssMoveStartClientX = 0
    let cssMoveStartClientY = 0
    let cssMoveLastDxWorld = 0
    let cssMoveLastDyWorld = 0
    // Set once per drag when the shape is ineligible for the CSS fast-path (e.g.
    // it has bound connectors) so the whole drag stays on the legacy live path.
    let cssMoveRejected = false

    /**
     * The live transform for one frame of a move-drag.
     *
     * Written to the SVG `transform` ATTRIBUTE — the same attribute Two.js
     * renders — not to `style.transform`. Both work on desktop, and the CSS one
     * is what this fast path used to write, but a CSS transform on an SVG `<g>`
     * (with `will-change: transform` promoting it to its own layer) is exactly
     * the combination mobile browsers are unreliable about: the promoted layer
     * can come back unpainted, so the element vanishes for the length of the
     * drag and reappears on release, when Two.js re-renders the real matrix.
     * The attribute has no compositing story to get wrong.
     *
     * The value must carry any scale the element has, because it REPLACES what
     * Two.js rendered, matrix and all. The zoom-resistant geo elements (point
     * pins, geoText) keep their whole counter-scale there, so dropping it would
     * snap them to world size mid-drag. Emitting translate → scale reproduces
     * Two.js's own composition; rotation never reaches here (rotated elements
     * are ineligible for this path).
     */
    const cssMoveTransform = (
        x: number,
        y: number,
        // Two.js `scale` is a number when uniform, a Two.Vector when not.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scale?: any
    ): string => {
        const translate = `translate(${x}, ${y})`
        const sx = typeof scale === 'number' ? scale : (scale?.x ?? 1)
        const sy = typeof scale === 'number' ? scale : (scale?.y ?? 1)
        if (sx === 1 && sy === 1) return translate
        return `${translate} scale(${sx}, ${sy})`
    }

    /**
     * Drop the live transforms and the drag state. Called on commit (mouseup)
     * and defensively when a new gesture starts.
     *
     * Our per-frame writes went to the same attribute Two.js renders into, so
     * clearing means handing it back: flag the matrix dirty and the next
     * `two.update()` restores the authoritative one. Without the flag Two.js
     * would consider the node clean and leave our last frame standing.
     */
    const clearCssMove = (): void => {
        if (cssMoveNode) cssMoveNode.removeAttribute('transform')
        if (cssMoveEl) cssMoveEl._flagMatrix = true
        if (cssMoveChrome) {
            cssMoveChrome.node.removeAttribute('transform')
            if (cssMoveChrome.shape) cssMoveChrome.shape._flagMatrix = true
        }
        cssMoveActive = false
        cssMoveEl = null
        cssMoveNode = null
        cssMoveChrome = null
        cssMoveRejected = false
    }
    let drawShapeType: string | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let drawShapeProps: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastPlacedElement: any = null
    // Empty-canvas mousedown stores its origin here. The dotted group
    // selector is only materialised on the first mousemove, so a click
    // without drag never produces a stray rectangle (and dblclick on
    // empty canvas can spawn a text element cleanly).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pendingGroupSelectorOrigin: any = null

    // ── Geo multi-click draw state (area / route) ────────────────────────────
    // Vertices are surface coords; preview dots/lines live in two.scene so ZUI
    // transforms them like everything else. Built into a component on finish.
    let geoDrawType: 'area' | 'route' | 'curvedLine' | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geoDrawProps: any = null
    let geoVertices: { x: number; y: number }[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geoDots: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geoLines: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geoPreviewLine: any = null
    // For the curved line, a single curved Two.Path preview replaces the straight
    // segment+rubber-band so the in-transit shape matches the committed curve.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geoCurvedPreview: any = null

    const toSurface = (e: { clientX: number; clientY: number }) =>
        zui.clientToSurface(e.clientX, e.clientY)
    // Opening range. The active base overrides this through setZoomLimits —
    // the map needs a far wider one (see BaseTypeProvider.zoomLimits).
    zui.addLimits(0.06, 8)

    // Parchment dot-grid camera sync. The grid is a CSS radial-gradient painted
    // on the renderer's SVG element, which lives in screen space (Two.js
    // transforms the scene group inside it, never the SVG itself). To make the
    // grid feel glued to the canvas we mirror the camera onto the CSS background:
    // scale the tile by the zoom and offset it by the scene translation. CSS
    // tiling makes it an infinite grid for free, and the dots re-rasterize sharp
    // at every zoom. Base tile is 24px (kept in sync with App.css).
    const BG_TILE_BASE = 24
    // Keep the on-screen dot spacing inside a comfortable band by stepping the
    // tile through power-of-2 "octaves". A plain `BG_TILE_BASE * scale` shrinks
    // the tile as you zoom out, crowding the dots into a dense mush below ~50%
    // (and into a sparse field when zoomed far in). Doubling/halving the tile at
    // the band edges keeps apparent spacing roughly constant. MAX must be 2*MIN
    // so each octave wrap lands back inside the band.
    const BG_TILE_MIN = 16
    const BG_TILE_MAX = 32
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bgSvgEl: any = null
    const syncBackgroundToCamera = () => {
        // Dot grid is behind a feature flag (default off). When disabled the CSS
        // paints only the solid parchment color, so there's nothing to drive.
        if (!getDotGridEnabled()) return
        if (!bgSvgEl) {
            const root = document.getElementById('main-two-root')
            bgSvgEl = root?.querySelector('svg') || null
        }
        if (!bgSvgEl) return
        const scale = two.scene.scale || 1
        const tx = two.scene.translation.x
        const ty = two.scene.translation.y
        let size = BG_TILE_BASE * scale
        if (size > 0) {
            while (size < BG_TILE_MIN) size *= 2
            while (size > BG_TILE_MAX) size /= 2
        }
        bgSvgEl.style.backgroundSize = `${size}px ${size}px`
        bgSvgEl.style.backgroundPosition = `${tx}px ${ty}px`
    }

    // Toggle the `cb-dot-grid` class on the canvas root so the CSS dot-grid
    // rule paints only when the flag is on, then re-sync the live size/position.
    const syncDotGridClass = () => {
        const root = document.getElementById('main-two-root')
        if (root) root.classList.toggle('cb-dot-grid', getDotGridEnabled())
        syncBackgroundToCamera()
    }

    const setRootCursor = (cursor: string) => {
        const root = document.getElementById('main-two-root')
        if (root) root.style.cursor = cursor
    }

    /**
     * Stroke width the pencil PREVIEW must be painted at so the live stroke
     * looks exactly like the element it becomes.
     *
     * The committed record stores the LOGICAL width (`defaultLinewidthValue`),
     * and on a geographic base the mounted element counter-scales it — see
     * `isStrokeScaled` / pencil.tsx — so the painted path ends up carrying
     * `base / scale^resist`. The preview is a bare scene path with no component
     * behind it, so it has to apply that factor itself. Without this the stroke
     * draws thin and visibly thickens the instant the element mounts.
     *
     * The base test mirrors the `objectClass: 'geo'` stamp on the committed
     * record below — the two must agree, or the jump comes straight back.
     */
    const pencilPreviewLinewidth = (): number => {
        const base = defaultLinewidthValue
        if (activeBaseTypeRef.current === 'board') return base
        const scale = zui.scale || two.scene.scale || 1
        return base * computeCounterScale(scale, DEFAULT_GEO_RESIST)
    }

    // ── Multi-click draw helpers (area / route / curvedLine) ─────────────────
    // Preview artifacts live in two.scene, so the ZUI scales them along with the
    // world. Dividing the screen-pixel sizes by the live scale cancels that out
    // and pins the drawing aid to a constant on-screen size — the committed
    // route does the same thing via its stroke counter-scale (counterScale.ts),
    // so what you trace matches what you get.
    const geoPreviewStyle = () => {
        const scale = zui.scale || two.scene.scale || 1
        const lw = defaultLinewidthValue || geoDrawProps?.linewidth || 2
        return {
            stroke:
                defaultStrokeColorValue ||
                geoDrawProps?.stroke ||
                SHAPE_DEFAULT_STROKE,
            // Surface-space width that renders as `max(lw, floor)` screen px.
            lw: Math.max(lw, GEO_PREVIEW_MIN_STROKE_PX) / scale,
            dotRadius: GEO_PREVIEW_DOT_PX / scale,
        }
    }

    // Zooming mid-draw changes the scale the preview was sized against, so
    // re-derive every artifact's width/radius. Cheap: a draw in progress has a
    // handful of vertices.
    const refreshGeoPreviewScale = () => {
        if (!geoDrawType) return
        const { lw, dotRadius } = geoPreviewStyle()
        geoDots.forEach((dot) => {
            // Two.Circle exposes `radius`; assigning it reflows the anchors.
            dot.radius = dotRadius
        })
        geoLines.forEach((line) => {
            line.linewidth = lw
        })
        if (geoPreviewLine) geoPreviewLine.linewidth = lw
        if (geoCurvedPreview) geoCurvedPreview.linewidth = lw
        two.update()
    }
    window.addEventListener('zoomChanged', refreshGeoPreviewScale)

    // Rebuild the curved preview path so the in-transit line is smooth (matching
    // the committed shape) instead of straight segments. Runs through the placed
    // vertices plus an optional live cursor point. Recreated each call — the
    // preview has few points, so this is cheap.
    const rebuildCurvedPreview = (cursor?: { x: number; y: number }) => {
        if (geoCurvedPreview) {
            two.remove(geoCurvedPreview)
            geoCurvedPreview = null
        }
        const pts = cursor ? [...geoVertices, cursor] : [...geoVertices]
        if (pts.length < 2) return
        const { stroke, lw } = geoPreviewStyle()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anchors = pts.map((p) => new (Two as any).Anchor(p.x, p.y))
        // closed = false, curved = true — same as the committed curvedLine.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const path = new (Two as any).Path(anchors, false, true)
        path.noFill()
        path.stroke = stroke
        path.linewidth = lw
        path.cap = 'round'
        path.join = 'round'
        path.opacity = GEO_PREVIEW_SEGMENT_OPACITY
        two.add(path)
        geoCurvedPreview = path
    }

    const addGeoVertex = (x: number, y: number) => {
        geoVertices.push({ x, y })
        // Read the live element defaults (kept in sync via useEffect) so a
        // stroke/width change made in the panel mid-draw is reflected
        // immediately — same contract as pencil. Falls back to the props
        // stashed at tool-pick, then the global shape default.
        const { stroke, lw, dotRadius } = geoPreviewStyle()
        const dot = two.makeCircle(x, y, dotRadius)
        dot.fill = stroke
        dot.noStroke()
        geoDots.push(dot)
        if (geoDrawType === 'curvedLine') {
            // Curved preview through the placed vertices (no straight segments).
            rebuildCurvedPreview()
        } else if (geoVertices.length >= 2) {
            const prev = geoVertices[geoVertices.length - 2]!
            const line = two.makeLine(prev.x, prev.y, x, y)
            line.stroke = stroke
            line.linewidth = lw
            line.cap = 'round'
            line.opacity = GEO_PREVIEW_SEGMENT_OPACITY
            geoLines.push(line)
        }
        two.update()
    }

    const updateGeoPreview = (sx: number, sy: number) => {
        if (!geoDrawType || geoVertices.length === 0) return
        const { stroke, lw } = geoPreviewStyle()
        if (geoDrawType === 'curvedLine') {
            // Smooth rubber-band: the curve flows through all points + cursor.
            rebuildCurvedPreview({ x: sx, y: sy })
            two.update()
            return
        }
        const last = geoVertices[geoVertices.length - 1]!
        if (geoPreviewLine) {
            geoPreviewLine.vertices[0].set(last.x, last.y)
            geoPreviewLine.vertices[1].set(sx, sy)
        } else {
            geoPreviewLine = two.makeLine(last.x, last.y, sx, sy)
            geoPreviewLine.stroke = stroke
            geoPreviewLine.cap = 'round'
            geoPreviewLine.opacity = GEO_PREVIEW_RUBBER_OPACITY
        }
        // Re-applied every move, not just on creation: a zoom mid-draw changes
        // the scale this width was derived from.
        geoPreviewLine.linewidth = lw
        two.update()
    }

    const clearGeoPreviewArtifacts = () => {
        geoDots.forEach((d) => two.remove(d))
        geoLines.forEach((l) => two.remove(l))
        if (geoPreviewLine) two.remove(geoPreviewLine)
        if (geoCurvedPreview) two.remove(geoCurvedPreview)
        geoDots = []
        geoLines = []
        geoPreviewLine = null
        geoCurvedPreview = null
        two.update()
    }

    const resetGeoDrawState = () => {
        geoDrawType = null
        geoDrawProps = null
        geoVertices = []
        localStorage.removeItem(GEO_DRAW_MODE_KEY)
        localStorage.removeItem(GEO_DRAW_TYPE_KEY)
        localStorage.removeItem(GEO_DRAW_PROPS_KEY)
        domElement.removeEventListener('mousemove', mousemove, false)
    }

    // Hide the curved-line "press Esc/Enter to finish" nudge (no-op for geo).
    // Also signals React (base.tsx) to drop the mobile ✓/✗ draw controls — the
    // nudge and those controls share the exact curved-line draw lifecycle.
    const hideMultiClickHint = () => {
        const hint = document.getElementById('multi-click-draw-hint')
        if (hint) {
            hint.style.opacity = '0'
            hint.style.zIndex = '-1'
        }
        window.dispatchEvent(new CustomEvent('multiClickDrawEnd'))
    }

    const cancelGeoDraw = () => {
        clearGeoPreviewArtifacts()
        resetGeoDrawState()
        hideMultiClickHint()
        setRootCursor('auto')
    }

    // Finish a multi-click area/route. `dropLast` strips the duplicate vertex
    // that the second mousedown of a double-click adds. Below the minimum vertex
    // count, the draw is discarded.
    const finishGeoDraw = ({
        dropLast = false,
    }: { dropLast?: boolean } = {}) => {
        if (!geoDrawType) return
        let verts = geoVertices.slice()
        if (dropLast && verts.length > 0) verts = verts.slice(0, -1)

        if (verts.length < GEO_MIN_VERTICES[geoDrawType]) {
            cancelGeoDraw()
            setPointerElement('pointer', { select: true })
            return
        }

        const type = geoDrawType
        // curvedLine is a generic whiteboard shape, not a geo object — it reuses
        // this multi-click machinery but carries no geo object-class.
        const isGeo = type !== 'curvedLine'
        const originX = Math.floor(verts[0]!.x)
        const originY = Math.floor(verts[0]!.y)
        const finalId = generateUUID()
        const finalShapeData = {
            ...(geoDrawProps || {}),
            id: finalId,
            componentType: type,
            ...(isGeo ? { objectClass: 'geo' } : {}),
            // Stroke/width/type come from the live element defaults so geo
            // draws honor edits made in the panel (just like pencil/shapes),
            // sharing the one default set across shapes/pencil/geo.
            stroke:
                defaultStrokeColorValue ||
                geoDrawProps?.stroke ||
                SHAPE_DEFAULT_STROKE,
            linewidth: defaultLinewidthValue || geoDrawProps?.linewidth || 2,
            strokeType: defaultStrokeTypeValue,
            x: originX,
            y: originY,
            x1: 0,
            x2: 0,
            y1: 0,
            y2: 0,
            width: 0,
            height: 0,
            radius: null,
            iconStroke: null,
            isDummy: null,
            createdAt: null,
            children: {},
            // Absolute vertex coords (same convention as pencil).
            metadata: verts.map((v) => ({
                x: Math.round(v.x),
                y: Math.round(v.y),
            })),
        }

        clearGeoPreviewArtifacts()
        resetGeoDrawState()
        hideMultiClickHint()
        addToLocalComponentStore(
            finalId,
            type,
            finalShapeData as unknown as ComponentRecord
        )
        setSelectedComponentInBase(null)
        // After finishing an area/route draw, land in pointer/select mode so the
        // shape can be tweaked immediately, whatever the base's home tool is.
        setRootCursor('auto')
        setPointerElement('pointer', { select: true })
    }

    window.addEventListener('cancelGeoDraw', () => {
        // Not gated on geoDrawType: the multi-click hint banner is shown as
        // soon as the tool is ARMED (handleMultiClickDraw writes
        // GEO_DRAW_TYPE_KEY to localStorage), but geoDrawType itself is only
        // populated lazily on the first canvas mousedown. Switching tools
        // before ever clicking the canvas left geoDrawType null, so this
        // guard skipped cancelGeoDraw() entirely and the hint stuck around
        // forever. cancelGeoDraw()'s steps are all no-ops when nothing was
        // drawn, so it's safe to always run.
        cancelGeoDraw()
    })

    // Mobile ✓ button (base.tsx) — finish the in-progress multi-click draw,
    // the touch equivalent of pressing Enter (no keyboard on mobile).
    window.addEventListener('finishGeoDraw', () => {
        if (geoDrawType) finishGeoDraw({})
    })

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!geoDrawType) return
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault()
            finishGeoDraw({})
        }
    })

    const selectionController = new SelectionController({
        two,
        zui,
        domElement,
        onSelect: (toolbarState) => {
            setSelectedComponentInBase(toolbarState)
        },
        onDeselect: () => {
            setSelectedComponentInBase(null)
        },
        commit: (id, patch) => {
            updateComponentBulkPropertiesInLocalStore(id, patch)
            const g = selectionController.currentGroup
            // Keep elementData (read by copy/paste and other consumers) in step
            // with the store + rendered shape after a resize — otherwise a clone
            // reads stale draw-time width/height. Mirrors the font-resize
            // metadata sync in selectionController's resize-end path.
            if (g?.elementData) Object.assign(g.elementData, patch)
            // Resize ended — persist any connectors whose ports tracked the
            // shape so their new tail/head survive a reload.
            if (g) persistBoundArrows(g)
        },
        onTransform: (group) => {
            // Live-follow during scale/rotate: drag bound connectors with the
            // shape's edges.
            reanchorArrowsForShape(group)
        },
        onDelete: (group) => {
            const id = group?.elementData?.id
            if (id) deleteComponentFromLocalStore(id)
            two.remove([group])
            two.update()
        },
    })

    /**
     * Select an element by id, from outside the canvas's own pointer handling.
     *
     * Paste is the caller: the clone lands under the cursor, but the SOURCE
     * element kept the selection box and the properties toolbar, so the panel
     * you reached for was editing the thing you had copied FROM. Selection is
     * otherwise only ever established by a real gesture, hence this door.
     *
     * Two kinds of element, two mechanisms. The controller owns rect/circle/
     * diamond/newText and `attach` does everything for them. Everything else
     * (arrow, line, pencil, and the whole geo family) draws its own selection
     * chrome inside its component, bound to a `click` on its own SVG node — so
     * for those we click the node, exactly as a user's finger would, and set the
     * toolbar state ourselves.
     */
    const selectComponentById = (id: string): void => {
        const group = two.scene.children.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => c?.elementData?.id === id
        )
        if (!group) return

        selectionController.detach()
        if (selectionController.attach(group)) {
            lastSelectedShape = group
            return
        }

        const shape = group.children?.[0]
        if (!shape) return
        const el = document.getElementById(group.id)
        el?.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true })
        )
        lastSelectedShape = group
        setSelectedComponentInBase(buildToolbarState(group, shape))
        two.update()
    }

    const onSelectComponentRequest = ((
        e: CustomEvent<{ id?: string }>
    ): void => {
        const id = e.detail?.id
        if (id) selectComponentById(id)
    }) as EventListener
    window.addEventListener(SELECT_COMPONENT_EVENT, onSelectComponentRequest)

    // Delete/Backspace for element types no other delete path covers.
    //
    // The base's delete key is spread across three owners: the selection
    // controller handles SHAPE_ADAPTERS shapes (rect/circle/diamond/text);
    // arrow, plain line, divider and geoText each carry their own focus-based
    // handler. That left the whole geo family — route, area and point — plus
    // the curved line cloned from route with no way to delete by keyboard at
    // all: they select and show a properties panel, but the key does nothing.
    // This is their handler, scoped to exactly those types so the shapes that
    // already own the key are never double-deleted.
    const KEY_DELETABLE_HERE: ReadonlySet<string> = new Set([
        'curvedLine',
        'route',
        'area',
        'point',
    ])
    const onOrphanDeleteKeyDown = (e: KeyboardEvent): void => {
        if (e.keyCode !== 8 && e.keyCode !== 46) return
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if ((document.activeElement as HTMLElement | null)?.isContentEditable) {
            return
        }
        // Don't delete mid multi-click draw, or when the controller owns the
        // selection (its own handler fires for those).
        if (geoDrawType || selectionController.currentGroup) return
        const grp = lastSelectedShape
        const type = grp?.elementData?.componentType
        if (!type || !KEY_DELETABLE_HERE.has(type)) return
        const id = grp.elementData.id
        if (!id) return
        deleteComponentFromLocalStore(id)
        two.remove([grp])
        two.update()
        lastSelectedShape = null
        setSelectedComponentInBase(null)
    }
    window.addEventListener('keydown', onOrphanDeleteKeyDown, false)

    // An element can leave the scene without the selection ever being cleared —
    // undoing its ADD is the common case (history's applyRemove just drops the
    // group). The selection overlay lives at scene level, so it survives the
    // element it was framing and would keep painting (and stay hit-testable) at
    // the dead shape's last position. Drop any selection state pointing at the
    // removed id. Idempotent: detach() no-ops when nothing is selected, so the
    // delete paths that already detach are unaffected.
    window.addEventListener('elementRemoved', ((e: CustomEvent) => {
        const id = e.detail?.id
        if (!id) return
        if (selectionController.currentGroup?.elementData?.id === id) {
            selectionController.detach()
        }
        if (lastSelectedShape?.elementData?.id === id) {
            lastSelectedShape = null
        }
        if (activeGroupRef.current?.elementData?.id === id) {
            activeGroupRef.current = null
        }
    }) as EventListener)

    domElement.addEventListener('mousedown', mousedown, false)
    domElement.addEventListener('mousemove', hoverDetectMove, false)
    domElement.addEventListener('dblclick', dblclick, false)
    domElement.addEventListener(
        'mousewheel',
        mousewheel as EventListener,
        false
    )
    domElement.addEventListener('wheel', mousewheel, false)

    domElement.addEventListener('touchstart', touchstart, { passive: false })
    domElement.addEventListener('touchmove', touchmove, { passive: false })
    domElement.addEventListener('touchend', touchend, false)
    domElement.addEventListener('touchcancel', touchend, false)

    window.addEventListener('groupFocused', ((e: CustomEvent) => {
        activeGroupRef.current = e.detail?.group ?? null
    }) as EventListener)
    window.addEventListener('groupBlurred', () => {
        activeGroupRef.current = null
    })

    // Generic "re-glue these ports" command: fired by useComponentHistory
    // (undo/redo of binding changes and position reverts), groupobject
    // (group-move commit) and the clipboard (paste of bound arrows). Restack
    // each port so the docked connectors re-anchor to the shape's current
    // edge and their fan layout (port indices + endpoint offsets) settles.
    // Poll first: the shape may still be mounting (undo of its delete, a
    // freshly pasted clone); if it's gone entirely (redo of a delete) the
    // poll times out and the restack is a no-op anyway.
    window.addEventListener('restackPorts', ((e: CustomEvent) => {
        if (!getConnectorsEnabled()) return
        const ports = e.detail?.ports as
            { shapeId: string; edge: string }[] | undefined
        if (!ports?.length) return
        ports.forEach(({ shapeId, edge }) => {
            pollUntilElement(
                two,
                shapeId,
                () => restackPortConnectors(shapeId, edge),
                { maxRetries: 60 }
            )
        })
    }) as EventListener)

    // Connectors flag is live-toggleable from Settings. When it flips, re-sync
    // the current selection box so its edge ports appear/disappear immediately
    // (rather than waiting for the next transform). If the flag goes off mid
    // arrow-drag, clear any lingering radar glow too.
    subscribeConnectorsEnabled((enabled) => {
        if (!enabled) selectionController.hidePortGlow()
        selectionController.resync()
    })

    // Dot-grid flag is live-toggleable from Settings. On flip, add/remove the
    // `cb-dot-grid` class so the dots appear/disappear immediately, and re-sync
    // their size/position to the current camera.
    subscribeDotGridEnabled(() => {
        syncDotGridClass()
    })

    // Theme-toggle color flip. The theme is signalled by the `dark` class on
    // <html> (toggled by useTheme). On each toggle we flip every element's color
    // to its paired counterpart (flipThemeColor — a theme-independent involution:
    // #000↔#fff, light shade↔dark shade) and PERSIST the new value to the store
    // (skipHistory, so it survives reload and isn't clobbered by later edits).
    // We mutate the Two.js node directly too, since the element components froze
    // their props at mount and won't re-render from the store. Colors are never
    // transformed at create/load/edit — only here, on an explicit toggle. The
    // selection box stroke is UI chrome and stays theme-driven (active `ink`).
    let prevDark = document.documentElement.classList.contains('dark')
    const flipColorOnNodesAndStore = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        child: any
    ): void => {
        const ed = child?.elementData
        if (!ed?.id) return
        const ct = ed.componentType

        // Group selectors: the background rectangle (children[0]) is tinted from
        // the theme-aware getGroupFill(), not a flippable element color, so just
        // re-read it for the active theme. The fill is computed, not persisted.
        if (ed.isGroupSelector) {
            const bg = child?.children?.[0]
            if (bg) bg.fill = getGroupFill()
            return
        }

        // Welcome-sketch content is theme-aware too, but it is ephemeral demo
        // content (metadata.isWelcome) — re-color its nodes to the active theme
        // ink WITHOUT persisting. Routing it through the persisting path below
        // would call updateComponentBulkPropertiesInLocalStore → promoteWelcome
        // Sketch, wrongly claiming the sketch as real content on a theme toggle.
        if (ed.metadata?.isWelcome) {
            const ink = themeDefaultInk()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getShapeTextNodes(child).forEach((n: any) => {
                n.fill = ink
            })
            if (ed.stroke) {
                paintElementStroke(child, ed.stroke, ink)
                ed.stroke = ink
            }
            if (ed.textColor) ed.textColor = ink
            if (ed.metadata?.textFill) {
                ed.metadata = { ...ed.metadata, textFill: ink }
            }
            return
        }

        // Text color. Standalone text (`newText`) renders from
        // elementData.textColor; shapes-with-text render from metadata.textFill
        // (the shapes' own `textColor` is a vestigial template value and not what
        // renderShapeTextLayer paints), so flip the field that actually drives it.
        if (ct === 'newText') {
            if (ed.textColor) {
                const flipped = flipThemeColor(ed.textColor)
                if (flipped !== ed.textColor) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    getShapeTextNodes(child).forEach((n: any) => {
                        n.fill = flipped
                    })
                    ed.textColor = flipped
                    updateComponentBulkPropertiesInLocalStore(
                        ed.id,
                        { textColor: flipped },
                        true
                    )
                }
            }
        } else if (ed.metadata?.textFill) {
            const flipped = flipThemeColor(ed.metadata.textFill)
            if (flipped !== ed.metadata.textFill) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                getShapeTextNodes(child).forEach((n: any) => {
                    n.fill = flipped
                })
                const newMeta = { ...ed.metadata, textFill: flipped }
                ed.metadata = newMeta
                updateComponentBulkPropertiesInLocalStore(
                    ed.id,
                    { metadata: newMeta },
                    true
                )
            }
        }

        // Shape fill (rectangle/circle/diamond).
        if (isFillableShapeType(ct) && ed.fill) {
            const flipped = flipThemeColor(ed.fill)
            if (flipped !== ed.fill) {
                paintShapeFill(child, flipped, findShapeTextLayer(child))
                ed.fill = flipped
                updateComponentBulkPropertiesInLocalStore(
                    ed.id,
                    { fill: flipped },
                    true
                )
            }
        }

        // Arrow + pencil stroke (endpoint handles keep their fixed color).
        if (isStrokeFlippableType(ct) && ed.stroke) {
            const flipped = flipThemeColor(ed.stroke)
            if (flipped !== ed.stroke) {
                paintElementStroke(child, ed.stroke, flipped)
                ed.stroke = flipped
                updateComponentBulkPropertiesInLocalStore(
                    ed.id,
                    { stroke: flipped },
                    true
                )
            }
        }
    }
    const repaintForTheme = (): void => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        two.scene.children.forEach((child: any) =>
            flipColorOnNodesAndStore(child)
        )
        // applyThemeStroke runs the single two.update() covering all changes.
        selectionController.applyThemeStroke()
    }
    const themeObserver = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains('dark')
        if (isDark === prevDark) return
        prevDark = isDark
        repaintForTheme()
    })
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
    })

    function dblclick(e: MouseEvent) {
        // In a multi-click geo draw, a double-click finishes it. Drop the
        // duplicate vertex the second mousedown added.
        if (geoDrawType) {
            finishGeoDraw({ dropLast: true })
            return
        }
        // Pan mode navigates, it does not author. A double-click is the canvas's
        // "edit this" gesture — on a shape it opens the text editor, on empty
        // canvas it spawns a whole text element — and neither belongs to a tool
        // whose entire job is moving the view. The element-owned editors
        // (point.tsx, geoText.tsx) carry the same guard, because their dblclick
        // listeners are bound to their own SVG nodes and never reach here.
        if (isPanMode()) return
        shape = null
        mouse.x = e.clientX
        mouse.y = e.clientY
        let avoidDragging = false
        // Hide all arrow/line endpoint circles before processing the new
        // selection. Covers plain lines too (isLineLikeType): on mobile, blur
        // never fires (synthetic taps don't move focus), so the line's own
        // onBlur can't hide them — this next-tap sweep is what clears them,
        // exactly as it does for arrows.
        two.scene.children.forEach((child: any) => {
            if (isLineLikeType(child?.elementData?.componentType)) {
                setArrowEndpointsVisible(child, false)
            }
        })

        const path =
            (e as MouseEvent & { path?: EventTarget[] }).path ||
            (e.composedPath && e.composedPath())
        ;({ shape, avoidDragging } = resolveShapeFromPath(path, two))

        if (avoidDragging) {
            shape = {}
        }

        // Empty-canvas dblclick → create new text element at click point.
        // Skipped if a shape was hit (preserve dblclick-to-edit), if the
        // dblclick landed on avoid-dragging UI, or if a draw mode is active.
        if (!avoidDragging && (!shape || Object.keys(shape).length === 0)) {
            const inDrawMode =
                isPencilModeRef?.current === true ||
                arrowDrawElement !== null ||
                localStorage.getItem(RUBBER_MODE_KEY) === 'true' ||
                localStorage.getItem(TEXT_DRAW_MODE_KEY) === 'true' ||
                localStorage.getItem(ARROW_DRAW_MODE_KEY) === 'true' ||
                localStorage.getItem(GEO_DRAW_MODE_KEY) === 'true' ||
                localStorage.getItem(GEO_POINT_PLACE_MODE_KEY) === 'true' ||
                localStorage.getItem(PENDING_SHAPE_TYPE_KEY) !== null
            if (!inDrawMode && createTextAtSurfaceRef?.current) {
                const surfaceCoords = toSurface(e)
                createTextAtSurfaceRef.current(surfaceCoords.x, surfaceCoords.y)
                return
            }
        }

        const showTextInput = (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            group: any,
            componentId: string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentMetadata: any
        ) => {
            const groupDomElem = document.getElementById(`${group.id}`)
            if (!groupDomElem) return

            const shapeKind = group?.elementData?.componentType
            // The shape Path child (rectangle/ellipse/diamond). The text layer
            // is a Group with no numeric width, so this still resolves the
            // geometry node and lets us auto-grow it while typing.
            const rectChild = group.children.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (c: any) =>
                    typeof c.value !== 'string' &&
                    typeof c.width === 'number' &&
                    typeof c.height === 'number'
            )

            // Anchor the textarea over the shape's screen box — its center is
            // where the centered text block sits, valid whether or not text
            // exists yet.
            const anchorElem =
                rectChild?._renderer?.elem ?? (groupDomElem as Element)
            const screenRect = anchorElem.getBoundingClientRect()

            // Hide the text layer (not the shape) while the textarea overlays.
            const textLayer = findShapeTextLayer(group)
            const layerElem = textLayer?._renderer?.elem as
                HTMLElement | undefined
            if (layerElem) layerElem.style.display = 'none'
            // The selection box stays visible while editing (same as the solo
            // text editor) — it re-syncs on every render, so it tracks the
            // shape as it auto-grows with the text.
            two.update()

            const rawLiveMeta =
                group.elementData?.metadata || currentMetadata || {}
            // A shape that's never had text has no `textFontSize` —
            // shapeTextStyleFromMeta would fall back to its hardcoded 24px
            // ("S"). Seed it from the user's current default text size (the
            // defaults toolbar) so new shape-text honors the last-set size.
            const liveMeta = {
                ...rawLiveMeta,
                textFontSize: rawLiveMeta.textFontSize ?? defaultTextSizeValue,
            }
            const { style: textStyle } = shapeTextStyleFromMeta(liveMeta)
            const fontSize = textStyle.size || DEFAULT_TEXT_SIZE
            // Two.js renders text at `fontSize * sceneScale` screen pixels.
            // Match the textarea/measureSpan to that so visuals stay in sync
            // and the surface-unit math (measuredW / zoom) remains correct.
            // Camera-dependent geometry — reassigned by recomputeGeometry() on
            // every two.update (pan/zoom) so the editor stays glued to the shape.
            const sceneScale = two?.scene?.scale || 1
            let cssFontSize = fontSize * sceneScale
            // Use a generous line-height so ascenders/descenders are
            // never clipped. A LINE_HEIGHT_MULTIPLIER× covers most font metrics.
            let lineH = Math.ceil(cssFontSize * LINE_HEIGHT_MULTIPLIER)
            // Vertical padding inside the textarea prevents the top of
            // tall glyphs (H, d, l …) from being cut off by the element
            // boundary. Half the difference between lineH and cssFontSize
            // approximates the ascender headroom the browser needs.
            let vertPad = Math.ceil((lineH - cssFontSize) / 2) + 4

            const input = document.createElement('textarea')
            const randomId = Math.floor(Math.random() * 90 + 10)
            input.id = `new-text-input-area-${randomId}`
            // Edit the RAW text (hard newlines preserved) — the wrapped
            // layout shown on canvas is derived, never the source of truth.
            input.value =
                typeof liveMeta.textContent === 'string'
                    ? liveMeta.textContent
                    : ''
            input.rows = 1
            input.style.border = 'none'
            input.style.background = 'transparent'
            input.style.padding = `${vertPad}px 8px`
            input.style.color = textStyle.fill || '#000'
            input.style.fontSize = `${cssFontSize}px`
            input.style.fontFamily =
                textStyle.family || DEFAULT_TEXT_FONT_FAMILY
            input.style.fontWeight = String(textStyle.weight ?? 'normal')
            input.style.lineHeight = `${lineH}px`
            input.style.letterSpacing = '0px'
            input.style.textAlign = 'left'
            input.style.position = 'absolute'
            input.style.outline = 'none'
            input.style.resize = 'none'
            input.style.overflow = 'hidden'
            // Wrap inside the shape (don't run past it horizontally); long
            // words break so the box can squeeze to 1 char/line.
            input.style.whiteSpace = 'pre-wrap'
            input.style.overflowWrap = 'anywhere'
            input.style.boxSizing = 'border-box'
            input.className = 'temp-input-area'

            // Where the shape sat and how tall it was before typing began.
            // Growing a rectangle downward moves its origin (see
            // growShapeToFit), so the commit below has to persist the new y —
            // compared against these.
            const startTranslationY = group.translation.y
            const startHeight = rectChild?.height

            // Anchor point: the SVG shape's screen-space center. The shape stays
            // VISIBLE during edit (only the text layer is hidden), so its rect is
            // live — recomputeGeometry() re-reads it each frame to follow pan/zoom.
            let centerX = screenRect.left + screenRect.width / 2
            let centerY = screenRect.top + screenRect.height / 2

            // px-per-surface-unit derived from the shape's current screen
            // size; converts the textarea's pixel measurement back into
            // Two.js surface units before growing the shape.
            const rectScreen =
                rectChild?._renderer?.elem?.getBoundingClientRect()
            let zoom =
                rectChild && rectScreen && rectChild.width
                    ? rectScreen.width / rectChild.width
                    : 1

            document.getElementById('main-two-root')?.append(input)

            // ── Offscreen measurement helper ──
            // We create a hidden <span> with identical font styles and
            // read its offsetWidth/offsetHeight. This is more reliable
            // than textarea.scrollWidth which can be affected by cols,
            // min intrinsic sizing, and platform differences.
            // The textarea content width = the shape's usable inner width
            // (screen px), so wrapping mirrors the committed render and the
            // box never spills outside the shape horizontally.
            const surfaceW = rectChild?.width || screenRect.width / zoom
            let usableScreenW = Math.max(
                Math.round(usableTextWidth(shapeKind, surfaceW) * zoom),
                Math.ceil(cssFontSize) // never below ~1 glyph
            )
            const PAD_X = 8

            const measureSpan = document.createElement('span')
            measureSpan.style.position = 'absolute'
            measureSpan.style.visibility = 'hidden'
            measureSpan.style.display = 'inline-block'
            measureSpan.style.whiteSpace = 'pre-wrap'
            measureSpan.style.overflowWrap = 'anywhere'
            measureSpan.style.width = `${usableScreenW}px`
            measureSpan.style.fontSize = `${cssFontSize}px`
            measureSpan.style.fontFamily =
                textStyle.family || DEFAULT_TEXT_FONT_FAMILY
            measureSpan.style.fontWeight = String(textStyle.weight ?? 'normal')
            measureSpan.style.lineHeight = `${lineH}px`
            measureSpan.style.letterSpacing = '0px'
            measureSpan.style.padding = '0'
            measureSpan.style.boxSizing = 'content-box'
            document.body.appendChild(measureSpan)

            // Pull anchor + font from the LIVE shape rect + camera. Called on
            // every two.update so the editor pans/zooms with the shape.
            const recomputeGeometry = () => {
                const scale = two?.scene?.scale || 1
                cssFontSize = fontSize * scale
                lineH = Math.ceil(cssFontSize * LINE_HEIGHT_MULTIPLIER)
                vertPad = Math.ceil((lineH - cssFontSize) / 2) + 4
                const liveRect = (
                    rectChild?._renderer?.elem ?? groupDomElem
                )?.getBoundingClientRect()
                if (liveRect) {
                    centerX = liveRect.left + liveRect.width / 2
                    centerY = liveRect.top + liveRect.height / 2
                }
                const rs = rectChild?._renderer?.elem?.getBoundingClientRect()
                zoom =
                    rectChild && rs && rectChild.width
                        ? rs.width / rectChild.width
                        : 1
                const sw =
                    rectChild?.width ||
                    (liveRect ? liveRect.width / zoom : surfaceW)
                usableScreenW = Math.max(
                    Math.round(usableTextWidth(shapeKind, sw) * zoom),
                    Math.ceil(cssFontSize)
                )
                input.style.fontSize = `${cssFontSize}px`
                input.style.lineHeight = `${lineH}px`
                input.style.padding = `${vertPad}px 8px`
                measureSpan.style.fontSize = `${cssFontSize}px`
                measureSpan.style.lineHeight = `${lineH}px`
                measureSpan.style.width = `${usableScreenW}px`
            }

            // Pure DOM: size + centre the textarea over the shape midpoint.
            // No shape-grow / two.update — safe to call from the update handler.
            const placeEditor = () => {
                const val = input.value || 'M'
                measureSpan.textContent = val
                const measuredH = measureSpan.offsetHeight

                const contentWidth = usableScreenW + PAD_X * 2
                const contentHeight = Math.max(
                    measuredH + vertPad * 2,
                    lineH + vertPad * 2
                )

                input.style.width = `${contentWidth}px`
                input.style.height = `${contentHeight}px`
                input.style.left = `${centerX - contentWidth / 2}px`
                input.style.top = `${centerY - contentHeight / 2}px`
            }

            // Grow ONLY the shape height to fit the wrapped lines (width is
            // user-driven). Only on typing — NOT from the update handler (it
            // calls two.update).
            const growShapeToFit = () => {
                if (!rectChild) return
                const val = input.value || 'M'
                measureSpan.textContent = val
                const measuredH = measureSpan.offsetHeight
                const textSurfaceH = measuredH / zoom
                const { h: nextH } = growShapeToFitText(
                    shapeKind,
                    rectChild.width,
                    rectChild.height,
                    0,
                    textSurfaceH
                )
                if (rectChild.height < nextH) {
                    const dh = nextH - rectChild.height
                    rectChild.height = nextH
                    // The shape path sits on the group origin, so growing
                    // `height` alone expands symmetrically and lifts the TOP
                    // edge — the box would swell around the text instead of
                    // below it, walking line 1 upward on every newline. Shift
                    // the origin down by half the delta so the top edge stays
                    // put and the box only extends downward (matching the
                    // standalone text editor). Rectangles only: a diamond or
                    // circle reads as a centered figure, so symmetric growth is
                    // the right behavior there.
                    if (shapeKind === componentTypes.rectangle) {
                        group.translation.y += dh / 2
                    }
                    two.update()
                }
            }

            // Re-glue the editor to the shape after any render (pan/zoom).
            const repositionEditor = () => {
                recomputeGeometry()
                placeEditor()
            }

            const onTextInput = () => {
                growShapeToFit() // may two.update → 'update' → repositionEditor
                placeEditor()
            }

            repositionEditor()
            two.bind('update', repositionEditor)

            // Re-measure on every keystroke so the box grows with the text
            input.addEventListener('input', onTextInput)

            input.focus()

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    if (event.shiftKey) {
                        // Shift+Enter: let the textarea insert a hard newline
                        // (whiteSpace:'pre-wrap' preserves it; reflow on
                        // commit re-wraps to the shape width).
                        return
                    }
                    // Plain Enter commits and closes the editor.
                    event.preventDefault()
                    input.blur()
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    input.blur()
                }
            })

            input.addEventListener('blur', () => {
                // Clean up the camera tracker, input listener and measure span
                two.unbind('update', repositionEditor)
                input.removeEventListener('input', onTextInput)
                if (measureSpan.parentNode) {
                    measureSpan.parentNode.removeChild(measureSpan)
                }

                if (layerElem) layerElem.style.display = ''
                // mousedown fires before blur, so if the user clicked empty
                // canvas, detach() already ran and currentGroup is null.
                // Only restore the selection UI if we still have a target.
                if (selectionController.currentGroup) {
                    selectionController.ui.visible = true
                    selectionController.syncToTarget()
                }
                two.update()

                // Raw text — may contain hard newlines from Shift+Enter.
                const newContent = input.value

                if (componentId) {
                    // Use the live elementData.metadata (updated by toolbar ops
                    // like font-size and text-color) rather than the stale
                    // snapshot captured at dblclick time.
                    const latestMeta = group.elementData?.metadata || {}
                    const updatedMetadata = {
                        ...latestMeta,
                        hasText: true,
                        textContent: newContent,
                        textFill: latestMeta.textFill || textStyle.fill,
                        textFontSize: latestMeta.textFontSize || textStyle.size,
                        textFamily: latestMeta.textFamily || textStyle.family,
                        textFontFamily:
                            latestMeta.textFontFamily || textStyle.family,
                        textBaseLine:
                            latestMeta.textBaseLine ||
                            textStyle.baseline ||
                            'middle',
                    }
                    // Re-wrap the raw text to the (possibly grown) box width
                    // and rebuild the multiline layer.
                    applyShapeText(
                        two,
                        group,
                        shapeKind,
                        rectChild?.width || screenRect.width,
                        updatedMetadata
                    )
                    two.update()

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const persistPayload: any = { metadata: updatedMetadata }
                    if (rectChild) {
                        persistPayload.width = Math.round(rectChild.width)
                        persistPayload.height = Math.round(rectChild.height)
                    }
                    // Keeping the top edge fixed moved the origin; without
                    // persisting it a reload would re-center the grown box on
                    // the old origin and the shape would jump upward.
                    if (group.translation.y !== startTranslationY) {
                        persistPayload.y = Math.round(group.translation.y)
                    }
                    updateComponentBulkPropertiesInLocalStore(
                        componentId,
                        persistPayload
                    )
                    // Keep the live group's elementData in sync so consumers
                    // that read from it (copy/paste, toolbar) see the latest
                    // text content without waiting for a re-render.
                    if (group.elementData) {
                        group.elementData.metadata = updatedMetadata
                        if (rectChild) {
                            group.elementData.width = persistPayload.width
                            group.elementData.height = persistPayload.height
                        }
                        if (persistPayload.y !== undefined) {
                            group.elementData.y = persistPayload.y
                        }
                    }

                    // Typing resized the box (and, for a rectangle, moved it),
                    // so every edge port shifted — re-glue anything docked to
                    // them. Restacking an edge with nothing docked is a no-op,
                    // so fire all four rather than scanning for bindings.
                    if (
                        persistPayload.y !== undefined ||
                        (rectChild && rectChild.height !== startHeight)
                    ) {
                        ;[
                            'n-resize',
                            'e-resize',
                            's-resize',
                            'w-resize',
                        ].forEach((edge) =>
                            restackPortConnectors(componentId, edge)
                        )
                        two.update()
                    }
                }

                input.remove()
            })
        }

        if (shape !== null && !isPencilModeRef?.current) {
            const ct = shape.elementData?.componentType
            if (
                ct === componentTypes.rectangle ||
                ct === componentTypes.diamond ||
                ct === componentTypes.circle
            ) {
                const meta = shape.elementData.metadata || {}
                showTextInput(shape, shape.elementData.id, meta)
            }
        }
    }

    // eraseElementAtPoint deletes whole elements via a point hit test, not
    // pixel painting — so "eraser size" widens the hit-test tolerance radius
    // around the cursor rather than a stroke width. Read live (not via a ref)
    // because, like RUBBER_MODE_KEY elsewhere in this file, the value is only
    // ever needed synchronously inside a DOM event handler.
    function getEraserSize(): EraserSize {
        const stored = localStorage.getItem(
            ERASER_SIZE_KEY
        ) as EraserSize | null
        return stored && stored in ERASER_SIZE_RADIUS
            ? stored
            : DEFAULT_ERASER_SIZE
    }

    function getEraserRadius(): number {
        return ERASER_SIZE_RADIUS[getEraserSize()]
    }

    // The trail is the eraser's cursor made visible, so it's drawn at the same
    // diameter as the dot in the size selector — pick the big dot, get a big
    // circle on the canvas. (The hit-test radius above reaches further; the
    // trail shows the tool, not the blast radius.)
    const eraserTrail = createEraserTrail(
        two,
        () => ERASER_DOT_PX[getEraserSize()],
        () => zui.scale || 1
    )

    function componentIdAtPoint(x: number, y: number): string | null {
        const el = document.elementFromPoint(x, y)
        if (!el) return null

        let target: Element | null = el
        while (target && target !== document.body) {
            const componentId =
                target.getAttribute?.('data-component-id') ?? null
            if (componentId) return componentId
            target = target.parentElement
        }
        return null
    }

    // Eraser hit-test samples points around a circle of the configured radius
    // (plus the center) rather than just the raw cursor point, so a larger
    // size gives a more forgiving catch area for thin strokes / small shapes.
    const ERASER_SAMPLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

    function eraseElementAtPoint(x: number, y: number) {
        const radius = getEraserRadius()
        const points: Array<[number, number]> =
            radius > 0
                ? [
                      [x, y],
                      ...ERASER_SAMPLE_ANGLES.map((deg): [number, number] => {
                          const rad = (deg * Math.PI) / 180
                          return [
                              x + radius * Math.cos(rad),
                              y + radius * Math.sin(rad),
                          ]
                      }),
                  ]
                : [[x, y]]

        const componentIds = new Set<string>()
        for (const [px, py] of points) {
            const id = componentIdAtPoint(px, py)
            if (id && !pendingDeletionSet.has(id)) componentIds.add(id)
        }
        if (componentIds.size === 0) return

        for (const componentId of componentIds) {
            eraseComponent(componentId)
        }
    }

    function eraseComponent(componentId: string) {
        const group = two.scene.children.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => c?.elementData?.id === componentId
        )
        if (!group) return

        pendingDeletionSet.add(componentId)
        group.opacity = 0.3
        two.update()

        setTimeout(() => {
            two.remove([group])
            two.update()
            deleteComponentFromLocalStore(componentId)
            pendingDeletionSet.delete(componentId)
        }, 1000)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastHoveredCircleGroup: any = null

    // Singleton hover indicator — separate from the selection circles
    const hoverCircle = two.makeCircle(0, 0, 6)
    hoverCircle.fill = HOVER_COLOR
    hoverCircle.noStroke()
    hoverCircle.opacity = 0

    // Throttle the (O(scene)) hover scan to at most once per frame, and drop it
    // entirely while a wheel gesture is in flight — the camera is moving under
    // the cursor, so any hover result is stale before it paints. Only the most
    // recent event of the frame is scanned; the earlier ones are superseded.
    function hoverDetectMove(e: MouseEvent) {
        if (isWheeling) return

        hoverPendingEvent = e
        if (hoverFrame !== null) return

        hoverFrame = requestAnimationFrame(() => {
            hoverFrame = null
            const pendingEvent = hoverPendingEvent
            hoverPendingEvent = null
            if (pendingEvent) runHoverDetect(pendingEvent)
        })
    }

    function runHoverDetect(e: MouseEvent) {
        // No arrow-endpoint hover while panning or drawing/placing a geo object.
        if (
            isMousePanning ||
            geoDrawType ||
            localStorage.getItem(GEO_POINT_PLACE_MODE_KEY) === 'true'
        ) {
            return
        }
        if (!isSelectPanMode(isPencilModeRef.current)) {
            if (lastHoveredCircleGroup) {
                hoverCircle.opacity = 0
                scheduleRender(two)
                lastHoveredCircleGroup = null
            }
            return
        }
        // Perf-testing lever: skip the O(N) endpoint scan (arrow-endpoint hover
        // indicator won't appear while off).
        if (!getDragScansEnabled()) {
            if (lastHoveredCircleGroup) {
                hoverCircle.opacity = 0
                scheduleRender(two)
                lastHoveredCircleGroup = null
            }
            return
        }

        const worldPos = toSurface(e)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let found: any = null
        let foundWx = 0
        let foundWy = 0

        for (const child of two.scene.children) {
            // Both arrowLine and plain line share the [line, circle1, circle2]
            // group shape, so the endpoint-hover indicator applies to both.
            if (!isLineLikeType(child?.elementData?.componentType)) continue
            const gx = child.translation.x
            const gy = child.translation.y
            for (const circleGroup of [child.children[1], child.children[2]]) {
                if (!circleGroup) continue
                const wx = gx + circleGroup.translation.x
                const wy = gy + circleGroup.translation.y
                const dist = Math.sqrt(
                    (worldPos.x - wx) ** 2 + (worldPos.y - wy) ** 2
                )
                if (dist < HOVER_THRESHOLD) {
                    found = circleGroup
                    foundWx = wx
                    foundWy = wy
                    break
                }
            }
            if (found) break
        }

        if (found) {
            // The indicator snaps to the endpoint, not the cursor, so while the
            // pointer wanders within the hover threshold of the same endpoint
            // nothing actually moves. Only render when something changed.
            const moved =
                hoverCircle.translation.x !== foundWx ||
                hoverCircle.translation.y !== foundWy
            hoverCircle.translation.x = foundWx
            hoverCircle.translation.y = foundWy
            if (found !== lastHoveredCircleGroup) hoverCircle.opacity = 1
            if (moved || found !== lastHoveredCircleGroup) scheduleRender(two)
        } else if (lastHoveredCircleGroup) {
            hoverCircle.opacity = 0
            scheduleRender(two)
        }
        lastHoveredCircleGroup = found ?? null
    }

    // Outward offset (surface units) from a shape's edge to its floated
    // selection port, matching where selectionController draws the port dot:
    // the box padding plus the screen-constant port gap divided out by zoom.
    const portGapSurface = (): number =>
        SELECTION_PADDING + PORT_GAP / (zui.scale || 1)

    // Surface-space step between stacked connector tails (screen-constant, so it
    // matches the port-dot spacing at the current zoom).
    const portTailStackGapSurface = (): number =>
        PORT_TAIL_STACK_GAP / (zui.scale || 1)

    // How many connectors already leave `shapeId`'s `edge` port (tail bound
    // there). A fresh pull-out takes the next slot, so it fans out beyond them.
    function countPortConnectors(
        shapeId: string | undefined,
        edge: string
    ): number {
        if (!shapeId) return 0
        let n = 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        two.scene.children.forEach((c: any) => {
            const ed = c?.elementData
            if (
                ed?.componentType === 'arrowLine' &&
                ed.tailShapeId === shapeId &&
                ed.tailEdge === edge
            ) {
                n++
            }
        })
        return n
    }

    // Re-fan a port-bound endpoint (tail = vertex[0], head = vertex[1]): place
    // it at the stacked offset for this connector's slot, fanning toward the
    // side its OTHER endpoint currently sits on. `port` is the live port anchor;
    // the far endpoint is read off the line so the fan direction follows the
    // drag (or the bound far end after a shape move).
    function applyStackedEndpoint(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        arrowGroup: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        line: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        circle: any,
        edge: string,
        port: { x: number; y: number },
        index: number,
        endpoint: 'tail' | 'head'
    ) {
        const farIdx = endpoint === 'tail' ? 1 : 0
        const far = {
            x: arrowGroup.position.x + line.vertices[farIdx].x,
            y: arrowGroup.position.y + line.vertices[farIdx].y,
        }
        const pt = getStackedPortPoint(
            edge,
            port,
            far,
            index,
            portTailStackGapSurface()
        )
        const relX = pt.x - arrowGroup.position.x
        const relY = pt.y - arrowGroup.position.y
        if (endpoint === 'tail') {
            updateX1Y1Vertices(Two, line, relX, relY, circle, two)
        } else {
            updateX2Y2Vertices(Two, line, relX, relY, circle, two)
        }
    }

    // Which arrow endpoint a drag is moving — context for the magnetic snap.
    type PortDragContext = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        arrowGroup: any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        line: any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        circle: any
        endpoint: 'head' | 'tail'
    }

    // Radar: while an arrow endpoint is dragging at `probeSurface` (the cursor),
    // glow + outline the nearest landable port. When `dragContext` is supplied
    // and a port is in range, also do the one-off magnetic pull — snap that
    // endpoint onto the port and remember the would-be binding in
    // `pendingPortConnection` (committed on release). The probe is the cursor,
    // not the snapped point, so pulling past the threshold releases the magnet
    // and clears the pending binding — the user is never forced to connect.
    function updatePortRadar(
        probeSurface: { x: number; y: number },
        dragContext: PortDragContext | null = null,
        excludeShapeId: string | null = arrowDrawTailShapeId
    ) {
        // No port snapping/glow while connectors are disabled (live flag).
        if (!getConnectorsEnabled()) return
        const threshold = PORT_RADAR_RADIUS / (zui.scale || 1)
        const nearest = findNearestPort(
            two.scene.children,
            probeSurface,
            threshold,
            portGapSurface(),
            excludeShapeId
        )
        if (nearest) {
            // Pass the candidate group so the controller also outlines the
            // shape the connector would attach to.
            selectionController.showPortGlow(nearest.point, nearest.group)
            if (dragContext && nearest.shapeId) {
                snapEndpointToPort(dragContext, nearest.point)
                pendingPortConnection = {
                    arrowId: dragContext.arrowGroup?.elementData?.id,
                    endpoint: dragContext.endpoint,
                    edge: nearest.edge,
                    shapeId: nearest.shapeId,
                }
            }
        } else {
            selectionController.hidePortGlow()
            // Just undocked: the magnet overwrote the endpoint with the port's
            // absolute position, but the endpoint-drag path advances the vertex
            // incrementally — so re-place it exactly under the cursor, else it
            // keeps the dock offset after release. (Harmless for the pull-out
            // path, which already recomputes the head from the cursor.)
            if (pendingPortConnection && dragContext) {
                snapEndpointToPort(dragContext, probeSurface)
            }
            pendingPortConnection = null
        }
    }

    // Magnetic pull: glue the dragged endpoint to the floated port anchor by
    // rewriting its line vertex (and endpoint circle) to that surface point.
    function snapEndpointToPort(
        ctx: PortDragContext,
        point: { x: number; y: number }
    ) {
        const relX = point.x - ctx.arrowGroup.translation.x
        const relY = point.y - ctx.arrowGroup.translation.y
        if (ctx.endpoint === 'head') {
            updateX2Y2Vertices(Two, ctx.line, relX, relY, ctx.circle, two)
        } else {
            updateX1Y1Vertices(Two, ctx.line, relX, relY, ctx.circle, two)
        }
    }

    // Commit a magnetic snap that was still active at release: write the
    // tail/head binding onto the arrow (live + store) so the endpoint stays
    // glued to the port and re-anchors when that shape later moves. Used by the
    // pull-out path; the endpoint-drag path folds the same write into its own
    // bulk update so detach/connect share a single undo step.
    function applyPendingPortConnection() {
        const pc = pendingPortConnection
        if (!pc || !pc.arrowId || !pc.shapeId) return
        const arrowGroup = two.scene.children.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => c?.elementData?.id === pc.arrowId
        )
        const ed = arrowGroup?.elementData
        if (!ed) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch: Record<string, any> = {}
        if (pc.endpoint === 'head') {
            ed.headShapeId = pc.shapeId
            ed.headEdge = pc.edge
            patch.headShapeId = pc.shapeId
            patch.headEdge = pc.edge
        } else {
            ed.tailShapeId = pc.shapeId
            ed.tailEdge = pc.edge
            patch.tailShapeId = pc.shapeId
            patch.tailEdge = pc.edge
        }
        updateComponentBulkPropertiesInLocalStore(pc.arrowId, patch)
    }

    // Pull a connector arrow out of a selection port. Mirrors the toolbar's
    // arrow-create flow (off-screen arrowLine in the store, then drive it via
    // SCENARIO_ARROW_DRAW), except the tail is pinned to the port's surface
    // anchor instead of the next mousedown's cursor, and the drag starts
    // immediately so the user only has to drop the head. The tail's binding
    // (tailShapeId/tailEdge) is recorded so it re-anchors when the shape moves.
    function startPortConnector(
        anchor: { x: number; y: number },
        tailShapeId: string | undefined,
        tailEdge: string
    ) {
        const arrowId = generateUUID()
        const userId = localStorage.getItem('userId')
        // Slot among the connectors already leaving this port — drives the fan
        // so this new tail doesn't bunch onto the existing ones.
        const tailPortIndex = countPortConnectors(tailShapeId, tailEdge)
        const arrowData = {
            id: arrowId,
            componentType: 'arrowLine',
            linewidth: defaultLinewidthValue,
            strokeType: defaultStrokeTypeValue,
            stroke: defaultStrokeColorValue ?? '#3A342C',
            children: {},
            x: -9999,
            y: -9999,
            x1: 0,
            x2: 0,
            y1: 0,
            y2: 0,
            baseId: props.baseId,
            baseName: null,
            radius: null,
            iconStroke: null,
            isDummy: null,
            createdAt: null,
            opacity: 1,
            metadata: {},
            width: 100,
            height: 0,
            fill: 'transparent',
            textColor: null,
            updatedBy: userId,
            // Connection binding — tail pinned to the source shape's edge port.
            tailShapeId: tailShapeId ?? null,
            tailEdge,
            tailPortIndex,
            headShapeId: null,
            headEdge: null,
        }
        addToLocalComponentStore(
            arrowId,
            'arrowLine',
            arrowData as unknown as ComponentRecord
        )

        // Remember the source so the radar won't glow this shape's own ports.
        arrowDrawTailShapeId = tailShapeId ?? null
        // Remember the port so each mousemove can re-fan the tail (direction
        // follows the head's quadrant; magnitude is this connector's slot).
        arrowDrawTailPort = {
            anchor: { x: anchor.x, y: anchor.y },
            edge: tailEdge,
            index: tailPortIndex,
        }
        // Fresh drag — no magnetic dock yet.
        pendingPortConnection = null

        // Drop the source shape's selection box so it doesn't linger over the
        // new connector while dragging.
        selectionController.detach()

        scenario = SCENARIO_ARROW_DRAW
        domElement.addEventListener('mousemove', mousemove, false)
        domElement.addEventListener('mouseup', mouseup, false)
        setRootCursor('crosshair')

        // The arrowLine React element mounts lazily — poll until it appears,
        // then pin the tail to the port anchor and collapse the head onto it so
        // the upcoming mousemove stretches it from the port.
        pollUntilElement(
            two,
            arrowId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (el: any) => {
                arrowDrawElement = el
                arrowDrawElement.position.x = anchor.x
                arrowDrawElement.position.y = anchor.y

                const line = arrowDrawElement.children[0]
                const pointCircle1Group = arrowDrawElement.children[1]
                const pointCircle2Group = arrowDrawElement.children[2]

                updateX1Y1Vertices(Two, line, 0, 0, pointCircle1Group, two)
                updateX2Y2Vertices(Two, line, 0, 0, pointCircle2Group, two)
                two.update()
            },
            { maxRetries: 30 }
        )
    }

    // Re-anchor every connector bound to `group`: recompute its tail (and/or
    // head) so the bound endpoint stays glued to the shape's edge port. Called
    // live during a shape drag so the connector follows in real time. The arrow
    // group's own position stays put — only the bound vertex moves, which keeps
    // the free endpoint fixed in surface space.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function reanchorArrowsForShape(group: any) {
        // Bound arrows only track their shape while connectors are enabled. When
        // off, existing bindings lie dormant (the arrow stays put) rather than
        // being stripped — flip the flag back on to resume gluing.
        if (!getConnectorsEnabled()) return
        // Perf-testing lever: skip the O(N) scene scan entirely (bound arrows
        // won't follow their shape while off).
        if (!getDragScansEnabled()) return
        const shapeId = group?.elementData?.id
        if (!shapeId) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        two.scene.children.forEach((child: any) => {
            if (child?.elementData?.componentType !== 'arrowLine') return
            const ed = child.elementData
            const line = child.children?.[0]
            if (!line) return
            if (ed.tailShapeId === shapeId && ed.tailEdge) {
                const p = getShapePortPoint(
                    group,
                    ed.tailEdge,
                    portGapSurface()
                )
                if (ed.tailPortIndex > 0) {
                    // Keep the fan offset (direction follows the bound head).
                    applyStackedEndpoint(
                        child,
                        line,
                        child.children[1],
                        ed.tailEdge,
                        p,
                        ed.tailPortIndex,
                        'tail'
                    )
                } else {
                    updateX1Y1Vertices(
                        Two,
                        line,
                        p.x - child.position.x,
                        p.y - child.position.y,
                        child.children[1],
                        two
                    )
                }
            }
            if (ed.headShapeId === shapeId && ed.headEdge) {
                const p = getShapePortPoint(
                    group,
                    ed.headEdge,
                    portGapSurface()
                )
                if (ed.headPortIndex > 0) {
                    // Keep the fan offset (direction follows the bound tail).
                    applyStackedEndpoint(
                        child,
                        line,
                        child.children[2],
                        ed.headEdge,
                        p,
                        ed.headPortIndex,
                        'head'
                    )
                } else {
                    updateX2Y2Vertices(
                        Two,
                        line,
                        p.x - child.position.x,
                        p.y - child.position.y,
                        child.children[2],
                        two
                    )
                }
            }
        })
    }

    // Does any connector currently dock onto this shape? Used to opt a shape out
    // of the CSS-transform move fast-path: a bound arrow must reshape every frame
    // to stay glued, which needs the shape's real position (not just a CSS
    // transform), so such shapes fall back to the legacy live-render drag. O(N)
    // scan, but run once at drag start — never per frame.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function shapeHasBoundArrows(group: any): boolean {
        // Perf-testing lever: skip the O(N) scan; every shape then reads as
        // unbound and stays eligible for the CSS move fast-path.
        if (!getDragScansEnabled()) return false
        const shapeId = group?.elementData?.id
        if (!shapeId) return false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return two.scene.children.some((child: any) => {
            const ed = child?.elementData
            if (ed?.componentType !== 'arrowLine') return false
            return ed.tailShapeId === shapeId || ed.headShapeId === shapeId
        })
    }

    // Persist the (already re-anchored) vertices of connectors bound to `group`
    // so the new tail/head survive a reload. Mirrors the arrow-draw commit:
    // prevX === position.x means the x,y branch is a no-op (the arrow group never
    // moves), and isLineCircle drives the x1/y1/x2/y2 write.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function persistBoundArrows(group: any) {
        if (!getConnectorsEnabled()) return
        const shapeId = group?.elementData?.id
        if (!shapeId) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        two.scene.children.forEach((child: any) => {
            if (child?.elementData?.componentType !== 'arrowLine') return
            const ed = child.elementData
            if (ed.tailShapeId !== shapeId && ed.headShapeId !== shapeId) return
            const line = child.children?.[0]
            if (!line) return
            updateToGlobalState(
                {
                    id: ed.id,
                    prevX: parseInt(child.position.x),
                    prevY: parseInt(child.position.y),
                    isLineCircle: true,
                    parentData: child,
                    data: {
                        x: parseInt(child.position.x),
                        y: parseInt(child.position.y),
                        x1: parseInt(line.vertices[0].x),
                        y1: parseInt(line.vertices[0].y),
                        x2: parseInt(line.vertices[1].x),
                        y2: parseInt(line.vertices[1].y),
                    },
                },
                {}
            )
        })
    }

    // After a connector endpoint settles on a port, re-sort EVERY endpoint
    // docked at that port (tails pulled out of it AND heads dropped onto it) so
    // their order matches their far endpoints' order: for side edges (e/w) by
    // the far end's y, for top/bottom edges (n/s) by its x. Without this the
    // slot index is frozen when the binding is made, so a later connector whose
    // far end lands between two earlier ones still stacks past them. The
    // endpoint whose far end is closest to the port-normal axis keeps the bare
    // port point (index 0); the rest fan out by side in far-end order.
    // Re-applies the fan and persists the new vertices + index so a reload
    // (local mode) keeps the layout.
    function restackPortConnectors(shapeId: string | undefined, edge: string) {
        if (!shapeId) return
        const group = two.scene.children.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => c?.elementData?.id === shapeId
        )
        if (!group) return
        const port = getShapePortPoint(group, edge, portGapSurface())
        const sideEdge = edge === 'e-resize' || edge === 'w-resize'
        const center = sideEdge ? port.y : port.x

        type Entry = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            child: any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            line: any
            endpoint: 'tail' | 'head'
            coord: number
            dist: number
        }
        const entries: Entry[] = []
        // Far endpoint vertex index for ordering: a tail bound here is ordered
        // by its head (vertex[1]); a head bound here by its tail (vertex[0]).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pushEntry = (
            child: any,
            line: any,
            endpoint: 'tail' | 'head'
        ) => {
            const farIdx = endpoint === 'tail' ? 1 : 0
            const coord = sideEdge
                ? child.position.y + line.vertices[farIdx].y
                : child.position.x + line.vertices[farIdx].x
            entries.push({
                child,
                line,
                endpoint,
                coord,
                dist: Math.abs(coord - center),
            })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        two.scene.children.forEach((child: any) => {
            const ed = child?.elementData
            if (ed?.componentType !== 'arrowLine') return
            const line = child.children?.[0]
            if (!line) return
            if (ed.tailShapeId === shapeId && ed.tailEdge === edge)
                pushEntry(child, line, 'tail')
            if (ed.headShapeId === shapeId && ed.headEdge === edge)
                pushEntry(child, line, 'head')
        })
        if (entries.length === 0) return

        // Closest-to-center first: the nearest takes the bare port (index 0),
        // the rest fan outward per side, increasing with distance — which keeps
        // endpoint order aligned with far-end order within each side.
        entries.sort((a, b) => a.dist - b.dist)
        let beforeCount = 0
        let afterCount = 0
        entries.forEach((entry, i) => {
            const index =
                i === 0
                    ? 0
                    : entry.coord < center
                      ? ++beforeCount
                      : ++afterCount
            const circle =
                entry.endpoint === 'tail'
                    ? entry.child.children[1]
                    : entry.child.children[2]
            if (entry.endpoint === 'tail')
                entry.child.elementData.tailPortIndex = index
            else entry.child.elementData.headPortIndex = index
            applyStackedEndpoint(
                entry.child,
                entry.line,
                circle,
                edge,
                port,
                index,
                entry.endpoint
            )
            const patch =
                entry.endpoint === 'tail'
                    ? {
                          x1: parseInt(entry.line.vertices[0].x),
                          y1: parseInt(entry.line.vertices[0].y),
                          tailPortIndex: index,
                      }
                    : {
                          x2: parseInt(entry.line.vertices[1].x),
                          y2: parseInt(entry.line.vertices[1].y),
                          headPortIndex: index,
                      }
            updateComponentBulkPropertiesInLocalStore(
                entry.child.elementData.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                patch as any,
                // Cosmetic re-layout — don't spawn an undo step per moved arrow.
                true
            )
        })
    }

    function mousedown(e: MouseEvent) {
        // Pan-mode (desktop): grab-and-drag translates the surface instead of
        // selecting/drawing. Runs before everything else so a click on a shape
        // pans rather than selecting it. Mirrors the single-finger touch pan.
        if (isPanMode()) {
            isMousePanning = true
            mousePanLastX = e.clientX
            mousePanLastY = e.clientY
            const root = document.getElementById('main-two-root')
            if (root) root.classList.add('panning')
            // Drag on window so a release outside the canvas still ends the pan
            // (and dragging keeps tracking past the canvas edge).
            window.addEventListener('mousemove', mousemove, false)
            window.addEventListener('mouseup', mouseup, false)
            return
        }

        // initialize shape definition
        const lastAddedElementId = localStorage.getItem(
            LAST_ADDED_ELEMENT_ID_KEY
        )

        // While a draw/placement tool is armed, a mousedown starts a NEW element —
        // it must never be reinterpreted as a resize of the current selection.
        // This matters now that finishing a draw auto-selects the element: drawing
        // a second shape next to the first would otherwise grab the first shape's
        // resize handle. Detach the lingering selection so its box doesn't hang
        // over the new draw (the new element auto-selects again on mouseup).
        const inCreateMode =
            isDrawing === true ||
            localStorage.getItem(ARROW_DRAW_MODE_KEY) === 'true' ||
            localStorage.getItem(TEXT_DRAW_MODE_KEY) === 'true' ||
            localStorage.getItem(GEO_POINT_PLACE_MODE_KEY) === 'true' ||
            localStorage.getItem(GEO_DRAW_MODE_KEY) === 'true' ||
            localStorage.getItem(PENDING_SHAPE_TYPE_KEY) !== null

        if (inCreateMode) {
            // Starting a new element clears any prior selection indicators so
            // only the just-drawn element ends up looking selected: the
            // controller box (shapes) and the endpoint circles of every arrow
            // (arrows aren't controller-managed, so detach() can't clear them).
            if (selectionController.currentGroup) selectionController.detach()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            two.scene.children.forEach((child: any) => {
                if (isLineLikeType(child?.elementData?.componentType)) {
                    setArrowEndpointsVisible(child, false)
                }
            })
        } else if (selectionController.currentGroup) {
            // Port check first: a click on a connection port pulls out a
            // connector arrow (tail pinned to the port) instead of selecting or
            // resizing. Ports sit outside the box, so they never overlap the
            // resize handles below.
            const portHit = selectionController.hitTestPort(
                e.clientX,
                e.clientY
            )
            if (portHit) {
                const sourceGroup = selectionController.currentGroup
                const tailShapeId = sourceGroup?.elementData?.id
                // Pin the tail to the floated selection port (edge + padding +
                // port gap) so the connector visually starts at the port dot.
                const anchor = getShapePortPoint(
                    sourceGroup,
                    portHit.edge,
                    portGapSurface()
                )
                startPortConnector(anchor, tailShapeId, portHit.edge)
                return
            }
            // Controller handle check — runs before the bare-canvas clearSelector
            // dispatch and the DOM path walk. Corner handles can extend slightly
            // beyond the element's SVG bounds, so relying on path-walking would
            // miss clicks that land in the handle's radius but outside the shape.
            const hit = selectionController.hitTest(e.clientX, e.clientY)
            if (hit) {
                selectionController.beginInteraction(e, hit)
                return
            }
        }

        if (
            (e?.srcElement as Element & { lastChild?: Element })?.lastChild
                ?.id === 'two-0'
        ) {
            let evt = new CustomEvent('clearSelector', {})
            window.dispatchEvent(evt)
            // clearSelector only detaches the visual selector; the React
            // selectedComponent stays set, which keeps the point tooltip
            // pinned. Clear it too so the tooltip dismisses immediately when
            // the user clicks bare canvas.
            setSelectedComponentInBase(null)
        }

        // Reset scenario to prevent stale state from a previous interaction
        // (e.g. mouse released outside the canvas during a draw)
        scenario = SCENARIO_DEFAULT

        // Clean up orphaned draw state from an interrupted drag
        // (e.g. user moved cursor outside canvas and released mouse there)
        if (drawPreviewActive) {
            removeDrawPreview()
            drawPreviewActive = false
        }
        // Defensive: a prior move-drag whose mouseup was missed (released off
        // canvas) would leave a stale CSS transform — clear it before a new one.
        if (cssMoveActive) clearCssMove()
        // Reset the fast-path decision for the new gesture (a rejected drag never
        // runs clearCssMove, so its flag would otherwise leak into the next one).
        cssMoveRejected = false
        if (drawOrigin) {
            drawOrigin = null
            drawCurrentCoords = null
            drawShapeType = null
            drawShapeProps = null
            domElement.removeEventListener('mousemove', mousemove, false)
            domElement.removeEventListener('mouseup', mouseup, false)
        }

        if (isDrawing === true) {
            scenario = SCENARIO_PENCIL_MODE
        }

        const arrowDrawMode = localStorage.getItem(ARROW_DRAW_MODE_KEY)
        const textDrawMode = localStorage.getItem(TEXT_DRAW_MODE_KEY)
        const pendingShapeType = localStorage.getItem(PENDING_SHAPE_TYPE_KEY)
        const rubberMode = localStorage.getItem(RUBBER_MODE_KEY)
        const geoPointPlaceMode = localStorage.getItem(GEO_POINT_PLACE_MODE_KEY)
        const geoDrawMode = localStorage.getItem(GEO_DRAW_MODE_KEY)
        if (rubberMode === 'true') {
            scenario = SCENARIO_RUBBER_MODE
        } else if (arrowDrawMode === 'true') {
            scenario = SCENARIO_ARROW_DRAW
        } else if (textDrawMode === 'true') {
            scenario = SCENARIO_TEXT_DRAW
        } else if (geoPointPlaceMode === 'true') {
            // checked before JUST_ADDED_ELEMENT: point place also sets
            // LAST_ADDED_ELEMENT_ID_KEY (the pre-created point).
            scenario = SCENARIO_GEO_POINT
        } else if (geoDrawMode === 'true') {
            scenario = SCENARIO_GEO_DRAW
        } else if (pendingShapeType !== null) {
            scenario = SCENARIO_DRAW_SHAPE
        } else if (lastAddedElementId !== null) {
            scenario = SCENARIO_JUST_ADDED_ELEMENT
        }

        switch (scenario) {
            case SCENARIO_ARROW_DRAW: {
                const surfaceCoords = toSurface(e)
                const arrowId = localStorage.getItem(LAST_ADDED_ELEMENT_ID_KEY)

                localStorage.removeItem(LAST_ADDED_ELEMENT_ID_KEY)
                localStorage.removeItem(ARROW_DRAW_MODE_KEY)

                domElement.addEventListener('mousemove', mousemove, false)
                domElement.addEventListener('mouseup', mouseup, false)

                setRootCursor('crosshair')

                // On first use the arrowLine module loads lazily — poll until the
                // React element appears in the scene before positioning it.
                // mousemove/mouseup already guard on arrowDrawElement being non-null,
                // so they are safe no-ops until this resolves.
                pollUntilElement(
                    two,
                    arrowId ?? '',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (el: any) => {
                        arrowDrawElement = el
                        arrowDrawElement.position.x = surfaceCoords.x
                        arrowDrawElement.position.y = surfaceCoords.y

                        const line = arrowDrawElement.children[0]
                        const pointCircle1Group = arrowDrawElement.children[1]
                        const pointCircle2Group = arrowDrawElement.children[2]

                        updateX1Y1Vertices(
                            Two,
                            line,
                            0,
                            0,
                            pointCircle1Group,
                            two
                        )
                        updateX2Y2Vertices(
                            Two,
                            line,
                            0,
                            0,
                            pointCircle2Group,
                            two
                        )
                        two.update()
                    },
                    { maxRetries: 30 }
                )

                break
            }
            case SCENARIO_TEXT_DRAW: {
                const surfaceCoords = toSurface(e)
                const textId = localStorage.getItem(LAST_ADDED_ELEMENT_ID_KEY)

                textDrawElement = two.scene.children.find(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (child: any) => child?.elementData?.id === textId
                )

                if (textDrawElement && textId) {
                    // Position the text at the clicked point
                    textDrawElement.position.x = surfaceCoords.x
                    textDrawElement.position.y = surfaceCoords.y
                    two.update()

                    // Update the component position in the store
                    updateComponentVertices(
                        textId,
                        surfaceCoords.x,
                        surfaceCoords.y
                    )
                }

                localStorage.removeItem(LAST_ADDED_ELEMENT_ID_KEY)
                localStorage.removeItem(TEXT_DRAW_MODE_KEY)

                domElement.addEventListener('mouseup', mouseup, false)
                setRootCursor('auto')
                break
            }
            case SCENARIO_GEO_POINT: {
                const surfaceCoords = toSurface(e)
                const pointId = localStorage.getItem(LAST_ADDED_ELEMENT_ID_KEY)

                localStorage.removeItem(LAST_ADDED_ELEMENT_ID_KEY)
                localStorage.removeItem(GEO_POINT_PLACE_MODE_KEY)

                // The point module loads lazily on first use — poll until the
                // pre-created element appears, then drop it at the click point.
                if (pointId) {
                    pollUntilElement(
                        two,
                        pointId,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (el: any) => {
                            el.position.x = surfaceCoords.x
                            el.position.y = surfaceCoords.y
                            two.update()
                            updateComponentVertices(
                                pointId,
                                surfaceCoords.x,
                                surfaceCoords.y
                            )
                            // A point is a circle plus a name, so placing one
                            // opens its label editor straight away — the same
                            // event the text tools use, answered by point.tsx.
                            window.dispatchEvent(
                                new CustomEvent('triggerTextInput', {
                                    detail: { elementId: pointId },
                                })
                            )
                        },
                        { maxRetries: 30 }
                    )
                }

                setSelectedComponentInBase(null)
                setPointerElement('pointer', { select: true })
                setRootCursor('auto')
                break
            }
            case SCENARIO_GEO_DRAW: {
                const surfaceCoords = toSurface(e)
                // First click of this draw — capture type/props from storage.
                if (!geoDrawType) {
                    geoDrawType = localStorage.getItem(GEO_DRAW_TYPE_KEY) as
                        'area' | 'route' | 'curvedLine' | null
                    geoDrawProps = JSON.parse(
                        localStorage.getItem(GEO_DRAW_PROPS_KEY) ?? 'null'
                    )
                    geoVertices = []
                    domElement.addEventListener('mousemove', mousemove, false)
                }
                if (geoDrawType) {
                    addGeoVertex(surfaceCoords.x, surfaceCoords.y)
                    setRootCursor('crosshair')
                }
                break
            }
            case SCENARIO_DRAW_SHAPE: {
                const surfaceCoords = toSurface(e)
                drawOrigin = { x: surfaceCoords.x, y: surfaceCoords.y }
                drawCurrentCoords = { x: surfaceCoords.x, y: surfaceCoords.y }
                drawShapeType = localStorage.getItem(PENDING_SHAPE_TYPE_KEY)
                drawShapeProps = JSON.parse(
                    localStorage.getItem(PENDING_SHAPE_PROPS_KEY) ?? 'null'
                )

                localStorage.removeItem(PENDING_SHAPE_TYPE_KEY)
                localStorage.removeItem(PENDING_SHAPE_PROPS_KEY)

                // Preview lives on a DOM overlay, positioned in client coords —
                // it never enters the scene, so the drag never repaints the SVG.
                if (
                    drawShapeType === 'circle' ||
                    drawShapeType === 'rectangle' ||
                    drawShapeType === 'diamond'
                ) {
                    drawScreenOriginX = e.clientX
                    drawScreenOriginY = e.clientY
                    drawPreviewActive = true
                    createDrawPreview(drawShapeType as DrawPreviewKind, {
                        fill: drawShapeProps?.fill || '#fff',
                        stroke: drawShapeProps?.stroke || SHAPE_DEFAULT_STROKE,
                        linewidth: drawShapeProps?.linewidth || 1,
                        opacity: DEFAULT_PREVIEW_OPACITY,
                    })
                    updateDrawPreview(
                        e.clientX,
                        e.clientY,
                        e.clientX,
                        e.clientY
                    )
                }

                domElement.addEventListener('mousemove', mousemove, false)
                domElement.addEventListener('mouseup', mouseup, false)
                setRootCursor('crosshair')
                break
            }
            case SCENARIO_JUST_ADDED_ELEMENT:
                domElement.addEventListener('mousemove', mousemove, false)

                // This block falls for the case when there is newly added element and we let user click
                // anywhere to set last added element's position
                const surfaceCoords = toSurface(e)

                let twoJSElement = two.scene.children.find(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (child: any) =>
                        child?.elementData?.id === lastAddedElementId
                )

                if (twoJSElement?.position && lastAddedElementId) {
                    twoJSElement.position.x = surfaceCoords.x
                    twoJSElement.position.y = surfaceCoords.y

                    two.update()

                    updateComponentVertices(
                        lastAddedElementId,
                        surfaceCoords.x,
                        surfaceCoords.y
                    )

                    lastPlacedElement = twoJSElement
                }

                localStorage.removeItem(LAST_ADDED_ELEMENT_ID_KEY)

                // remove event listeners for mousemove
                // domElement.removeEventListener('mousemove', mousemove, false)

                domElement.addEventListener('mousemove', mousemove, false)
                domElement.addEventListener('mouseup', mouseup, false)

                setRootCursor('auto')
                break
            case SCENARIO_PENCIL_MODE: {
                domElement.addEventListener('mousemove', mousemove, false)
                domElement.addEventListener('mouseup', mouseup, false)

                // Stroke is now mid-flight — block undo/redo until mouseup
                // commits it (see isPencilStrokeActive declaration).
                isPencilStrokeActive = true

                // Single growing curved path for live preview — matches the
                // final factory render so there's no visual jump on mouseup.
                pencilGroup = two.makeGroup()
                pencilRawPoints = []
                lastPencilLinewidth = defaultLinewidthValue

                const startCoords = toSurface(e)
                lastPencilPoint = { x: startCoords.x, y: startCoords.y }
                lastPencilTime = performance.now()
                pencilRawPoints.push({
                    x: startCoords.x,
                    y: startCoords.y,
                    lw: lastPencilLinewidth,
                })

                // Note: two.makePath only treats numeric (x, y) pair args as
                // vertices. Passing a Two.Anchor here would be silently dropped,
                // leaving the path empty and missing the mousedown start point.
                pencilPath = two.makePath()
                pencilPath.vertices.push(
                    new Two.Anchor(startCoords.x, startCoords.y)
                )
                pencilPath.noFill()
                pencilPath.stroke = defaultStrokeColorValue
                pencilPath.linewidth = pencilPreviewLinewidth()
                pencilPath.cap = 'round'
                pencilPath.join = 'round'
                pencilPath.closed = false
                pencilGroup.add(pencilPath)
                break
            }
            case SCENARIO_RUBBER_MODE: {
                domElement.addEventListener('mousemove', mousemove, false)
                domElement.addEventListener('mouseup', mouseup, false)
                eraseElementAtPoint(e.clientX, e.clientY)
                {
                    const p = toSurface(e)
                    eraserTrail.addPoint(p.x, p.y)
                }
                break
            }
            default:
                shape = null
                mouse.x = e.clientX
                mouse.y = e.clientY
                let avoidDragging = false
                let isGroupSelector = false

                // Snapshot before clearing — used below to select arrow by endpoint click
                const hoveredEndpointGroup = lastHoveredCircleGroup

                // Hide all arrow/line endpoint circles and hover indicator before
                // processing the new selection. Includes plain lines (mobile has
                // no blur to hide them, so this next-tap sweep does it) — the
                // clicked line re-reveals its own via setArrowEndpointsVisible.
                lastHoveredCircleGroup = null
                hoverCircle.opacity = 0
                two.scene.children.forEach((child: any) => {
                    if (isLineLikeType(child?.elementData?.componentType)) {
                        setArrowEndpointsVisible(child, false)
                    }
                })

                const path =
                    (e as MouseEvent & { path?: EventTarget[] }).path ||
                    (e.composedPath && e.composedPath())
                ;({ shape, avoidDragging } = resolveShapeFromPath(path, two))

                // Endpoint circles are opacity:0 so pointer-events don't fire on them.
                // If the cursor was hovering over an endpoint (hoverCircle was visible),
                // use that to select the parent arrow — only in select/pan mode.
                if (shape === null && hoveredEndpointGroup) {
                    const parentArrow = two.scene.children.find(
                        (child: any) =>
                            isLineLikeType(child?.elementData?.componentType) &&
                            (child.children[1] === hoveredEndpointGroup ||
                                child.children[2] === hoveredEndpointGroup)
                    )
                    if (parentArrow) {
                        setArrowEndpointsVisible(parentArrow, true)
                        shape = parentArrow
                    }
                }

                // Track for copy BEFORE drag-prevention clears shape (pencil uses
                // avoid-dragging so shape would become {} immediately after).
                if (shape?.elementData?.id) {
                    lastSelectedShape = shape
                }

                if (avoidDragging) {
                    shape = {}
                }

                if (shape === null) {
                    // Clicking empty canvas clears any active selection.
                    //
                    // All three of these, because "selected" is drawn by three
                    // different owners: the controller's box (shapes), the
                    // element-owned chrome that answers `clearSelector`
                    // (geoText, point), and the React `selectedComponent` that
                    // drives the properties toolbar AND area/route's vertex
                    // handles. Only the first was cleared here; the other two
                    // relied on the `lastChild?.id === 'two-0'` test further up,
                    // which only matches when the press lands on the wrapper div
                    // rather than the SVG or the map canvas underneath — so a
                    // click on empty canvas deselected an area or a route only
                    // sometimes, and the user had to click again (and again) to
                    // find a spot that did. This branch is the reliable one: it
                    // runs precisely when the hit test found no element.
                    lastSelectedShape = null
                    selectionController.detach()
                    window.dispatchEvent(new CustomEvent('clearSelector', {}))
                    setSelectedComponentInBase(null)
                    // When a text input overlay is active (about to blur),
                    // the click is just dismissing the input — skip the
                    // pending-selector setup so no rect is ever materialised.
                    const activeTextInput =
                        document.querySelector('.temp-input-area')

                    if (activeTextInput) {
                        shape = {}
                        avoidDragging = true
                    } else {
                        // Defer rect creation to the first mousemove. We
                        // still need mousemove/mouseup wired up below so
                        // the next mousemove can materialise the selector.
                        pendingGroupSelectorOrigin = toSurface(e)
                        mouse.copy(pendingGroupSelectorOrigin)
                        domElement.addEventListener(
                            'mousemove',
                            mousemove,
                            false
                        )
                        domElement.addEventListener('mouseup', mouseup, false)
                        return
                    }
                }

                // Central selection controller: for shapes registered in its
                // adapter registry, the controller owns selection lifecycle
                // (toolbar open/close) and replaces per-element interactjs
                // resize. If the pointer landed on a resize/rotate handle,
                // the controller claims this gesture and we skip the legacy
                // drag + toolbar wiring below.
                let controllerClaimedGesture = false
                let controllerHandledSelection = false
                if (
                    !avoidDragging &&
                    shape &&
                    !isGroupSelector &&
                    selectionController.canHandle(shape)
                ) {
                    selectionController.attach(shape, shape.children[0])
                    controllerHandledSelection = true
                    const hit = selectionController.hitTest(
                        e.clientX,
                        e.clientY
                    )
                    if (hit) {
                        selectionController.beginInteraction(e, hit)
                        controllerClaimedGesture = true
                    }
                }

                if (controllerClaimedGesture) {
                    two.update()
                    return
                }

                // inserting prevX and prevY to diff at updateToGlobalState function
                // checking if new x,y are not equal to prev x,y
                // then only perform the mutation
                if (!avoidDragging) {
                    shape.elementData = {
                        ...shape?.elementData,
                        isGroupSelector: isGroupSelector,
                        prevX: parseInt(shape.translation.x),
                        prevY: parseInt(shape.translation.y),
                    }

                    const shapeEl = document.getElementById(shape.id)
                    if (shapeEl) {
                        const rect = shapeEl.getBoundingClientRect()
                        dragging =
                            mouse.x > rect.left &&
                            mouse.x < rect.right &&
                            mouse.y > rect.top &&
                            mouse.y < rect.bottom

                        domElement.addEventListener(
                            'mousemove',
                            mousemove,
                            false
                        )
                        domElement.addEventListener('mouseup', mouseup, false)
                    }
                }

                // When an arrow or its endpoint circle is selected, disable pointer
                // events on all other components so interactjs resize handlers on
                // shapes like rectangle don't capture events during arrow drag
                if (
                    !avoidDragging &&
                    (shape?.elementData?.isLineCircle ||
                        isLineLikeType(shape?.elementData?.componentType))
                ) {
                    document
                        .querySelectorAll<HTMLElement>(
                            '.dragger-picker:not(.is-line-circle)'
                        )
                        .forEach((el) => {
                            el.style.pointerEvents = 'none'
                        })
                }

                if (
                    !avoidDragging &&
                    !shape.elementData.isGroupSelector &&
                    !controllerHandledSelection
                ) {
                    selectionController.detach()
                    // this internal state is required for floating toolbar component since floating
                    // toolbar relies on the exact structure/schema for component's internal state
                    // so that any changes made from toolbar can be applied directly on component's two.js properties

                    // For arrow endpoint circle clicks, resolve to the parent arrow group and
                    // the actual line shape so the toolbar has the correct id and target element
                    const isLineCircle =
                        shape?.elementData?.isLineCircle === true
                    const groupForToolbar = isLineCircle
                        ? shape.elementData.parentData
                        : shape
                    const shapeForToolbar = isLineCircle
                        ? shape.elementData.lineData
                        : shape.children[0]

                    // Keep a selected arrow's endpoint handles visible. The
                    // mousedown above hides ALL endpoints (line ~1632); the
                    // pull-out auto-select and the hover fallback re-show them,
                    // but a plain body-click never did — leaving the handles
                    // at opacity 0. Since opacity-0 circles don't fire pointer
                    // events, a follow-up grab of an endpoint would miss the
                    // circle, fall through to the null→parent-arrow fallback,
                    // and become a whole-arrow BODY drag — which detaches the
                    // arrow's port bindings. Re-showing them here keeps the next
                    // endpoint grab an endpoint drag, so bindings survive.
                    if (
                        isLineLikeType(
                            groupForToolbar?.elementData?.componentType
                        )
                    ) {
                        setArrowEndpointsVisible(groupForToolbar, true)
                    }

                    // First line node of the text layer (or a legacy direct
                    // text child) — gives the toolbar a representative text
                    // node for shape-with-text enablement.
                    const textChild = getShapeTextNodes(groupForToolbar)[0]

                    let componentInternalState = {
                        element: {
                            [shapeForToolbar.id]: shapeForToolbar,
                            [groupForToolbar.id]: groupForToolbar,
                        },
                        group: {
                            id: groupForToolbar.id,
                            data: groupForToolbar,
                        },
                        shape: {
                            type: groupForToolbar.elementData.componentType,
                            id: shapeForToolbar.id,
                            data: shapeForToolbar,
                        },
                        text: {
                            data: textChild || {},
                        },
                        icon: {
                            data: {},
                        },
                    }
                    setSelectedComponentInBase(componentInternalState)
                }

                two.update()
        }
    }

    function mousemove(e: MouseEvent) {
        // Set when this frame moved a selected element via CSS transform (no
        // scene render) — used to skip the full-scene two.update() at the end.
        let didCssMove = false
        // Pan-mode (desktop): translate the surface by the per-frame mouse
        // delta. Mirrors the single-finger touch pan in touchmove.
        if (isMousePanning) {
            const dx = e.clientX - mousePanLastX
            const dy = e.clientY - mousePanLastY
            mousePanLastX = e.clientX
            mousePanLastY = e.clientY
            if (dx !== 0 || dy !== 0) {
                zui.translateSurface(dx, dy)
                cullOnCameraChange()
                // Batched, NOT a direct two.update(): pointers fire well above
                // the paint rate (120Hz+ trackpads), so a synchronous render
                // here means 2x the full O(scene) renders the display can even
                // show. scheduleRender coalesces the burst into one per frame.
                scheduleRender(two)
                syncBackgroundToCamera()
                onCameraChangeRef?.current?.({
                    scale: two.scene.scale,
                    tx: two.scene.translation.x,
                    ty: two.scene.translation.y,
                })
            }
            return
        }

        // Multi-click geo draw: rubber-band the preview line to the cursor.
        if (geoDrawType) {
            const s = toSurface(e)
            updateGeoPreview(s.x, s.y)
            return
        }

        const lastAddedElementId = localStorage.getItem(
            LAST_ADDED_ELEMENT_ID_KEY
        )

        if (
            lastAddedElementId !== null &&
            localStorage.getItem(ARROW_DRAW_MODE_KEY) !== 'true' &&
            localStorage.getItem(TEXT_DRAW_MODE_KEY) !== 'true'
        ) {
            scenario = SCENARIO_JUST_ADDED_ELEMENT
        }

        switch (scenario) {
            case SCENARIO_ARROW_DRAW:
                if (arrowDrawElement) {
                    const surfaceCoords = toSurface(e)
                    let relX = surfaceCoords.x - arrowDrawElement.position.x
                    let relY = surfaceCoords.y - arrowDrawElement.position.y

                    if (e.shiftKey) {
                        if (Math.abs(relY) < Math.abs(relX)) {
                            relY = 0
                        } else {
                            relX = 0
                        }
                    }

                    const line = arrowDrawElement.children[0]
                    const pointCircle2Group = arrowDrawElement.children[2]

                    updateX2Y2Vertices(
                        Two,
                        line,
                        relX,
                        relY,
                        pointCircle2Group,
                        two
                    )

                    // Fan the tail off the port so stacked connectors don't
                    // overlap — direction follows the quadrant the head is in.
                    if (arrowDrawTailPort && arrowDrawTailPort.index > 0) {
                        applyStackedEndpoint(
                            arrowDrawElement,
                            line,
                            arrowDrawElement.children[1],
                            arrowDrawTailPort.edge,
                            arrowDrawTailPort.anchor,
                            arrowDrawTailPort.index,
                            'tail'
                        )
                    }

                    // Radar sweep + magnetic snap for the head being pulled out.
                    // Plain lines (noArrowhead) never dock to ports — skip the
                    // radar so they don't snap onto nearby shapes.
                    if (line?.noArrowhead !== true) {
                        updatePortRadar(
                            {
                                x: arrowDrawElement.position.x + relX,
                                y: arrowDrawElement.position.y + relY,
                            },
                            {
                                arrowGroup: arrowDrawElement,
                                line,
                                circle: pointCircle2Group,
                                endpoint: 'head',
                            }
                        )
                    }
                }
                break
            case SCENARIO_DRAW_SHAPE: {
                const surfaceCoordsMove = toSurface(e)
                drawCurrentCoords = {
                    x: surfaceCoordsMove.x,
                    y: surfaceCoordsMove.y,
                }

                // Grow the DOM overlay from client coords — O(1), no two.update(),
                // so the scene SVG is never touched during the drag.
                if (drawPreviewActive) {
                    updateDrawPreview(
                        drawScreenOriginX,
                        drawScreenOriginY,
                        e.clientX,
                        e.clientY
                    )
                }
                break
            }
            case SCENARIO_JUST_ADDED_ELEMENT: {
                // This block falls for the case when there is newly added element and we let user click
                // anywhere to set last added element's position
                const sc = toSurface(e)

                let twoJSElement = two.scene.children.find(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (child: any) =>
                        child?.elementData?.id === lastAddedElementId
                )

                if (twoJSElement?.position) {
                    twoJSElement.position.x = sc.x
                    twoJSElement.position.y = sc.y

                    two.update()
                }
                break
            }
            case SCENARIO_PENCIL_MODE: {
                const pencilCoords = toSurface(e)

                // Distance throttle: skip if too close to last point
                const pdx = pencilCoords.x - lastPencilPoint.x
                const pdy = pencilCoords.y - lastPencilPoint.y
                const pDist = Math.sqrt(pdx * pdx + pdy * pdy)
                if (pDist < PENCIL_DISTANCE_THROTTLE) break

                // Compute velocity and map to linewidth
                const now = performance.now()
                const timeDelta = now - lastPencilTime
                const velocity = timeDelta > 0 ? pDist / timeDelta : 0
                const targetLw = velocityToLinewidth(
                    velocity,
                    defaultLinewidthValue
                )
                const smoothedLw = smoothLinewidth(
                    lastPencilLinewidth ?? defaultLinewidthValue,
                    targetLw,
                    0.3
                )

                // Record point with linewidth (kept for future variable-width work)
                pencilRawPoints.push({
                    x: pencilCoords.x,
                    y: pencilCoords.y,
                    lw: smoothedLw,
                })

                // Rebuild the preview path from the smoothed raw points so the
                // live stroke matches the final factory render exactly.
                if (pencilPath) {
                    const smoothedPreview =
                        pencilRawPoints.length > 2
                            ? chaikinSmooth(pencilRawPoints, 2)
                            : pencilRawPoints
                    pencilPath.vertices.splice(0)
                    smoothedPreview.forEach((pt) => {
                        pencilPath.vertices.push(new Two.Anchor(pt.x, pt.y))
                    })
                }

                lastPencilPoint = { x: pencilCoords.x, y: pencilCoords.y }
                lastPencilTime = now
                lastPencilLinewidth = smoothedLw

                two.update()
                break
            }
            case SCENARIO_RUBBER_MODE: {
                eraseElementAtPoint(e.clientX, e.clientY)
                const p = toSurface(e)
                eraserTrail.addPoint(p.x, p.y)
                break
            }
            default:
                /**
                    Currently "resize" event handling is at component level.
                    Once I shift that handling to this one main component,
                    I'll remove this first if condition block
                */

                // Empty-canvas mousedown deferred selector creation here.
                // First mousemove materialises the dotted rect at the
                // original mousedown position so it grows with the cursor.
                if (pendingGroupSelectorOrigin && !shape?.elementData) {
                    const area = two.makePath(0, 0, 10, 0, 10, 10, 0, 10)
                    area.fill = getGroupFill()
                    area.opacity = 1
                    area.linewidth = 1
                    area.dashes[0] = 4
                    area.stroke = SELECTION_PREVIEW_STROKE
                    const newSelectorGroup = two.makeGroup(area)
                    newSelectorGroup.position.copy(pendingGroupSelectorOrigin)
                    shape = newSelectorGroup
                    shape.elementData = {
                        isGroupSelector: true,
                        prevX: parseInt(shape.translation.x),
                        prevY: parseInt(shape.translation.y),
                    }
                    dragging = true
                    pendingGroupSelectorOrigin = null
                    two.update()
                }

                if (isResizeEvent === true) {
                    domElement.removeEventListener(
                        'mousemove',
                        mousemove,
                        false
                    )
                    domElement.removeEventListener('mouseup', mouseup, false)
                    isResizeEvent = false
                } else if (
                    shape?.id &&
                    document
                        .getElementById(shape.id)
                        ?.hasAttribute('data-resize')
                ) {
                    // element resize is being performed
                    isResizeEvent = true
                    domElement.removeEventListener(
                        'mousemove',
                        mousemove,
                        false
                    )
                    domElement.removeEventListener('mouseup', mouseup, false)
                } else if (shape?.id || shape?.elementData) {
                    let dx = e.clientX - mouse.x
                    let dy = e.clientY - mouse.y

                    // check if while dragging, the shape does not point to root element (two-0)
                    if (
                        dragging &&
                        shape.id !== 'two-0' &&
                        !shape.elementData.isGroupSelector
                    ) {
                        // code block condition to handle arrow line circle component's dragging
                        // it roughly translates -> does shape === line/arrow line ?
                        if (shape?.lineData) {
                            let line = shape?.lineData

                            if (shape.direction === 'left') {
                                if (e.shiftKey == true) {
                                    let x1 = (line.vertices[0].x +=
                                        dx / zui.scale)
                                    let y1 = (line.vertices[0].y +=
                                        dy / zui.scale)
                                    updateX1Y1Vertices(
                                        Two,
                                        line,
                                        x1,
                                        y1,
                                        shape,
                                        two
                                    )

                                    /* update x2,y2 vertices acc. to shift key press event */
                                    let x2 = line.vertices[1].x
                                    let y2 = y1
                                    updateX2Y2Vertices(
                                        Two,
                                        line,
                                        x2,
                                        y2,
                                        shape.siblingCircle,
                                        two
                                    )
                                } else {
                                    let x1 = (line.vertices[0].x +=
                                        dx / zui.scale)
                                    let y1 = (line.vertices[0].y +=
                                        dy / zui.scale)
                                    updateX1Y1Vertices(
                                        Two,
                                        line,
                                        x1,
                                        y1,
                                        shape,
                                        two
                                    )
                                }
                            } else if (shape.direction === 'right') {
                                if (e.shiftKey === true) {
                                    let x2 = (line.vertices[1].x +=
                                        dx / zui.scale)
                                    let y2 = (line.vertices[1].y +=
                                        dy / zui.scale)
                                    updateX2Y2Vertices(
                                        Two,
                                        line,
                                        x2,
                                        y2,
                                        shape,
                                        two
                                    )

                                    /* update x1,y1 vertices acc. to shift key press event */
                                    let x1 = line.vertices[0].x
                                    let y1 = y2
                                    updateX1Y1Vertices(
                                        Two,
                                        line,
                                        x1,
                                        y1,
                                        shape.siblingCircle,
                                        two
                                    )
                                } else {
                                    let x2 = (line.vertices[1].x +=
                                        dx / zui.scale)
                                    let y2 = (line.vertices[1].y +=
                                        dy / zui.scale)
                                    updateX2Y2Vertices(
                                        Two,
                                        line,
                                        x2,
                                        y2,
                                        shape,
                                        two
                                    )
                                }
                            }

                            // Radar + magnetic snap for the endpoint being
                            // re-dragged (tail or head, per `direction`). Works
                            // every time, not just at creation. No source
                            // exclusion here — an existing arrow's end may dock
                            // onto any shape in range.
                            updatePortRadar(
                                toSurface(e),
                                {
                                    arrowGroup: shape.lineData?.parent,
                                    line: shape.lineData,
                                    circle: shape,
                                    endpoint:
                                        shape.direction === 'left'
                                            ? 'tail'
                                            : 'head',
                                },
                                null
                            )
                        }
                        // code block condition to handle normal component's dragging
                        else {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const node = (shape as any)._renderer?.elem as
                                SVGGraphicsElement | undefined
                            // CSS-transform move: eligible for non-rotated
                            // elements, including the group overlay — its member
                            // copies and selector chrome live inside its own SVG
                            // node, so one transform moves them all; the mouseup
                            // commit below writes the real translation before
                            // groupobject's window-mouseup commitGroupMove reads
                            // it (domElement listeners fire first in the bubble).
                            // Rotated shapes keep the legacy path.
                            const cheapEligible = !!node && !shape.rotation
                            // Decide CSS-vs-legacy ONCE per drag. A shape with
                            // bound connectors must reshape its arrows every
                            // frame (needs its real position), so it takes the
                            // legacy live-render path. The bound-arrow scan is
                            // O(N) but runs only on this first-frame decision,
                            // and only when connectors are on.
                            if (
                                cheapEligible &&
                                !cssMoveActive &&
                                !cssMoveRejected
                            ) {
                                if (
                                    getConnectorsEnabled() &&
                                    shapeHasBoundArrows(shape)
                                ) {
                                    cssMoveRejected = true
                                }
                            }
                            const eligible = cheapEligible && !cssMoveRejected
                            if (eligible) {
                                if (!cssMoveActive) {
                                    cssMoveActive = true
                                    cssMoveEl = shape
                                    cssMoveNode = node!
                                    cssMoveBaseX = shape.position.x
                                    cssMoveBaseY = shape.position.y
                                    cssMoveLastDxWorld = 0
                                    cssMoveLastDyWorld = 0
                                    // Deliberately no `will-change`: promoting
                                    // an SVG node to its own layer is half of
                                    // the mobile disappearing-while-dragged bug
                                    // (see cssMoveTransform), and the win here
                                    // was never the layer — it is skipping the
                                    // full-scene two.update() each frame.
                                    // Move the selection box in lockstep so it
                                    // stays glued to the element during the drag.
                                    cssMoveChrome =
                                        selectionController.getChromeDragHandle(
                                            shape
                                        )
                                }
                                cssMoveLastDxWorld += dx / zui.scale
                                cssMoveLastDyWorld += dy / zui.scale
                                // Read `scale` fresh each frame rather than
                                // caching it at drag start, so a zoom landing
                                // mid-drag (which re-counter-scales the element)
                                // is picked up on the next move.
                                cssMoveNode!.setAttribute(
                                    'transform',
                                    cssMoveTransform(
                                        cssMoveBaseX + cssMoveLastDxWorld,
                                        cssMoveBaseY + cssMoveLastDyWorld,
                                        shape.scale
                                    )
                                )
                                if (cssMoveChrome) {
                                    // The selection chrome is never scaled (it
                                    // sizes itself in screen px), so this stays
                                    // a pure translate.
                                    cssMoveChrome.node.setAttribute(
                                        'transform',
                                        cssMoveTransform(
                                            cssMoveChrome.baseX +
                                                cssMoveLastDxWorld,
                                            cssMoveChrome.baseY +
                                                cssMoveLastDyWorld
                                        )
                                    )
                                }
                                didCssMove = true
                            } else {
                                shape.position.x += dx / zui.scale
                                shape.position.y += dy / zui.scale
                                // Drag any connector tails/heads pinned to this
                                // shape's ports along with it.
                                reanchorArrowsForShape(shape)
                            }
                        }
                    } else if (shape.elementData.isGroupSelector) {
                        // this blocks falls for the case when user has clicked and
                        // is dragging to create a group selector
                        let area = shape.children[0]
                        const m = toSurface(e)
                        mouse.copy(m)

                        const width = mouse.x - shape.position.x
                        const height = mouse.y - shape.position.y

                        area.vertices[1].x = width
                        area.vertices[2].x = width
                        area.vertices[2].y = height
                        area.vertices[3].y = height

                        two.update()
                    }
                    mouse.set(e.clientX, e.clientY)
                    // A CSS-transform move-drag repaints nothing in the scene, so
                    // skip the full-scene render this frame — that's the whole win.
                    if (!didCssMove) two.update()
                }
        }
    }

    function mouseup(e: MouseEvent) {
        // Commit a CSS-transform move-drag: write the accumulated delta into the
        // element's real Two.js position, clear the live CSS transforms, then let
        // the normal move/persist/history path below run (it reads the committed
        // translation, sees the move, and persists + records it as usual).
        if (cssMoveActive) {
            const el = cssMoveEl
            const finalX = cssMoveBaseX + cssMoveLastDxWorld
            const finalY = cssMoveBaseY + cssMoveLastDyWorld
            clearCssMove()
            if (el) {
                el.position.x = finalX
                el.position.y = finalY
                reanchorArrowsForShape(el)
                selectionController.syncToTarget()
                two.update()
            }
        }
        // Pan-mode (desktop): end the grab-drag, restore the grab cursor and
        // detach the on-demand listeners. Persist the viewport like the wheel.
        if (isMousePanning) {
            isMousePanning = false
            const root = document.getElementById('main-two-root')
            if (root) root.classList.remove('panning')
            window.removeEventListener('mousemove', mousemove, false)
            window.removeEventListener('mouseup', mouseup, false)
            scheduleViewportSave()
            return
        }

        switch (scenario) {
            case SCENARIO_ARROW_DRAW: {
                if (arrowDrawElement) {
                    const line = arrowDrawElement.children[0]
                    const finalX1 = parseInt(line.vertices[0].x)
                    const finalY1 = parseInt(line.vertices[0].y)
                    const finalX2 = parseInt(line.vertices[1].x)
                    const finalY2 = parseInt(line.vertices[1].y)

                    // Update elementData so subsequent drag operations use correct position
                    arrowDrawElement.elementData.x = parseInt(
                        arrowDrawElement.position.x
                    )
                    arrowDrawElement.elementData.y = parseInt(
                        arrowDrawElement.position.y
                    )

                    const newShapeData = {
                        id: arrowDrawElement.elementData.id,
                        prevX: -9999,
                        prevY: -9999,
                        isLineCircle: true,
                        parentData: arrowDrawElement,
                        data: {
                            x: parseInt(arrowDrawElement.position.x),
                            y: parseInt(arrowDrawElement.position.y),
                            x1: finalX1,
                            y1: finalY1,
                            x2: finalX2,
                            y2: finalY2,
                        },
                    }

                    updateToGlobalState(newShapeData, {})

                    // If the head was magnetically docked on a port at release,
                    // commit the head→shape binding (the vertices were already
                    // snapped during the drag).
                    applyPendingPortConnection()

                    // Auto-select the freshly drawn arrow so its endpoint
                    // handles and the edit toolbar appear immediately — a
                    // visual cue that the arrow is editable. Arrows aren't in
                    // SHAPE_ADAPTERS (no resize box), so build the toolbar
                    // state directly, mirroring the click-select path.
                    const arrowGroup = arrowDrawElement
                    const arrowLineShape = arrowGroup.children[0]
                    setArrowEndpointsVisible(arrowGroup, true)
                    // getSelectedGroup() (used by copy/paste) falls back to
                    // lastSelectedShape when selectionController has nothing
                    // attached — which is always the case here, since arrows
                    // and plain lines have no SHAPE_ADAPTERS entry. Without
                    // this, Cmd+C right after finishing a draw silently no-ops
                    // (getSelectedGroup() returns null) even though the
                    // endpoint handles are visibly "selected".
                    lastSelectedShape = arrowGroup
                    setSelectedComponentInBase({
                        element: {
                            [arrowLineShape.id]: arrowLineShape,
                            [arrowGroup.id]: arrowGroup,
                        },
                        group: { id: arrowGroup.id, data: arrowGroup },
                        shape: {
                            type: arrowGroup.elementData?.componentType,
                            id: arrowLineShape.id,
                            data: arrowLineShape,
                        },
                        text: { data: {} },
                        icon: { data: {} },
                    })
                    // Paint the now-visible endpoint handles.
                    two.update()
                } else {
                    setSelectedComponentInBase(null)
                }

                // Radar is a draw-time affordance only — clear it on drop.
                selectionController.hidePortGlow()
                // Now the endpoints are firmly placed, re-sort every connector on
                // each touched port so their order matches their far ends' order
                // (fixes a later connector whose far end lands between earlier
                // ones from stacking past them). Two ports may be involved: the
                // source port a tail was pulled from, and the port a head docked
                // onto (the latter also covers a plain toolbar arrow whose head
                // lands on a port — no tail source).
                if (arrowDrawTailShapeId && arrowDrawTailPort) {
                    restackPortConnectors(
                        arrowDrawTailShapeId,
                        arrowDrawTailPort.edge
                    )
                }
                const drawnEd = arrowDrawElement?.elementData
                if (drawnEd?.headShapeId && drawnEd?.headEdge) {
                    restackPortConnectors(drawnEd.headShapeId, drawnEd.headEdge)
                }
                arrowDrawTailShapeId = null
                arrowDrawTailPort = null

                arrowDrawElement = null
                setArrowDrawModeOff()
                setPointerElement('pointer')
                setRootCursor('auto')
                domElement.removeEventListener('mousemove', mousemove, false)
                domElement.removeEventListener('mouseup', mouseup, false)
                break
            }
            case SCENARIO_TEXT_DRAW: {
                if (textDrawElement && textDrawElement.children?.[0]) {
                    // Trigger text input by dispatching a custom event
                    const textInputEvent = new CustomEvent('triggerTextInput', {
                        detail: { elementId: textDrawElement.elementData.id },
                    })
                    window.dispatchEvent(textInputEvent)

                    const groupEl = textDrawElement
                    const shapeEl = textDrawElement.children[0]
                    const componentInternalState = {
                        element: {
                            [shapeEl.id]: shapeEl,
                            [groupEl.id]: groupEl,
                        },
                        group: { id: groupEl.id, data: groupEl },
                        shape: {
                            type: groupEl.elementData?.componentType,
                            id: shapeEl.id,
                            data: shapeEl,
                        },
                        text: { data: {} },
                        icon: { data: {} },
                    }
                    // Don't use the canvas's generic toolbar for text elements —
                    // the text component manages its own correctly-configured toolbar.
                    setSelectedComponentInBase(null)
                }

                textDrawElement = null
                setTextDrawModeOff()
                // In geo mode the only text tool is geoText; land in pointer so
                // the placed text can be selected (no effect when geo is off).
                setPointerElement('pointer', { select: true })
                setRootCursor('auto')
                domElement.removeEventListener('mouseup', mouseup, false)
                break
            }
            case SCENARIO_DRAW_SHAPE: {
                const MIN_SIZE = 20
                const endCoords = drawCurrentCoords || drawOrigin
                const finalWidth = Math.round(
                    Math.max(Math.abs(endCoords.x - drawOrigin.x), MIN_SIZE)
                )
                const finalHeight = Math.round(
                    Math.max(Math.abs(endCoords.y - drawOrigin.y), MIN_SIZE)
                )
                const finalCenterX = Math.round(
                    (drawOrigin.x + endCoords.x) / 2
                )
                const finalCenterY = Math.round(
                    (drawOrigin.y + endCoords.y) / 2
                )

                drawPreviewActive = false

                const finalId = generateUUID()
                const finalShapeData = {
                    ...drawShapeProps,
                    id: finalId,
                    x: finalCenterX,
                    y: finalCenterY,
                    width: finalWidth,
                    height: finalHeight,
                }

                addToLocalComponentStore(
                    finalId,
                    drawShapeType ?? '',
                    finalShapeData as unknown as ComponentRecord
                )

                // React renders the element asynchronously; poll until it appears in two.scene.children,
                // then remove the preview so there is no blank gap between preview removal and final render.
                // Once the real group exists, auto-select it so the resize box and the edit toolbar appear
                // immediately — a visual cue to new users that the freshly drawn shape is editable.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const finishPlacement = (el?: any) => {
                    // Keep the overlay up until the real element has rendered so
                    // there's no blank flash, then drop it.
                    removeDrawPreview()
                    if (el) selectionController.attach(el)
                }
                pollUntilElement(two, finalId, finishPlacement, {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    condition: (el: any) => !!el.children?.[0],
                    onTimeout: () => finishPlacement(),
                })

                drawOrigin = null
                drawCurrentCoords = null
                drawShapeType = null
                drawShapeProps = null
                setPointerElement('pointer')
                setRootCursor('auto')
                const hintBtn = document.getElementById(
                    'show-click-anywhere-btn'
                )
                if (hintBtn) hintBtn.style.opacity = '0'
                domElement.removeEventListener('mousemove', mousemove, false)
                domElement.removeEventListener('mouseup', mouseup, false)
                break
            }
            case SCENARIO_JUST_ADDED_ELEMENT:
                setSelectedComponentInBase(null)
                lastPlacedElement = null
                setPointerElement('pointer')
                domElement.removeEventListener('mousemove', mousemove, false)
                domElement.removeEventListener('mouseup', mouseup, false)
                break
            case SCENARIO_PENCIL_MODE: {
                // Gesture is over — re-enable undo/redo before the stroke is
                // committed to the store/history just below.
                isPencilStrokeActive = false
                const capturedPencilGroup = pencilGroup
                pencilGroup = null
                pencilPath = null

                // A click with no drag is a deliberate dot, not a failed
                // stroke. Emit a hair-length horizontal segment centred on the
                // click: the pencil's round caps then paint it as a single dot
                // the width of the stroke. The length has to be non-zero —
                // Two.js collapses two identical anchors into one `M` command,
                // which draws nothing. DOT_SEGMENT is far below one screen
                // pixel at normal zoom, so the mark reads as round, and
                // everything downstream (persistence, undo, group move,
                // export) just sees an ordinary 2-point stroke.
                if (pencilRawPoints.length === 1) {
                    const dot = pencilRawPoints[0]
                    const half = PENCIL_DOT_SEGMENT / 2
                    pencilRawPoints = [
                        { ...dot, x: dot.x - half },
                        { ...dot, x: dot.x + half },
                    ]
                }

                if (pencilRawPoints.length < 2) {
                    // No points at all — remove preview immediately
                    if (capturedPencilGroup) {
                        two.remove(capturedPencilGroup)
                        two.update()
                    }
                    pencilRawPoints = []
                    lastPencilPoint = null
                    lastPencilLinewidth = null
                    break
                }

                // Light simplification keeps the final shape close to what the
                // user actually drew (smaller epsilon = more fidelity).
                const simplifiedPoints = simplifyWithLinewidth(
                    pencilRawPoints,
                    0.3
                )

                let pencilId = generateUUID()
                let pencilComponentData = {
                    id: pencilId,
                    baseId: props.baseId,
                    componentType: 'pencil',
                    // Which base this stroke belongs to, decided once at
                    // creation. The pencil is the one whiteboard tool offered on
                    // every base, so the *record* has to carry the answer —
                    // `componentType` alone can no longer say where it lives.
                    // `objectClass: 'geo'` is the existing marker the visibility
                    // rule already checks ahead of BOARD_ONLY_TYPES, so a map
                    // scribble hides on the board base and vice versa with no new
                    // rule. Board strokes stay untagged, exactly as before.
                    ...(activeBaseTypeRef.current !== 'board'
                        ? { objectClass: 'geo' }
                        : {}),
                    children: {},
                    metadata: simplifiedPoints,
                    x: 0,
                    y: 0,
                    linewidth: defaultLinewidthValue,
                    stroke: defaultStrokeColorValue,
                    strokeType: defaultStrokeTypeValue,
                }

                pencilComponentData.x = Math.floor(simplifiedPoints[0]?.x || 0)
                pencilComponentData.y = Math.floor(simplifiedPoints[0]?.y || 0)

                addToLocalComponentStore(
                    pencilComponentData.id,
                    pencilComponentData.componentType,
                    pencilComponentData as unknown as ComponentRecord
                )

                // React renders the element asynchronously; keep preview visible until
                // the final element appears in two.scene.children to avoid a blank gap
                const removePencilPreview = () => {
                    if (capturedPencilGroup) {
                        two.remove(capturedPencilGroup)
                        two.update()
                    }
                }
                pollUntilElement(two, pencilId, removePencilPreview, {
                    onTimeout: removePencilPreview,
                })

                // Reset pencil state
                pencilRawPoints = []
                lastPencilPoint = null
                lastPencilLinewidth = null
                break
            }
            case SCENARIO_RUBBER_MODE:
                domElement.removeEventListener('mousemove', mousemove, false)
                domElement.removeEventListener('mouseup', mouseup, false)
                // Drop the anchor so the next sweep starts a fresh beam
                // instead of drawing a line from where this one ended. Live
                // segments carry on fading.
                eraserTrail.end()
                break
            default:
                // diff to check new x,y and prev x,y
                let oldShapeData = {}
                let newShapeData = {}
                // No mousemove happened between empty-canvas mousedown and
                // this mouseup → no selector was ever materialised. Just
                // clear the pending origin and let the cleanup below run.
                if (pendingGroupSelectorOrigin) {
                    pendingGroupSelectorOrigin = null
                }
                if (shape?.elementData?.isGroupSelector) {
                    // check on mouse up if shape's a group selector or not
                    // if yes, then call setOnGroup for adding a group in two.js space
                    let area = shape.children[0]
                    const groupWidth = area.vertices[2].x - area.vertices[0].x
                    const groupHeight = area.vertices[3].y - area.vertices[0].y
                    two.remove(shape)
                    // The selector starts as a 10x10 rect (see mousedown). If
                    // it never grew, the user just clicked without dragging —
                    // don't materialise an empty groupobject skeleton (and
                    // crucially, don't leave one behind that would intercept
                    // the second click of a dblclick on empty canvas).
                    if (groupWidth > 10 || groupHeight > 10) {
                        setOnGroupHandler({
                            x: area.vertices[0].x + shape.translation.x,
                            y: area.vertices[0].y + shape.translation.y,
                            left: area.vertices[0].x + shape.translation.x,
                            right: area.vertices[1].x + shape.translation.x,
                            top: area.vertices[0].y + shape.translation.y,
                            bottom: area.vertices[3].y + shape.translation.y,
                            width: groupWidth,
                            height: groupHeight,
                        })
                    }
                    setSelectedComponentInBase(null)
                } else if (shape?.elementData) {
                    // Did the element actually move since mousedown? Compare the
                    // rounded translation against `prevX`/`prevY` captured at
                    // mousedown (line ~1721, also `parseInt(translation)`).
                    //
                    // The old guard compared `elementData.x` against
                    // `translation.x` directly, but `elementData.x` is stored as
                    // a parseInt'd integer while `translation.x` keeps the float.
                    // For a port-pulled connector the position is a fractional
                    // port anchor, so the two always differed — making a plain
                    // CLICK on the arrow body read as a "move" and fall into the
                    // body branch below, which detaches both port bindings.
                    // Gating on real movement makes a click a no-op.
                    const prevX = shape.elementData.prevX
                    const prevY = shape.elementData.prevY
                    const movedX =
                        prevX === undefined
                            ? shape.elementData.x !== shape.translation.x
                            : parseInt(shape.translation.x) !== prevX
                    const movedY =
                        prevY === undefined
                            ? shape.elementData.y !== shape.translation.y
                            : parseInt(shape.translation.y) !== prevY
                    if (movedX || movedY) {
                        if (shape?.elementData?.isLineCircle === true) {
                            shape.opacity = 0
                            shape.siblingCircle.opacity = 0

                            const vertexObj = {
                                x1: parseInt(shape.lineData.vertices[0].x),
                                y1: parseInt(shape.lineData.vertices[0].y),
                                x2: parseInt(shape.lineData.vertices[1].x),
                                y2: parseInt(shape.lineData.vertices[1].y),
                            }

                            // Releasing this endpoint either CONNECTS it (still
                            // magnetically docked on a port at release) or
                            // DETACHES it (manual move ending off every port).
                            // Either way fold the binding write into the SAME
                            // bulk update as the vertices so one undo reverts
                            // both position and binding.
                            const arrowGroup = shape.lineData?.parent
                            const ed = arrowGroup?.elementData
                            const draggedEndpoint =
                                shape.direction === 'left' ? 'tail' : 'head'
                            // Ports this release touches — the one the dragged
                            // endpoint was on (it may detach or hop off) plus the
                            // one it docks onto — re-sorted once the binding is
                            // settled so the remaining fans stay ordered.
                            const portsToRestack: {
                                shapeId: string
                                edge: string
                            }[] = []
                            const recordPort = (
                                shapeId?: string | null,
                                edge?: string | null
                            ) => {
                                if (
                                    shapeId &&
                                    edge &&
                                    !portsToRestack.some(
                                        (p) =>
                                            p.shapeId === shapeId &&
                                            p.edge === edge
                                    )
                                )
                                    portsToRestack.push({ shapeId, edge })
                            }
                            if (ed && draggedEndpoint === 'tail')
                                recordPort(ed.tailShapeId, ed.tailEdge)
                            else if (ed && draggedEndpoint === 'head')
                                recordPort(ed.headShapeId, ed.headEdge)
                            const connectHere =
                                !!pendingPortConnection &&
                                pendingPortConnection.endpoint ===
                                    draggedEndpoint &&
                                !!pendingPortConnection.shapeId &&
                                !!ed &&
                                pendingPortConnection.arrowId === ed.id
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const bindObj: Record<string, any> = {}
                            if (connectHere && pendingPortConnection) {
                                if (draggedEndpoint === 'tail') {
                                    bindObj.tailShapeId =
                                        pendingPortConnection.shapeId
                                    bindObj.tailEdge =
                                        pendingPortConnection.edge
                                } else {
                                    bindObj.headShapeId =
                                        pendingPortConnection.shapeId
                                    bindObj.headEdge =
                                        pendingPortConnection.edge
                                }
                                if (ed) Object.assign(ed, bindObj)
                            } else if (
                                draggedEndpoint === 'tail' &&
                                ed &&
                                (ed.tailShapeId || ed.tailEdge)
                            ) {
                                bindObj.tailShapeId = null
                                bindObj.tailEdge = null
                                bindObj.tailPortIndex = 0
                                ed.tailShapeId = null
                                ed.tailEdge = null
                                ed.tailPortIndex = 0
                            } else if (
                                draggedEndpoint === 'head' &&
                                ed &&
                                (ed.headShapeId || ed.headEdge)
                            ) {
                                bindObj.headShapeId = null
                                bindObj.headEdge = null
                                bindObj.headPortIndex = 0
                                ed.headShapeId = null
                                ed.headEdge = null
                                ed.headPortIndex = 0
                            }

                            if (ed?.id && Object.keys(bindObj).length > 0) {
                                // One UPDATE_BULK carries vertices + binding so
                                // undo reverts the whole connect/detach in a
                                // single step.
                                updateComponentBulkPropertiesInLocalStore(
                                    ed.id,
                                    { ...vertexObj, ...bindObj }
                                )
                            } else {
                                oldShapeData = { ...shape.elementData }
                                newShapeData = Object.assign(
                                    {},
                                    shape.elementData,
                                    { data: vertexObj }
                                )
                                updateToGlobalState(newShapeData, oldShapeData)
                            }

                            // Re-sort the fans on every port this release touched
                            // (the port just docked onto + any port the endpoint
                            // left), now the endpoint is firmly placed.
                            if (connectHere && pendingPortConnection)
                                recordPort(
                                    pendingPortConnection.shapeId,
                                    pendingPortConnection.edge
                                )
                            portsToRestack.forEach((p) =>
                                restackPortConnectors(p.shapeId, p.edge)
                            )
                        } else {
                            // Where the element sat before this drag. Captured
                            // BEFORE the overwrite below, because the
                            // absolute-vertex branch needs the delta and
                            // `prevX`/`prevY` are only set by the mousedown that
                            // started a drag (a programmatic move has neither).
                            const originX =
                                prevX ?? parseInt(shape.elementData.x)
                            const originY =
                                prevY ?? parseInt(shape.elementData.y)
                            shape.elementData.x = shape.translation.x
                            shape.elementData.y = shape.translation.y

                            // Dragging a connector's BODY moves both endpoints
                            // off their ports, so it detaches any bindings —
                            // otherwise a later shape move would snap the tail
                            // back. Clear them live and fold into the same
                            // position update so one undo reverts the whole move.
                            const ed = shape.elementData
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const arrowDetach: Record<string, any> = {}
                            // Ports the body-drag pulled this connector off of,
                            // re-sorted afterwards so the remaining fans close up.
                            const bodyDetachPorts: {
                                shapeId: string
                                edge: string
                            }[] = []
                            if (ed.componentType === 'arrowLine') {
                                if (ed.tailShapeId || ed.tailEdge) {
                                    if (ed.tailShapeId && ed.tailEdge)
                                        bodyDetachPorts.push({
                                            shapeId: ed.tailShapeId,
                                            edge: ed.tailEdge,
                                        })
                                    arrowDetach.tailShapeId = null
                                    arrowDetach.tailEdge = null
                                    arrowDetach.tailPortIndex = 0
                                    ed.tailShapeId = null
                                    ed.tailEdge = null
                                    ed.tailPortIndex = 0
                                }
                                if (ed.headShapeId || ed.headEdge) {
                                    if (ed.headShapeId && ed.headEdge)
                                        bodyDetachPorts.push({
                                            shapeId: ed.headShapeId,
                                            edge: ed.headEdge,
                                        })
                                    arrowDetach.headShapeId = null
                                    arrowDetach.headEdge = null
                                    arrowDetach.headPortIndex = 0
                                    ed.headShapeId = null
                                    ed.headEdge = null
                                    ed.headPortIndex = 0
                                }
                            }

                            if (Object.keys(arrowDetach).length > 0) {
                                // One UPDATE_BULK: position + binding clear.
                                updateComponentBulkPropertiesInLocalStore(
                                    ed.id,
                                    {
                                        x: parseInt(shape.translation.x),
                                        y: parseInt(shape.translation.y),
                                        ...arrowDetach,
                                    }
                                )
                            } else if (
                                hasAbsoluteVertexMetadata(ed.componentType)
                            ) {
                                // The absolute-metadata family — curvedLine,
                                // area, route and pencil — keeps its geometry as
                                // ABSOLUTE coords in `metadata`, and the factory
                                // rebuilds the path as `metadata - (x, y)`. A
                                // body drag moves the group but leaves metadata
                                // where it was, so persisting the new x/y ALONE
                                // is worse than doing nothing: on reload the
                                // factory subtracts the new origin from the old
                                // vertices and the shape lands exactly back
                                // where it started. The move has to be written
                                // into the vertex array as well, in the SAME
                                // update so one undo reverts both.
                                //
                                // Rebasing the stored array by the drag delta
                                // rather than reading the path's vertices back:
                                // pencil's rendered vertices are Chaikin-
                                // smoothed, so a read-back would persist the
                                // smoothed curve and then smooth THAT again on
                                // the next load, rounding the stroke off a
                                // little more with every move. A delta also
                                // preserves per-point extras (pencil's `lw`).
                                //
                                // Undo stays correct: applyBulkProps reverts the
                                // group translation from the snapshotted
                                // prevProps, and the relative vertices never
                                // moved, so restoring the translation restores
                                // the whole shape (array metadata is a no-op on
                                // the Two.js side).
                                const dx =
                                    parseInt(shape.translation.x) - originX
                                const dy =
                                    parseInt(shape.translation.y) - originY
                                const movedVerts = shiftVertexMetadata(
                                    ed.metadata,
                                    dx,
                                    dy
                                )
                                if (movedVerts) ed.metadata = movedVerts
                                updateComponentBulkPropertiesInLocalStore(
                                    ed.id,
                                    {
                                        x: parseInt(shape.translation.x),
                                        y: parseInt(shape.translation.y),
                                        ...(movedVerts
                                            ? {
                                                  // `metadata` is the
                                                  // polymorphic column TS
                                                  // cannot express (object for
                                                  // text/point, vertex array
                                                  // here) — the cast is the
                                                  // same one every array-metadata
                                                  // path in this file makes.
                                                  metadata:
                                                      movedVerts as unknown as ComponentRecord['metadata'],
                                              }
                                            : {}),
                                    }
                                )
                            } else {
                                oldShapeData = { ...shape.elementData }

                                newShapeData = Object.assign(
                                    {},
                                    shape.elementData,
                                    {
                                        data: {
                                            x: parseInt(shape.translation.x),
                                            y: parseInt(shape.translation.y),
                                        },
                                    }
                                )

                                if (
                                    shape.elementData.componentType !==
                                    'groupobject'
                                ) {
                                    updateToGlobalState(
                                        newShapeData,
                                        oldShapeData
                                    )
                                }
                            }

                            // Save the connectors that followed this shape so
                            // their new tail/head positions survive a reload.
                            persistBoundArrows(shape)

                            // Re-close the fans on any port this connector was
                            // just dragged off of.
                            bodyDetachPorts.forEach((p) =>
                                restackPortConnectors(p.shapeId, p.edge)
                            )
                        }
                    }
                }
        }

        // Restore pointer events on all components (may have been disabled during arrow drag)
        document
            .querySelectorAll<HTMLElement>('.dragger-picker')
            .forEach((el) => {
                el.style.pointerEvents = ''
            })

        // Radar is a drag-time affordance only — clear the glow on any release
        // (covers the endpoint-drag path; the arrow-draw case clears it too).
        // The pending snap was already consumed by the case handlers above.
        selectionController.hidePortGlow()
        pendingPortConnection = null

        shape = {}
        scenario = null

        two.update()

        domElement.removeEventListener('mousemove', mousemove, false)
        domElement.removeEventListener('mouseup', mouseup, false)
    }

    // Debounced persist of the current camera (pan + zoom) so a reload restores
    // the viewport. Shared by the wheel and the desktop pan-drag.
    function scheduleViewportSave() {
        if (!props.baseId) return
        if (viewportSaveTimer) clearTimeout(viewportSaveTimer)
        viewportSaveTimer = setTimeout(() => {
            writeViewport(props.baseId!, activeBaseTypeRef.current, false, {
                tx: two.scene.translation.x,
                ty: two.scene.translation.y,
                scale: two.scene.scale,
            })
        }, 300)
    }

    function mousewheel(e: WheelEvent) {
        // Wheel/scroll zooms only with a modifier held — cmd (macOS), ctrl
        // (Windows; also what trackpad pinch-zoom emits), or shift. A plain
        // wheel/scroll always pans the surface, in pan mode and otherwise.
        if (e.shiftKey === true || e.metaKey === true || e.ctrlKey === true) {
            let dy =
                ((e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY ||
                    -e.deltaY) / 1000
            zui.zoomBy(dy, e.clientX, e.clientY)
            window.dispatchEvent(
                new CustomEvent('zoomChanged', { detail: { scale: zui.scale } })
            )
        } else {
            zui.translateSurface(-e.deltaX, -e.deltaY)
        }

        // A wheel gesture is in flight — suppress the hover hit-test until it
        // settles (see hoverDetectMove). Wheel has no gesture-end event, so the
        // flag is cleared on a short trailing timer.
        isWheeling = true
        if (wheelSettleTimer !== null) window.clearTimeout(wheelSettleTimer)
        wheelSettleTimer = window.setTimeout(() => {
            isWheeling = false
            wheelSettleTimer = null
        }, 120)

        cullOnCameraChange()
        // Batched — same reason as the pan handler: wheel/trackpad events fire
        // faster than the display paints.
        scheduleRender(two)
        syncBackgroundToCamera()

        onCameraChangeRef?.current?.({
            scale: two.scene.scale,
            tx: two.scene.translation.x,
            ty: two.scene.translation.y,
        })

        scheduleViewportSave()
    }

    // --- Touch handlers ---
    // Routing:
    //   1 finger  → synthetic MouseEvent → existing mouse pipeline (select, drag, pencil, draw)
    //   2 fingers → pan canvas (midpoint delta) + pinch zoom (distance delta) simultaneously

    function touchstart(e: TouchEvent) {
        e.preventDefault()

        if (e.touches.length === 1) {
            lastTouch = e.touches[0]
            touchStartX = lastTouch.clientX
            touchStartY = lastTouch.clientY

            // Pan-mode short-circuit: single-finger drag should translate the
            // surface, not select/draw. Skip the synthetic mousedown pipeline
            // entirely while pan mode is active.
            if (isPanMode()) {
                isSinglePanning = true
                panLastX = lastTouch.clientX
                panLastY = lastTouch.clientY
                const root = document.getElementById('main-two-root')
                if (root) root.style.cursor = 'grabbing'
                return
            }

            // If the tap lands on an active selection handle, keep the selection
            // attached so mousedown's hitTest can begin a resize/rotate. Without
            // this, the unconditional clearSelector below detaches the controller
            // before mousedown runs — visible on shapes whose bbox corners sit in
            // empty space (e.g. diamond NE handle), where elementFromPoint returns
            // bare canvas and re-selection never fires.
            const handleHit =
                selectionController.currentGroup &&
                selectionController.hitTest(
                    lastTouch.clientX,
                    lastTouch.clientY
                )

            const underFinger = document.elementFromPoint(
                lastTouch.clientX,
                lastTouch.clientY
            ) as Element | null

            // A multi-element group uses the older objectSelector path (not
            // selectionController), so handleHit is false for it. Without this,
            // the clearSelector below hides the group's dashed box the instant
            // the drag begins on mobile. Skip the clear when the finger lands on
            // the group object so its selector stays visible through the drag.
            const groupHit = underFinger?.closest(
                '[data-label="groupobject_coord"]'
            )

            // Same idea, for the *other* legacy selector: elements that draw
            // their own edit chrome inside their group (objectSelector) rather
            // than through selectionController — geoText being the one with
            // resize handles on it.
            //
            // Those handles gate themselves on the selector being visible
            // (`areaGroup.opacity === 0 → return`), so clearing the selection
            // here disarmed them a moment before the synthetic mousedown
            // reached them: the handler bailed out without stopping
            // propagation, the event fell through to the drag path, and the
            // text moved instead of resizing. Desktop never saw it because
            // nothing dispatches clearSelector on a plain mousedown.
            //
            // Visibility is checked because opacity:0 SVG still hit-tests — an
            // unselected element's dormant chrome must not swallow the clear.
            const chromeEl = underFinger?.closest(`[${SELECTION_CHROME_ATTR}]`)
            const chromeHit =
                !!chromeEl &&
                parseFloat(window.getComputedStyle(chromeEl).opacity || '1') > 0

            if (!handleHit && !groupHit && !chromeHit) {
                // Clear any previous selection before processing the new tap.
                // On desktop this happens via focus/blur, but synthetic mouse events
                // don't transfer browser focus on mobile, so we do it explicitly here
                // — before mousedown so the new selection set inside mousedown survives.
                window.dispatchEvent(new CustomEvent('clearSelector', {}))
            }

            // Dispatch mousedown on the actual element under the finger so
            // element-level listeners (interactjs resize handles, click handlers) fire correctly.
            // For handle hits, target domElement directly — elementFromPoint may
            // resolve to bare canvas (which would re-trigger clearSelector inside
            // mousedown at the `two-0` branch).
            const target = handleHit ? domElement : underFinger || domElement
            target.dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: lastTouch.clientX,
                    clientY: lastTouch.clientY,
                    screenX: lastTouch.screenX,
                    screenY: lastTouch.screenY,
                })
            )
        } else if (e.touches.length === 2) {
            // Second finger added — cancel any in-progress 1-finger interaction
            if (isSinglePanning) {
                // Single-finger pan never dispatched a mousedown, so there's
                // nothing to mouseup; just clear pan state and let
                // twoFingerStart take over for pinch+pan.
                isSinglePanning = false
                lastTouch = null
            } else if (lastTouch) {
                domElement.dispatchEvent(
                    new MouseEvent('mouseup', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: lastTouch.clientX,
                        clientY: lastTouch.clientY,
                    })
                )
                lastTouch = null
            }
            twoFingerStart(e)
        }
    }

    function touchmove(e: TouchEvent) {
        e.preventDefault()

        if (e.touches.length === 1) {
            lastTouch = e.touches[0]

            // Pan-mode: translate the surface by per-frame finger delta.
            if (isSinglePanning) {
                const dx = lastTouch.clientX - panLastX
                const dy = lastTouch.clientY - panLastY
                panLastX = lastTouch.clientX
                panLastY = lastTouch.clientY
                if (dx !== 0 || dy !== 0) {
                    zui.translateSurface(dx, dy)
                    cullOnCameraChange()
                    // Batched — touchmove also outruns the paint rate.
                    scheduleRender(two)
                    syncBackgroundToCamera()
                    onCameraChangeRef?.current?.({
                        scale: two.scene.scale,
                        tx: two.scene.translation.x,
                        ty: two.scene.translation.y,
                    })
                }
                return
            }

            domElement.dispatchEvent(
                new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: lastTouch.clientX,
                    clientY: lastTouch.clientY,
                    screenX: lastTouch.screenX,
                    screenY: lastTouch.screenY,
                })
            )
        } else if (e.touches.length >= 2) {
            twoFingerMove(e)
        }
    }

    function touchend(e: TouchEvent) {
        if (e.touches.length === 0 && lastTouch) {
            const endX = lastTouch.clientX
            const endY = lastTouch.clientY

            // Pan-mode end: persist viewport (matches two-finger persistence
            // path below) and reset cursor. Skip the synthetic mouseup/click
            // pipeline so taps in pan mode never trigger selection.
            if (isSinglePanning) {
                isSinglePanning = false
                if (props.baseId) {
                    writeViewport(
                        props.baseId,
                        activeBaseTypeRef.current,
                        true,
                        {
                            tx: two.scene.translation.x,
                            ty: two.scene.translation.y,
                            scale: two.scene.scale,
                        }
                    )
                }
                const root = document.getElementById('main-two-root')
                if (root) root.style.cursor = 'grab'
                lastTouch = null
                return
            }

            domElement.dispatchEvent(
                new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: endX,
                    clientY: endY,
                })
            )

            // If finger barely moved, treat as a tap and fire a click on the
            // actual element so interactjs `.on('click')` handlers (which draw
            // the selection outline) are triggered.
            const dx = endX - touchStartX
            const dy = endY - touchStartY
            const moved = Math.sqrt(dx * dx + dy * dy)
            if (moved < 10) {
                // Blur any focused element (e.g. an active text-editing
                // textarea) so it commits + removes itself before we
                // re-query elementFromPoint and dispatch the tap click.
                // On mobile, synthetic mouse events don't transfer focus,
                // so blur never fires naturally when tapping elsewhere.
                if (
                    document.activeElement &&
                    document.activeElement !== document.body
                ) {
                    ;(document.activeElement as HTMLElement).blur()
                }

                const now = Date.now()
                const tapDx = endX - lastTapX
                const tapDy = endY - lastTapY
                const tapDist = Math.sqrt(tapDx * tapDx + tapDy * tapDy)
                const isDoubleTap = now - lastTapTime < 300 && tapDist < 30

                const target =
                    document.elementFromPoint(endX, endY) || domElement

                if (isDoubleTap) {
                    // Reset so a third tap doesn't re-trigger
                    lastTapTime = 0
                    lastTapX = 0
                    lastTapY = 0
                    target.dispatchEvent(
                        new MouseEvent('dblclick', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: endX,
                            clientY: endY,
                        })
                    )
                } else {
                    lastTapTime = now
                    lastTapX = endX
                    lastTapY = endY
                    target.dispatchEvent(
                        new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: endX,
                            clientY: endY,
                        })
                    )
                }
            }

            lastTouch = null
        }
        // Drop below 2 fingers — save viewport then reset 2-finger tracking state.
        // distance > 0 means twoFingerStart ran (a real 2-finger gesture was active).
        if (e.touches.length < 2) {
            if (distance > 0 && props.baseId) {
                writeViewport(props.baseId, activeBaseTypeRef.current, true, {
                    tx: two.scene.translation.x,
                    ty: two.scene.translation.y,
                    scale: two.scene.scale,
                })
            }
            touches = {}
            distance = 0
        }
    }

    function twoFingerStart(e: TouchEvent) {
        touches = {}
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i]
            if (t) touches[t.identifier] = t
        }
        const ids = Object.keys(touches)
        if (ids.length < 2) return
        const a = touches[ids[0]!]
        const b = touches[ids[1]!]
        const dx = b.clientX - a.clientX
        const dy = b.clientY - a.clientY
        distance = Math.sqrt(dx * dx + dy * dy)
        twoFingerMidX = (a.clientX + b.clientX) / 2
        twoFingerMidY = (a.clientY + b.clientY) / 2
    }

    function twoFingerMove(e: TouchEvent) {
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i]
            if (t) touches[t.identifier] = t
        }
        const ids = Object.keys(touches)
        if (ids.length < 2) return

        const a = touches[ids[0]!]
        const b = touches[ids[1]!]
        const dx = b.clientX - a.clientX
        const dy = b.clientY - a.clientY
        const newDist = Math.sqrt(dx * dx + dy * dy)
        const newMidX = (a.clientX + b.clientX) / 2
        const newMidY = (a.clientY + b.clientY) / 2

        // Safety: if twoFingerStart was never called (e.g. second finger
        // landed outside the canvas element), initialise from current state
        // and skip this frame to avoid a large jump.
        if (distance === 0) {
            distance = newDist
            twoFingerMidX = newMidX
            twoFingerMidY = newMidY
            return
        }

        // Pan: translate by midpoint delta
        zui.translateSurface(newMidX - twoFingerMidX, newMidY - twoFingerMidY)

        // Zoom: scale by distance delta (pinch)
        const distDelta = newDist - distance
        if (Math.abs(distDelta) > 0.5) {
            zui.zoomBy(distDelta / 250, newMidX, newMidY)
            window.dispatchEvent(
                new CustomEvent('zoomChanged', { detail: { scale: zui.scale } })
            )
        }

        twoFingerMidX = newMidX
        twoFingerMidY = newMidY
        distance = newDist

        cullOnCameraChange()
        // Batched — pinchmove fires per touch sample, not per frame.
        scheduleRender(two)
        syncBackgroundToCamera()

        onCameraChangeRef?.current?.({
            scale: two.scene.scale,
            tx: two.scene.translation.x,
            ty: two.scene.translation.y,
        })
    }

    // Union of every persistable element's *surface* (scene-coord) bounds —
    // position-based (shallow getBoundingClientRect), so it reflects where the
    // elements actually are regardless of the live camera. Returns null when
    // there's nothing measurable yet. Shared by fitToContent and the load poll's
    // settle check (bounds stabilise once the element components apply x/y).
    const computeContentSurfaceBounds = (): {
        left: number
        top: number
        right: number
        bottom: number
    } | null => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children = two.scene.children as any[]
        let left = Infinity
        let top = Infinity
        let right = -Infinity
        let bottom = -Infinity
        for (const child of children) {
            const id = child?.elementData?.id
            if (!id) continue
            if (child.elementData.componentType === GROUP_COMPONENT) continue
            // Skip non-content children that would bloat the bbox and force an
            // over-zoomed-out fit (the 6%-floor symptom): hidden groups, and
            // transient dummy/preview elements (the drag preview, the
            // lastAddedElement stand-in) that can sit at the origin or cursor,
            // far from the real content.
            // A viewport-culled element is hidden for paint only — it's still
            // real content, so measure it (its world bbox is valid regardless
            // of visibility). Only skip genuinely-hidden groups.
            if (child.visible === false && child[CULLED_FLAG] !== true) continue
            if (child.elementData.isDummy === true) continue
            let rect
            try {
                rect = child.getBoundingClientRect(true)
            } catch {
                continue
            }
            if (!rect) continue
            const { left: l, top: t, right: r, bottom: b } = rect
            if (![l, t, r, b].every((n) => Number.isFinite(n))) continue
            left = Math.min(left, l)
            top = Math.min(top, t)
            right = Math.max(right, r)
            bottom = Math.max(bottom, b)
        }
        if (!Number.isFinite(left) || right - left <= 0 || bottom - top <= 0)
            return null
        return { left, top, right, bottom }
    }

    return {
        zui,
        syncBackgroundToCamera,
        syncDotGridClass,
        /**
         * Announce the current camera to `onCameraChange` subscribers (the
         * active base's backdrop, plus any consumer callback).
         *
         * Camera changes driven from *outside* addZUI's own event handlers —
         * ZoomControls' buttons being the one case today — have to call this,
         * or the backdrop silently stops tracking. Previously only the dot grid
         * needed syncing, so it was easy to miss; a map base makes it obvious.
         */
        notifyCameraChange: (): void => {
            onCameraChangeRef?.current?.({
                scale: two.scene.scale as number,
                tx: two.scene.translation.x,
                ty: two.scene.translation.y,
            })
        },
        mousemove,
        // Stops the trail's rAF loop so it can't keep ticking against a
        // torn-down Two.js instance after unmount.
        disposeEraserTrail: () => eraserTrail.dispose(),
        resetDragState: () => {
            dragging = false
            shape = {}
        },
        getCurrentShape: () => shape,
        getSelectedGroup: () =>
            selectionController.currentGroup ||
            activeGroupRef.current ||
            lastSelectedShape,
        bringSelectionToFront: () =>
            selectionController.bringSelectionToFront(),
        // True when at least one persistable element overlaps the current
        // viewport. Uses each element group's *deep* getBoundingClientRect
        // (worldMatrix → element-local pixel space, i.e. reflects the live
        // camera), tested against the SVG rect. Drives the auto-fit-on-load
        // decision: fit only when the restored/default camera shows no content.
        hasVisibleContent: (): boolean => {
            const scene = two.scene
            const vw = domElement.clientWidth || two.width
            const vh = domElement.clientHeight || two.height
            if (!vw || !vh) return true // can't measure → don't force a fit
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const children = scene.children as any[]
            for (const child of children) {
                const id = child?.elementData?.id
                if (!id) continue
                if (child.elementData.componentType === GROUP_COMPONENT)
                    continue
                let rect
                try {
                    rect = child.getBoundingClientRect(false)
                } catch {
                    continue
                }
                if (!rect) continue
                const { left, top, right, bottom } = rect
                if (
                    ![left, top, right, bottom].every((n) => Number.isFinite(n))
                )
                    continue
                // Any overlap between the element rect and the viewport.
                if (right > 0 && bottom > 0 && left < vw && top < vh)
                    return true
            }
            return false
        },
        // Rounded signature of the content's surface bounds, or '' when nothing
        // is measurable. The load poll watches this: once it's non-empty and
        // stable across frames, the element components have applied their x/y
        // (the count alone stabilises too early — groups are in the scene before
        // their position is set), so the visibility decision can be trusted.
        contentBoundsSignature: (): string => {
            const b = computeContentSurfaceBounds()
            if (!b) return ''
            return [b.left, b.top, b.right, b.bottom]
                .map((n) => Math.round(n))
                .join(',')
        },
        // Frame all persistable elements in the viewport (zoom-to-fit). Bounds
        // are read via each element group's *shallow* getBoundingClientRect, so
        // they're in surface (scene) coords — independent of the current camera
        // — and cover every shape type via its real rendered geometry. Returns
        // false when there's nothing measurable to fit (empty base / not yet
        // mounted) so the caller can keep polling. Used by the auto-fit-on-load
        // fallback and the "Go to content" button.
        fitToContent: (opts?: { padding?: number }): boolean => {
            const bounds = computeContentSurfaceBounds()
            if (!bounds) return false
            const { left, top, right, bottom } = bounds

            const vw = domElement.clientWidth || two.width
            const vh = domElement.clientHeight || two.height
            if (!vw || !vh) return false

            // Leave a margin; clamp to the ACTIVE base's zoom limits so a huge
            // or tiny base doesn't overshoot the range (the map's is far wider
            // than the board base's — see BaseTypeProvider.zoomLimits).
            const bboxW = right - left
            const bboxH = bottom - top
            const padding = opts?.padding ?? 0.8
            const scale = Math.max(
                zui.limits.scale.min,
                Math.min(
                    zui.limits.scale.max,
                    Math.min(vw / bboxW, vh / bboxH) * padding
                )
            )

            // reset → zoomSet establishes the scale from a known identity camera;
            // then translate so the content's center lands at the viewport center.
            // Work in element-local pixels (surfaceMatrix output space, 0,0 at the
            // SVG top-left) — NOT surfaceToClient, which adds the element's page
            // offset. The delta translateSurface needs lives in this same space,
            // so an embedded base (host not at page origin) still centers
            // correctly. viewport center = (vw/2, vh/2) is element-local too.
            zui.reset()
            zui.zoomSet(scale, 0, 0)
            const cx = (left + right) / 2
            const cy = (top + bottom) / 2
            const [curX, curY] = zui.surfaceMatrix.multiply(cx, cy, 1)
            zui.translateSurface(vw / 2 - curX, vh / 2 - curY)
            two.update()

            // Notify the rest of the app the camera moved — same trio every other
            // zoom/pan path fires. Without this the ZoomControls readout keeps its
            // stale value (e.g. shows 100% while the fit set 6%), the dot-grid
            // background drifts, and consumers' onCameraChange never hears the fit.
            window.dispatchEvent(
                new CustomEvent('zoomChanged', { detail: { scale: zui.scale } })
            )
            syncBackgroundToCamera()
            onCameraChangeRef?.current?.({
                scale: two.scene.scale,
                tx: two.scene.translation.x,
                ty: two.scene.translation.y,
            })
            return true
        },
        /**
         * Replace the camera's zoom range, and pull the current zoom inside it
         * if the new range excludes where we are.
         *
         * Not `zui.addLimits` — that one only ever *tightens* (it Math.max's a
         * new min against the existing one), so it can raise a floor but never
         * lower it, and a base switch has to be able to do both.
         */
        setZoomLimits: (min: number, max: number): void => {
            zui.limits.scale.min = min
            zui.limits.scale.max = max
            const clamped = Math.max(min, Math.min(max, zui.scale))
            if (clamped !== zui.scale) {
                const vw = domElement.clientWidth || two.width
                const vh = domElement.clientHeight || two.height
                zui.zoomSet(clamped, vw / 2, vh / 2)
                two.update()
                window.dispatchEvent(
                    new CustomEvent('zoomChanged', {
                        detail: { scale: zui.scale },
                    })
                )
                syncBackgroundToCamera()
                onCameraChangeRef?.current?.({
                    scale: two.scene.scale as number,
                    tx: two.scene.translation.x,
                    ty: two.scene.translation.y,
                })
            }
        },
        /**
         * Put a surface point in the middle of the viewport, keeping the
         * current zoom unless `scale` is given.
         *
         * This is how you travel on a georeferenced base: the map base ties
         * surface (0,0) to the base's anchor lng/lat, so "go to this place"
         * means "move the CAMERA to that place's surface coordinate" — never
         * "move the anchor", which would slide the whole world under ink that
         * stays where it is.
         */
        centerOnSurface: (x: number, y: number, scale?: number): void => {
            const vw = domElement.clientWidth || two.width
            const vh = domElement.clientHeight || two.height
            if (!vw || !vh) return

            const nextScale = Math.max(
                zui.limits.scale.min,
                Math.min(zui.limits.scale.max, scale ?? zui.scale)
            )
            zui.reset()
            zui.zoomSet(nextScale, 0, 0)
            const [curX, curY] = zui.surfaceMatrix.multiply(x, y, 1)
            zui.translateSurface(vw / 2 - curX, vh / 2 - curY)
            two.update()

            // Same notification trio every other camera driver fires — without
            // it the zoom readout, the dot grid and the map backdrop all keep
            // the pre-jump camera.
            window.dispatchEvent(
                new CustomEvent('zoomChanged', { detail: { scale: zui.scale } })
            )
            syncBackgroundToCamera()
            onCameraChangeRef?.current?.({
                scale: two.scene.scale as number,
                tx: two.scene.translation.x,
                ty: two.scene.translation.y,
            })
        },
        disconnectThemeObserver: () => themeObserver.disconnect(),
    }
}

const Canvas: React.FC<CanvasProps> = (props) => {
    const { isMobile } = useMediaQueryUtils()

    const {
        addToLocalComponentStore,
        deleteComponentFromLocalStore,
        updateComponentVerticesInLocalStore,
        updateComponentBulkPropertiesInLocalStore,
        setTwoJSInstanceInBase,
        setZuiInstanceInBase,
        setSelectedComponentInBase,
        setArrowDrawModeInBase,
        setTextDrawModeInBase,
        setCurrentElementInBase,
        togglePanMode,
        toolset,
        activeBaseType,
        undoLastAction,
        redoLastAction,
        recordBatchToHistoryLog,
        enableTextDrawMode,
        createTextAtSurface,
    } = useBaseContext()

    // addZUI's post-draw resets funnel a 'pointer' through setPointerElement.
    // On a base whose home tool is pan, a generic reset re-activates pan instead
    // of stranding the user in select mode. The exception is finishing a geo
    // draw (point/area/route): we want the user dropped straight into
    // pointer/select so the just-placed object can be tweaked — callers signal
    // that with { select: true }.
    //
    // No shipped base sets pan as its home tool any more (the map moved to
    // select), so this redirect is currently inert — kept because homeTool is
    // per-base by design and the deprecated `geoObjectsEnabled` overlay still
    // forces 'pan'.
    // resetToHomeTool is handed to addZUI, which runs once on mount — so it
    // must not close over `baseTypeProvider` directly. The base is switchable at
    // runtime now, and a captured provider would keep reporting the base the
    // base loaded with. See the stale-closure section in CLAUDE.md.
    const homeToolRef = useRef<string>(toolset.homeTool)
    useEffect(() => {
        homeToolRef.current = toolset.homeTool
    }, [toolset])

    // Same reason: viewport saves inside addZUI must key off the *live* base.
    const activeBaseTypeRef = useRef<BaseType>(activeBaseType)
    useEffect(() => {
        activeBaseTypeRef.current = activeBaseType
    }, [activeBaseType])

    const resetToHomeTool = (
        element: CurrentElement | null,
        options?: { select?: boolean }
    ): void => {
        if (element === 'pointer' && homeToolRef.current === 'pan') {
            if (options?.select) {
                togglePanMode(false)
                setCurrentElementInBase('pointer')
                return
            }
            togglePanMode(true)
            setCurrentElementInBase('pan')
            return
        }
        setCurrentElementInBase(element)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [twoJSInstance, setTwoJSInstance] = useState<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [zuiInstance, setZuiInstance] = useState<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [onGroup, setOnGroup] = useState<any>(null)
    // Right-click / two-finger context menu position (null = closed).
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(
        null
    )
    const [componentsToRender, setComponentsToRender] = useState<
        React.ComponentType[]
    >([])

    const stateRefForComponentStore = useRef<ComponentStore | undefined>(
        undefined
    )
    const isPencilModeRef = useRef<boolean>(props.isPencilMode)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zuiInstanceRef = useRef<any>(null)
    const renderGroupRef = useRef<
        ((currentComponents: ComponentRecord[]) => void) | null
    >(null)
    const prevElementsRef = useRef<string[]>([])
    const componentsToRenderRef = useRef<React.ComponentType[]>([])
    // Holds the latest createTextAtSurface from BaseContext so the dblclick
    // handler (registered once inside addZUI) sees fresh closure state.
    const createTextAtSurfaceRef = useRef<
        ((x: number, y: number) => void) | null
    >(null)
    useEffect(() => {
        createTextAtSurfaceRef.current = createTextAtSurface
    }, [createTextAtSurface])

    // Latest onCameraChange callback. Read from inside addZUI's DOM event
    // handlers via the ref to avoid the stale-closure trap (see CLAUDE.md).
    const onCameraChangeRef = useRef<
        ((event: CameraChangeEvent) => void) | undefined
    >(props.onCameraChange)
    useEffect(() => {
        onCameraChangeRef.current = props.onCameraChange
    }, [props.onCameraChange])

    const { clipboardRef, lastMouseRef } = useCanvasClipboard({
        twoJSInstance,
        zuiInstanceRef,
        baseId: props.baseId,
        addToLocalComponentStore,
        recordBatchToHistoryLog,
        renderGroupRef,
        stateRefForComponentStore,
    })

    useEffect(() => {
        const elem = document.getElementById('main-two-root')
        if (!elem) return

        const two = new Two({ fullscreen: true }).appendTo(elem)
        two.update()

        let zui_instance = addZUI(
            props,
            two,
            updateToGlobalState,
            updateComponentVertices,
            setOnGroupHandler,
            addToLocalComponentStore,
            setSelectedComponentInBase,
            () => setArrowDrawModeInBase(false),
            () => setTextDrawModeInBase(false),
            resetToHomeTool,
            updateComponentBulkPropertiesInLocalStore,
            deleteComponentFromLocalStore,
            isPencilModeRef,
            createTextAtSurfaceRef,
            onCameraChangeRef,
            activeBaseTypeRef
        )

        // Floating render origin: keeps far-from-anchor elements from shaking
        // on zoom by splitting the camera across a wrapper <g> so the browser
        // never composes million-unit surface coordinates in float32. Purely a
        // DOM concern — it adds nothing to two.scene.children and leaves every
        // element's translation in absolute surface coords.
        const renderOrigin = installRenderOrigin(two)

        // Dev-only handles for profiling the camera from the console or a
        // headless perf harness (drive the zoom/pan without synthesising input).
        if (import.meta.env.DEV) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(window as any).__cbZui = zui_instance.zui
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(window as any).__cbTwo = two
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(window as any).__cbRenderOrigin = renderOrigin
        }

        setZuiInstance(zui_instance)
        setTwoJSInstance(two)
        setTwoJSInstanceInBase(two)
        setZuiInstanceInBase(zui_instance)

        // Restore last mobile viewport (zoom + pan) from localStorage.
        // Use ZUI's own API so its internal zScale stays in sync with the
        // scene — setting two.scene.scale directly desynchronises ZUI and
        // causes the first pan gesture to jump back to the origin.
        const applyViewport = (vp: StoredViewport): boolean => {
            try {
                const { tx, ty, scale } = vp
                // zoomSet updates zui.zScale + surface.scale atomically.
                // Centering at (0,0) with initial translation (0,0) means no
                // translation side-effect from the zoom.
                zui_instance.zui.zoomSet(scale, 0, 0)
                // translateSurface increments from the post-zoom translation
                // (still 0,0) to the saved position.
                zui_instance.zui.translateSurface(tx, ty)
                two.update()
                return true
            } catch (_) {
                return false
            }
        }

        const restoreViewport = (mobile: boolean): boolean => {
            if (!props.baseId) return false
            const parsed = readViewport(
                props.baseId,
                activeBaseTypeRef.current,
                mobile
            )
            if (!parsed) return false
            return applyViewport(parsed)
        }

        // First-land seed: a base opened from Share carries the originating
        // '/' viewport (pan + zoom) in the URL (vx/vy/vs). Clone it into this
        // base's viewport localStorage key(s) so restoreViewport below lands
        // on the same view instead of the origin. Seed both desktop+mobile keys
        // (sharer and opener may be on different devices), then strip the params
        // so a later reload uses the save-as-you-go value rather than the frozen
        // param — i.e. subsequent reloads honour the last pan/zoom for this base.
        if (props.baseId) {
            const params = new URLSearchParams(window.location.search)
            if (params.has('vx') && params.has('vy') && params.has('vs')) {
                const tx = Number(params.get('vx'))
                const ty = Number(params.get('vy'))
                const scale = Number(params.get('vs'))
                // Guard against malformed/tampered params — a NaN here would
                // feed zoomSet/translateSurface and corrupt the scene.
                if (
                    Number.isFinite(tx) &&
                    Number.isFinite(ty) &&
                    Number.isFinite(scale) &&
                    scale > 0
                ) {
                    // Seed both desktop+mobile keys for the base the link
                    // opens on (sharer and opener may be on different devices).
                    const seeded = { tx, ty, scale }
                    writeViewport(
                        props.baseId,
                        activeBaseTypeRef.current,
                        false,
                        seeded
                    )
                    writeViewport(
                        props.baseId,
                        activeBaseTypeRef.current,
                        true,
                        seeded
                    )
                }
                // Strip the params regardless so a reload never re-seeds.
                window.history.replaceState({}, '', window.location.pathname)
            }
        }

        // First-open landing: put a shared map on the spot its author shared.
        //
        // The base row carries the view as lng/lat/zoom rather than the
        // camera's own tx/ty/scale, because those are pixel translations —
        // replaying a desktop pan on a phone lands somewhere else entirely. So
        // the geography is converted to a camera HERE, against this device's
        // viewport. Pure mercator arithmetic, no maplibre, which matters: at
        // this point the resolved provider is still the board base.
        //
        // "First open" is defined as "this base+type+device has no saved
        // camera". That needs no extra flag and is self-cleaning: once the
        // recipient pans, the save-as-you-go writer owns the camera and this
        // never fires again. After the 30-day viewport TTL it lands them on the
        // shared spot once more, which is the right answer for a link revisited
        // months later. It sits after the vx/vy/vs block so an explicit param
        // link still wins.
        let landedViewport: StoredViewport | null = null
        const landing = props.initialMapLanding
        if (props.baseId && landing && activeBaseTypeRef.current === 'map') {
            const alreadyHasCamera =
                readViewport(props.baseId, 'map', isMobile) !== null
            if (!alreadyHasCamera) {
                const scale = scaleForMapZoom(landing.zoom, landing.anchor)
                const { x, y } = lngLatToSurface(landing.lngLat, landing.anchor)
                const vw = two.width || window.innerWidth
                const vh = two.height || window.innerHeight
                landedViewport = {
                    scale,
                    tx: vw / 2 - x * scale,
                    ty: vh / 2 - y * scale,
                }
                // Current device's key only — unlike the vx/vy/vs path above,
                // which copies opaque pixels and so seeds both. These tx/ty were
                // computed from THIS viewport, so writing them under the other
                // form factor's key would be a wrong pan. A recipient who later
                // crosses the breakpoint gets the landing re-derived from the
                // geography instead, which is strictly better.
                writeViewport(props.baseId, 'map', isMobile, landedViewport)
            }
        }

        if (props.baseId) {
            // Widen the camera to the ACTIVE base's range FIRST. addZUI opens
            // on the board base's 6%–800% (it has no idea which type this is), and
            // the map reaches far below that floor — so restoring a saved map
            // camera against the board base's floor silently clamps it. That is what
            // made a base saved at map z8 reopen at ~z11: scale 0.0039 was
            // pinned to 0.06, and nothing re-applied the saved value once
            // base.tsx installed the real limits a beat later.
            //
            // Read from the static table, not `baseTypeProvider`: providers load
            // through a dynamic import, so at this point the resolved provider
            // is still the board base no matter which type the base opens on.
            const limits = zoomLimitsForBaseType(activeBaseTypeRef.current)
            zui_instance.setZoomLimits(limits.min, limits.max)
            // Fall back to the landing we just computed if the read comes back
            // empty. `writeViewport` swallows quota/private-mode failures by
            // design, and trusting the localStorage round-trip would drop a
            // recipient in private browsing at the origin with no clue why.
            if (!restoreViewport(isMobile) && landedViewport) {
                applyViewport(landedViewport)
            }
        }

        // Auto-fit-on-load: a base can land showing empty space — either the
        // camera is at the origin (no seeded/saved viewport) while content sits
        // far away, OR a stale/bad saved viewport (30-day TTL, save-as-you-go) or
        // a shared link's seeded viewport points at emptiness. In every one of
        // those cases the user has to hunt for the content by zooming out.
        //
        // So the trigger is content *visibility*, not "nothing restored": the
        // componentStore effect settles the (async-loaded) elements, then fits
        // ONLY IF no element is on-screen. A good restored view (or a deliberate
        // zoom into one region) shows content → left untouched. Runs once.
        //
        // Scope to URL-loaded bases (/base/:id, /map/:id) only. Local drafts
        // (`/`) also carry a baseId (localBaseId) but seed the
        // deliberately-placed welcome sketch — reframing that would disturb the
        // intended landing.
        //
        // A shared landing stands auto-fit down. The two are mutually exclusive
        // by definition: auto-fit is the rescue for a camera nobody chose, and
        // a landing is a camera someone chose deliberately. Someone can quite
        // reasonably share a view with the pins just off-frame, and fitting
        // would throw that away and reframe on content they aimed away from.
        pendingInitialFitRef.current =
            Boolean(props.baseId && isUrlBasePath()) && !landedViewport

        // Reflect the stored dot-grid flag on the root (adds `cb-dot-grid` when
        // enabled) and seed the parchment grid from the restored (or default)
        // camera so it lands aligned on first paint, not just on the first
        // pan/zoom. No-op visually when the flag is off.
        zui_instance.syncDotGridClass()

        onCameraChangeRef.current?.({
            scale: two.scene.scale as number,
            tx: two.scene.translation.x,
            ty: two.scene.translation.y,
        })

        const baseId = props.baseId
        const tabsOpen = localStorage.getItem(`tabs_open_${baseId}`)
        if (tabsOpen == null) {
            localStorage.setItem(`tabs_open_${baseId}`, '1')
        } else {
            localStorage.setItem(
                `tabs_open_${baseId}`,
                String(parseInt(tabsOpen) + 1)
            )
        }

        window.onunload = function (e) {
            const newTabCount = localStorage.getItem(`tabs_open_${baseId}`)
            if (newTabCount !== null) {
                localStorage.setItem(
                    `tabs_open_${baseId}`,
                    String(Number(newTabCount) - 1)
                )
            }
        }

        // Two.js `fullscreen: true` mutates document.body inline styles
        // (overflow:hidden, position:fixed, margin/padding/inset:0) and binds
        // a window 'resize' listener — none of which it auto-reverts. Without
        // this cleanup, leaving the Board (e.g. navigating to /privacy or
        // /support) leaves <body> scroll-locked so those pages can't scroll.
        // Resetting to '' drops the inline declarations so the stylesheet /
        // browser defaults take over again; remounting the Board re-applies
        // them, so the whiteboard's no-scroll behavior is unchanged.
        return () => {
            renderOrigin.uninstall()
            zui_instance?.disconnectThemeObserver?.()
            zui_instance?.disposeEraserTrail?.()
            for (const prop of [
                'overflow',
                'position',
                'margin',
                'padding',
                'top',
                'left',
                'right',
                'bottom',
            ]) {
                document.body.style.removeProperty(prop)
            }
        }
    }, [])

    // Handle for an in-flight z-order reconcile poll so a new store change can
    // cancel a stale one instead of stacking rAF loops.
    const zOrderPollRef = useRef<number | null>(null)
    // Set true on mount when a base opened with no seeded/saved viewport should
    // be zoom-to-fit once its (async-loaded) content settles. Consumed + cleared
    // by the one-time fit poll in the componentStore effect so it fires once.
    const pendingInitialFitRef = useRef<boolean>(false)
    const initialFitPollRef = useRef<number | null>(null)

    // Deterministically re-sort the element groups inside two.scene.children by
    // their store `position` (back→front). Element mounting is async (React.lazy
    // + Suspense), so groups land in the scene in unpredictable order — this is
    // the single source of truth that fixes the post-refresh z-order. Reads live
    // state from refs (stale-closure rule); idempotent and safe to re-run.
    const reconcileZOrder = useCallback(() => {
        const two = twoJSInstance
        const store = stateRefForComponentStore.current
        if (!two?.scene || !store) return
        const scene = two.scene
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children = scene.children as any[]

        // Skip while a transient group selection (marquee selector or the
        // mounted groupobject) is active. Such a group is NOT reorderable
        // (isReorderableElementChild excludes GROUP_COMPONENT) and its grouped
        // originals are hidden (opacity 0) beneath it, so there is nothing
        // useful to reorder. More importantly, the groupobject mounts its child
        // elements asynchronously: sorting + two.update() mid-mount can detach
        // the just-built group node (the scene.subtractions pitfall in
        // CLAUDE.md), silently destroying the selection. The componentStore
        // effect re-runs this poll once the group is dismissed and the
        // originals re-render, so deterministic z-order is still restored then.
        const hasActiveGroupSelection = children.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) =>
                c?.elementData?.isGroupSelector === true ||
                c?.elementData?.componentType === GROUP_COMPONENT
        )
        if (hasActiveGroupSelection) return

        // Build the desired final order: element groups sorted by their store
        // position (back→front) dropped back into the index slots they already
        // occupy, while non-element children (selection box, previews) keep
        // their slots. A rank map gives a *total* order — returning 0 for
        // mixed pairs would break sort's transitivity contract and could
        // mis-order elements separated by an overlay.
        const sortedEls = children
            .filter((c) => isReorderableElementChild(c, store))
            .sort((a, b) =>
                compareByZOrder(
                    store[a.elementData.id],
                    store[b.elementData.id]
                )
            )
        let e = 0
        const desired = children.map((c) =>
            isReorderableElementChild(c, store) ? sortedEls[e++] : c
        )
        const rank = new Map<unknown, number>()
        desired.forEach((c, i) => rank.set(c, i))

        // Already in the desired order? Then there is nothing to restack, and
        // re-rendering would be pure waste. This matters because the reconcile
        // POLL re-runs this every frame while a base mounts: each render is
        // O(scene) in the SVG renderer, so unconditionally rendering here cost
        // ~90 full-scene renders per store change on a large base.
        const alreadyOrdered = children.every((c, i) => desired[i] === c)
        if (alreadyOrdered) return

        // Collection.sort fires the 'order' event that flags the SVG renderer
        // to physically reorder the <g> nodes — a bare splice would NOT.
        children.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))

        // The just-sorted elements may have buried the selection overlay — lift
        // it back on top so the active selection box stays visible.
        zuiInstanceRef.current?.bringSelectionToFront?.()

        // An arrow's "selected" look is its two endpoint circles, shown while
        // the arrow group's <g> holds DOM focus. The restack below detaches and
        // re-appends that <g> to reorder it, which blurs the focused node and
        // fires arrowLine's blur handler — hiding the circles even though the
        // arrow is still the active selection. Capture the selected arrow now so
        // we can re-assert its endpoints after the restack settles.
        const selectedGroup = zuiInstanceRef.current?.getSelectedGroup?.()
        const selectedArrow =
            selectedGroup?.elementData?.componentType === 'arrowLine'
                ? selectedGroup
                : null

        try {
            two.update()
        } catch (err) {
            // A concurrent mount/cleanup could leave a stale subtraction queued;
            // clear it so future updates don't keep retrying the broken op (see
            // the scene.subtractions pitfall in CLAUDE.md).
            console.warn('reconcileZOrder two.update failed', err)
            scene.subtractions.length = 0
            scene._flagSubtractions = false
        }

        // Re-show the endpoints AFTER the restack: the blur (and its own nested
        // two.update) has already run during the update above, so setting them
        // visible now and re-rendering sticks. The node is no longer focused, so
        // this second update doesn't reorder and can't re-trigger the blur.
        if (selectedArrow) {
            setArrowEndpointsVisible(selectedArrow, true)
            try {
                two.update()
            } catch {
                scene.subtractions.length = 0
                scene._flagSubtractions = false
            }
        }
    }, [twoJSInstance])

    // Element groups appear in the scene over several frames as their lazy
    // chunks resolve. Poll a few frames, reconciling each tick, until every
    // expected element group is present (or a frame cap as a safety stop).
    const startZOrderReconcilePoll = useCallback(() => {
        if (zOrderPollRef.current !== null) {
            cancelAnimationFrame(zOrderPollRef.current)
            zOrderPollRef.current = null
        }
        const two = twoJSInstance
        const store = stateRefForComponentStore.current
        if (!two?.scene || !store) return

        // Expected = store records that are reorderable AND map to a known
        // element module (others are skipped by handleSetComponentsToRender).
        const expected = Object.values(store).filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (r: any) =>
                r?.componentType !== GROUP_COMPONENT &&
                !!elementModules[
                    `./components/elements/${r?.componentType}.tsx`
                ]
        ).length

        let frame = 0
        const MAX_FRAMES = 90
        const tick = (): void => {
            zOrderPollRef.current = null
            reconcileZOrder()
            const present = (two.scene.children as unknown[]).filter((c) =>
                isReorderableElementChild(c, store)
            ).length
            frame += 1
            if (present < expected && frame < MAX_FRAMES) {
                zOrderPollRef.current = requestAnimationFrame(tick)
            }
        }
        zOrderPollRef.current = requestAnimationFrame(tick)
    }, [twoJSInstance, reconcileZOrder])

    useEffect(
        () => () => {
            if (zOrderPollRef.current !== null) {
                cancelAnimationFrame(zOrderPollRef.current)
            }
            if (initialFitPollRef.current !== null) {
                cancelAnimationFrame(initialFitPollRef.current)
            }
        },
        []
    )

    useEffect(() => {
        stateRefForComponentStore.current = props.componentStore
        if (twoJSInstance !== null && zuiInstance !== null) {
            let domElement = twoJSInstance?.renderer?.domElement
            // Reset stale drag state so a resize followed by a store update
            // (e.g. undo) doesn't leave the element dragging on next mousemove
            zuiInstance.resetDragState()
            domElement.addEventListener(
                'mousemove',
                zuiInstance.mousemove,
                false
            )
        }

        if (Object.values(props.componentStore).length > 0 && twoJSInstance) {
            handleSetComponentsToRender(Object.values(props.componentStore))
            // Re-assert deterministic z-order once the (async) element mounts
            // settle — this is what fixes the post-refresh ordering bug.
            startZOrderReconcilePoll()

            // One-time auto-fit-on-load (see the mount effect). The base's
            // content arrives async: element groups enter the scene a frame or
            // two BEFORE their component applies x/y, so settling on the child
            // *count* is too early — the visibility test would run while the
            // groups are still at the origin and wrongly conclude "visible".
            // Instead settle on the content *geometry*: poll the surface-bounds
            // signature until it's non-empty and unchanged for a few frames
            // (positions applied). Then force a render so worldMatrix is current,
            // and fit only if nothing is on-screen. One-shot: clear the flag so
            // later edits never re-fit. A cap bails out on a genuinely empty or
            // never-settling base (chunks that never load).
            if (pendingInitialFitRef.current && zuiInstance) {
                if (initialFitPollRef.current !== null) {
                    cancelAnimationFrame(initialFitPollRef.current)
                }
                let lastSig: string | null = null
                let stableFrames = 0
                let frame = 0
                const MAX_FRAMES = 600
                const tryFit = (): void => {
                    initialFitPollRef.current = null
                    const sig = zuiInstance.contentBoundsSignature?.() ?? ''
                    stableFrames =
                        sig !== '' && sig === lastSig ? stableFrames + 1 : 0
                    lastSig = sig
                    frame += 1
                    if (
                        (sig !== '' && stableFrames >= 3) ||
                        frame >= MAX_FRAMES
                    ) {
                        if (sig !== '') {
                            // Ensure the SVG (and each group's worldMatrix) is
                            // rendered at the settled positions before the
                            // camera-relative visibility test.
                            try {
                                twoJSInstance.update()
                            } catch (_) {
                                /* tear-down races are non-fatal here */
                            }
                            if (!zuiInstance.hasVisibleContent?.()) {
                                zuiInstance.fitToContent?.()
                            }
                        }
                        pendingInitialFitRef.current = false
                        return
                    }
                    initialFitPollRef.current = requestAnimationFrame(tryFit)
                }
                initialFitPollRef.current = requestAnimationFrame(tryFit)
            }
        }
    }, [props.componentStore])

    useEffect(() => {
        if (props.lastAddedElement !== null) {
            handleSetComponentsToRender([
                { ...props.lastAddedElement, isDummy: true },
            ])
        }
    }, [props.lastAddedElement])

    useEffect(() => {
        isPencilModeRef.current = props.isPencilMode
        // Toggling the pencil tool means no stroke is in flight — clear the
        // guard so a missed mouseup can't leave undo blocked indefinitely.
        isPencilStrokeActive = false
        const root = document.getElementById('main-two-root')
        if (props.isPencilMode === true) {
            isDrawing = true
            if (root) root.style.cursor = 'crosshair'
        } else {
            isDrawing = false
            if (root) root.style.cursor = 'auto'
        }
    }, [props.isPencilMode])

    useEffect(() => {
        defaultLinewidthValue = props.defaultLinewidth || 1
    }, [props.defaultLinewidth])

    useEffect(() => {
        defaultStrokeTypeValue = props.defaultStrokeType || null
    }, [props.defaultStrokeType])

    useEffect(() => {
        defaultStrokeColorValue =
            props.defaultStrokeColor || PENCIL_DEFAULT_COLOR
    }, [props.defaultStrokeColor])

    useEffect(() => {
        defaultTextSizeValue = props.defaultTextSize || DEFAULT_TEXT_SIZE
    }, [props.defaultTextSize])

    // on group select use effect hook
    useEffect(() => {
        if (onGroup) {
            // Cancel any in-flight z-order reconcile poll started by an earlier
            // store change. The groupobject mounts its children asynchronously;
            // a reconcile tick that fires in the gap *before* the group node is
            // in the scene (so reconcileZOrder's group guard can't see it yet)
            // would sort + two.update() mid-mount and detach the just-built
            // group (scene.subtractions pitfall), dropping the selection.
            if (zOrderPollRef.current !== null) {
                cancelAnimationFrame(zOrderPollRef.current)
                zOrderPollRef.current = null
            }
            let e = onGroup
            let x1Coord = e.left
            let x2Coord = e.right
            let y1Coord = e.top
            let y2Coord = e.bottom

            let xMid = parseInt(String(e.left)) + Math.floor(e.width / 2)
            let yMid = parseInt(String(e.top)) + Math.floor(e.height / 2)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newGroup: any = {}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newChildren: any[] = []
            const selectedComponentArr: string[] = []

            // Iterate in global z-order (position asc = back→front) so the
            // group's internal child order mirrors the canvas stacking. The
            // group adds children in array order (groupobject.tsx) where
            // index 0 is the backmost, so feeding them sorted keeps grouped
            // elements visually consistent with their ungrouped positions.
            //
            // Only elements that belong to the ACTIVE base are candidates. The
            // hit-test is geometric over stored coordinates, and every element
            // keeps its coordinates on every base — so without this filter a
            // marquee on the map silently swallows the whiteboard shapes lying
            // under it (hidden, but still in the store), and vice versa. The
            // rule is the same one `applyBaseTypeVisibility` paints with; sharing it
            // is what keeps "what I can see" and "what I can select" in step.
            const allComponentCoords = (
                stateRefForComponentStore.current
                    ? Object.values(stateRefForComponentStore.current).sort(
                          compareByZOrder
                      )
                    : []
            ).filter((record) =>
                isRecordVisibleOnBaseType(record, activeBaseTypeRef.current)
            )

            // Geometric marquee hit-test on an element's stored origin.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isInsideMarquee = (item: any): boolean =>
                item.x > x1Coord &&
                item.x < x2Coord &&
                item.y > y1Coord &&
                item.y < y2Coord

            // A connector's origin (item.x/y) is a single point near its tail —
            // NOT its span or its attachment — so the bare geometric test flips
            // it in/out of the group depending on exactly where the marquee
            // lands (see the "whole vs head-only" inconsistency). Decide shape
            // membership geometrically first, then pull in every connector docked
            // to a member shape regardless of its origin, so a bound connector
            // ALWAYS travels with its group. commitGroupMove already re-glues any
            // endpoint docked to a shape OUTSIDE the group (restackPorts), so a
            // connector straddling the boundary stays correct after the move.
            const memberShapeIds = new Set(
                allComponentCoords
                    .filter(
                        (it) =>
                            it.componentType !== 'arrowLine' &&
                            isInsideMarquee(it)
                    )
                    .map((it) => it.id)
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isMember = (item: any): boolean => {
                if (isInsideMarquee(item)) return true
                // Bound connector: member iff docked to a member shape.
                if (item.componentType === 'arrowLine') {
                    return (
                        memberShapeIds.has(item.tailShapeId) ||
                        memberShapeIds.has(item.headShapeId)
                    )
                }
                return false
            }

            allComponentCoords.forEach((item) => {
                if (isMember(item)) {
                    selectedComponentArr.push(item.id)

                    let relativeX = item.x - xMid
                    let relativeY = item.y - yMid

                    let newMetadata = item.metadata
                    // pencil + geo area/route + curvedLine all store an absolute
                    // {x,y} vertex array; remap it into the group's child
                    // coordinate space (else the factory builds the path at a
                    // wrong offset and the member renders off-screen / invisible).
                    if (
                        (item.componentType === 'pencil' ||
                            item.componentType === 'area' ||
                            item.componentType === 'route' ||
                            item.componentType === 'curvedLine') &&
                        Array.isArray(item.metadata)
                    ) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const meta = item.metadata as any[]
                        newMetadata = meta.map((vert) => {
                            const lwProp =
                                vert.lw !== undefined ? { lw: vert.lw } : {}
                            // Group-relative vertex = ABSOLUTE vertex − the
                            // group's integer midpoint. Anchor every vertex to
                            // its own absolute coord, NOT the stored member
                            // origin (item.x/y): a curvedLine's x/y is its first
                            // vertex at *creation* and drifts after a vertex
                            // edit, so the old item.x-keyed formula translated
                            // the whole curve by that drift on group. The member
                            // origin's integer part cancels against the factory's
                            // prevX, so metadata alone sets position. Floats (no
                            // trunc) keep pencil's Chaikin smoothing on its path.
                            return {
                                x: vert.x - xMid,
                                y: vert.y - yMid,
                                ...lwProp,
                            }
                        }) as unknown as typeof item.metadata
                    }
                    let obj = {
                        ...item,
                        metadata: newMetadata,
                        id: item.id,
                        componentType: item.componentType,
                        x: relativeX,
                        relativeX: relativeX,
                        y: relativeY,
                        relativeY: relativeY,
                    }

                    // For arrowLine / line: read actual vertex coordinates from
                    // Two.js scene to preserve direction (componentStore may have
                    // stale/missing values)
                    if (isLineLikeType(item.componentType)) {
                        const arrowShape = twoJSInstance.scene.children.find(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (child: any) => child?.elementData?.id === item.id
                        )
                        // Arrow factory adds line as first child (line, pointCircle1Group, pointCircle2Group)
                        const line = arrowShape?.children?.[0]
                        if (line?.vertices?.length >= 2) {
                            // Keep endpoints as floats — do NOT Math.trunc. These
                            // are local vertex coords; truncating them dropped the
                            // arrow sub-pixel off its original. The member origin
                            // is truncated once in groupobject (matching the arrow
                            // factory's parseInt translation), so float endpoints
                            // reconstruct the line exactly over the original.
                            obj.x1 = line.vertices[0].x
                            obj.y1 = line.vertices[0].y
                            obj.x2 = line.vertices[1].x
                            obj.y2 = line.vertices[1].y
                        }
                    }

                    newChildren.push(obj)
                }
            })

            newGroup.id = Math.floor(100000 + Math.random() * 900000)
            newGroup.componentType = 'groupobject'
            newGroup.width = e.width
            newGroup.height = e.height
            // Use the SAME integer midpoint that the children's relative coords
            // (relativeX/Y above) were computed against. groupobject truncates
            // this into group.translation; if it diverged from xMid/yMid by even
            // a fraction (float surface coords, odd width, panned origin) every
            // member copy would render group.translation + relativeX ≠ item.x —
            // the slight displacement seen on select-before-blur. Reusing xMid/
            // yMid makes the reconstruction cancel to exactly item.x.
            newGroup.x = xMid
            newGroup.y = yMid

            newGroup.children = newChildren

            // Defer hiding the originals to the group's own assembly so the
            // swap is atomic — the group hides exactly these ids in the SAME
            // two.update() that paints its member copies, so there is never a
            // blank frame between "originals hidden" and "group copies drawn"
            // (the residual group-select flicker). Only the group-SELECT path
            // sets this; paste leaves it unset (its clones have no on-canvas
            // originals to hide).
            newGroup.membersToHide = [...selectedComponentArr]

            handleSetComponentsToRender([newGroup])
        }
    }, [onGroup])

    useEffect(() => {
        zuiInstanceRef.current = zuiInstance
    }, [zuiInstance])

    useEffect(() => {
        const onUndoRedoKeyDown = (evt: KeyboardEvent) => {
            if (evt.key.toLowerCase() === 'z' && (evt.ctrlKey || evt.metaKey)) {
                // Live text editing (solo text component, shape inline text —
                // both are .temp-input-area textareas — or any other text
                // field): let the browser's native text undo handle the key
                // instead of popping a canvas action out from under the editor.
                const tag = document.activeElement?.tagName
                if (tag === 'INPUT' || tag === 'TEXTAREA') return
                evt.preventDefault()
                // Don't undo/redo mid-stroke — the in-progress pencil stroke
                // isn't in history yet, so undoing here would pop the wrong
                // (previously committed) element. User must finish the stroke
                // first. See isPencilStrokeActive.
                if (isPencilStrokeActive) return
                if (evt.shiftKey) {
                    redoLastAction()
                } else {
                    undoLastAction()
                }
            }
        }

        const onTextModeKeyDown = (evt: KeyboardEvent) => {
            if (evt.key !== 't' && evt.key !== 'T') return
            if (evt.ctrlKey || evt.metaKey || evt.altKey) return
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            if (
                localStorage.getItem(TEXT_DRAW_MODE_KEY) === 'true' ||
                localStorage.getItem(ARROW_DRAW_MODE_KEY) === 'true' ||
                localStorage.getItem(RUBBER_MODE_KEY) === 'true' ||
                localStorage.getItem(PENCIL_MODE_KEY) === 'TRUE' ||
                localStorage.getItem(GEO_DRAW_MODE_KEY) === 'true' ||
                localStorage.getItem(GEO_POINT_PLACE_MODE_KEY) === 'true' ||
                localStorage.getItem(PENDING_SHAPE_TYPE_KEY) !== null
            )
                return
            evt.preventDefault()
            enableTextDrawMode?.()
        }

        window.addEventListener('keydown', onUndoRedoKeyDown)
        window.addEventListener('keydown', onTextModeKeyDown)
        return () => {
            window.removeEventListener('keydown', onUndoRedoKeyDown)
            window.removeEventListener('keydown', onTextModeKeyDown)
        }
    }, [undoLastAction, redoLastAction, enableTextDrawMode])

    // Export the active selection (marquee group or single element) as a
    // standalone .svg. getSelectedGroup() unifies both selection mechanisms.
    const exportActiveSelection = useCallback(async () => {
        const group = zuiInstanceRef.current?.getSelectedGroup?.()
        if (!group) return
        try {
            await exportSelectionAsSvg(group)
        } catch (err) {
            console.warn('Export selection as SVG failed', err)
        }
    }, [])

    // Change the z-order of the currently-selected element. We move by *index*
    // in the deterministic sorted order, then renumber every row to a dense,
    // distinct position (0..n-1). The old approach swapped position *values*,
    // which silently no-ops whenever neighbours tie — and most legacy rows share
    // position 0 (position is only assigned to newly-created elements), so once a
    // shape stepped into the 0-block it could never come back. Renumbering
    // self-heals that degeneracy; only rows whose position actually changes are
    // written, so steady-state single-step moves touch just the couple that
    // shifted. The whole renumber is recorded as one BATCH = one undo step.
    const reorderSelected = useCallback(
        (op: 'front' | 'forward' | 'backward' | 'back') => {
            const store = stateRefForComponentStore.current
            if (!store) return
            const id =
                zuiInstanceRef.current?.getSelectedGroup?.()?.elementData?.id
            if (!id || !store[id]) return

            const sorted = Object.values(store)
                .filter((r) => r.componentType !== GROUP_COMPONENT)
                .sort(compareByZOrder)
            const n = sorted.length
            if (n === 0) return
            const idx = sorted.findIndex((r) => r.id === id)
            if (idx === -1) return

            // Target slot for the selected element in the final back→front order.
            const target =
                op === 'front'
                    ? n - 1
                    : op === 'back'
                      ? 0
                      : op === 'forward'
                        ? idx + 1
                        : idx - 1 // backward
            if (target < 0 || target > n - 1 || target === idx) return // at edge

            // Rebuild the order with the selected element moved to `target`.
            const newOrder = sorted.slice()
            const [moved] = newOrder.splice(idx, 1)
            if (!moved) return
            newOrder.splice(target, 0, moved)

            // Assign dense distinct positions; write + record only what changed.
            const batch: HistoryEntry[] = []
            newOrder.forEach((r, i) => {
                const prev = Number.isFinite(r.position)
                    ? (r.position as number)
                    : 0
                if (prev === i) return
                updateComponentBulkPropertiesInLocalStore(
                    r.id,
                    { position: i },
                    true
                )
                batch.push({
                    action: 'UPDATE_BULK',
                    id: r.id,
                    prevProps: { position: prev },
                    bulkObj: { position: i },
                })
            })
            if (batch.length > 0) recordBatchToHistoryLog(batch)

            reconcileZOrder()
        },
        [
            updateComponentBulkPropertiesInLocalStore,
            recordBatchToHistoryLog,
            reconcileZOrder,
        ]
    )

    // Publish reorderSelected up to base.tsx so the properties toolbar can
    // trigger it through BaseContext (see the reorderSelectedRef bridge).
    useEffect(() => {
        const ref = props.reorderSelectedRef
        if (ref) ref.current = reorderSelected
        return () => {
            if (ref) ref.current = null
        }
    }, [props.reorderSelectedRef, reorderSelected])

    // Publish fitToContent up to base.tsx (see the fitToContentRef bridge) so
    // the "Go to content" button can frame all elements on demand. Reads the
    // live zui handle via its ref so it never captures a stale instance.
    useEffect(() => {
        const ref = props.fitToContentRef
        if (ref)
            ref.current = () =>
                Boolean(zuiInstanceRef.current?.fitToContent?.())
        return () => {
            if (ref) ref.current = null
        }
    }, [props.fitToContentRef])

    // Right-click (mouse) and two-finger trackpad tap both fire the native
    // 'contextmenu' event. Suppress the OS menu; if something is selected, open
    // our menu at the cursor. Cmd/Ctrl+Shift+D triggers the same export.
    useEffect(() => {
        const root = document.getElementById('main-two-root')
        if (!root) return

        const onContextMenu = (evt: MouseEvent) => {
            evt.preventDefault()
            const group = zuiInstanceRef.current?.getSelectedGroup?.()
            if (group) {
                setCtxMenu({ x: evt.clientX, y: evt.clientY })
            } else {
                setCtxMenu(null)
            }
        }

        const onExportKeyDown = (evt: KeyboardEvent) => {
            if (
                evt.key.toLowerCase() !== 'd' ||
                !(evt.ctrlKey || evt.metaKey) ||
                !evt.shiftKey
            )
                return
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            evt.preventDefault()
            void exportActiveSelection()
        }

        // Reorder shortcuts:
        //   [ / ]    → backward / forward (one step)
        //   ⌘[ / ⌘]  → to back / to front
        // We deliberately avoid ⌘⇧[/⌘⇧] here: on macOS Chrome those are the
        // reserved "switch tab" accelerators (native app-menu key equivalents)
        // and preventDefault() can't cancel them — the page never wins. Detect
        // brackets via code OR key so non-US layouts resolve too. Only hijack
        // the key when a shape is actually selected, so bare [ /] stay inert and
        // ⌘[ /⌘] keep their browser history-nav behaviour on an empty selection.
        const onReorderKeyDown = (evt: KeyboardEvent) => {
            if (evt.shiftKey || evt.altKey) return
            const isRight =
                evt.code === 'BracketRight' ||
                evt.key === ']' ||
                evt.key === '}'
            const isLeft =
                evt.code === 'BracketLeft' || evt.key === '[' || evt.key === '{'
            if (!isRight && !isLeft) return
            const el = document.activeElement as HTMLElement | null
            const tag = el?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable)
                return
            if (!zuiInstanceRef.current?.getSelectedGroup?.()) return
            evt.preventDefault()
            const withCmd = evt.metaKey || evt.ctrlKey
            const op: 'front' | 'forward' | 'backward' | 'back' = isRight
                ? withCmd
                    ? 'front'
                    : 'forward'
                : withCmd
                  ? 'back'
                  : 'backward'
            reorderSelected(op)
        }

        root.addEventListener('contextmenu', onContextMenu)
        window.addEventListener('keydown', onExportKeyDown)
        window.addEventListener('keydown', onReorderKeyDown)
        return () => {
            root.removeEventListener('contextmenu', onContextMenu)
            window.removeEventListener('keydown', onExportKeyDown)
            window.removeEventListener('keydown', onReorderKeyDown)
        }
    }, [exportActiveSelection, reorderSelected])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setOnGroupHandler = (obj: any) => {
        setOnGroup(obj)
    }

    const handleSetComponentsToRender = (
        currentComponents: ComponentRecord[]
    ) => {
        let arr = [...prevElementsRef.current]
        // Membership set over `arr`: this runs for every record on every store
        // change, so a linear Array.includes() per item made it O(n²).
        const seen = new Set(arr)
        let components = [...componentsToRenderRef.current]
        if (currentComponents && twoJSInstance) {
            // console.log(
            //     'newCanvas ... Canvas ... handleSetComponentsToRender ... condition(currentComponents && twoJSInstance) === true ',
            //     prevElementsRef.current,
            //     currentComponents
            // )
            currentComponents.forEach((item) => {
                // prevElementsRef is the sole authority on whether a wrapper already exists.
                // We must NOT check existsInScene here: on slow networks the React lazy
                // module may still be loading (no Two.js group yet) when a second shape is
                // drawn, causing existsInScene=false even though a wrapper was already
                // created — which would produce a second wrapper and a duplicate shape.
                // Deletion removes the id from the ref via the 'elementRemoved' event,
                // so undo-of-delete still gets a fresh wrapper.
                const moduleLoader =
                    elementModules[
                        `./components/elements/${item.componentType}.tsx`
                    ]
                if (!moduleLoader) {
                    // componentType doesn't map to a known element file — skip to avoid a crash.
                    // This can happen if shapeData was null when stored (e.g. componentTypes
                    // query hadn't resolved yet).
                    return
                }

                if (seen.has(item.id)) {
                    // do nothing — wrapper already exists
                } else {
                    arr.push(item.id)
                    seen.add(item.id)
                    const ElementToRender = getLazyElement(
                        item.componentType,
                        moduleLoader as () => Promise<{
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            default: React.ComponentType<any>
                        }>
                    )
                    const data = {
                        twoJSInstance: twoJSInstance,
                        id: item.id,
                        baseId: props.baseId,
                        itemData: item,
                    }

                    let component = null
                    if (item.componentType === GROUP_COMPONENT) {
                        component = GroupRenderWrapper(ElementToRender, {
                            ...item,
                            ...data,
                        })
                    } else {
                        component = ElementRenderWrapper(
                            ElementToRender,
                            data,
                            deleteComponentFromLocalStore,
                            props.componentStore
                        )
                    }
                    components.push(component)
                }
            })
            componentsToRenderRef.current = components
            setComponentsToRender(components)
            if (twoJSInstance) prevElementsRef.current = arr
        }
    }
    renderGroupRef.current = handleSetComponentsToRender

    // When an element is deleted or its ADD is undone, remove it from prevElementsRef
    // so handleSetComponentsToRender can create a fresh wrapper if the element is
    // ever restored (e.g. undo of a delete).
    useEffect(() => {
        const handleElementRemoved = ((e: CustomEvent<{ id: string }>) => {
            // console.log(
            //     'newCanvas ... Canvas ... elementRemoved Event Listener',
            //     prevElementsRef.current
            // )
            const { id } = e.detail
            let updatedPrevElementsArr = prevElementsRef.current
            updatedPrevElementsArr = updatedPrevElementsArr.filter(
                (eid) => eid !== id
            )
            // console.log(
            //     'newCanvas ... Canvas ... elementRemoved Event Listener ... updatedPrevElementsArr',
            //     updatedPrevElementsArr
            // )
            prevElementsRef.current = updatedPrevElementsArr
        }) as EventListener
        window.addEventListener('elementRemoved', handleElementRemoved)
        return () => {
            window.removeEventListener('elementRemoved', handleElementRemoved)
        }
    }, [])

    const updateToGlobalState: UpdateToGlobalStateFn = (
        newShapeData,
        oldShapeData
    ) => {
        const userId = localStorage.getItem('userId')
        // prevX === -9999 means initial arrow placement — skip extra undo steps
        const isInitialArrowPlacement = newShapeData.prevX === -9999

        if (
            newShapeData.id &&
            (newShapeData.data.x != newShapeData.prevX ||
                newShapeData.data.y != newShapeData.prevY)
        ) {
            let updateObj = {
                x: parseInt(newShapeData.data.x),
                y: parseInt(newShapeData.data.y),
                updatedBy: userId,
            }
            updateComponentBulkPropertiesInLocalStore(
                newShapeData.id,
                updateObj,
                isInitialArrowPlacement
            )
        }

        if (newShapeData?.isLineCircle === true) {
            let updateObj = {
                x1: parseInt(newShapeData.data.x1),
                x2: parseInt(newShapeData.data.x2),
                y1: parseInt(newShapeData.data.y1),
                y2: parseInt(newShapeData.data.y2),
                updatedBy: userId,
            }
            updateComponentBulkPropertiesInLocalStore(
                newShapeData.parentData.elementData.id,
                updateObj,
                isInitialArrowPlacement
            )
        }
    }

    const updateComponentVertices: UpdateComponentVerticesFn = (id, x, y) => {
        updateComponentVerticesInLocalStore(id, x, y)
        const btn = document.getElementById('show-click-anywhere-btn')
        if (btn) btn.style.opacity = '0'
    }

    return (
        <>
            {/* {import.meta.env.DEV && <PerfOverlay />} */}
            <div id="selector-rect"></div>
            {/* Backdrop slot for the active base provider (see src/bases).
                The consumer's renderBackground override renders inside it so
                apps predating the base system keep their background layer. */}
            <div id={BASE_ROOT_ID}>{props.renderBackground?.()}</div>
            <div id="main-two-root"></div>
            {componentsToRender.map((Component, index) => (
                <Suspense key={index} fallback={<Loader />}>
                    <Component />
                </Suspense>
            ))}
            {ctxMenu && (
                <CanvasContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    onClose={() => setCtxMenu(null)}
                    onExportSvg={() => {
                        setCtxMenu(null)
                        void exportActiveSelection()
                    }}
                    onReorder={(op) => {
                        setCtxMenu(null)
                        reorderSelected(op)
                    }}
                />
            )}
        </>
    )
}

export default Canvas
