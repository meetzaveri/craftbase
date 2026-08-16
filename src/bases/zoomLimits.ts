// How far each base's camera may zoom, as ZUI scale.
//
// Split out of the providers because the camera needs these BEFORE a provider
// exists. Providers load through a dynamic import (the map base carries ~1MB of
// maplibre), so on a page load the canvas is created — and the saved viewport
// restored — while `baseProvider` is still the board base. Restoring a map
// camera against the board's floor silently clamps it, which is how a board
// saved at map z8 came back at z11. This table is plain arithmetic with no
// dependencies, so the camera can be given the right range immediately.
//
// `BaseProvider.zoomLimits` reads from here, so there is still exactly one
// definition per base.

import { DEFAULT_ANCHOR_ZOOM } from '../utils/timezoneCities'
import type { BaseId } from './types'

export interface ZoomLimits {
    min: number
    max: number
}

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

/** The pre-bases range, kept exactly: 6%–800%. */
const BOARD_LIMITS: ZoomLimits = { min: 0.06, max: 8 }

const MAP_LIMITS: ZoomLimits = {
    min: Math.pow(2, MIN_MAP_ZOOM - DEFAULT_ANCHOR_ZOOM),
    max: Math.pow(2, MAX_MAP_ZOOM - DEFAULT_ANCHOR_ZOOM),
}

export const BASE_ZOOM_LIMITS: Record<BaseId, ZoomLimits> = {
    board: BOARD_LIMITS,
    map: MAP_LIMITS,
}

/** Limits for a base, falling back to the board's for anything unrecognised. */
export function zoomLimitsForBase(base: BaseId): ZoomLimits {
    return BASE_ZOOM_LIMITS[base] ?? BOARD_LIMITS
}
