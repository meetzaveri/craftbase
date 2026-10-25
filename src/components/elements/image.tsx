import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'

import ElementFactory from '../../factory/image'
import { readOpacity } from '../../utils/canvasUtils'
import { scheduleRender } from '../../utils/renderScheduler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

// Local-mode-only bitmap element. The record carries only an asset reference
// in `metadata` (see utils/imageAssetStore.ts); the factory resolves it and
// paints a native <image> under a transparent frame rect.
function Image(props: ElementProps): ReactElement {
    const { isPencilMode, isArrowDrawMode, isArrowSelected } = useBoardContext()

    const groupRef = useRef<ShapeLike>(null)
    const frameRef = useRef<ShapeLike>(null)

    const two = props.twoJSInstance

    useEffect(() => {
        const elementFactory = new ElementFactory(two, props.x, props.y, {
            ...props,
            ownsImageNode: true,
        })
        const { group, frame, disposeImageNode } =
            elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }
        group.opacity = readOpacity(props)
        groupRef.current = group
        frameRef.current = frame

        scheduleRender(two, () => {
            const groupEl = document.getElementById(group.id)
            if (groupEl) {
                groupEl.setAttribute('class', 'dragger-picker')
                groupEl.setAttribute('data-component-id', props.id)
            }
        })

        return (): void => {
            disposeImageNode()
            two.remove(group)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const groupInstance = groupRef.current
        const frameInstance = frameRef.current
        if (!groupInstance || !frameInstance) return

        groupInstance.translation.x = props.x
        groupInstance.translation.y = props.y
        frameInstance.width = props.width || frameInstance.width
        frameInstance.height = props.height || frameInstance.height
        scheduleRender(two)
    }, [props.x, props.y, props.width, props.height, two])

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
            <div id="two-image"></div>
        </React.Fragment>
    )
}

export default Image
