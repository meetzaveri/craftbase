import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'

import PointFactory from '../../factory/point'
import { computeCounterScale } from '../../utils/counterScale'
import { DEFAULT_GEO_RESIST } from '../../constants/misc'

// See circle.tsx for the rationale on the loose prop bag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

function Point(props: ElementProps): ReactElement {
    const { isPencilMode, isArrowDrawMode, isArrowSelected, zuiInBoard } =
        useBoardContext()

    const groupRef = useRef<ShapeLike>(null)

    const two = props.twoJSInstance
    const resist = props.metadata?.resist ?? DEFAULT_GEO_RESIST

    useEffect(() => {
        const prevX = props.x
        const prevY = props.y

        const elementFactory = new PointFactory(two, prevX, prevY, {
            ...props,
        })
        const { group } = elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }

        if (props.parentGroup) {
            const parentGroup = props.parentGroup
            group.translation.x = props.properties.x
            group.translation.y = props.properties.y
            parentGroup.add(group)
            two.update()
        } else {
            groupRef.current = group

            // Seed the counter-scale from the current camera so the pin is
            // sized correctly before the first zoom event fires. The board
            // context holds the addZUI wrapper ({ zui, ... }) — the live scale
            // lives on the nested ZUI instance (fall back to the scene scale).
            const initialScale =
                (zuiInBoard as ShapeLike)?.zui?.scale ?? two?.scene?.scale
            if (initialScale) {
                group.scale = computeCounterScale(initialScale, resist)
            }

            two.update()

            const groupEl = document.getElementById(group.id)
            if (groupEl) {
                groupEl.setAttribute('class', 'dragger-picker')
                groupEl.setAttribute('data-component-id', props.id)
            }
        }

        return (): void => {
            two.remove(group)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Counter-scale the pin on every camera change so it stays legible when the
    // world zooms out. Reads the scale from the event each fire — no stale
    // closure (see the React + Two.js stale-closure note in CLAUDE.md).
    useEffect(() => {
        const onZoom = (e: Event): void => {
            const group = groupRef.current
            if (!group) return
            const scale = (e as CustomEvent<{ scale: number }>).detail?.scale
            if (!scale) return
            group.scale = computeCounterScale(scale, resist)
            two.update()
        }
        window.addEventListener('zoomChanged', onZoom as EventListener)
        return (): void => {
            window.removeEventListener('zoomChanged', onZoom as EventListener)
        }
    }, [two, resist])

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

export default Point
