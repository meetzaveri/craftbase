// Where to open the map when we haven't been told.
//
// The browser's IANA timezone is the one location signal that needs no
// permission, no prompt, and no network — `Intl.DateTimeFormat()
// .resolvedOptions().timeZone` is available synchronously on every browser we
// support, desktop and mobile. It is coarse (a zone is a country-sized region)
// but it is never *absurd*, which is the whole bar for a starting view: landing
// a New York user in New York is right, landing them in Ahmedabad is not.
//
// IANA zone ids are named after a representative city by convention
// (`America/New_York`, `Asia/Tokyo`), so the table below is mostly just that
// convention made into coordinates. When a zone is missing we fall back to the
// table entry whose CURRENT UTC offset is closest, preferring the same region
// prefix — which lands somewhere on roughly the right meridian rather than
// nowhere at all.

/**
 * The map zoom that ZUI `scale = 1` ("100%") represents, and therefore the zoom
 * every fresh anchor is pinned at. z16 is shop/area detail — the zoom you draw
 * at most. The reachable window spans roughly [zoom - 4.1, zoom + 3] given the
 * map base's ZUI scale limits; see mapType.ts for that arithmetic.
 *
 * It lives here rather than in mapType so the host can reference it without
 * importing the map provider — that module carries the ~1MB maplibre chunk
 * behind a dynamic import, and a static import would defeat it.
 */
export const DEFAULT_ANCHOR_ZOOM = 16

/** [lng, lat] — MapLibre's order, matching MapAnchor. */
export type LngLat = [number, number]

export interface TimezoneCity {
    /** IANA zone id. */
    zone: string
    /** Shown to the user, so they understand where they landed and why. */
    city: string
    lngLat: LngLat
}

/**
 * Legacy/alias zone ids some browsers still report, mapped to the canonical id
 * used in the table. Without these an Indian user on a browser reporting
 * `Asia/Calcutta` would miss an exact match and fall through to offset
 * guessing — which happens to work here, but not everywhere.
 */
const ZONE_ALIASES: Record<string, string> = {
    'Asia/Calcutta': 'Asia/Kolkata',
    'Asia/Saigon': 'Asia/Ho_Chi_Minh',
    'Asia/Rangoon': 'Asia/Yangon',
    'Asia/Katmandu': 'Asia/Kathmandu',
    'Europe/Kiev': 'Europe/Kyiv',
    'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
    'America/Montreal': 'America/Toronto',
    'US/Eastern': 'America/New_York',
    'US/Central': 'America/Chicago',
    'US/Mountain': 'America/Denver',
    'US/Pacific': 'America/Los_Angeles',
    'Europe/Belfast': 'Europe/London',
    GB: 'Europe/London',
}

