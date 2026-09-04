import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'

import ElementFactory from '../../factory/rectangle'
import { strokeTypeToDashes } from '../../utils/misc'
import { applyShapeText, readOpacity } from '../../utils/canvasUtils'
import { scheduleRender } from '../../utils/renderScheduler'
import { componentTypes } from '../../constants/misc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

function Rectangle(props: ElementProps): ReactElement {
    const { isPencilMode, isArrowDrawMode, isArrowSelected } = useBoardContext()

    const groupRef = useRef<ShapeLike>(null)
    const shapeRef = useRef<ShapeLike>(null)

    const two = props.twoJSInstance

    useEffect(() => {
        const prevX = props.x
        const prevY = props.y

        const elementFactory = new ElementFactory(two, prevX, prevY, {
            ...props,
        })
        const { group, rectangle } = elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }
        const opacityValue = readOpacity(props)

        if (props.parentGroup) {
            const parentGroup = props.parentGroup
            rectangle.opacity = opacityValue
            parentGroup.add(rectangle)
            scheduleRender(two)
        } else {
            groupRef.current = group
            shapeRef.current = rectangle
            group.children.unshift(rectangle)

            const meta = props.metadata || {}
            // "rectangle-with-text": multiline text reflowed to the box width.
            applyShapeText(
                two,
                group,
                componentTypes.rectangle,
                props.width || rectangle.width || 120,
                meta
            )

            // Apply opacity at the group level so the shape and any embedded
            // text dim uniformly, and so it actually repaints (the rounded-rect
            // path is double-referenced in group.children via the unshift above,
            // which leaves leaf-level opacity flags unprocessed on render).
            group.opacity = opacityValue

            // The SVG node only exists after a render. Batch the render with
            // every other element mounting this frame, then tag the node.
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
        }

        return (): void => {
            two.remove(group)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const groupInstance = groupRef.current
        const shapeInstance = shapeRef.current
        if (!groupInstance || !shapeInstance) return

        groupInstance.translation.x = props.x
        groupInstance.translation.y = props.y
        shapeInstance.width = props.width || shapeInstance.width
        shapeInstance.height = props.height || shapeInstance.height
        shapeInstance.fill = props.fill || shapeInstance.fill
        scheduleRender(two)
    }, [props.x, props.y, props.width, props.height, props.fill, two])

    // Re-wrap the embedded text whenever the box width or text metadata
    // changes so resize/reload reflow deterministically from raw content.
    useEffect(() => {
        const groupInstance = groupRef.current
        const shapeInstance = shapeRef.current
        if (!groupInstance || !shapeInstance) return
        applyShapeText(
            two,
            groupInstance,
            componentTypes.rectangle,
            props.width || shapeInstance.width || 120,
            props.metadata || {}
        )
        scheduleRender(two)
    }, [props.width, props.metadata, two])

    useEffect(() => {
        if (shapeRef.current) {
            shapeRef.current.dashes = strokeTypeToDashes(props.strokeType)
            scheduleRender(two)
        }
    }, [props.strokeType, two])

    // When pencil/arrow mode is active, disable pointer events on this shape.
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

    return (
        <React.Fragment>
            <div id="two-rectangle"></div>
        </React.Fragment>
    )
}

export default Rectangle
