import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'

import CurvedLineFactory from '../../factory/curvedLine'
import { strokeTypeToDashes } from '../../utils/misc'
import {
    attachHandleCounterScale,
    attachStrokeCounterScale,
} from '../../utils/handleScale'
import { scheduleRender } from '../../utils/renderScheduler'

// A multi-point curved line. Renders as an open, curved Two.Path (see the
// factory). Unlike the geo route it does NOT counter-scale on zoom — a plain
// whiteboard line should scale with the world like every other shape.
//
// When selected it shows one draggable circle handle per vertex; dragging a
// handle reshapes the curve live (the curved Path re-flows its control points
// automatically) and persists the new vertex array into `metadata` on release.
// The drag is self-contained here (using the camera's clientToSurface) rather
// than threaded through the canvas's arrow-endpoint machinery, since that is
// hard-wired to a fixed 2-endpoint shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

const HANDLE_RADIUS = 5
// Clickable band width (screen px) around the curve, held constant at any zoom
// so the line stays easy to select even at 10%.
const HIT_BAND_PX = 22

function CurvedLine(props: ElementProps): ReactElement {
    const {
        isPencilMode,
        isArrowDrawMode,
        isArrowSelected,
        zuiInBoard,
        selectedComponent,
        updateComponentBulkPropertiesInLocalStore,
    } = useBoardContext()

    const two = props.twoJSInstance

    const groupRef = useRef<ShapeLike>(null)
    const pathRef = useRef<ShapeLike>(null)
    const handlesRef = useRef<ShapeLike[]>([])

    // Live values read inside DOM drag handlers registered once at mount — keep
    // them in refs to dodge the stale-closure trap (see CLAUDE.md).
    const zuiRef = useRef<ShapeLike>(zuiInBoard)
    const persistRef = useRef(updateComponentBulkPropertiesInLocalStore)
    const idRef = useRef<string>(props.id)
    useEffect(() => {
        zuiRef.current = zuiInBoard
    }, [zuiInBoard])
    useEffect(() => {
        persistRef.current = updateComponentBulkPropertiesInLocalStore
    }, [updateComponentBulkPropertiesInLocalStore])
    useEffect(() => {
        idRef.current = props.id
    }, [props.id])

    useEffect(() => {
        let mountCancelled = false
        const prevX = props.x
        const prevY = props.y

        const elementFactory = new CurvedLineFactory(two, prevX, prevY, {
            ...props,
        })
        const { group, path } = elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }

        if (props.parentGroup) {
            // Member of a selected/copied group — render the path into the parent
            // group; no per-vertex handles for grouped members.
            const parentGroup = props.parentGroup
            path.translation.x = props.properties.x
            path.translation.y = props.properties.y
            parentGroup.add(path)
            scheduleRender(two)
            return (): void => {
                two.remove(group)
            }
        }

        groupRef.current = group
        pathRef.current = path

        // Build one draggable handle per vertex (children of the group, so they
        // move/scale with it). Hidden until the line is selected.
        const verts = path.vertices
        const handles: ShapeLike[] = []
        for (let i = 0; i < verts.length; i++) {
            const v = verts[i]
            const handle = two.makeCircle(v.x, v.y, HANDLE_RADIUS)
            handle.fill = '#f4f4f2'
            handle.stroke = '#6965db'
            handle.linewidth = 1.5
            group.add(handle)
            handles.push(handle)
        }
        handlesRef.current = handles

        // Hold the vertex dots at a constant on-screen size so they stay
        // grabbable when zoomed far out (else ~1px at 20%).
        const initialScale =
            zuiRef.current?.zui?.scale ?? two?.scene?.scale ?? 1
        const detachHandleScale = attachHandleCounterScale(
            handles,
            two,
            initialScale
        )

        let hitObserver: MutationObserver | null = null
        let detachHitScale: (() => void) | null = null
        const cleanups: Array<() => void> = []

        // Every DOM read below needs the rendered SVG nodes, which only exist
        // after a render. Batch that render with every other element mounting
        // this frame — a synchronous two.update() per element made mounting a
        // board O(N²). `mountCancelled` guards an unmount before the frame
        // fires, so we never observe/bind a node that is already gone.
        scheduleRender(two, () => {
            if (mountCancelled) return

            const groupEl = document.getElementById(group.id)
            if (groupEl) {
                groupEl.setAttribute('class', 'dragger-picker')
                groupEl.setAttribute('data-component-id', props.id)
                groupEl.setAttribute(
                    'data-linewidth',
                    String(props.linewidth ?? '')
                )
            }
            // Show the `move` cursor over the line body, matching the selection
            // controller's body cursor for other shapes (the curve is a drag zone).
            // Inline beats the base `.dragger-picker` rule but yields to the
            // `!important` draw/pan-mode overrides.
            const pathEl = document.getElementById(path.id)
            if (pathEl) pathEl.style.cursor = 'move'

            // Fat transparent hit path so the (thin) curve is easy to click — its
            // `d` mirrors the visible path (a MutationObserver tracks vertex drags
            // for free), and its stroke width counter-scales so the clickable band
            // stays a constant ~22px on screen at any zoom (else ~0.25px at 10%).
            // A raw SVG node (not a Two child) so it never gets recolored/exported.
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
                    HIT_BAND_PX,
                    two,
                    zuiRef.current?.zui?.scale ?? two?.scene?.scale ?? 1
                )
            }

            // Per-vertex drag, wired directly on each handle's SVG node. stopPropagation
            // keeps the canvas from also starting a body-drag / reselect.
            handles.forEach((handle, index) => {
                const el = document.getElementById(handle.id)
                if (!el) return
                // `move` cursor on the vertex handles too, matching the body + the
                // selection controller's drag-zone cursor.
                el.style.cursor = 'move'
                el.setAttribute('class', 'dragger-picker is-vertex-handle')
                el.setAttribute('data-vertex-index', String(index))
                // Hidden handles must not eat clicks (opacity-0 SVG still hit-tests).
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
                        vertex.x = surface.x - grp.translation.x
                        vertex.y = surface.y - grp.translation.y
                        handle.translation.x = vertex.x
                        handle.translation.y = vertex.y
                        // Curved, non-manual Path recomputes its control points from
                        // the anchors on render — flag the vertices so it re-flows.
                        pth._flagVertices = true
                        two.update()
                    }

                    const onUp = (): void => {
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                        const grp = groupRef.current
                        const pth = pathRef.current
                        if (!grp || !pth) return
                        // Persist absolute vertex coords (same convention as route).
                        const newVerts = pth.vertices.map((vx: ShapeLike) => ({
                            x: Math.round(grp.translation.x + vx.x),
                            y: Math.round(grp.translation.y + vx.y),
                        }))
                        grp.elementData = {
                            ...grp.elementData,
                            metadata: newVerts,
                        }
                        // Records an UPDATE_BULK so the vertex edit is undoable. The
                        // component snapshots props at mount (frozen props), so the
                        // history hook can't revert us via a re-render — it fires a
                        // `curvedLineVertsReverted` event instead, which the effect
                        // below re-flows (path + handles) from the reverted metadata.
                        persistRef.current?.(idRef.current, {
                            metadata: newVerts,
                        })
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

        return (): void => {
            mountCancelled = true
            hitObserver?.disconnect()
            detachHitScale?.()
            detachHandleScale()
            cleanups.forEach((fn) => fn())
            two.remove(group)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Show the vertex handles only while this line is the active selection.
    useEffect(() => {
        const group = groupRef.current
        if (!group) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedId = (selectedComponent as any)?.group?.id
        const isSelected = selectedId != null && selectedId === group.id
        handlesRef.current.forEach((handle) => {
            handle.opacity = isSelected ? 1 : 0
            const el = document.getElementById(handle.id)
            if (el) el.style.pointerEvents = isSelected ? 'auto' : 'none'
        })
        scheduleRender(two)
    }, [selectedComponent, two])

    // Undo/redo of a vertex edit reverts our `metadata` in the store, but
    // ElementRenderWrapper freezes our props at mount so no effect re-fires.
    // The history hook dispatches this event instead; we re-flow the path's
    // relative anchors (translation is unchanged by a vertex edit) and move each
    // handle back to its reverted anchor, mirroring the live drag's onMove.
    useEffect(() => {
        const handleReverted = ((
            e: CustomEvent<{
                id: string
                metadata: Array<{ x: number; y: number }>
            }>
        ): void => {
            if (e.detail?.id !== idRef.current) return
            const grp = groupRef.current
            const pth = pathRef.current
            const verts = e.detail.metadata
            if (!grp || !pth || !Array.isArray(verts)) return
            pth.vertices.forEach((vx: ShapeLike, i: number) => {
                const v = verts[i]
                if (!v) return
                vx.x = v.x - grp.translation.x
                vx.y = v.y - grp.translation.y
            })
            handlesRef.current.forEach((handle: ShapeLike, i: number) => {
                const vx = pth.vertices[i]
                if (!vx) return
                handle.translation.x = vx.x
                handle.translation.y = vx.y
            })
            // Curved, non-manual Path re-flows its control points on render.
            pth._flagVertices = true
            two.update()
        }) as EventListener
        window.addEventListener('curvedLineVertsReverted', handleReverted)
        return () =>
            window.removeEventListener(
                'curvedLineVertsReverted',
                handleReverted
            )
    }, [two])

    // Reactive style updates (stroke / width / dash) — mirrors route/arrow.
    useEffect(() => {
        const path = pathRef.current
        if (!path) return
        if (props.stroke) path.stroke = props.stroke
        if (props.linewidth) path.linewidth = props.linewidth
        path.dashes = strokeTypeToDashes(props.strokeType)
        scheduleRender(two)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.stroke, props.linewidth, props.strokeType])

    // Disable hit-testing while a draw tool is active (matches route/area).
    useEffect(() => {
        const group = groupRef.current
        const el = group ? document.getElementById(group.id) : null
        if (el) {
            el.style.pointerEvents =
                isPencilMode || isArrowDrawMode || isArrowSelected
                    ? 'none'
                    : 'auto'
        }
    }, [isPencilMode, isArrowDrawMode, isArrowSelected])

    return <React.Fragment />
}

export default CurvedLine