// Ordered loosely west → east. Coordinates are city centres, good to a few
// hundred metres, which is far finer than this feature needs.
const TIMEZONE_CITIES: readonly TimezoneCity[] = [
    // — Pacific / Americas —
    {
        zone: 'Pacific/Honolulu',
        city: 'Honolulu',
        lngLat: [-157.8583, 21.3069],
    },
    {
        zone: 'America/Anchorage',
        city: 'Anchorage',
        lngLat: [-149.9003, 61.2181],
    },
    {
        zone: 'America/Los_Angeles',
        city: 'Los Angeles',
        lngLat: [-118.2437, 34.0522],
    },
    {
        zone: 'America/Vancouver',
        city: 'Vancouver',
        lngLat: [-123.1207, 49.2827],
    },
    { zone: 'America/Tijuana', city: 'Tijuana', lngLat: [-117.0382, 32.5149] },
    { zone: 'America/Phoenix', city: 'Phoenix', lngLat: [-112.074, 33.4484] },
    { zone: 'America/Denver', city: 'Denver', lngLat: [-104.9903, 39.7392] },
    {
        zone: 'America/Edmonton',
        city: 'Edmonton',
        lngLat: [-113.4909, 53.5461],
    },
    { zone: 'America/Chicago', city: 'Chicago', lngLat: [-87.6298, 41.8781] },
    { zone: 'America/Winnipeg', city: 'Winnipeg', lngLat: [-97.1385, 49.8951] },
    {
        zone: 'America/Mexico_City',
        city: 'Mexico City',
        lngLat: [-99.1332, 19.4326],
    },
    {
        zone: 'America/Guatemala',
        city: 'Guatemala City',
        lngLat: [-90.5133, 14.6349],
    },
    { zone: 'America/New_York', city: 'New York', lngLat: [-74.006, 40.7128] },
    { zone: 'America/Toronto', city: 'Toronto', lngLat: [-79.3832, 43.6532] },
    { zone: 'America/Detroit', city: 'Detroit', lngLat: [-83.0458, 42.3314] },
    { zone: 'America/Havana', city: 'Havana', lngLat: [-82.3666, 23.1136] },
    { zone: 'America/Bogota', city: 'Bogotá', lngLat: [-74.0721, 4.711] },
    { zone: 'America/Lima', city: 'Lima', lngLat: [-77.0428, -12.0464] },
    {
        zone: 'America/Panama',
        city: 'Panama City',
        lngLat: [-79.5199, 8.9824],
    },
    { zone: 'America/Caracas', city: 'Caracas', lngLat: [-66.9036, 10.4806] },
    { zone: 'America/Halifax', city: 'Halifax', lngLat: [-63.5752, 44.6488] },
    {
        zone: 'America/Santiago',
        city: 'Santiago',
        lngLat: [-70.6693, -33.4489],
    },
    {
        zone: 'America/Sao_Paulo',
        city: 'São Paulo',
        lngLat: [-46.6333, -23.5505],
    },
    {
        zone: 'America/Argentina/Buenos_Aires',
        city: 'Buenos Aires',
        lngLat: [-58.3816, -34.6037],
    },
    {
        zone: 'America/St_Johns',
        city: "St. John's",
        lngLat: [-52.7126, 47.5615],
    },

    // — Atlantic / Europe / Africa —
    {
        zone: 'Atlantic/Reykjavik',
        city: 'Reykjavík',
        lngLat: [-21.9426, 64.1466],
    },
    { zone: 'Europe/Dublin', city: 'Dublin', lngLat: [-6.2603, 53.3498] },
    { zone: 'Europe/London', city: 'London', lngLat: [-0.1276, 51.5072] },
    { zone: 'Europe/Lisbon', city: 'Lisbon', lngLat: [-9.1393, 38.7223] },
    {
        zone: 'Africa/Casablanca',
        city: 'Casablanca',
        lngLat: [-7.5898, 33.5731],
    },
    { zone: 'Africa/Accra', city: 'Accra', lngLat: [-0.187, 5.6037] },
    { zone: 'Europe/Madrid', city: 'Madrid', lngLat: [-3.7038, 40.4168] },
    { zone: 'Europe/Paris', city: 'Paris', lngLat: [2.3522, 48.8566] },
    { zone: 'Europe/Brussels', city: 'Brussels', lngLat: [4.3517, 50.8503] },
    { zone: 'Europe/Amsterdam', city: 'Amsterdam', lngLat: [4.9041, 52.3676] },
    { zone: 'Europe/Zurich', city: 'Zürich', lngLat: [8.5417, 47.3769] },
    { zone: 'Europe/Berlin', city: 'Berlin', lngLat: [13.405, 52.52] },
    { zone: 'Europe/Rome', city: 'Rome', lngLat: [12.4964, 41.9028] },
    { zone: 'Europe/Vienna', city: 'Vienna', lngLat: [16.3738, 48.2082] },
    { zone: 'Europe/Prague', city: 'Prague', lngLat: [14.4378, 50.0755] },
    { zone: 'Europe/Warsaw', city: 'Warsaw', lngLat: [21.0122, 52.2297] },
    { zone: 'Europe/Budapest', city: 'Budapest', lngLat: [19.0402, 47.4979] },
    { zone: 'Europe/Stockholm', city: 'Stockholm', lngLat: [18.0686, 59.3293] },
    { zone: 'Europe/Oslo', city: 'Oslo', lngLat: [10.7522, 59.9139] },
    {
        zone: 'Europe/Copenhagen',
        city: 'Copenhagen',
        lngLat: [12.5683, 55.6761],
    },
    { zone: 'Africa/Lagos', city: 'Lagos', lngLat: [3.3792, 6.5244] },
    {
        zone: 'Africa/Johannesburg',
        city: 'Johannesburg',
        lngLat: [28.0473, -26.2041],
    },
    { zone: 'Europe/Helsinki', city: 'Helsinki', lngLat: [24.9384, 60.1699] },
    { zone: 'Europe/Athens', city: 'Athens', lngLat: [23.7275, 37.9838] },
    { zone: 'Europe/Bucharest', city: 'Bucharest', lngLat: [26.1025, 44.4268] },
    { zone: 'Europe/Kyiv', city: 'Kyiv', lngLat: [30.5234, 50.4501] },
    { zone: 'Europe/Istanbul', city: 'Istanbul', lngLat: [28.9784, 41.0082] },
    { zone: 'Africa/Cairo', city: 'Cairo', lngLat: [31.2357, 30.0444] },
    { zone: 'Asia/Jerusalem', city: 'Jerusalem', lngLat: [35.2137, 31.7683] },
    { zone: 'Africa/Nairobi', city: 'Nairobi', lngLat: [36.8219, -1.2921] },
    { zone: 'Europe/Moscow', city: 'Moscow', lngLat: [37.6173, 55.7558] },

    // — Middle East / Asia —
    { zone: 'Asia/Riyadh', city: 'Riyadh', lngLat: [46.6753, 24.7136] },
    { zone: 'Asia/Tehran', city: 'Tehran', lngLat: [51.389, 35.6892] },
    { zone: 'Asia/Dubai', city: 'Dubai', lngLat: [55.2708, 25.2048] },
    { zone: 'Asia/Karachi', city: 'Karachi', lngLat: [67.0011, 24.8607] },
    { zone: 'Asia/Tashkent', city: 'Tashkent', lngLat: [69.2401, 41.2995] },
    { zone: 'Asia/Almaty', city: 'Almaty', lngLat: [76.8512, 43.222] },
    { zone: 'Asia/Colombo', city: 'Colombo', lngLat: [79.8612, 6.9271] },
    { zone: 'Asia/Kolkata', city: 'Kolkata', lngLat: [88.3639, 22.5726] },
    { zone: 'Asia/Kathmandu', city: 'Kathmandu', lngLat: [85.324, 27.7172] },
    { zone: 'Asia/Dhaka', city: 'Dhaka', lngLat: [90.4125, 23.8103] },
    { zone: 'Asia/Yangon', city: 'Yangon', lngLat: [96.1951, 16.8661] },
    { zone: 'Asia/Bangkok', city: 'Bangkok', lngLat: [100.5018, 13.7563] },
    { zone: 'Asia/Jakarta', city: 'Jakarta', lngLat: [106.8456, -6.2088] },
    {
        zone: 'Asia/Ho_Chi_Minh',
        city: 'Ho Chi Minh City',
        lngLat: [106.6297, 10.8231],
    },
    {
        zone: 'Asia/Kuala_Lumpur',
        city: 'Kuala Lumpur',
        lngLat: [101.6869, 3.139],
    },
    { zone: 'Asia/Singapore', city: 'Singapore', lngLat: [103.8198, 1.3521] },
    { zone: 'Asia/Hong_Kong', city: 'Hong Kong', lngLat: [114.1694, 22.3193] },
    { zone: 'Asia/Shanghai', city: 'Shanghai', lngLat: [121.4737, 31.2304] },
    { zone: 'Asia/Taipei', city: 'Taipei', lngLat: [121.5654, 25.033] },
    { zone: 'Asia/Manila', city: 'Manila', lngLat: [120.9842, 14.5995] },
    { zone: 'Asia/Seoul', city: 'Seoul', lngLat: [126.978, 37.5665] },
    { zone: 'Asia/Tokyo', city: 'Tokyo', lngLat: [139.6917, 35.6895] },

    // — Oceania —
    { zone: 'Australia/Perth', city: 'Perth', lngLat: [115.8575, -31.9505] },
    {
        zone: 'Australia/Adelaide',
        city: 'Adelaide',
        lngLat: [138.6007, -34.9285],
    },
    {
        zone: 'Australia/Brisbane',
        city: 'Brisbane',
        lngLat: [153.0251, -27.4698],
    },
    { zone: 'Australia/Sydney', city: 'Sydney', lngLat: [151.2093, -33.8688] },
    {
        zone: 'Australia/Melbourne',
        city: 'Melbourne',
        lngLat: [144.9631, -37.8136],
    },
    {
        zone: 'Pacific/Auckland',
        city: 'Auckland',
        lngLat: [174.7633, -36.8485],
    },
    { zone: 'Pacific/Fiji', city: 'Suva', lngLat: [178.4419, -18.1416] },
]

