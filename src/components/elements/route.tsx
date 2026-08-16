import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'

import RouteFactory from '../../factory/route'
import { computeCounterScale } from '../../utils/counterScale'
import { DEFAULT_GEO_RESIST } from '../../constants/misc'
import {
    attachVertexHandles,
    setVertexHandlesVisible,
    applyRevertedVertices,
    VERTEX_PATH_REVERTED_EVENT,
} from '../utils/vertexHandles'
import type {
    VertexHandles,
    VertexPathRevertedDetail,
} from '../utils/vertexHandles'

// See circle.tsx for the rationale on the loose prop bag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

function Route(props: ElementProps): ReactElement {
    const {
        isPencilMode,
        isArrowDrawMode,
        isArrowSelected,
        zuiInBoard,
        selectedComponent,
        updateComponentBulkPropertiesInLocalStore,
    } = useBoardContext()

    const groupRef = useRef<ShapeLike>(null)
    const shapeRef = useRef<ShapeLike>(null)
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

    const two = props.twoJSInstance
    // metadata for route is the vertex array, so `.resist` is undefined and we
    // fall back to the default — same expression point.tsx uses.
    const resist = props.metadata?.resist ?? DEFAULT_GEO_RESIST
    // Logical (unscaled) stroke width. We counter-scale this on zoom rather
    // than the whole group, so the polyline geometry stays glued to the world.
    const baseLinewidth = props.linewidth ?? 2.5

    useEffect(() => {
        const prevX = props.x
        const prevY = props.y
        let vertexHandles: VertexHandles | null = null

        const elementFactory = new RouteFactory(two, prevX, prevY, {
            ...props,
        })
        const { group, path } = elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }

        if (props.parentGroup) {
            const parentGroup = props.parentGroup
            path.translation.x = props.properties.x
            path.translation.y = props.properties.y
            parentGroup.add(path)
            two.update()
        } else {
            groupRef.current = group
            shapeRef.current = path

            // Seed the stroke-width counter-scale from the current camera so the
            // line is legible before the first zoom event fires. Only linewidth
            // resists the zoom — the geometry stays glued to the world (unlike
            // point.tsx, which counter-scales the whole group).
            const initialScale =
                (zuiInBoard as ShapeLike)?.zui?.scale ?? two?.scene?.scale
            if (initialScale) {
                path.linewidth =
                    baseLinewidth * computeCounterScale(initialScale, resist)
            }

            two.update()

            // Per-vertex handles + the fat hit band, shared with the curved
            // line — all three are absolute-metadata multi-point paths, so
            // they get the same editing model.
            vertexHandles = attachVertexHandles({
                two,
                group,
                path,
                componentId: props.id,
                zuiRef,
                persistRef,
                idRef,
                groupRef,
                pathRef: shapeRef,
            })
            handlesRef.current = vertexHandles.handles

            const groupEl = document.getElementById(group.id)
            if (groupEl) {
                groupEl.setAttribute('class', 'dragger-picker')
                groupEl.setAttribute('data-component-id', props.id)
                groupEl.setAttribute(
                    'data-linewidth',
                    String(props.linewidth ?? '')
                )
            }
        }

        return (): void => {
            vertexHandles?.destroy()
            two.remove(group)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Counter-scale only the stroke width on every camera change so the route
    // stays legible when the world zooms out, while the geometry stays glued to
    // its coordinates. Reads scale from the event each fire — no stale closure
    // (see the React + Two.js stale-closure note in CLAUDE.md).
    useEffect(() => {
        const onZoom = (e: Event): void => {
            const group = groupRef.current
            const path = shapeRef.current
            if (!group || !path) return
            const scale = (e as CustomEvent<{ scale: number }>).detail?.scale
            if (!scale) return
            // Logical width lives on elementData (kept in sync by the property
            // panel); fall back to the mount-time base.
            const base = group.elementData?.linewidth ?? baseLinewidth
            path.linewidth = base * computeCounterScale(scale, resist)
            two.update()
        }
        window.addEventListener('zoomChanged', onZoom as EventListener)
        return (): void => {
            window.removeEventListener('zoomChanged', onZoom as EventListener)
        }
    }, [two, resist, baseLinewidth])

    // Show the vertex handles only while this route is the active selection.
    useEffect(() => {
        const group = groupRef.current
        if (!group) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectedId = (selectedComponent as any)?.group?.id
        const isSelected = selectedId != null && selectedId === group.id
        setVertexHandlesVisible(handlesRef.current, isSelected, two)
    }, [selectedComponent, two])

    // Undo/redo of a vertex edit reverts our `metadata` in the store, but
    // ElementRenderWrapper freezes our props at mount so no effect re-fires.
    // The history hook dispatches this event instead.
    useEffect(() => {
        const handleReverted = ((
            e: CustomEvent<VertexPathRevertedDetail>
        ): void => {
            if (e.detail?.id !== idRef.current) return
            applyRevertedVertices(
                two,
                groupRef.current,
                shapeRef.current,
                handlesRef.current,
                e.detail.metadata
            )
        }) as EventListener
        window.addEventListener(VERTEX_PATH_REVERTED_EVENT, handleReverted)
        return () =>
            window.removeEventListener(
                VERTEX_PATH_REVERTED_EVENT,
                handleReverted
            )
    }, [two])

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

export default Route
