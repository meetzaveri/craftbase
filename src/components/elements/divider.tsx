import Two from 'two.js'
import React, { useEffect, useState, useRef } from 'react'
import type { ReactElement } from 'react'
import { useImmer } from 'use-immer'

import { strokeTypeToDashes } from '../../utils/misc'

import ElementCreator from '../../factory/divider'
import { readOpacity, focusSvgElement } from '../../utils/canvasUtils'
import { scheduleRender } from '../../utils/renderScheduler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalState = Record<string, any>

function Divider(props: ElementProps): ReactElement {
    const [, toggleToolbar] = useState(false)
    const [internalState, setInternalState] = useImmer<InternalState>({})
    const stateRefForGroup = useRef<ShapeLike>(null)

    const two = props.twoJSInstance
    let selectorInstance: ShapeLike = null
    let groupObject: ShapeLike = null

    function onBlurHandler(e: FocusEvent): void {
        const related = e?.relatedTarget as HTMLElement | null
        if (
            related?.id === 'floating-toolbar' ||
            related?.dataset?.parent === 'floating-toolbar'
        ) {
            const el = stateRefForGroup.current
                ? document.getElementById(`${stateRefForGroup.current.id}`)
                : null
            if (el) {
                focusSvgElement(el)
                el.addEventListener('blur', onBlurHandler)
            }
        } else {
            if (selectorInstance) {
                selectorInstance.pointCircle1.opacity = 0
                selectorInstance.pointCircle2.opacity = 0
                selectorInstance.hide?.()
            }
            two.update()
            if (groupObject) {
                document
                    .getElementById(`${groupObject.id}`)
                    ?.removeEventListener('keydown', handleKeyDown)
            }
        }
    }

    function handleKeyDown(e: KeyboardEvent): void {
        if (e.keyCode === 8 || e.keyCode === 46) {
            if (groupObject) {
                document.getElementById(`${groupObject.id}`)?.blur()
                props.handleDeleteComponent?.(groupObject)
                two.remove([groupObject])
            }
            two.update()
        }
    }

    function onFocusHandler(): void {
        if (!groupObject) return
        const el = document.getElementById(`${groupObject.id}`)
        if (el) {
            el.style.outline = '0'
            el.addEventListener('keydown', handleKeyDown)
        }
    }

    useEffect(() => {
        const prevX = props.x
        const prevY = props.y

        const elementFactory = new ElementCreator(two, prevX, prevY, {
            x1: props.x1,
            x2: props.x2,
            y1: props.y1,
            y2: props.y2,
            strokeType: props.strokeType,
        })
        const { group, pointCircle1, pointCircle2, line } =
            elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }
        line.opacity = readOpacity(props)

        if (props.parentGroup) {
            const parentGroup = props.parentGroup
            parentGroup.add(group)
            scheduleRender(two)
        } else {
            groupObject = group
            stateRefForGroup.current = group

            selectorInstance = { pointCircle1, pointCircle2 }

            // SVG nodes exist only after a render. Batch this render with every
            // other element mounting in this frame, then tag the nodes and wire
            // up focus/blur — all of which need the nodes to be in the DOM.
            scheduleRender(two, () => {
                const lineEl = document.getElementById(line.id)
                if (lineEl) lineEl.style.cursor = 'pointer'
                const p1El = document.getElementById(pointCircle1.id)
                if (p1El) {
                    p1El.style.cursor = 'pointer'
                    p1El.setAttribute('class', 'avoid-dragging')
                }
                const p2El = document.getElementById(pointCircle2.id)
                if (p2El) {
                    p2El.style.cursor = 'pointer'
                    p2El.setAttribute('class', 'avoid-dragging')
                }
                const groupEl = document.getElementById(group.id)
                if (groupEl) {
                    groupEl.setAttribute('class', 'dragger-picker')
                    groupEl.setAttribute('data-component-id', props.id)
                }

                const el = document.getElementById(`${group.id}`)
                el?.addEventListener('focus', onFocusHandler)
                el?.addEventListener('blur', onBlurHandler)
            })

            setInternalState((draft) => {
                draft.element = {
                    [group.id]: group,
                    [line.id]: line,
                }
                draft.group = { id: group.id, data: group }
                draft.shape = { id: line.id, data: line }
                draft.line = { id: line.id, data: line }
                draft.pointCircle1 = { id: pointCircle1.id, data: pointCircle1 }
                draft.pointCircle2 = { id: pointCircle2.id, data: pointCircle2 }
                draft.text = { data: {} }
                draft.icon = { data: {} }
            })
        }

        return (): void => {
            two.remove(group)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (internalState?.line?.data) {
            internalState.line.data.dashes = strokeTypeToDashes(
                props.strokeType
            )
            scheduleRender(two)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.strokeType])

    const updateX2Y2VerticesLocal = (
        line: ShapeLike,
        x2: number,
        y2: number,
        pointCircle2: ShapeLike
    ): void => {
        pointCircle2.translation.x = line.vertices[1].x + 4
        pointCircle2.translation.y =
            line.vertices[1].y + parseInt(String(line.linewidth))

        const vertices = [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                line.vertices[0].x,
                line.vertices[0].y,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.move
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x2,
                y2,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.line
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x2,
                y2,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.line
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x2,
                y2,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.move
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x2,
                y2,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.line
            ),
        ]
        line.vertices = vertices

        two.update()
    }

    const updateX1Y1VerticesLocal = (
        line: ShapeLike,
        x1: number,
        y1: number,
        pointCircle1: ShapeLike
    ): void => {
        pointCircle1.translation.x = line.vertices[0].x + 4
        pointCircle1.translation.y =
            line.vertices[0].y + parseInt(String(line.linewidth))

        const vertices = [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x1,
                y1,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.move
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                line.vertices[1].x,
                line.vertices[1].y,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.line
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                line.vertices[1].x,
                line.vertices[1].y,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.line
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                line.vertices[1].x,
                line.vertices[1].y,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.move
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                line.vertices[1].x,
                line.vertices[1].y,
                undefined,
                undefined,
                undefined,
                undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Two as any).Commands.line
            ),
        ]
        line.vertices = vertices

        two.update()
    }

    useEffect(() => {
        if (internalState?.group?.data) {
            const groupInstance = internalState.group.data
            const lineInstance = internalState.line.data
            const pointCircle1 = internalState.pointCircle1.data
            const pointCircle2 = internalState.pointCircle2.data

            groupInstance.translation.x = props.x
            groupInstance.translation.y = props.y
            scheduleRender(two)

            updateX1Y1VerticesLocal(
                lineInstance,
                props.x1,
                props.y1,
                pointCircle1
            )
            updateX2Y2VerticesLocal(
                lineInstance,
                props.x2,
                props.y2,
                pointCircle2
            )
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        props.x,
        props.y,
        props.metadata,
        props.x1,
        props.x2,
        props.y1,
        props.y2,
    ])

    void toggleToolbar

    return <React.Fragment />
}

export default Divider
