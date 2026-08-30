import React, { useEffect, useState, useRef } from 'react'
import type { ReactElement } from 'react'

import { useImmer } from 'use-immer'
import Two from 'two.js'

import ElementCreator from '../../factory/line'
import { readOpacity, focusSvgElement } from '../../utils/canvasUtils'

import {
    updateX1Y1Vertices,
    updateX2Y2Vertices,
} from '../../utils/updateVertices'
import { strokeTypeToDashes } from '../../utils/misc'
import {
    attachHandleCounterScale,
    attachStrokeCounterScale,
} from '../../utils/handleScale'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import { scheduleRender } from '../../utils/renderScheduler'

// Clickable band width (screen px) around the line, held constant at any zoom so
// the line stays easy to select even at 10%.
const HIT_BAND_PX = 22

// A plain straight line. This mirrors arrowLine.tsx (same group structure of
// line + two endpoint circles) so it shares the arrow-draw and endpoint-edit
// machinery; the `line` factory sets `noArrowhead`, which the vertex updaters
// honor to keep the segment headless. It intentionally has no port-binding
// (connector) logic — plain lines do not dock to shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalState = Record<string, any>

function Line(props: ElementProps): ReactElement {
    const [, toggleToolbar] = useState(false)
    const [internalState, setInternalState] = useImmer<InternalState>({})
    const stateRefForGroup = useRef<ShapeLike>(null)
    const { isMobile } = useMediaQueryUtils()

    const two = props.twoJSInstance
    let selectorInstance: ShapeLike = null
    let groupObject: ShapeLike = null

    function onBlurHandler(e: FocusEvent): void {
        const related = e?.relatedTarget as HTMLElement | null
        if (
            related?.id === 'floating-toolbar' ||
            related?.dataset?.parent === 'floating-toolbar'
        ) {
            const getGroupElementFromDOM = stateRefForGroup.current
                ? document.getElementById(`${stateRefForGroup.current.id}`)
                : null
            if (getGroupElementFromDOM) {
                focusSvgElement(getGroupElementFromDOM)
                getGroupElementFromDOM.addEventListener('blur', onBlurHandler)
            }
        } else {
            if (selectorInstance) {
                selectorInstance.pointCircle1Group.opacity = 0
                selectorInstance.pointCircle2Group.opacity = 0
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
        let mountCancelled = false
        let hitAreaObserver: MutationObserver | null = null
        let detachHandleScale: (() => void) | null = null
        let detachHitScale: (() => void) | null = null
        const prevX = props.x
        const prevY = props.y

        const elementFactory = new ElementCreator(two, prevX, prevY, {
            x1: props.x1 ?? 20,
            x2: props.x2 ?? 100,
            y1: props.y1 ?? 10,
            y2: props.y2 ?? 10,
            strokeType: props.strokeType,
            linewidth: props.linewidth,
            isMobile,
        })
        const { group, pointCircle1Group, pointCircle2Group, line } =
            elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }
        line.opacity = readOpacity(props)
        if (props.stroke) line.stroke = props.stroke
        if (props.linewidth) line.linewidth = props.linewidth

        if (props.parentGroup) {
            const parentGroup = props.parentGroup
            parentGroup.add(group)
            scheduleRender(two)
        } else {
            groupObject = group
            stateRefForGroup.current = group
            selectorInstance = {
                pointCircle1Group,
                pointCircle2Group,
            }

            // Hold the endpoint circles at a constant on-screen size so they
            // stay grabbable when zoomed far out (else ~0.8px at 20%).
            detachHandleScale = attachHandleCounterScale(
                [pointCircle1Group, pointCircle2Group],
                two,
                two?.scene?.scale ?? 1
            )

            // Every DOM read below needs the rendered SVG nodes, which only
            // exist after a render. Batch that render with every other element
            // mounting this frame — a synchronous two.update() per element made
            // mounting a base O(N²). `mountCancelled` guards an unmount before
            // the frame fires, so we never observe/bind a node already gone.
            scheduleRender(two, () => {
                if (mountCancelled) return

                const lineDomElem = document.getElementById(line.id)
                if (lineDomElem) {
                    const HIT_INSET = 20
                    const hitElem = document.createElementNS(
                        'http://www.w3.org/2000/svg',
                        'line'
                    )
                    hitElem.setAttribute('stroke', 'transparent')
                    hitElem.setAttribute('pointer-events', 'stroke')
                    // Match the selection controller's body cursor (a drag zone).
                    hitElem.style.cursor = 'move'

                    const syncHitLine = (): void => {
                        const v0 = line.vertices[0]
                        const v1 = line.vertices[1]
                        const dx = v1.x - v0.x
                        const dy = v1.y - v0.y
                        const len = Math.sqrt(dx * dx + dy * dy)
                        if (len < HIT_INSET * 2 + 5) return
                        const r = HIT_INSET / len
                        hitElem.setAttribute('x1', String(v0.x + dx * r))
                        hitElem.setAttribute('y1', String(v0.y + dy * r))
                        hitElem.setAttribute('x2', String(v1.x - dx * r))
                        hitElem.setAttribute('y2', String(v1.y - dy * r))
                    }

                    syncHitLine()
                    lineDomElem.parentNode?.insertBefore(hitElem, lineDomElem)
                    hitAreaObserver = new MutationObserver(syncHitLine)
                    hitAreaObserver.observe(lineDomElem, {
                        attributes: true,
                        attributeFilter: ['d'],
                    })
                    // Keep the clickable band a constant screen width at any zoom.
                    detachHitScale = attachStrokeCounterScale(
                        (w) => hitElem.setAttribute('stroke-width', String(w)),
                        HIT_BAND_PX,
                        two,
                        two?.scene?.scale ?? 1
                    )
                }

                // Show the `move` cursor over the line + endpoint circles, matching
                // the selection controller's body cursor for other shapes. Inline so
                // it beats the base `.dragger-picker { cursor: pointer }` rule, but
                // still yields to the `!important` draw/pan-mode cursor overrides.
                const lineEl = document.getElementById(line.id)
                if (lineEl) lineEl.style.cursor = 'move'
                const p1El = document.getElementById(pointCircle1Group.id)
                if (p1El) {
                    p1El.style.cursor = 'move'
                    p1El.setAttribute('class', 'dragger-picker is-line-circle')
                    p1El.setAttribute('data-parent-id', group.id)
                    p1El.setAttribute('data-line-id', line.id)
                    p1El.setAttribute('data-direction', 'left')
                }
                const p2El = document.getElementById(pointCircle2Group.id)
                if (p2El) {
                    p2El.style.cursor = 'move'
                    p2El.setAttribute('class', 'dragger-picker is-line-circle')
                    p2El.setAttribute('data-parent-id', group.id)
                    p2El.setAttribute('data-line-id', line.id)
                    p2El.setAttribute('data-direction', 'right')
                }
                const groupEl = document.getElementById(group.id)
                if (groupEl) {
                    groupEl.setAttribute('class', 'dragger-picker')
                    groupEl.setAttribute('data-component-id', props.id)
                    groupEl.setAttribute(
                        'data-linewidth',
                        String(props.linewidth ?? '')
                    )
                }

                const getGroupElementFromDOM = document.getElementById(
                    `${group.id}`
                )
                getGroupElementFromDOM?.addEventListener(
                    'focus',
                    onFocusHandler
                )
                getGroupElementFromDOM?.addEventListener('blur', onBlurHandler)
            })

            setInternalState((draft) => {
                draft.element = {
                    [group.id]: group,
                    [line.id]: line,
                }
                draft.group = { id: group.id, data: group }
                draft.shape = { id: line.id, data: line }
                draft.line = { id: line.id, data: line }
                draft.pointCircle1Group = {
                    id: pointCircle1Group.id,
                    data: pointCircle1Group,
                }
                draft.pointCircle2Group = {
                    id: pointCircle2Group.id,
                    data: pointCircle2Group,
                }
                draft.text = { data: {} }
                draft.icon = { data: {} }
            })
        }

        return (): void => {
            mountCancelled = true
            hitAreaObserver?.disconnect()
            detachHandleScale?.()
            detachHitScale?.()
            two.remove(group)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (internalState?.group?.data) {
            const groupInstance = internalState.group.data
            const lineInstance = internalState.line.data
            groupInstance.translation.x = props.x
            groupInstance.translation.y = props.y
            lineInstance.opacity = readOpacity(props)
            scheduleRender(two)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.x, props.y, props.metadata])

    useEffect(() => {
        if (internalState?.line?.data) {
            const lineInstance = internalState.line.data
            if (props.stroke) lineInstance.stroke = props.stroke
            if (props.linewidth) lineInstance.linewidth = props.linewidth
            lineInstance.dashes = strokeTypeToDashes(props.strokeType)
            scheduleRender(two)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.stroke, props.linewidth, props.strokeType])

    useEffect(() => {
        if (internalState?.group?.data) {
            updateX1Y1Vertices(
                Two,
                internalState.line.data,
                props.x1,
                props.y1,
                internalState.pointCircle1Group.data,
                two
            )
            updateX2Y2Vertices(
                Two,
                internalState.line.data,
                props.x2,
                props.y2,
                internalState.pointCircle2Group.data,
                two
            )
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.x1, props.x2, props.y1, props.y2])

    void toggleToolbar

    return <React.Fragment />
}

export default Line
