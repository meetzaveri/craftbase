import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'

import ElementFactory from '../../factory/diamond'
import { strokeTypeToDashes } from '../../utils/misc'
import { applyShapeText, readOpacity } from '../../utils/canvasUtils'
import { scheduleRender } from '../../utils/renderScheduler'
import { componentTypes } from '../../constants/misc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

function Diamond(props: ElementProps): ReactElement {
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
        const { group, diamond } = elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }
        const opacityValue = readOpacity(props)

        if (props.parentGroup) {
            const parentGroup = props.parentGroup
            diamond.opacity = opacityValue
            parentGroup.add(diamond)
            scheduleRender(two)
        } else {
            groupRef.current = group
            shapeRef.current = diamond
            group.children.unshift(diamond)

            const meta = props.metadata || {}
            // "diamond-with-text": multiline text reflowed to the inscribed box.
            applyShapeText(
                two,
                group,
                componentTypes.diamond,
                props.width || diamond.width || 120,
                meta
            )

            // Group-level opacity so shape + embedded text dim uniformly and
            // actually repaint (see rectangle.tsx for the unshift rationale).
            group.opacity = opacityValue

            // The SVG node only exists after a render. Batch the render
            // with every other element mounting this frame, then tag it.
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
        if (props.width) shapeInstance.width = props.width
        if (props.height) shapeInstance.height = props.height
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
            componentTypes.diamond,
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
            <div id="two-diamond"></div>
        </React.Fragment>
    )
}

export default Diamond
