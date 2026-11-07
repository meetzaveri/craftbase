// Public data types for the craftbase npm package: the persisted component
// record, the store, and the embed's document + imperative API. Deliberately
// dependency-free (no two.js, no React) so the published .d.ts graph only
// needs these. types/board.ts re-exports everything here.

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

/**
 * Serializable board document handed to / emitted from the embedded
 * <Craftbase> component. Same envelope as the JSON export, minus the
 * viewport and image assets.
 */
export interface CraftbaseData {
    formatVersion: '1.1'
    components: ComponentStore
}

/** Imperative handle Board fills in for the embedded <Craftbase> ref. */
export interface BoardApi {
    /** Replace the board with `data` (clears undo history). */
    load: (data: CraftbaseData) => void
    /** Remove every element (same as the menu's Clear canvas). */
    clear: () => void
    /** Current board document. */
    getData: () => CraftbaseData
}
