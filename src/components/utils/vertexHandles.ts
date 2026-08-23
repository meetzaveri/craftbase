// Draggable per-vertex handles for multi-point paths — the selection affordance
// shared by the curved line (board base) and the geo route / area (map base).
//
// All three are the same shape underneath: a Two.Path whose anchors are stored
// as ABSOLUTE coordinates in `metadata`, made relative to the group origin by
// the factory. So they get the same editing model — one circle per vertex,
// shown only while the element is selected, dragged to reshape the path, with
// the new vertex array persisted (and undoable) on release.
//
// Why not the SelectionController: that is hard-wired to a bounding box with
// eight handles, which says nothing useful about a polyline. This is a
// per-vertex model, so it lives on its own.
//
// The drag reads the camera through `zuiRef` rather than a captured value —
// these listeners are registered once against DOM nodes and never re-bound, so
// a captured camera would go stale on the first pan (see CLAUDE.md).

import type { MutableRefObject } from 'react'
import {
    attachHandleCounterScale,
    attachStrokeCounterScale,
} from '../../utils/handleScale'
import { scheduleRender } from '../../utils/renderScheduler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

/** Handle dot radius in surface units at scale 1 (counter-scaled on zoom). */
const HANDLE_RADIUS = 5
/**
 * Clickable band around the stroke, in SCREEN px, held constant at any zoom.
 * A route's 2px stroke is a ~0.2px target at 10% zoom without this.
 */
const DEFAULT_HIT_BAND_PX = 22

const HANDLE_FILL = '#f4f4f2'
const HANDLE_STROKE = '#6965db'

/**
 * Fired when undo/redo reverts a vertex array. Element components freeze their
 * props at mount (see ElementRenderWrapper), so the history hook cannot revert
 * them through a re-render — it dispatches this instead and the component
 * re-flows its own path and handles.
 */
export const VERTEX_PATH_REVERTED_EVENT = 'vertexPathReverted'

/**
 * Element types that carry an absolute vertex array in `metadata` and render it
 * with these handles. The revert dispatchers gate on this so a vertex undo
 * reaches every one of them.
 */
export const VERTEX_PATH_TYPES: ReadonlySet<string> = new Set([
    'curvedLine',
    'route',
    'area',
])

export interface VertexPathRevertedDetail {
    id: string
    metadata: Array<{ x: number; y: number }>
}

export interface VertexHandlesOptions {
    two: ShapeLike
    /** The element's group and path, as returned by its factory. */
    group: ShapeLike
    path: ShapeLike
    componentId: string
    /** Live BaseContext camera wrapper ({ zui, ... }). */
    zuiRef: MutableRefObject<ShapeLike>
    /** Live `updateComponentBulkPropertiesInLocalStore`. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    persistRef: MutableRefObject<((id: string, patch: any) => void) | undefined>
    /** Live component id, group and path (the drag re-reads all three). */
    idRef: MutableRefObject<string>
    groupRef: MutableRefObject<ShapeLike>
    pathRef: MutableRefObject<ShapeLike>
    /** Override the clickable band width. */
    hitBandPx?: number
}

export interface VertexHandles {
    handles: ShapeLike[]
    destroy(): void
}

/**
 * Build the handles and wire their drags. Call from the element's mount effect,
 * right after the factory has produced `group` and `path`.
 *
 * Handles are children of the group, so they inherit its translation for free —
 * a body drag moves them without any bookkeeping here.
 */
