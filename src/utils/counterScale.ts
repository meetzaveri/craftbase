// Counter-scale (zoom-resistance) for canvas elements that should stay legible
// as the world zooms out — most notably geo "point" pins.
//
// pinScale = 1 / (zuiScale ^ resist)
//
// The counter-scaled group is a child of the ZUI-scaled scene, so the two
// multiply and what you actually see on screen is:
//
//   apparentSize ∝ zuiScale * pinScale = zuiScale ^ (1 - resist)
//
//   resist = 0   → apparent ∝ scale^1   — scales exactly with the world
//   resist = 0.5 → apparent ∝ scale^0.5 — shrinks much slower than the world
//   resist = 1   → apparent ∝ scale^0   — fully fixed on screen (ignores zoom)
//
// Measured at the ZUI's 0.06 zoom floor: a resist=0 pin renders at 6% of
// nominal, a resist=1 pin at 100%, and the default resist=0.9 at
// scale^0.1 ≈ 75%.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

/**
 * The two ways an element resists zoom. A point counter-scales its whole group
 * (circle and label together); an area/route counter-scales only its stroke
 * width, because scaling their geometry would peel the outline off the map.
 * Don't unify them.
 *
 * geoText is deliberately absent: map text scales with the geography it labels,
 * like every other mark on the canvas.
 */
const GROUP_SCALED_TYPES: ReadonlySet<string> = new Set(['point'])
const STROKE_SCALED_TYPES: ReadonlySet<string> = new Set(['area', 'route'])

/**
 * Apply zoom-resistance to a *detached copy* of an element — the member copies
 * a group overlay builds straight from the factories (groupobject.tsx).
 *
 * Those copies have no element component behind them, so nothing else
 * counter-scales them: without this a grouped pin renders at world size for as
 * long as the selection lasts (a speck when zoomed out), then jumps back to
 * full size the moment the group dissolves.
 *
 * Mirrors exactly what the live components do on mount and on every
 * `zoomChanged` — see point.tsx (whole group) and area.tsx / route.tsx (stroke
 * width only). `metadata` is a vertex array for area/route,
 * so `.resist` is undefined there and falls through to the default, same as in
 * those components.
 */
export function applyCounterScaleToCopy(
    copy: ShapeLike,
    item: ShapeLike,
    zuiScale: number | undefined
): void {
    if (!copy || !zuiScale) return
    const type = item?.componentType
    if (!GROUP_SCALED_TYPES.has(type) && !STROKE_SCALED_TYPES.has(type)) return

    const factor = computeCounterScale(
        zuiScale,
        item?.metadata?.resist ?? DEFAULT_GEO_RESIST
    )

    if (GROUP_SCALED_TYPES.has(type)) {
        copy.scale = factor
        return
    }

    const base = item?.linewidth ?? 2
    copy.children?.forEach((child: ShapeLike) => {
        if (typeof child?.linewidth === 'number') {
            child.linewidth = base * factor
        }
    })
}

/**
 * Re-apply zoom-resistance to every member copy inside a group overlay. Cheap
 * enough to run on every camera change: it only touches the geo types and skips
 * the overlay's own selector rectangle (no `elementData`).
 */
export function applyCounterScaleToCopies(
    group: ShapeLike,
    zuiScale: number | undefined
): void {
    group?.children?.forEach((child: ShapeLike) => {
        if (child?.elementData) {
            applyCounterScaleToCopy(child, child.elementData, zuiScale)
        }
    })
}
