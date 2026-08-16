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
    BaseConfig,
    BaseHandle,
    BaseMountContext,
    BaseProvider,
    MapAnchor,
} from './types'
import type { CameraChangeEvent } from '../types/board'
import { geoElementData } from '../utils/constants'
import { GEO_HIDDEN_TOOLS } from '../constants/misc'

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

/**
 * The map zoom that ZUI `scale = 1` (craftbase's "100%") represents. Ink renders
 * at its nominal size at scale 1 and grows/shrinks from there, so this should be
 * the zoom you draw at most. z16 is shop/area detail. The window spans roughly
 * [zoom - 4.1, zoom + 3] given the ZUI scale limits (0.06, 8) — i.e. z11.9-z19,
 * all of it renderable, since vector tiles overzoom past their z14 source cap.
 */
const DEFAULT_ANCHOR_ZOOM = 16

/**
 * The map zoom range the camera can reach, and — through
 * `mapZoom = anchor.zoom + log2(zuiScale)` — the ZUI scale limits that produce
 * it. z1 is the whole world in view; z19 is OSM's deepest tile.
 *
 * This is why the map can't just inherit the board's 6%–800%: that range spans
 * only ~7 zoom levels, which pins a z16-anchored board to roughly z12–z19 and
 * makes "zoom out to see another continent" impossible. The relation between
 * the two zooms is fixed (it's what keeps ink glued to the map), so the only
 * way to widen what the user can see is to widen the scale range itself.
 */
const MIN_MAP_ZOOM = 1
const MAX_MAP_ZOOM = 19

/**
 * Where to land when geolocation is unavailable (denied, incognito, timeout).
 * Without this we'd fall back to the [0,0] world view, which — combined with the
 * zoom-window math above — caps zoom-in at ~z5 and is useless for annotating.
 * [lng, lat], MapLibre's order.
 */
const DEFAULT_ANCHOR_CENTER: [number, number] = [72.63, 23.03] // Ahmedabad

const GEOLOCATION_TIMEOUT_MS = 5000

const OPAQUE_BACKDROP_CLASS = 'cb-base-opaque-backdrop'
const MAP_CONTAINER_ID = 'cb-map-bg'

interface MapBaseHandle extends BaseHandle {
    map: MapLibreMap
    anchor: MapAnchor
    /** Last camera seen, so an async anchor change can re-sync immediately. */
    lastCamera: CameraChangeEvent | null
    container: HTMLElement
    disposed: boolean
}

function defaultAnchor(): MapAnchor {
    return { lngLat: [...DEFAULT_ANCHOR_CENTER], zoom: DEFAULT_ANCHOR_ZOOM }
}

/**
 * Mirrors the Two.js ZUI camera onto the MapLibre map.
 *
 * Two.js: `screenPoint = sceneTranslation + surfacePoint * sceneScale`. We treat
 * surface (0,0) at scale 1 as `anchor.lngLat` at `anchor.zoom`, so
 * `targetZoom = anchor.zoom + log2(scale)` keeps tile resolution in lockstep
 * with the canvas.
 */
function syncMapToZui(handle: MapBaseHandle, camera: CameraChangeEvent): void {
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

/** Browser geolocation as a promise; resolves null rather than rejecting. */
function locate(): Promise<[number, number] | null> {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null)
            return
        }
        navigator.geolocation.getCurrentPosition(
            (p) => resolve([p.coords.longitude, p.coords.latitude]),
            () => resolve(null),
            { timeout: GEOLOCATION_TIMEOUT_MS }
        )
    })
}

export const mapBase: BaseProvider = {
    id: 'map',
    label: 'Map',

    hiddenTools: GEO_HIDDEN_TOOLS,
    extraTools: geoElementData,

    zoomLimits: {
        min: Math.pow(2, MIN_MAP_ZOOM - DEFAULT_ANCHOR_ZOOM),
        max: Math.pow(2, MAX_MAP_ZOOM - DEFAULT_ANCHOR_ZOOM),
    },
    // One whole map zoom level per click: 2^1 = double the scale. At 0.2 a user
    // would need ~70 clicks to cross the range.
    zoomStep: 1,
    // Dragging the canvas should pan the world, not rubber-band a selection.
    homeTool: 'pan',

    async mount(
        container: HTMLElement,
        config: BaseConfig,
        ctx: BaseMountContext
    ): Promise<BaseHandle> {
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
        // same view. Only a board that has never been on the map geolocates.
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

        const handle: MapBaseHandle = {
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

        if (!saved) {
            // First time on the map for this board: try for the user's actual
            // location, but don't block the mount on it — the map is already
            // showing the fallback city, and we re-sync when the answer lands.
            void locate().then((lngLat) => {
                if (handle.disposed || !lngLat) return
                handle.anchor = { lngLat, zoom: DEFAULT_ANCHOR_ZOOM }
                // Persist only a real geolocation success, so a denied prompt
                // is retried on the next visit rather than baked in.
                ctx.saveConfig({ mapAnchor: handle.anchor })
                if (handle.lastCamera) syncMapToZui(handle, handle.lastCamera)
            })
        }

        return handle
    },

    syncCamera(handle: BaseHandle, camera: CameraChangeEvent): void {
        const h = handle as MapBaseHandle
        if (h.disposed) return
        h.lastCamera = camera
        syncMapToZui(h, camera)
    },

    setAnchor(handle: BaseHandle, anchor: MapAnchor): void {
        const h = handle as MapBaseHandle
        if (h.disposed) return
        h.anchor = { lngLat: [...anchor.lngLat], zoom: anchor.zoom }
        if (h.lastCamera) syncMapToZui(h, h.lastCamera)
    },

    readConfig(handle: BaseHandle): Partial<BaseConfig> {
        const h = handle as MapBaseHandle
        return { mapAnchor: h.anchor }
    },

    async captureBackdrop(handle: BaseHandle): Promise<string | null> {
        const h = handle as MapBaseHandle
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

    unmount(handle: BaseHandle): void {
        const h = handle as MapBaseHandle
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

export default mapBase
