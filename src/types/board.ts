// Single source of truth for craftbase's public surface types.
//
// During the JS → TS migration these are intentionally loose where they need
// to be: many fields carry internal handlers whose precise signatures live in
// still-JS hook/board files. Later stages will tighten function signatures
// in-place when those source files convert (hooks: Stage 4, board: Stage 10).
//
// Consumers (e.g. craftmaps) should rely on:
//   - BoardProps  — props accepted by the exported <Board /> component
//   - BoardContextValue — shape returned by useBoardContext()
//   - ComponentRecord — shape of a single component in the persisted store

import type { ReactNode, MutableRefObject } from 'react'
import type Two from 'two.js'
import type { EraserSize } from '../constants/misc'

// --- DB shape (mirrors CLAUDE.md "Component schema (from DB)") ----------

export interface ComponentMetadata {
    [key: string]: unknown
}

export interface ComponentRecord {
    id: string
    componentType: string
    /** Distinguishes geo objects (point/area/route) from regular shapes. */
    objectClass?: 'shape' | 'geo'
    x: number
    y: number
    x1: number
    x2: number
    y1: number
    y2: number
    width: number
    height: number
    fill: string
    stroke: string | null
    linewidth: number | null
    strokeType: string | null
    radius: number | null
    iconStroke: string | null
    textColor: string | null
    boardId: string | null
    boardName: string | null
    metadata: ComponentMetadata | null
    children: unknown | null
    isDummy: boolean | null
    updatedBy: string | null
    createdAt: number | null
    /**
     * Z-order key (back→front). Lower draws first (behind), higher draws on
     * top — matching Two.js `scene.children` where index 0 is the back. New
     * elements get `max(position)+1` (assigned in addToLocalComponentStore).
     * Optional/nullable: legacy DB rows and directly-seeded records (e.g. the
     * welcome sketch) may omit it; the z-order reconcile treats absent as 0.
     */
    position?: number | null
    /**
     * Connector binding (arrowLine only): the arrow's tail/head is pinned to a
     * shape's edge port and re-anchors when that shape moves/resizes. Stores the
     * bound shape's id and the edge (`n/e/s/w-resize`). Null/absent = free
     * endpoint; cleared when the user manually drags that endpoint off.
     */
    tailShapeId?: string | null
    tailEdge?: string | null
    headShapeId?: string | null
    headEdge?: string | null
    /**
     * Fan slot among the connectors docked at the same port (0 = the bare port
     * point; higher indices offset along the edge so stacked endpoints stay
     * distinguishable). Reassigned by restackPortConnectors on every release.
     */
    tailPortIndex?: number | null
    headPortIndex?: number | null
}

export type ComponentStore = Record<string, ComponentRecord>

// --- Consumer-facing props on <Board /> --------------------------------

export interface CameraChangeEvent {
    scale: number
    tx: number
    ty: number
}

// --- Point clustering (consumer-driven) --------------------------------

/** One point handed to the clustering callback. */
export interface PointScreenInfo {
    /** Component id (matches the DOM node's data-component-id). */
    id: string
    /** World/surface coordinates. */
    x: number
    y: number
    /** Viewport pixel center of the pin. */
    screenX: number
    screenY: number
    /** metadata.category, if any. */
    category?: string
}

/** A cluster the consumer wants craftbase to render in place of its points. */
export interface Cluster {
    /** Stable id for React keys / hit-testing. */
    id: string
    /** Viewport pixel center where the cluster marker is drawn. */
    screenX: number
    screenY: number
    /** Number to show on the badge. */
    count: number
    /** Points absorbed by this cluster — craftbase hides their pins. */
    pointIds: string[]
    /** Marker styling: dark (default) or the warm accent variant. */
    variant?: 'default' | 'warm'
}

export interface BoardProps {
    /** Fired on ZUI camera updates. See CLAUDE.md "Extension points over forks". */
    onCameraChange?: (event: CameraChangeEvent) => void
    /** Render slot mounted between #selector-rect and #main-two-root. */
    renderBackground?: () => ReactNode
    /** Overrides the zoom-readout shown in ZoomControls. */
    scaleToDisplay?: (scale: number) => string
    /**
     * Opt-in: surface geo tools (point / area / route) in the toolbar alongside
     * the regular shape tools. Default off — no-op when omitted, so the
     * standalone craftbase app is unaffected. Used by craftmaps.
     */
    geoObjectsEnabled?: boolean
    /**
     * Opt-in feature flag: cluster nearby points into a single marker. craftbase
     * only knows the screen camera, not real-world meters, so the actual grouping
     * is delegated to `clusterPoints` (e.g. craftmaps groups points within 100m
     * using its map projection). No-op when off or when no callback is supplied.
     */
    pointClusteringEnabled?: boolean
    /**
     * Consumer-supplied clustering. Given every point's world + screen position
     * and the current camera, return the clusters to render — craftbase draws a
     * marker per cluster and hides the absorbed `pointIds`. Required for
     * clustering to do anything; see `pointClusteringEnabled`.
     */
    clusterPoints?: (
        points: PointScreenInfo[],
        camera: CameraChangeEvent
    ) => Cluster[]
    /**
     * Opt-in: seed a small onboarding sketch on the first visit (no draft
     * restored, no prior dismissal). Dismissed the moment the user creates
     * their first element. Default off — craftmaps and other map-backed
     * consumers should leave this off and supply their own onboarding.
     */
    welcomeSketch?: boolean
}

// --- Context value ------------------------------------------------------

