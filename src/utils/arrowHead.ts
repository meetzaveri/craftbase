// Shared arrowhead geometry for arrowLine and curvedArrow, so both draw the
// same head: two wings at ±30° off the shaft, their length scaling with the
// stroke width so a thick arrow keeps a readable head.

export interface Point {
    x: number
    y: number
}

// Half-angle between each wing and the shaft.
export const ARROW_HEAD_SPREAD = Math.PI / 6
const ARROW_HEAD_MIN_LENGTH = 10
const ARROW_HEAD_LENGTH_PER_LINEWIDTH = 3

export function arrowHeadLength(linewidth?: number | null): number {
    return Math.max(
        ARROW_HEAD_MIN_LENGTH,
        (linewidth || 0) * ARROW_HEAD_LENGTH_PER_LINEWIDTH
    )
}

// The two wing ends of a head whose tip is `tip`, for a shaft travelling in
// direction `dir` (need not be normalised). Null when `dir` has no length.
export function arrowHeadWings(
    tip: Point,
    dir: Point,
    linewidth?: number | null
): { left: Point; right: Point } | null {
    const len = Math.hypot(dir.x, dir.y)
    if (len < 0.001) return null
    const back = Math.atan2(dir.y, dir.x) + Math.PI
    const size = arrowHeadLength(linewidth)
    const wing = (sign: number): Point => ({
        x: tip.x + Math.cos(back + sign * ARROW_HEAD_SPREAD) * size,
        y: tip.y + Math.sin(back + sign * ARROW_HEAD_SPREAD) * size,
    })
    return { left: wing(1), right: wing(-1) }
}
