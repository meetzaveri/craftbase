import Two from 'two.js'
import CurvedLineFactory from './curvedLine'
import { arrowHeadWings } from '../utils/arrowHead'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

interface Point {
    x: number
    y: number
}

// Direction of travel at the curve's last vertex.
//
// Two.js builds an open curved path with getCurveFromPoints: the last vertex
// gets no control handle (its next point is itself), so the final cubic
// segment runs from p[n-2] via its right control point straight into p[n-1],
// and its end tangent is p[n-1] − (p[n-2] + rightControl). Recomputed here
// with Two.js's own formula (utils/curves.js getControlPoints) so the head is
// right before the path's next render, not a frame behind.
export function curveEndDirection(vertices: Point[]): Point | null {
    const n = vertices.length
    if (n < 2) return null
    const c = vertices[n - 1]!
    const b = vertices[n - 2]!
    const chord = { x: c.x - b.x, y: c.y - b.y }
    if (n === 2) return chord

    const a = vertices[n - 3]!
    const d1 = Math.hypot(a.x - b.x, a.y - b.y)
    const d2 = Math.hypot(c.x - b.x, c.y - b.y)
    if (d1 < 0.001 || d2 < 0.001) return chord

    const a1 = Math.atan2(a.y - b.y, a.x - b.x)
    const a2 = Math.atan2(c.y - b.y, c.x - b.x)
    let mid = (a1 + a2) / 2
    mid += a2 < a1 ? Math.PI / 2 : -Math.PI / 2
    mid -= Math.PI
    const control = {
        x: b.x + Math.cos(mid) * d2 * 0.33,
        y: b.y + Math.sin(mid) * d2 * 0.33,
    }
    const dir = { x: c.x - control.x, y: c.y - control.y }
    return Math.hypot(dir.x, dir.y) < 0.001 ? chord : dir
}

// Place the head on the path's last vertex, pointing along the curve, and
// mirror the path's stroke and width onto it. Head geometry is shared with
// arrowLine (utils/arrowHead.ts). Cheap when nothing changed, so
// it's safe to call every frame.
export function fitCurvedArrowHead(path: ShapeLike, head: ShapeLike): void {
    if (!path || !head) return
    const verts: Point[] = Array.from(path.vertices)
    const dir = curveEndDirection(verts)
    const tip = verts[verts.length - 1]
    const len = dir ? Math.hypot(dir.x, dir.y) : 0
    if (!dir || !tip || len < 0.001) {
        head.visible = false
        return
    }

    const key = [
        tip.x,
        tip.y,
        dir.x / len,
        dir.y / len,
        path.stroke,
        path.linewidth,
        path.translation.x,
        path.translation.y,
    ].join('|')
    if (head._fitKey === key) return
    head._fitKey = key

    const wings = arrowHeadWings(tip, dir, path.linewidth)
    if (!wings) return
    const { left, right } = wings
    head.vertices[0].set(left.x, left.y)
    head.vertices[1].set(tip.x, tip.y)
    head.vertices[2].set(right.x, right.y)
    head.translation.copy(path.translation)
    head.stroke = path.stroke
    head.linewidth = path.linewidth
    head.visible = true
}

// The arrowhead inside a curved-arrow group, if any. Group children are
// [path, head, ...vertex handles].
export function findCurvedArrowHead(group: ShapeLike): ShapeLike | null {
    const head = group?.children?.[1]
    return head?.isArrowHead ? head : null
}

// Re-fit the head of a curved-arrow group (no-op for anything else).
export function syncCurvedArrowHead(group: ShapeLike): void {
    const head = findCurvedArrowHead(group)
    if (head) fitCurvedArrowHead(group.children[0], head)
}

// A curved line with an arrowhead on its last vertex. The curve is built by
// CurvedLineFactory; the head is a separate open path (a curved Path would
// smooth the head's corners too). The head never takes the line's dash
// pattern, so a dashed arrow keeps a solid, readable head.
export default class CurvedArrowFactory extends CurvedLineFactory {
    head?: ShapeLike

    override createElement(): { group: ShapeLike; path: ShapeLike } {
        const { group, path } = super.createElement()
        const head = new (Two as ShapeLike).Path(
            [
                new (Two as ShapeLike).Anchor(0, 0),
                new (Two as ShapeLike).Anchor(0, 0),
                new (Two as ShapeLike).Anchor(0, 0),
            ],
            false,
            false
        )
        head.noFill()
        head.cap = 'round'
        head.join = 'round'
        head.isArrowHead = true
        group.add(head)
        fitCurvedArrowHead(path, head)
        this.head = head
        return { group, path }
    }
}