export function attachVertexHandles({
    two,
    group,
    path,
    componentId,
    zuiRef,
    persistRef,
    idRef,
    groupRef,
    pathRef,
    hitBandPx = DEFAULT_HIT_BAND_PX,
}: VertexHandlesOptions): VertexHandles {
    let cancelled = false

    const handles: ShapeLike[] = []
    const verts = path.vertices ?? []
    for (let i = 0; i < verts.length; i++) {
        const v = verts[i]
        const handle = two.makeCircle(v.x, v.y, HANDLE_RADIUS)
        handle.fill = HANDLE_FILL
        handle.stroke = HANDLE_STROKE
        handle.linewidth = 1.5
        // Start hidden: handles belong to the selection, not the drawing.
        handle.opacity = 0
        group.add(handle)
        handles.push(handle)
    }

    // Hold the dots at a constant on-screen size so they stay grabbable when
    // zoomed far out (else ~1px at 20%).
    const initialScale = zuiRef.current?.zui?.scale ?? two?.scene?.scale ?? 1
    const detachHandleScale = attachHandleCounterScale(
        handles,
        two,
        initialScale
    )

    let hitObserver: MutationObserver | null = null
    let detachHitScale: (() => void) | null = null
    const cleanups: Array<() => void> = []

    // Every DOM read below needs rendered SVG nodes, which only exist after a
    // render. Batch that render with every other element mounting this frame —
    // a synchronous two.update() per element made mounting a base O(N²).
    // `cancelled` guards an unmount before the frame fires, so we never bind a
    // node that is already gone.
    scheduleRender(two, () => {
        if (cancelled) return

        const pathEl = document.getElementById(path.id)
        // `move` over the body, matching the selection controller's drag-zone
        // cursor. Inline beats the base `.dragger-picker` rule but yields to
        // the `!important` draw/pan-mode overrides.
        if (pathEl) pathEl.style.cursor = 'move'

        // Fat transparent hit path so a thin stroke is easy to click. Its `d`
        // mirrors the visible path (a MutationObserver tracks vertex drags for
        // free) and its width counter-scales to a constant screen band. A raw
        // SVG node, not a Two child, so it is never recolored or exported.
        if (pathEl) {
            const hitEl = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'path'
            )
            hitEl.setAttribute('stroke', 'transparent')
            hitEl.setAttribute('fill', 'none')
            hitEl.setAttribute('pointer-events', 'stroke')
            hitEl.setAttribute('stroke-linecap', 'round')
            hitEl.setAttribute('stroke-linejoin', 'round')
            hitEl.style.cursor = 'move'
            const syncD = (): void => {
                const d = pathEl.getAttribute('d')
                if (d) hitEl.setAttribute('d', d)
            }
            syncD()
            pathEl.parentNode?.insertBefore(hitEl, pathEl)
            hitObserver = new MutationObserver(syncD)
            hitObserver.observe(pathEl, {
                attributes: true,
                attributeFilter: ['d'],
            })
            detachHitScale = attachStrokeCounterScale(
                (w) => hitEl.setAttribute('stroke-width', String(w)),
                hitBandPx,
                two,
                zuiRef.current?.zui?.scale ?? two?.scene?.scale ?? 1
            )
        }

        // Per-vertex drag, wired directly on each handle's SVG node.
        // stopPropagation keeps the canvas from also starting a body-drag or a
        // reselect on the same press.
        handles.forEach((handle, index) => {
            const el = document.getElementById(handle.id)
            if (!el) return
            el.style.cursor = 'move'
            el.setAttribute('class', 'dragger-picker is-vertex-handle')
            el.setAttribute('data-vertex-index', String(index))
            el.setAttribute('data-component-id', componentId)
            // Hidden handles must not eat clicks — opacity-0 SVG still
            // hit-tests, so this is the real gate, re-opened on selection.
            el.style.pointerEvents = 'none'

            const onMouseDown = (e: MouseEvent): void => {
                e.preventDefault()
                e.stopPropagation()

                const onMove = (me: MouseEvent): void => {
                    const z = zuiRef.current
                    const grp = groupRef.current
                    const pth = pathRef.current
                    if (!z?.zui || !grp || !pth) return
                    const surface = z.zui.clientToSurface(
                        me.clientX,
                        me.clientY
                    )
                    const vertex = pth.vertices[index]
                    if (!vertex) return
                    vertex.x = surface.x - grp.translation.x
                    vertex.y = surface.y - grp.translation.y
                    handle.translation.x = vertex.x
                    handle.translation.y = vertex.y
                    // A curved, non-manual Path recomputes its control points
                    // from the anchors on render — flag so it re-flows. Inert
                    // but harmless on the straight-segment route/area.
                    pth._flagVertices = true
                    two.update()
                }

                const onUp = (): void => {
                    window.removeEventListener('mousemove', onMove)
                    window.removeEventListener('mouseup', onUp)
                    const grp = groupRef.current
                    const pth = pathRef.current
                    if (!grp || !pth) return
                    // Persist ABSOLUTE vertex coords (the stored convention).
                    const newVerts = pth.vertices.map((vx: ShapeLike) => ({
                        x: Math.round(grp.translation.x + vx.x),
                        y: Math.round(grp.translation.y + vx.y),
                    }))
                    grp.elementData = {
                        ...grp.elementData,
                        metadata: newVerts,
                    }
                    // Records an UPDATE_BULK so the edit is undoable; the revert
                    // comes back through VERTEX_PATH_REVERTED_EVENT.
                    persistRef.current?.(idRef.current, { metadata: newVerts })
                }

                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
            }

            el.addEventListener('mousedown', onMouseDown)
            cleanups.push(() =>
                el.removeEventListener('mousedown', onMouseDown)
            )
        })
    })

    return {
        handles,
        destroy(): void {
            cancelled = true
            hitObserver?.disconnect()
            detachHitScale?.()
            detachHandleScale()
            cleanups.forEach((fn) => fn())
        },
    }
}

/**
 * Show or hide the handles. Toggles `pointerEvents` as well as opacity, because
 * an invisible SVG node still hit-tests — leaving it clickable would let an
 * unselected path's handles swallow clicks meant for whatever is underneath.
 */
export function setVertexHandlesVisible(
    handles: ShapeLike[],
    visible: boolean,
    two: ShapeLike
): void {
    handles.forEach((handle) => {
        handle.opacity = visible ? 1 : 0
        const el = document.getElementById(handle.id)
        if (el) el.style.pointerEvents = visible ? 'auto' : 'none'
    })
    scheduleRender(two)
}

/**
 * Re-seat a path and its handles onto a reverted vertex array (undo/redo).
 * Vertices are stored absolute and held relative, and a vertex edit never moves
 * the group, so the group's translation is the conversion both ways.
 */
export function applyRevertedVertices(
    two: ShapeLike,
    group: ShapeLike,
    path: ShapeLike,
    handles: ShapeLike[],
    verts: Array<{ x: number; y: number }>
): void {
    if (!group || !path || !Array.isArray(verts)) return
    path.vertices.forEach((vx: ShapeLike, i: number) => {
        const v = verts[i]
        if (!v) return
        vx.x = v.x - group.translation.x
        vx.y = v.y - group.translation.y
    })
    handles.forEach((handle: ShapeLike, i: number) => {
        const vx = path.vertices[i]
        if (!vx) return
        handle.translation.x = vx.x
        handle.translation.y = vx.y
    })
    path._flagVertices = true
    two.update()
}
