// Base-type providers — the swappable substrate a base is drawn on.
//
// A **base** is the workspace: the document a user opens, shares and persists.
// Its **type** is the substrate underneath — `board` (parchment whiteboard),
// `map` (OpenStreetMap), and `image` (still to come). A provider is the backdrop
// renderer for one type plus the tool set that makes sense on it.
//
// The critical property is that **ink never moves across a switch**: element
// coordinates live in Two.js surface space and are untouched, so changing a
// base's type only swaps the backdrop renderer and re-anchors it to the current
// ZUI camera.
//
// Providers are resolved through `registry.ts` with a dynamic import, so a type
// nobody activates costs nothing at load time.

import type { CameraChangeEvent } from '../types/base'
import type { PrimaryElement } from '../utils/constants'

export type BaseType = 'board' | 'map'

/** Where a map base is pinned. `lngLat` is [lng, lat] — MapLibre's order. */
export interface MapAnchor {
    lngLat: [number, number]
    zoom: number
}

/**
 * Persisted per-base type state. Written to `craftbase_base_type_<baseId>` only
 * when the user explicitly switches — opening an older base never writes one,
 * which is what keeps pre-existing bases byte-identical in storage.
 */
export interface BaseTypeConfig {
    type: BaseType
    mapAnchor?: MapAnchor | null
}

/**
 * Opaque per-provider instance returned by `mount`. Each provider narrows this
 * to its own shape internally (e.g. the map base carries the MapLibre map); no
 * caller outside the provider should reach into it.
 */
export interface BaseTypeHandle {
    readonly id: BaseType
}

/**
 * Host callbacks handed to a provider at mount. A base often can't know its
 * final config synchronously — the map base resolves its anchor from
 * geolocation well after mount — so it reports back through here rather than
 * the host having to poll.
 */
export interface BaseTypeMountContext {
    /** Persist a partial config update for the current base. */
    saveConfig(patch: Partial<BaseTypeConfig>): void
}

export interface BaseTypeProvider {
    readonly id: BaseType
    /**
     * Human name for this base. Note the base switcher does NOT read it: it
     * lists bases that aren't loaded yet (and one that isn't built yet), and
     * reading a label off the map provider would mean importing maplibre just
     * to draw a menu. Its option labels are its own.
     */
    readonly label: string

    /**
     * Mount the backdrop into the slot element. Async so a provider can
     * dynamically import a heavy renderer before first paint.
     */
    mount(
        container: HTMLElement,
        config: BaseTypeConfig,
        ctx: BaseTypeMountContext
    ): Promise<BaseTypeHandle>

    /**
     * Mirror the ZUI camera onto the backdrop. Called on every camera event, so
     * it must be cheap and synchronous.
     */
    syncCamera(handle: BaseTypeHandle, camera: CameraChangeEvent): void

    /** Tools removed from the shapes toolbar while this base is active. */
    readonly hiddenTools: ReadonlySet<string>

    /** Tools appended to the shapes toolbar while this base is active. */
    readonly extraTools: readonly PrimaryElement[]

    /** Resting tool when this base activates ('pointer' | 'pan'). */
    readonly homeTool: string

    /**
     * NOTE: zoom limits are NOT a provider field. They live in
     * `./zoomLimits.ts`, because the camera has to be given the right range
     * before any provider is loaded — providers are dynamic imports, so on a
     * page load the saved viewport is restored while this one is still the
     * board base, and a map camera would be clamped to the whiteboard's floor.
     * `BASE_TYPE_ZOOM_LIMITS` is keyed `Record<BaseType, ...>`, so a new base cannot
     * forget to declare its range: the type checker demands an entry.
     */

    /**
     * Zoom-button step, in ZUI zoom units (log2 of scale — 1 doubles the
     * scale). The map wants a whole zoom level per click, matching every other
     * map UI and making a 15-level range crossable; a whiteboard wants finer
     * grain.
     */
    readonly zoomStep: number

    /**
     * Rasterized backdrop for PNG export, as a data URL sized to the viewport.
     * `null` → the caller falls back to painting the parchment background, so a
     * provider with nothing to contribute simply returns null.
     */
    captureBackdrop(
        handle: BaseTypeHandle,
        width: number,
        height: number
    ): Promise<string | null>

    /**
     * Read back any provider-owned state that belongs in the persisted config
     * (the map base returns its current anchor). Returns null when there's
     * nothing to persist.
     */
    readConfig?(handle: BaseTypeHandle): Partial<BaseTypeConfig> | null

    /**
     * Recentre the backdrop (map base: jump to a searched place). Absent on
     * bases with nothing to recentre.
     */
    setAnchor?(handle: BaseTypeHandle, anchor: MapAnchor): void

    unmount(handle: BaseTypeHandle): void
}

export const DEFAULT_BASE_TYPE: BaseType = 'board'
