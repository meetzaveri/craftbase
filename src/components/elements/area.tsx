import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'

import AreaFactory from '../../factory/area'
import { computeCounterScale } from '../../utils/counterScale'
import { DEFAULT_GEO_RESIST } from '../../constants/misc'

// See circle.tsx for the rationale on the loose prop bag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

function Area(props: ElementProps): ReactElement {
    const { isPencilMode, isArrowDrawMode, isArrowSelected, zuiInBoard } =
        useBoardContext()

    const groupRef = useRef<ShapeLike>(null)
    const shapeRef = useRef<ShapeLike>(null)

    const two = props.twoJSInstance
    // metadata for area is the vertex array, so `.resist` is undefined and we
    // fall back to the default — same expression point.tsx uses.
    const resist = props.metadata?.resist ?? DEFAULT_GEO_RESIST
    // Logical (unscaled) stroke width. We counter-scale this on zoom rather
    // than the whole group, so the polygon geometry stays glued to the world.
    const baseLinewidth = props.linewidth ?? 2

    useEffect(() => {
        const prevX = props.x
        const prevY = props.y

        const elementFactory = new AreaFactory(two, prevX, prevY, {
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
            // border is legible before the first zoom event fires. Only linewidth
            // resists the zoom — the geometry stays glued to the world (unlike
            // point.tsx, which counter-scales the whole group).
            const initialScale =
                (zuiInBoard as ShapeLike)?.zui?.scale ?? two?.scene?.scale
            if (initialScale) {
                path.linewidth =
                    baseLinewidth * computeCounterScale(initialScale, resist)
            }

            two.update()

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
            two.remove(group)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Counter-scale only the stroke width on every camera change so the area's
    // border stays legible when the world zooms out, while the geometry stays
    // glued to its coordinates. Reads scale from the event each fire — no stale
    // closure (see the React + Two.js stale-closure note in CLAUDE.md).
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

export default Area