/**
 * Last resort, when the browser reports no timezone at all and the offset probe
 * also fails. London is the honest choice for "we have no idea": it is the zero
 * meridian, so it is the least *wrong* guess rather than an arbitrary one.
 */
const FALLBACK_CITY: TimezoneCity = {
    zone: 'Europe/London',
    city: 'London',
    lngLat: [-0.1276, 51.5072],
}

const byZone = new Map(TIMEZONE_CITIES.map((c) => [c.zone, c]))

/** The browser's IANA zone, or null if it can't say. */
export function browserTimezone(): string | null {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null
    } catch {
        return null
    }
}

/**
 * A zone's CURRENT offset from UTC in minutes (east positive), read live so DST
 * is accounted for rather than baked into the table.
 */
function zoneOffsetMinutes(zone: string): number | null {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: zone,
            timeZoneName: 'longOffset',
        }).formatToParts(new Date())
        const name = parts.find((p) => p.type === 'timeZoneName')?.value
        if (!name) return null
        if (name === 'GMT' || name === 'UTC') return 0
        const m = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(name)
        if (!m) return null
        const sign = m[1] === '-' ? -1 : 1
        return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
    } catch {
        return null
    }
}

/**
 * The city to open the map on for `zone` (defaults to the browser's).
 *
 * Exact table hit first. Failing that, the closest entry by current UTC offset,
 * preferring one sharing the zone's region prefix — so an unlisted
 * `Europe/Ljubljana` lands on another Central-European city rather than on a
 * same-offset African one.
 */
export function resolveTimezoneCity(
    zone: string | null = browserTimezone()
): TimezoneCity {
    if (!zone) return FALLBACK_CITY

    const canonical = ZONE_ALIASES[zone] ?? zone
    const exact = byZone.get(canonical)
    if (exact) return exact

    const offset = zoneOffsetMinutes(canonical)
    if (offset === null) return FALLBACK_CITY

    const region = canonical.split('/')[0]
    let best: TimezoneCity | null = null
    let bestScore = Number.POSITIVE_INFINITY
    for (const candidate of TIMEZONE_CITIES) {
        const candidateOffset = zoneOffsetMinutes(candidate.zone)
        if (candidateOffset === null) continue
        // Same-region entries win any offset tie and survive a modest offset
        // gap, which is what keeps the guess on the right continent.
        const sameRegion = candidate.zone.split('/')[0] === region
        const score =
            Math.abs(candidateOffset - offset) + (sameRegion ? 0 : 240)
        if (score < bestScore) {
            bestScore = score
            best = candidate
        }
    }
    return best ?? FALLBACK_CITY
}
