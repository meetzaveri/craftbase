// Surface ⇄ geography, without maplibre.
//
// The map base pins surface (0,0) to `anchor.lngLat` and renders the world at
// `mapZoom = anchor.zoom + log2(zuiScale)` (see syncMapToZui in mapBase.ts).
// Work that equation through and the surface coordinate of any lng/lat falls
// out as a plain Web Mercator pixel delta, measured at the anchor's zoom:
//
//   surface(L) = project(L, anchor.zoom) − project(anchor.lngLat, anchor.zoom)
//
// The camera drops out entirely — zoom cancels, because Mercator pixels scale
// by 2^zoom exactly as the ZUI scales the surface. So a point's surface
// position is a fixed property of the board's anchor, not of where the user
// happens to be looking.
//
// This lives apart from mapBase.ts on purpose: mapBase pulls in maplibre (~1MB,
// dynamically imported), and the place search needs this math in the main
// bundle. It's ~20 lines of arithmetic with no runtime dependency, so the copy
// is cheaper than the chunk.

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
 * Where a lng/lat sits in the board's surface coordinates, given its anchor.
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
 * The ZUI scale that renders the map at `mapZoom`, inverting
 * `mapZoom = anchor.zoom + log2(scale)`. Clamped to the ZUI's own limits
 * (addLimits(0.06, 8)), which is what bounds a board to roughly
 * [anchor.zoom − 4.1, anchor.zoom + 3].
 */
export function scaleForMapZoom(mapZoom: number, anchor: MapAnchor): number {
    const raw = Math.pow(2, mapZoom - anchor.zoom)
    return Math.max(0.06, Math.min(8, raw))
}