// Selected component is a complex Two.js-bound shape produced by the canvas.
// It carries `group.data.elementData` (a ComponentRecord) plus Two.js handles.
// Kept opaque here until canvas/selection internals convert (Stages 7–9).
export type SelectedComponent = unknown
export type SelectedGroup = unknown
// CurrentElement is the active toolbar tool name (e.g. 'pointer', 'rectangle',
// 'arrowLine', 'pencil', 'text'). Toolbar code compares against literal names.
export type CurrentElement = string

// History entry shape lives in useComponentHistory; tightened in Stage 4.
export type HistoryEntry = unknown

export interface BoardContextValue {
    // Identity / persistence
    boardId: string
    isPersisted: boolean
    persistBoard: () => Promise<string>
    backgroundBoardId: string | null
    onCreateBoard: () => void
    createBoardLoading: boolean
    clearBoard: () => void
    /** Open the file picker → parse → new-vs-merge chooser flow (P0 import). */
    beginBoardImport: () => void

    // Two.js handles
    twoJSInstance: Two | null
    setTwoJSInstanceInBoard: (instance: Two | null) => void
    zuiInBoard: unknown
    setZuiInstanceInBoard: (zui: unknown) => void

    // Drawing modes
    isPencilMode: boolean
    isArrowDrawMode: boolean
    isTextDrawMode: boolean
    isArrowSelected: boolean
    isRubberMode: boolean
    eraserSize: EraserSize
    isPanMode: boolean
    togglePencilMode: (value: boolean) => void
    togglePointer: (value: boolean) => void
    togglePanMode: (value: boolean) => void
    setArrowDrawModeInBoard: (value: boolean) => void
    setTextDrawModeInBoard: (value: boolean) => void
    setRubberModeInBoard: (value: boolean) => void
    setEraserSizeInBoard: (value: EraserSize) => void
    cancelPendingElement: () => void
    enableTextDrawMode: (componentType?: 'newText' | 'geoText') => void
    createTextAtSurface: (x: number, y: number) => void
    updateLastAddedElement: (element: unknown) => void

    // Selection
    selectedComponent: SelectedComponent | null
    setSelectedComponentInBoard: (component: SelectedComponent | null) => void
    selectedGroup: SelectedGroup | null
    currentElement: CurrentElement | null
    setCurrentElementInBoard: (element: CurrentElement | null) => void

    // Local component store mutations
    addToLocalComponentStore: (
        id: string,
        type: string,
        componentInfo: ComponentRecord,
        skipHistory?: boolean
    ) => void
    updateComponentVerticesInLocalStore: (
        id: string,
        x: number,
        y: number
    ) => void
    updateComponentBulkPropertiesInLocalStore: (
        id: string,
        update: Partial<ComponentRecord>,
        skipDbWrite?: boolean
    ) => void
    deleteComponentFromLocalStore: (id: string) => void
    deleteBulkComponentsFromLocalStore: (ids: string[]) => void
    stateRefForComponentStore: MutableRefObject<ComponentStore>
    // Reactive element store — re-renders consumers when elements are added or
    // removed (unlike stateRefForComponentStore, which is a mutable ref).
    componentStore: ComponentStore

    // Property application
    applyProperty: (
        name: string,
        value: unknown,
        opts?: { preview?: boolean }
    ) => void
    applyGroupProperty: (
        name: string,
        value: unknown,
        opts?: { preview?: boolean }
    ) => void

    // Z-order of the currently-selected element. Bridged up from newCanvas via
    // a ref (the implementation lives there alongside reconcileZOrder); a no-op
    // until Canvas has mounted and populated it.
    reorderSelected: (op: 'front' | 'forward' | 'backward' | 'back') => void

    // Frames all elements in the viewport (zoom-to-fit). Bridged from Canvas via
    // a ref (the fitToContent implementation lives on the live zui handle);
    // a no-op returning false until Canvas has mounted. Used by "Go to content".
    fitToContent: () => boolean

    // True while a selected element/group is being dragged or resized — the
    // properties toolbar hides itself so it doesn't overlap the element.
    isElementDragging: boolean

    // Element defaults (read sites: ElementPropertiesToolbar, primary sidebar, factories)
    defaultFill: string
    defaultStrokeColor: string
    defaultLinewidth: number
    defaultStrokeType: string | null
    defaultOpacity: number
    defaultTextColor: string
    defaultTextSize: string
    defaultTextFontFamily: string
    setDefaultLinewidthInBoard: (value: number) => void
    setDefaultStrokeTypeInBoard: (value: string | null) => void

    // Mobile toolbar panel
    showMobileToolbarPanel: boolean
    setShowMobileToolbarPanel: (value: boolean | ((prev: boolean) => boolean)) => void

    // Undo history
    historyLog: HistoryEntry[]
    historyLogRef: MutableRefObject<HistoryEntry[]>
    bucketLog: HistoryEntry[]
    bucketLogRef: MutableRefObject<HistoryEntry[]>
    recordBatchToHistoryLog: (entries: HistoryEntry[]) => void
    undoLastAction: () => void
    redoLastAction: () => void

    // Consumer extension points (forwarded from BoardProps)
    scaleToDisplay?: BoardProps['scaleToDisplay']
    geoObjectsEnabled?: BoardProps['geoObjectsEnabled']
    pointClusteringEnabled?: BoardProps['pointClusteringEnabled']
    clusterPoints?: BoardProps['clusterPoints']
}

// --- Utility exports ---------------------------------------------------

export interface RandomUsername {
    nickname: string
    firstName: string
    lastName: string
}
