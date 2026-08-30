import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBaseContext } from '../../views/Base/baseContext'

import CircleFactory from '../../factory/circle'
import { strokeTypeToDashes } from '../../utils/misc'
import { applyShapeText, readOpacity } from '../../utils/canvasUtils'
import { scheduleRender } from '../../utils/renderScheduler'
import { componentTypes, DEFAULT_GEO_RESIST } from '../../constants/misc'
import { computeCounterScale } from '../../utils/counterScale'

// Element components receive a fluid prop bag composed of the ComponentRecord
// fields plus canvas-side handles (twoJSInstance, parentGroup, itemData,
// handleDeleteComponent). Typing this strictly fights more than it helps
// during the migration; the props originate in ElementRenderWrapper and the
// canvas, which are themselves loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

function Circle(props: ElementProps): ReactElement {
    const { isPencilMode, isArrowDrawMode, isArrowSelected, zuiInBase } =
        useBaseContext()

    const groupRef = useRef<ShapeLike>(null)
    const shapeRef = useRef<ShapeLike>(null)

    const two = props.twoJSInstance

    // The same component serves the whiteboard circle and the map circle; the
    // objectClass column is the only thing separating them. On a map base the
    // circle marks a real-world radius, so it carries no inner text and its
    // stroke counter-scales against the camera (see isStrokeScaled).
    const isGeo = props.objectClass === 'geo'
    // A circle's metadata is an object without `resist`, so this lands on the
    // default — the same value area and route run at.
    const resist = props.metadata?.resist ?? DEFAULT_GEO_RESIST
    // Logical (unscaled) stroke width. Only this counter-scales; the geometry
    // stays glued to the world so a 5km radius stays 5km.
    const baseLinewidth = props.linewidth ?? 2

    useEffect(() => {
        const prevX = props.x
        const prevY = props.y

        const elementFactory = new CircleFactory(two, prevX, prevY, {
            ...props,
        })
        const { group, circle } = elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }
        const opacityValue = readOpacity(props)

        if (props.parentGroup) {
            const parentGroup = props.parentGroup
            circle.opacity = opacityValue
            circle.translation.x = props.properties.x
            circle.translation.y = props.properties.y
            parentGroup.add(circle)
            scheduleRender(two)
        } else {
            groupRef.current = group
            shapeRef.current = circle
            group.children.unshift(circle)

            const meta = props.metadata || {}
            // "circle-with-text": multiline text reflowed to the inscribed box.
            // Geo objects carry no inner text (geoText is the map's labelling
            // tool), matching the dblclick guard in newCanvas.
            if (!isGeo) {
                applyShapeText(
                    two,
                    group,
                    componentTypes.circle,
                    props.width || circle.width || 100,
                    meta
                )
            }

            // Seed the stroke counter-scale from the current camera so the ring
            // is already the right weight before the first zoom event fires —
            // mirrors area.tsx.
            if (isGeo) {
                const initialScale =
                    (zuiInBase as ShapeLike)?.zui?.scale ?? two?.scene?.scale
                if (initialScale) {
                    circle.linewidth =
                        baseLinewidth *
                        computeCounterScale(initialScale, resist)
                }
            }

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
        shapeInstance.width = props.width || shapeInstance.width
        shapeInstance.height = props.height || shapeInstance.height
        shapeInstance.fill = props.fill || shapeInstance.fill
        scheduleRender(two)
    }, [props.x, props.y, props.fill, props.width, props.height, two])

    // Re-wrap the embedded text whenever the box width or text metadata
    // changes so resize/reload reflow deterministically from raw content.
    useEffect(() => {
        const groupInstance = groupRef.current
        const shapeInstance = shapeRef.current
        if (!groupInstance || !shapeInstance || isGeo) return
        applyShapeText(
            two,
            groupInstance,
            componentTypes.circle,
            props.width || shapeInstance.width || 100,
            props.metadata || {}
        )
        scheduleRender(two)
    }, [props.width, props.metadata, two, isGeo])

    // Map circle only: counter-scale the stroke width on every camera change so
    // the ring stays a readable couple of pixels across the map's whole zoom
    // range, while the circle itself keeps marking the same ground. Reads the
    // scale off the event each fire — no stale closure (see CLAUDE.md).
    useEffect(() => {
        if (!isGeo) return
        const onZoom = (e: Event): void => {
            const group = groupRef.current
            const shape = shapeRef.current
            if (!group || !shape) return
            const scale = (e as CustomEvent<{ scale: number }>).detail?.scale
            if (!scale) return
            // Logical width lives on elementData (kept in sync by the property
            // panel); fall back to the mount-time base.
            const base = group.elementData?.linewidth ?? baseLinewidth
            shape.linewidth = base * computeCounterScale(scale, resist)
            scheduleRender(two)
        }
        window.addEventListener('zoomChanged', onZoom as EventListener)
        return (): void => {
            window.removeEventListener('zoomChanged', onZoom as EventListener)
        }
    }, [two, isGeo, resist, baseLinewidth])

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

    return <React.Fragment />
}

export default Circle
