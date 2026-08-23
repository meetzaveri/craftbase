import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBaseContext } from '../../views/Base/baseContext'

import CurvedLineFactory from '../../factory/curvedLine'
import { strokeTypeToDashes } from '../../utils/misc'
import { scheduleRender } from '../../utils/renderScheduler'
import {
    attachVertexHandles,
    setVertexHandlesVisible,
    applyRevertedVertices,
    VERTEX_PATH_REVERTED_EVENT,
} from '../utils/vertexHandles'
import type { VertexPathRevertedDetail } from '../utils/vertexHandles'

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

function CurvedLine(props: ElementProps): ReactElement {
    const {
        isPencilMode,
        isArrowDrawMode,
        isArrowSelected,
        zuiInBase,
        selectedComponent,
        updateComponentBulkPropertiesInLocalStore,
    } = useBaseContext()

    const two = props.twoJSInstance

    const groupRef = useRef<ShapeLike>(null)
    const pathRef = useRef<ShapeLike>(null)
    const handlesRef = useRef<ShapeLike[]>([])

    // Live values read inside DOM drag handlers registered once at mount — keep
    // them in refs to dodge the stale-closure trap (see CLAUDE.md).
    const zuiRef = useRef<ShapeLike>(zuiInBase)
    const persistRef = useRef(updateComponentBulkPropertiesInLocalStore)
    const idRef = useRef<string>(props.id)
    useEffect(() => {
        zuiRef.current = zuiInBase
    }, [zuiInBase])
    useEffect(() => {
        persistRef.current = updateComponentBulkPropertiesInLocalStore
    }, [updateComponentBulkPropertiesInLocalStore])
    useEffect(() => {
        idRef.current = props.id
    }, [props.id])

    useEffect(() => {
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

        // Per-vertex handles + the fat hit band. Shared with route/area —
        // all three are absolute-metadata multi-point paths.
        const vertexHandles = attachVertexHandles({
            two,
            group,
            path,
            componentId: props.id,
            zuiRef,
            persistRef,
            idRef,
            groupRef,
            pathRef,
        })
        handlesRef.current = vertexHandles.handles

        scheduleRender(two, () => {
            const groupEl = document.getElementById(group.id)
            if (groupEl) {
                groupEl.setAttribute('class', 'dragger-picker')
                groupEl.setAttribute('data-component-id', props.id)
                groupEl.setAttribute(
                    'data-linewidth',
                    String(props.linewidth ?? '')
                )
            }
        })

        return (): void => {
            vertexHandles.destroy()
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
                pathRef.current,
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
