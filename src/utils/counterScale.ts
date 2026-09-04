// Counter-scale (zoom-resistance) for canvas elements that should stay legible
// as the world zooms out — most notably geo "point" pins.
//
// pinScale = 1 / (zuiScale ^ resist)
//   resist = 0   → element is fully fixed on screen (ignores zoom completely)
//   resist = 0.5 → "half resistant" — shrinks much slower than the world
//   resist = 1   → element scales exactly with the world (no counter-scaling)
//
// Reference: the standalone prototype in point_two.js.

import { DEFAULT_GEO_RESIST } from '../constants/misc'

export function computeCounterScale(
    zuiScale: number,
    resist: number = DEFAULT_GEO_RESIST
): number {
    if (!Number.isFinite(zuiScale) || zuiScale <= 0) return 1
    return 1 / Math.pow(zuiScale, resist)
}
