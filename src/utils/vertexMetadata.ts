// The absolute-vertex-metadata coordinate model, in one place.
//
// Four element types keep their geometry as an array of ABSOLUTE surface coords
// in `metadata` rather than in `x`/`y`: pencil, area, route and curvedLine.
// Their factories rebuild the path as `metadata - (x, y)` and then translate the
// group to `(x, y)` — so `x`/`y` is only the origin those vertices were made
// relative to, and the two have to be kept in step.
//
// That is the whole trap: writing a moved element's new `x`/`y` WITHOUT moving
// the vertex array is worse than not persisting at all, because on the next load
// the factory subtracts the new origin from the old vertices and the shape lands
// exactly where it began. Every path that relocates one of these elements —
// dragging it, pasting it — has to shift both.

/** Element types whose `metadata` is an absolute vertex array. */
const ABSOLUTE_VERTEX_TYPES: ReadonlySet<string> = new Set([
    'pencil',
    'area',
    'route',
    'curvedLine',
])

export function hasAbsoluteVertexMetadata(
    componentType?: string | null
): boolean {
    return !!componentType && ABSOLUTE_VERTEX_TYPES.has(componentType)
}

/**
 * One stored vertex. Pencil carries a per-point width in `lw`, which survives a
 * shift by being spread through — deliberately not declared here, because an
 * index signature on this type makes the array unassignable to
 * `ComponentMetadata` at every call site.
 */
export interface VertexPoint {
    x: number
    y: number
}

/**
 * Move a vertex array by `(dx, dy)`, keeping every other per-point field.
 *
 * Returns `null` when `metadata` is not a vertex array, so callers can skip the
 * write rather than clobber an object-shaped metadata (`text`, `point`) with an
 * empty list. A zero delta still returns a fresh array — the caller decides
 * whether that is worth persisting.
 */
export function shiftVertexMetadata(
    metadata: unknown,
    dx: number,
    dy: number
): VertexPoint[] | null {
    if (!Array.isArray(metadata)) return null
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
    return metadata.map((point) => {
        const p = (point ?? {}) as Record<string, unknown>
        return {
            ...p,
            x: Math.round((Number(p.x) || 0) + dx),
            y: Math.round((Number(p.y) || 0) + dy),
        }
    })
}

/**
 * Centre of a vertex array's bounding box, or `null` if there is nothing to
 * measure.
 *
 * Paste uses it as the element's visual middle. `x`/`y` will not do: for these
 * types it is wherever the first vertex happened to fall, so pasting "at the
 * cursor" by that anchor drops the shape a corner's-worth away from the pointer
 * — and further the more the drawing wanders from its first point.
 */
export function vertexMetadataCenter(
    metadata: unknown
): { x: number; y: number } | null {
    if (!Array.isArray(metadata) || metadata.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const point of metadata) {
        const px = Number((point as Record<string, unknown>)?.x)
        const py = Number((point as Record<string, unknown>)?.y)
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (py < minY) minY = py
        if (py > maxY) maxY = py
    }
    if (minX === Infinity) return null
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}
