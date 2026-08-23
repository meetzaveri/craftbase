// The base row, as the client understands it.
//
// `bases.base` carries the two pieces of geography that make a map base
// shareable, and they are NOT the same thing:
//
//   mapAnchor* — the **georeference**. Surface (0,0) is this lng/lat at this
//     zoom, so every element's stored x/y only means somewhere on Earth
//     relative to it. Written once, when the base is created.
//   landing*   — the **shared view**: where the camera opens. The centre of the
//     sharer's viewport at the moment they clicked Share, refreshed on every
//     re-share.
//
// The anchor is why this has to live on the server at all. Before these
// columns it lived only in `craftbase_base_type_<baseId>`, so a recipient —
// who has no such key — fell back to a guess derived from their own timezone
// and every pin landed in the wrong city.
//
// The landing view is stored as lng/lat/zoom rather than the camera's own
// tx/ty/scale because tx/ty are pixel translations: replaying them on a phone
// lands somewhere else entirely. Geography is the device-independent form.

import { isBaseType } from './registry'
import type { BaseType, MapAnchor } from './types'

/** The columns of `bases.base` this app reads. `float8` arrives as `any`. */
export interface ServerBaseRow {
    id?: string | null
    type?: string | null
    isPublic?: boolean | null
    mapAnchorLng?: unknown
    mapAnchorLat?: unknown
    mapAnchorZoom?: unknown
    landingLng?: unknown
    landingLat?: unknown
    landingZoom?: unknown
}

export interface ServerBaseConfig {
    /** null when the row's type isn't one this build can render. */
    type: BaseType | null
    /** The georeference. null unless all three columns are present and finite. */
    mapAnchor: MapAnchor | null
    /** The shared view. null unless all three columns are present and finite. */
    landing: MapAnchor | null
}

/** Narrow an unknown column to a usable number. Rejects null, '', NaN, ±∞. */
function finite(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

/**
 * A lng/lat/zoom triple, or null.
 *
 * All three or nothing, deliberately: the writer always sets them together, so
 * a partial triple means a hand-edited row. Half a georeference is worse than
 * none — it would place ink confidently in the wrong place, where `null` falls
 * back to a guess the user can see is wrong and correct.
 */
function triple(
    lng: unknown,
    lat: unknown,
    zoom: unknown
): MapAnchor | null {
    const l = finite(lng)
    const a = finite(lat)
    const z = finite(zoom)
    if (l === null || a === null || z === null) return null
    // Outside these the projection is meaningless; `project()` clamps latitude
    // anyway, but a bad row shouldn't reach it in the first place.
    if (l < -180 || l > 180 || a < -90 || a > 90) return null
    return { lngLat: [l, a], zoom: z }
}

/**
 * Convert a fetched base row into the shapes the base-type layer speaks.
 * Returns null for a missing row, so callers can't tell "not loaded" from
 * "loaded and empty" by accident.
 *
 * `type` is guarded by `isBaseType` rather than trusted: the Postgres enum
 * already carries `'image'`, which `registry.LOADERS` has no loader for — an
 * unguarded value would be a crash for the first user whose row says so.
 */
export function normalizeServerBaseConfig(
    row: ServerBaseRow | null | undefined
): ServerBaseConfig | null {
    if (!row) return null
    return {
        type: isBaseType(row.type) ? row.type : null,
        mapAnchor: triple(row.mapAnchorLng, row.mapAnchorLat, row.mapAnchorZoom),
        landing: triple(row.landingLng, row.landingLat, row.landingZoom),
    }
}
