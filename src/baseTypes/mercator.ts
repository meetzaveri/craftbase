// Surface ⇄ geography, without maplibre.
//
// The map base pins surface (0,0) to `anchor.lngLat` and renders the world at
// `mapZoom = anchor.zoom + log2(zuiScale)` (see syncMapToZui in mapType.ts).
// Work that equation through and the surface coordinate of any lng/lat falls
// out as a plain Web Mercator pixel delta, measured at the anchor's zoom:
//
//   surface(L) = project(L, anchor.zoom) − project(anchor.lngLat, anchor.zoom)
//
// The camera drops out entirely — zoom cancels, because Mercator pixels scale
// by 2^zoom exactly as the ZUI scales the surface. So a point's surface
// position is a fixed property of the base's anchor, not of where the user
// happens to be looking.
//
// This lives apart from mapType.ts on purpose: mapType pulls in maplibre (~1MB,
// dynamically imported), and the place search needs this math in the main
// bundle. It's ~20 lines of arithmetic with no runtime dependency, so the copy
// is cheaper than the chunk.

import { BASE_TYPE_ZOOM_LIMITS } from './zoomLimits'
import type { MapAnchor } from './types'

/**
 * MapLibre's world is `TILE_SIZE · 2^zoom` pixels across, and **MapLibre uses
 * 512** — not the 256 of the classic slippy-map convention. Its `project()`
 * returns pixels in that space, and the surface has to agree with it exactly or
 * every distance computed here comes out half right: measured against a live
 * map, a 256 here sent "go to Virginia" precisely halfway to Virginia.
 */
const TILE_SIZE = 512

/**
 * Web Mercator projection: lng/lat → world pixel at `zoom`. Latitude is clamped
 * to the Mercator limit (±85.051129°), where the projection goes to infinity.
 */
function project(
    lngLat: [number, number],
    zoom: number
): { x: number; y: number } {
    const worldSize = TILE_SIZE * Math.pow(2, zoom)
    const [lng, lat] = lngLat
    const clampedLat = Math.max(-85.051129, Math.min(85.051129, lat))
    const sinLat = Math.sin((clampedLat * Math.PI) / 180)
    return {
        x: worldSize * (lng / 360 + 0.5),
        y:
            worldSize *
            (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)),
    }
}

/**
 * Where a lng/lat sits in the base's surface coordinates, given its anchor.
 *
 * This is the function that makes geography and ink agree: as long as the
 * anchor never moves, a place always resolves to the same surface point, so
 * elements drawn over it stay over it.
 */
export function lngLatToSurface(
    lngLat: [number, number],
    anchor: MapAnchor
): { x: number; y: number } {
    const target = project(lngLat, anchor.zoom)
    const origin = project(anchor.lngLat, anchor.zoom)
    return { x: target.x - origin.x, y: target.y - origin.y }
}

/**
 * Where a surface point sits in geography — the inverse of `lngLatToSurface`,
 * and the direction sharing needs: "the camera is centred on surface (x, y);
 * what place is that?"
 *
 * Longitude is normalised into [-180, 180]. The surface is unbounded, so a user
 * who pans three worlds east is at a perfectly valid surface x that projects to
 * lng 900 — a number MapLibre would accept and no one could read.
 */
export function surfaceToLngLat(
    point: { x: number; y: number },
    anchor: MapAnchor
): [number, number] {
    const worldSize = TILE_SIZE * Math.pow(2, anchor.zoom)
    const origin = project(anchor.lngLat, anchor.zoom)
    const x = origin.x + point.x
    const y = origin.y + point.y

    const rawLng = (x / worldSize - 0.5) * 360
    // ((n % 360) + 360) % 360 first, so the shift works for negative inputs too.
    const lng = ((((rawLng + 180) % 360) + 360) % 360) - 180
    const lat =
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldSize))) * 180) /
        Math.PI
    return [lng, lat]
}

/**
 * The map zoom the base is rendering at, given a ZUI scale. The forward form of
 * `mapZoom = anchor.zoom + log2(scale)` — the same equation `syncMapToZui`
 * runs, named once here so the three callers that need it don't each re-derive
 * it. Inverse of `scaleForMapZoom`.
 */
export function mapZoomForScale(scale: number, anchor: MapAnchor): number {
    return anchor.zoom + Math.log2(scale)
}

/**
 * The ZUI scale that renders the map at `mapZoom`, inverting
 * `mapZoom = anchor.zoom + log2(scale)`.
 *
 * Clamped to the **map's** scale range, not the board's. This used to clamp to
 * a hard-coded [0.06, 8] — the whiteboard's range — which silently truncated
 * any travel outside roughly [anchor.zoom − 4.1, anchor.zoom + 3]. Landing a
 * shared link at z5 on a z16-anchored base asks for scale 2^-11 and got 0.06,
 * i.e. ~z11.9: a recipient who was sent a country landed on a city.
 */
export function scaleForMapZoom(mapZoom: number, anchor: MapAnchor): number {
    const raw = Math.pow(2, mapZoom - anchor.zoom)
    const { min, max } = BASE_TYPE_ZOOM_LIMITS.map
    return Math.max(min, Math.min(max, raw))
}
