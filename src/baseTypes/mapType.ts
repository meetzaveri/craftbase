// The map base — an OpenStreetMap backdrop slaved to the ZUI camera.
//
// Ported from craftmaps' src/utils/mapBackground.js, which proved the camera
// math in production. The PMTiles/self-hosting branches are deliberately gone:
// craftbase points MapLibre at a hosted vector style (see BASEMAP_STYLE_URL).
//
// The contract that makes switching frictionless: **ink never moves**. Element
// coordinates stay in Two.js surface space; instead the map is jumped so that
// surface (0,0) always sits over `anchor.lngLat`. Pan/zoom the whiteboard and
// the map follows, which is what makes annotations behave as if pinned to the
// geography.
//
// maplibre-gl (~800KB) is imported dynamically here and nowhere else, so a user
// who never opens the map base never downloads it.

import type {
    BaseTypeConfig,
    BaseTypeHandle,
    BaseTypeMountContext,
    BaseTypeProvider,
    MapAnchor,
} from './types'
import type { CameraChangeEvent } from '../types/base'
import { geoElementData } from '../utils/constants'
import { GEO_HIDDEN_TOOLS } from '../constants/misc'
import {
    resolveTimezoneCity,
    DEFAULT_ANCHOR_ZOOM,
} from '../utils/timezoneCities'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapLibreMap = any

/**
 * CARTO's Positron basemap — OpenStreetMap data drawn as *vector* tiles with a
 * muted, low-contrast palette, so the map reads as a backdrop and the ink on top
 * stays the loudest thing on screen. No API key.
 *
 * Why not osm.org's own tiles: `tile.openstreetmap.org` serves exactly one
 * design (Standard/Carto) as pre-rendered PNGs with labels baked into the
 * pixels — there is nothing to restyle, and it caps out at z19. A vector style
 * is client-rendered, so labels stay sharp at fractional zoom and the whole
 * palette is ours to override later.
 *
 * Kept as a single exported constant on purpose: swapping providers (or moving
 * to self-hosted tiles) stays a one-line change here rather than a hunt through
 * the provider. Attribution ships inside the style's TileJSON — both CARTO's and
 * OSM's — so `attributionControl` surfaces it without our help.
 */
export const BASEMAP_STYLE_URL =
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

// DEFAULT_ANCHOR_ZOOM lives in utils/timezoneCities — see the note there.

// Zoom limits live in ./zoomLimits — the camera needs them before this
// (dynamically imported) provider exists. See the note there.

const OPAQUE_BACKDROP_CLASS = 'cb-base-opaque-backdrop'
const MAP_CONTAINER_ID = 'cb-map-bg'

interface MapBaseTypeHandle extends BaseTypeHandle {
    map: MapLibreMap
    anchor: MapAnchor
    /** Last camera seen, so an async anchor change can re-sync immediately. */
    lastCamera: CameraChangeEvent | null
    container: HTMLElement
    disposed: boolean
}

/**
 * Where a base opens the map when it has never been told a place.
 *
 * Derived from the browser's IANA timezone — no permission prompt, no network,
 * available synchronously so the map's very first frame is already in roughly
 * the right part of the world. It is only a *starting* view: the host offers
 * the user a place to search on first visit (MapStartLocationModal), and the
 * place search stays available forever after.
 *
 * This deliberately replaced an *automatic* `navigator.geolocation` call, which
 * prompted the user unbidden the instant they switched base, never fired at all
 * on some mobile browsers, and left everyone else on a hard-coded city.
 *
 * Geolocation is back in `utils/geolocation.ts`, but only behind an explicit
 * tap in MapStartLocationModal — never on mount. That is what answers the first
 * objection; the other two are answered by a timeout backstop and by this
 * function, which is the fallback every failed lookup lands on. So this is
 * still the anchor a base opens with, and the prompt only ever replaces it.
 */
function defaultAnchor(): MapAnchor {
    return {
        lngLat: [...resolveTimezoneCity().lngLat],
        zoom: DEFAULT_ANCHOR_ZOOM,
    }
}

/**
 * Mirrors the Two.js ZUI camera onto the MapLibre map.
 *
 * Two.js: `screenPoint = sceneTranslation + surfacePoint * sceneScale`. We treat
 * surface (0,0) at scale 1 as `anchor.lngLat` at `anchor.zoom`, so
 * `targetZoom = anchor.zoom + log2(scale)` keeps tile resolution in lockstep
 * with the canvas.
 */
function syncMapToZui(handle: MapBaseTypeHandle, camera: CameraChangeEvent): void {
    const { map, anchor } = handle
    if (!map || !anchor) return

    const { scale, tx, ty } = camera
    if (!Number.isFinite(scale) || scale <= 0) return

    const targetZoom = anchor.zoom + Math.log2(scale)
    const rect = handle.container.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2

    // Step 1: park the map on the anchor at the new zoom, so project() returns
    // pixel coordinates in that zoom's reference frame.
    map.jumpTo({ center: anchor.lngLat, zoom: targetZoom })

    // Step 2: shift so the surface origin lands at (tx, ty) on screen.
    const anchorPoint = map.project(anchor.lngLat)
    const desiredCenter = map.unproject([
        anchorPoint.x + (cx - tx),
        anchorPoint.y + (cy - ty),
    ])
    map.jumpTo({ center: desiredCenter, zoom: targetZoom })
}

