import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'

import PointFactory, {
    getPointLabelNode,
    pointLabelOf,
} from '../../factory/point'
import { computeCounterScale } from '../../utils/counterScale'
import {
    DEFAULT_GEO_RESIST,
    DEFAULT_TEXT_FONT_FAMILY,
    POINT_LABEL_COLOR,
    POINT_LABEL_FONT_SIZE,
    POINT_LABEL_GAP,
} from '../../constants/misc'

// See circle.tsx for the rationale on the loose prop bag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

// Comfortable minimum for the label editor, in screen px, so an empty point
// still offers something to aim at when zoomed out.
const MIN_INPUT_WIDTH = 90

function Point(props: ElementProps): ReactElement {
    const {
        isPencilMode,
        isArrowDrawMode,
        isArrowSelected,
        zuiInBoard,
        updateComponentBulkPropertiesInLocalStore,
    } = useBoardContext()

    const groupRef = useRef<ShapeLike>(null)
    // Live label text, mirrored to a ref so the DOM editor (registered once, in
    // the mount effect) always reads the current value rather than the one
    // frozen into its closure.
    const labelRef = useRef<string>(pointLabelOf(props))

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
            return
        }

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

        /**
         * Open the label editor: an absolutely-positioned input laid over the
         * label slot — the gap just right of the circle — so typing appears
         * where the label will render.
         *
         * The overlay must match what's on screen, and a point's on-screen size
         * folds the group's counter-scale on top of the camera scale (mirrors
         * geoText.tsx's editor). Anchoring off the CIRCLE rather than the label
         * node matters: an empty label has no glyphs and therefore no usable
         * bounding box, which is exactly the state this opens in most often.
         */
        const showLabelInput = (): void => {
            const labelNode = getPointLabelNode(group)
            const circleNode = group.children?.[0]
            const circleElem = circleNode?._renderer?.elem as
                | SVGGraphicsElement
                | undefined
            if (!labelNode || !circleElem) return
            // Already editing — don't stack a second input.
            if (document.getElementById(`point-label-input-${props.id}`)) return

            const circleRect = circleElem.getBoundingClientRect()
            const sceneScale = two?.scene?.scale || 1
            const groupScale = typeof group.scale === 'number' ? group.scale : 1
            const effScale = sceneScale * groupScale
            const cssFontSize = POINT_LABEL_FONT_SIZE * effScale
            const lineH = Math.ceil(cssFontSize * 1.4)

            // The rendered label steps aside while its editor is open, so the
            // glyphs aren't drawn twice at slightly different metrics.
            const renderedOpacity = labelNode.opacity ?? 1
            labelNode.opacity = 0
            two.update()

            const input = document.createElement('input')
            input.id = `point-label-input-${props.id}`
            input.type = 'text'
            input.value = labelRef.current
            input.placeholder = 'Name this place'
            input.className = 'temp-input-area'
            input.style.position = 'absolute'
            input.style.border = 'none'
            input.style.background = 'transparent'
            input.style.outline = 'none'
            input.style.padding = '0'
            input.style.margin = '0'
            input.style.color = POINT_LABEL_COLOR
            input.style.fontSize = `${cssFontSize}px`
            input.style.fontFamily = DEFAULT_TEXT_FONT_FAMILY
            input.style.lineHeight = `${lineH}px`
            input.style.height = `${lineH}px`
            input.style.left = `${circleRect.right + POINT_LABEL_GAP * effScale}px`
            input.style.top = `${circleRect.top + circleRect.height / 2 - lineH / 2}px`

            document.getElementById('main-two-root')?.append(input)

            // Grow with the text so long names aren't typed into a keyhole.
            const measure = document.createElement('span')
            measure.style.position = 'absolute'
            measure.style.visibility = 'hidden'
            measure.style.whiteSpace = 'pre'
            measure.style.fontSize = `${cssFontSize}px`
            measure.style.fontFamily = DEFAULT_TEXT_FONT_FAMILY
            document.body.appendChild(measure)

            const autoSize = (): void => {
                measure.textContent = input.value || input.placeholder
                input.style.width = `${Math.max(
                    measure.offsetWidth + cssFontSize,
                    MIN_INPUT_WIDTH
                )}px`
            }
            autoSize()
            input.addEventListener('input', autoSize)

            const commit = (): void => {
                input.removeEventListener('input', autoSize)
                measure.remove()

                const value = input.value.trim()
                labelRef.current = value
                labelNode.value = value
                labelNode.opacity = renderedOpacity
                two.update()

                const updatedMetadata = {
                    ...(group.elementData?.metadata ?? props.metadata ?? {}),
                    label: value,
                }
                // Frozen props mean React won't re-render this element, so the
                // scene node above and elementData here are the live copies —
                // keep both in step with the store write.
                if (group.elementData) {
                    group.elementData.metadata = updatedMetadata
                }
                updateComponentBulkPropertiesInLocalStore?.(props.id, {
                    metadata: updatedMetadata,
                })

                input.remove()
            }

            input.addEventListener('blur', commit)
            input.addEventListener('keydown', (event: KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                    event.preventDefault()
                    // Escape keeps what was typed, same as every other text
                    // editor on the canvas — blur() runs the commit above.
                    input.blur()
                }
            })

            input.focus()
            input.select()
        }

        // Placement fires this once the element has mounted, so a fresh point
        // lands ready to be named; double-click reopens it later.
        const handleTriggerTextInput = (e: Event): void => {
            const detail = (e as CustomEvent<{ elementId: string }>).detail
            if (detail?.elementId !== props.id) return
            setTimeout(showLabelInput, 60)
        }
        window.addEventListener('triggerTextInput', handleTriggerTextInput)
        groupEl?.addEventListener('dblclick', showLabelInput)

        return (): void => {
            window.removeEventListener('triggerTextInput', handleTriggerTextInput)
            groupEl?.removeEventListener('dblclick', showLabelInput)
            document.getElementById(`point-label-input-${props.id}`)?.remove()
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
