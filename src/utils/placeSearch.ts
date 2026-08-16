// Place lookup for the map base, backed by OpenStreetMap's Nominatim service.
//
// Nominatim's usage policy caps this at roughly one request per second and asks
// for a identifying Referer/User-Agent — a browser supplies the former
// automatically. The debounce in the search UI is what keeps us inside that
// budget, so don't call this on every keystroke.

import type { MapAnchor } from '../bases/types'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const RESULT_LIMIT = 5

/** Zoom to land on for a searched place — street/neighbourhood detail. */
const PLACE_ZOOM = 15

export interface PlaceResult {
    /** Stable key for lists (Nominatim's place_id). */
    id: string
    /** Human-readable place name, e.g. "Ahmedabad, Gujarat, India". */
    label: string
    anchor: MapAnchor
}

interface NominatimRow {
    place_id?: number | string
    display_name?: string
    lat?: string
    lon?: string
}

/**
 * Search for places by free text. Returns [] for blank input, network failure
 * or a malformed response — a failed lookup should quietly show "no results",
 * never break the board.
 */
export async function searchPlaces(
    query: string,
    signal?: AbortSignal
): Promise<PlaceResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const url = `${NOMINATIM_URL}?format=jsonv2&limit=${RESULT_LIMIT}&q=${encodeURIComponent(trimmed)}`

    try {
        const response = await fetch(url, { signal })
        if (!response.ok) return []
        const rows: unknown = await response.json()
        if (!Array.isArray(rows)) return []

        return rows.flatMap((raw: NominatimRow, index): PlaceResult[] => {
            const lat = Number(raw?.lat)
            const lon = Number(raw?.lon)
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []
            return [
                {
                    id: String(raw.place_id ?? `${lat},${lon},${index}`),
                    label: raw.display_name ?? `${lat}, ${lon}`,
                    anchor: { lngLat: [lon, lat], zoom: PLACE_ZOOM },
                },
            ]
        })
    } catch {
        // Aborted (superseded query) or offline — both mean "nothing to show".
        return []
    }
}