export const mapType: BaseTypeProvider = {
    id: 'map',
    label: 'Map',

    hiddenTools: GEO_HIDDEN_TOOLS,
    extraTools: geoElementData,

    // One whole map zoom level per click: 2^1 = double the scale. At 0.2 a user
    // would need ~70 clicks to cross the range.
    zoomStep: 1,
    // Select, same as the board base. The map is a *substrate* to draw on, not a
    // map viewer — so the resting gesture is "work with what I drew", and
    // reaching for pan is the explicit act. Pan stays one click away in the
    // toolbar (it is not in GEO_HIDDEN_TOOLS), and scroll still pans regardless
    // of the active tool.
    homeTool: 'pointer',

    async mount(
        container: HTMLElement,
        config: BaseTypeConfig,
        // Unused: the anchor is resolved synchronously from the timezone, and a
        // real choice arrives later via setAnchor (the host persists it).
        _ctx: BaseTypeMountContext
    ): Promise<BaseTypeHandle> {
        const [{ default: maplibregl }] = await Promise.all([
            import('maplibre-gl'),
            // Bundled into this lazy chunk, so board-base users never fetch it.
            import('maplibre-gl/dist/maplibre-gl.css'),
        ])

        const mapEl = document.createElement('div')
        mapEl.id = MAP_CONTAINER_ID
        container.appendChild(mapEl)
        document.body.classList.add(OPAQUE_BACKDROP_CLASS)

        // A persisted anchor is authoritative: the saved Two.js viewport was
        // recorded against it, so reusing it is what makes a refresh land on the
        // same view. Only a base that has never picked a place falls back to
        // the timezone guess — and the host then offers to replace it.
        const saved = config.mapAnchor
        const anchor: MapAnchor = saved
            ? { lngLat: [...saved.lngLat], zoom: saved.zoom }
            : defaultAnchor()

        const map = new maplibregl.Map({
            container: mapEl,
            style: BASEMAP_STYLE_URL,
            center: anchor.lngLat,
            zoom: anchor.zoom,
            // The Two.js canvas above owns every gesture; the map only follows.
            interactive: false,
            attributionControl: { compact: true },
            fadeDuration: 0,
            // Required for captureBackdrop: without it the WebGL drawing buffer
            // is cleared after each frame and toDataURL returns a blank image.
            // (maplibre v5 moved this under canvasContextAttributes.)
            canvasContextAttributes: { preserveDrawingBuffer: true },
            // Accept every centre we ask for, unclamped.
            //
            // By default maplibre keeps the world filling the viewport, which
            // silently pulls the centre back toward the equator once you are
            // zoomed far enough out. Here that clamp is corruption: the map is a
            // slave to the ZUI camera, so a centre we asked for and didn't get
            // means the backdrop no longer matches the ink — pan north at world
            // zoom and every route slides off its geography by however much
            // maplibre decided to hold back. We own the camera; the map follows.
            transformConstrain: (lngLat, zoom) => ({
                center: lngLat,
                zoom: zoom ?? 0,
            }),
        })

        const handle: MapBaseTypeHandle = {
            id: 'map',
            map,
            anchor,
            lastCamera: null,
            container: mapEl,
            disposed: false,
        }

        // Dev-only handle for inspecting the camera mirror from the console or a
        // headless harness — same pattern as __cbZui / __cbTwo in newCanvas.
        if (import.meta.env.DEV) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(window as any).__cbMap = handle
        }

        return handle
    },

    syncCamera(handle: BaseTypeHandle, camera: CameraChangeEvent): void {
        const h = handle as MapBaseTypeHandle
        if (h.disposed) return
        h.lastCamera = camera
        syncMapToZui(h, camera)
    },

    setAnchor(handle: BaseTypeHandle, anchor: MapAnchor): void {
        const h = handle as MapBaseTypeHandle
        if (h.disposed) return
        h.anchor = { lngLat: [...anchor.lngLat], zoom: anchor.zoom }
        if (h.lastCamera) syncMapToZui(h, h.lastCamera)
    },

    readConfig(handle: BaseTypeHandle): Partial<BaseTypeConfig> {
        const h = handle as MapBaseTypeHandle
        return { mapAnchor: h.anchor }
    },

    async captureBackdrop(handle: BaseTypeHandle): Promise<string | null> {
        const h = handle as MapBaseTypeHandle
        if (h.disposed || !h.map) return null
        try {
            // preserveDrawingBuffer keeps the last rendered frame readable, so
            // there's no need to force a repaint first. Throws SecurityError if
            // the style's sprite sheet ever arrives without CORS headers — the
            // vector tiles themselves are ArrayBuffers and can't taint the
            // canvas, but the sprite is an <img> (CARTO sends `allow-origin: *`).
            return h.map.getCanvas().toDataURL('image/png')
        } catch (err) {
            console.error('Map backdrop capture failed', err)
            return null
        }
    },

    unmount(handle: BaseTypeHandle): void {
        const h = handle as MapBaseTypeHandle
        if (h.disposed) return
        h.disposed = true
        document.body.classList.remove(OPAQUE_BACKDROP_CLASS)
        try {
            h.map?.remove()
        } catch (err) {
            console.error('Map teardown failed', err)
        }
        h.container?.remove()
    },
}

export default mapType
