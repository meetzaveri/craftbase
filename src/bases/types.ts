// Base providers — the swappable substrate a board is drawn on.
//
// A "base" is the backdrop behind the Two.js scene plus the tool set that makes
// sense on it. The board base is today's parchment; the map base is an
// OpenStreetMap view. The critical property is that **ink never moves across a
// switch**: element coordinates live in Two.js surface space and are untouched,
// so switching a base only swaps the backdrop renderer and re-anchors it to the
// current ZUI camera.
//
// Providers are resolved through `registry.ts` with a dynamic import, so a base
// nobody activates costs nothing at load time.

import type { CameraChangeEvent } from '../types/board'
import type { PrimaryElement } from '../utils/constants'

export type BaseId = 'board' | 'map'

/** Where a map base is pinned. `lngLat` is [lng, lat] — MapLibre's order. */
export interface MapAnchor {
    lngLat: [number, number]
    zoom: number
}

/**
 * Persisted per-board base state. Written to `craftbase_base_<boardId>` only
 * when the user explicitly switches — opening an older board never writes one,
 * which is what keeps pre-existing boards byte-identical in storage.
 */
export interface BaseConfig {
    base: BaseId
    mapAnchor?: MapAnchor | null
}

/**
 * Opaque per-provider instance returned by `mount`. Each provider narrows this
 * to its own shape internally (e.g. the map base carries the MapLibre map); no
 * caller outside the provider should reach into it.
 */
export interface BaseHandle {
    readonly id: BaseId
}

/**
 * Host callbacks handed to a provider at mount. A base often can't know its
 * final config synchronously — the map base resolves its anchor from
 * geolocation well after mount — so it reports back through here rather than
 * the host having to poll.
 */
export interface BaseMountContext {
    /** Persist a partial config update for the current board. */
    saveConfig(patch: Partial<BaseConfig>): void
}

export interface BaseProvider {
    readonly id: BaseId
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
        config: BaseConfig,
        ctx: BaseMountContext
    ): Promise<BaseHandle>

    /**
     * Mirror the ZUI camera onto the backdrop. Called on every camera event, so
     * it must be cheap and synchronous.
     */
    syncCamera(handle: BaseHandle, camera: CameraChangeEvent): void

    /** Tools removed from the shapes toolbar while this base is active. */
    readonly hiddenTools: ReadonlySet<string>

    /** Tools appended to the shapes toolbar while this base is active. */
    readonly extraTools: readonly PrimaryElement[]

    /** Resting tool when this base activates ('pointer' | 'pan'). */
    readonly homeTool: string

    /**
     * How far the camera may zoom on this base, as ZUI scale.
     *
     * A base decides its own range because the range *means* something
     * different on each one. On the board it's how big a whiteboard can get; on
     * the map the ZUI scale is locked to the map's zoom
     * (`mapZoom = anchor.zoom + log2(scale)`, the relation that keeps ink glued
     * to geography), so the scale range IS the span of map zoom levels the user
     * can reach — a narrow one strands them at city level with no way out.
     */
    readonly zoomLimits: { min: number; max: number }

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
        handle: BaseHandle,
        width: number,
        height: number
    ): Promise<string | null>

    /**
     * Read back any provider-owned state that belongs in the persisted config
     * (the map base returns its current anchor). Returns null when there's
     * nothing to persist.
     */
    readConfig?(handle: BaseHandle): Partial<BaseConfig> | null

    /**
     * Recentre the backdrop (map base: jump to a searched place). Absent on
     * bases with nothing to recentre.
     */
    setAnchor?(handle: BaseHandle, anchor: MapAnchor): void

    unmount(handle: BaseHandle): void
}

export const DEFAULT_BASE: BaseId = 'board'
