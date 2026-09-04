import React, { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { useImmer } from 'use-immer'

import { strokeTypeToDashes } from '../../utils/misc'
import getEditComponents from '../utils/editWrapper'
import PencilFactory from '../../factory/pencil'
import { readOpacity } from '../../utils/canvasUtils'
import { scheduleRender } from '../../utils/renderScheduler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalState = Record<string, any>

function Pencil(props: ElementProps): ReactElement {
    const [, toggleToolbar] = useState(false)
    const [internalState, setInternalState] = useImmer<InternalState>({})

    const two = props.twoJSInstance

    useEffect(() => {
        const prevX = props.x
        const prevY = props.y

        const elementFactory = new PencilFactory(two, prevX, prevY, {
            ...props,
        })
        const { group, path } = elementFactory.createElement()
        const shapeRef = path || group.children[0]
        group.elementData = { ...props.itemData, ...props }

        // Opacity persists in the top-level `opacity` field (pencil's
        // `metadata` is the vertex array; legacy rows fall back to metadata).
        const pencilOpacity = readOpacity(props)

        if (props.parentGroup) {
            const parentGroup = props.parentGroup
            shapeRef.translation.x = props.properties.x
            shapeRef.translation.y = props.properties.y
            shapeRef.opacity = pencilOpacity
            parentGroup.add(shapeRef)
            scheduleRender(two)
        } else {
            group.opacity = pencilOpacity
            getEditComponents(two, group, 4)

            if (path) {
                group.children.unshift(path)
            }
            // SVG node exists only after a render. Batch this render with
            // every other element mounting in this frame, then tag the node.
            scheduleRender(two, () => {
                const groupEl = document.getElementById(group.id)
                if (groupEl) {
                    groupEl.setAttribute('class', 'avoid-dragging')
                    groupEl.setAttribute('data-component-id', props.id)
                    groupEl.setAttribute(
                        'data-linewidth',
                        String(props.linewidth ?? '')
                    )
                }
            })

            setInternalState((draft) => {
                draft.element = {
                    [shapeRef.id]: shapeRef,
                    [group.id]: group,
                }
                draft.group = {
                    id: group.id,
                    data: group,
                }
                draft.shape = {
                    id: shapeRef.id,
                    data: shapeRef,
                }
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
        if (internalState?.group?.data) {
            const groupInstance = internalState.group.data
            groupInstance.translation.x = props.x
            groupInstance.translation.y = props.y
            scheduleRender(two)
        }
        if (internalState?.shape?.data) {
            const shapeInstance = internalState.shape.data
            shapeInstance.width = props.width
                ? props.width
                : shapeInstance.width
            shapeInstance.height = props.height
                ? props.height
                : shapeInstance.height
            shapeInstance.fill = props.fill ? props.fill : shapeInstance.fill
            scheduleRender(two)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.x, props.y, props.fill, props.width, props.height])

    useEffect(() => {
        if (internalState?.group?.data) {
            const dashes = strokeTypeToDashes(props.strokeType)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            internalState.group.data.children.forEach((child: any) => {
                child.dashes = dashes
            })
            scheduleRender(two)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.strokeType])

    // Reserved for future toolbar wiring.
    void toggleToolbar

    return (
        <React.Fragment>
            <div id="two-Pencil"></div>
        </React.Fragment>
    )
}

export default Pencil
