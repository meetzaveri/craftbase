// Vertex math for arrow lines. The Two.js types we need (Anchor, Commands) come
// off the constructor namespace. Parameters are intentionally typed loosely
// here because the calling sites pass through scene-bookkeeping shapes that get
// fully typed in Stages 7–9 (canvas / newCanvas).

import { arrowHeadWings } from './arrowHead'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoRefLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PointCircleLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any

export const updateX1Y1Vertices = (
    TwoRef: TwoRefLike,
    line: LineLike,
    x1: number,
    y1: number,
    pointCircle1: PointCircleLike,
    two: TwoLike
): void => {
    // Plain lines carry `noArrowhead` (set by the line factory) — rebuild as a
    // bare 2-anchor segment so dragging the tail never sprouts an arrowhead.
    if (line?.noArrowhead === true) {
        line.vertices = [
            new TwoRef.Anchor(
                x1,
                y1,
                undefined,
                undefined,
                undefined,
                undefined,
                TwoRef.Commands.move
            ),
            new TwoRef.Anchor(
                line.vertices[1].x,
                line.vertices[1].y,
                undefined,
                undefined,
                undefined,
                undefined,
                TwoRef.Commands.line
            ),
        ]
        pointCircle1.translation.x = line.vertices[0].x
        pointCircle1.translation.y = line.vertices[0].y
        two.update()
        return
    }

    line.vertices = buildArrowLineVertices(
        TwoRef,
        x1,
        y1,
        line.vertices[1].x,
        line.vertices[1].y,
        line.linewidth
    )

    pointCircle1.translation.x = line.vertices[0].x
    pointCircle1.translation.y = line.vertices[0].y

    two.update()
}

export const updateX2Y2Vertices = (
    TwoRef: TwoRefLike,
    line: LineLike,
    x2: number,
    y2: number,
    pointCircle2: PointCircleLike,
    two: TwoLike
): void => {
    // Plain lines (see updateX1Y1Vertices) stay a bare 2-anchor segment.
    if (line?.noArrowhead === true) {
        line.vertices = [
            new TwoRef.Anchor(
                line.vertices[0].x,
                line.vertices[0].y,
                undefined,
                undefined,
                undefined,
                undefined,
                TwoRef.Commands.move
            ),
            new TwoRef.Anchor(
                x2,
                y2,
                undefined,
                undefined,
                undefined,
                undefined,
                TwoRef.Commands.line
            ),
        ]
        pointCircle2.translation.x = line.vertices[1].x
        pointCircle2.translation.y = line.vertices[1].y
        two.update()
        return
    }

    line.vertices = buildArrowLineVertices(
        TwoRef,
        line.vertices[0].x,
        line.vertices[0].y,
        x2,
        y2,
        line.linewidth
    )

    pointCircle2.translation.x = line.vertices[1].x
    pointCircle2.translation.y = line.vertices[1].y

    two.update()
}

// An arrow line's anchors: the shaft, then the head as two wings drawn from
// the tip — [tail (move), tip, left wing, tip (move), right wing]. Head
// geometry is shared with curvedArrow (utils/arrowHead.ts).
export const buildArrowLineVertices = (
    TwoRef: TwoRefLike,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    linewidth?: number | null
): LineLike[] => {
    const anchor = (x: number, y: number, command: string): LineLike =>
        new TwoRef.Anchor(
            x,
            y,
            undefined,
            undefined,
            undefined,
            undefined,
            command
        )
    const { move, line } = TwoRef.Commands
    // A zero-length arrow has no direction; collapse its wings onto the tip.
    const wings = arrowHeadWings(
        { x: x2, y: y2 },
        { x: x2 - x1, y: y2 - y1 },
        linewidth
    ) ?? { left: { x: x2, y: y2 }, right: { x: x2, y: y2 } }
    return [
        anchor(x1, y1, move),
        anchor(x2, y2, line),
        anchor(wings.left.x, wings.left.y, line),
        anchor(x2, y2, move),
        anchor(wings.right.x, wings.right.y, line),
    ]
}

// Re-size an arrow line's head to its current stroke width, in place. The head
// length scales with the width, but a width edit (toolbar, group edit, undo)
// only sets `linewidth`. Cached, so calling it every frame is cheap. No-op for
// plain lines, which have no head.
export const refitArrowLineHead = (line: LineLike): void => {
    if (!line || line.noArrowhead === true || line.vertices?.length !== 5) {
        return
    }
    const v = line.vertices
    const key = [v[0].x, v[0].y, v[1].x, v[1].y, line.linewidth].join('|')
    if (line._headFitKey === key) return
    line._headFitKey = key
    const wings = arrowHeadWings(
        { x: v[1].x, y: v[1].y },
        { x: v[1].x - v[0].x, y: v[1].y - v[0].y },
        line.linewidth
    )
    if (!wings) return
    v[2].set(wings.left.x, wings.left.y)
    v[4].set(wings.right.x, wings.right.y)
}
