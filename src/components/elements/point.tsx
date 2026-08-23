import React, { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import interact from 'interactjs'
import { useBaseContext } from '../../views/Base/baseContext'

import PointFactory, {
    getPointLabelNode,
    pointLabelOf,
    POINT_CHROME_FLAG,
} from '../../factory/point'
import getEditComponents from '../utils/editWrapper'
import { computeCounterScale } from '../../utils/counterScale'
import {
    DEFAULT_GEO_RESIST,
    DEFAULT_TEXT_FONT_FAMILY,
    POINT_LABEL_COLOR,
    POINT_LABEL_FONT_SIZE,
    POINT_LABEL_GAP,
    POINT_RADIUS,
} from '../../constants/misc'

// Clear space between the point's ink and its selection box, in surface units.
const SELECTOR_PAD = 5

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
        zuiInBase,
        updateComponentBulkPropertiesInLocalStore,
    } = useBaseContext()

    const groupRef = useRef<ShapeLike>(null)
    const selectorRef = useRef<ShapeLike>(null)
    // Re-fits the selection box. Held in a ref so the zoom handler and the label
    // editor — both registered once — always call the live one.
    const syncSelectorRef = useRef<(() => void) | null>(null)
    // Should committing the label editor put the selection box back? Set when
    // the editor opens over a selected point, and cleared if the user clicks
    // away — because a click-away deselects on mousedown but only commits the
    // editor on the blur that follows, so an unconditional restore would draw a
    // box around a point that is no longer selected.
    const restoreSelectorAfterEditRef = useRef(false)
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

        /**
         * On-screen scale of anything inside this group: the camera's scale
         * times the group's own zoom-resist counter-scale. The selector needs
         * it to keep its outline a constant screen width — inside the group,
         * both multiplications apply to it too.
         */
        const effectiveScale = (): number => {
            const sceneScale = two?.scene?.scale || 1
            const groupScale = typeof group.scale === 'number' ? group.scale : 1
            return sceneScale * groupScale || 1
        }

        // Seed the counter-scale from the current camera so the pin is
        // sized correctly before the first zoom event fires. The board base
        // context holds the addZUI wrapper ({ zui, ... }) — the live scale
        // lives on the nested ZUI instance (fall back to the scene scale).
        const initialScale =
            (zuiInBase as ShapeLike)?.zui?.scale ?? two?.scene?.scale
        if (initialScale) {
            group.scale = computeCounterScale(initialScale, resist)
        }

        two.update()

        const groupEl = document.getElementById(group.id)
        if (groupEl) {
            groupEl.setAttribute('class', 'dragger-picker')
            groupEl.setAttribute('data-component-id', props.id)
        }

        // Selection box. `0` = no corner handles: a point is a fixed-size pin,
        // so there is nothing to resize — the box is purely "this is selected".
        //
        // It lives INSIDE the point's group, which is what makes it track the
        // pin for free: the group carries both the translation and the
        // zoom-resist counter-scale, so the box follows a drag and stays the
        // same apparent size as the pin at every zoom, with no per-frame work.
        const { selector } = getEditComponents(two, group, 0)
        selectorRef.current = selector
        selector.areaGroup[POINT_CHROME_FLAG] = true
        selector.hide()

        /** Is this point's label editor currently on screen? */
        const isEditingLabel = (): boolean =>
            !!document.getElementById(`point-label-input-${props.id}`)

        /**
         * Show the selection box, fitted to the CIRCLE only.
         *
         * The label is deliberately outside the box. The pin is the object; the
         * label is an annotation hanging off it, and its width is whatever the
         * user typed — so boxing both would make the selection jump and stretch
         * as the name changes, and read as a text field rather than a point.
         * A fixed square around the circle is also constant in group-local
         * coordinates, which is why it needs no re-measuring.
         */
        const syncSelector = (): void => {
            const sel = selectorRef.current
            if (!sel) return
            // Editing owns the point — never draw the box over an open editor.
            //
            // A guard rather than careful ordering, because the ordering is not
            // ours to control: placing a point creates it on MOUSEDOWN, so the
            // matching `click` lands afterwards, on the element that did not
            // exist when the press began. Hold the mouse down for longer than
            // the editor's open delay and that click arrives after the editor
            // is already up, re-showing a box we had just hidden.
            if (isEditingLabel()) return
            const half = POINT_RADIUS + SELECTOR_PAD
            sel.update(-half, half, -half, half, effectiveScale())
        }
        syncSelectorRef.current = syncSelector

        // Show on click rather than mousedown: the canvas dispatches
        // `clearSelector` during mousedown (and, on mobile, during touchstart),
        // so anything shown earlier in the gesture is hidden again a moment
        // later. Click lands after all of that has settled. Same reason
        // geoText.tsx binds its selector here.
        interact(`#${group.id}`).on('click', syncSelector)

        // Clicking away hides it. `clearSelector` already covers bare-canvas
        // clicks; this covers landing on *another* element, which does not
        // dispatch that event.
        const onGlobalMouseDown = (e: MouseEvent): void => {
            const path: EventTarget[] = e.composedPath ? e.composedPath() : []
            const onSelf = path.some(
                (el) => (el as HTMLElement)?.id === group.id
            )
            const onToolbar = path.some(
                (el) => (el as HTMLElement)?.id === 'floating-toolbar'
            )
            // The label editor is an overlay on <body>, not a child of the
            // group, so typing in it would otherwise read as clicking away.
            const onLabelEditor = path.some(
                (el) =>
                    (el as HTMLElement)?.id === `point-label-input-${props.id}`
            )
            if (onSelf || onToolbar || onLabelEditor) return
            // Deselecting mid-edit: the editor's own commit runs later, on
            // blur, and must not resurrect the box this click just dismissed.
            restoreSelectorAfterEditRef.current = false
            selectorRef.current?.hide()
            two.update()
        }
        window.addEventListener('mousedown', onGlobalMouseDown)

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
                SVGGraphicsElement | undefined
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

            // The selection box steps aside too. While typing, the point is in
            // edit mode, not selection mode — leaving the box up would draw a
            // second, competing focus ring around the caret. Its prior state is
            // captured so committing restores exactly what was there before,
            // rather than asserting a selection the user never made (the editor
            // opens by itself on a freshly placed point).
            restoreSelectorAfterEditRef.current =
                selectorRef.current?.areaGroup?.opacity === 1
            selectorRef.current?.hide()
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
                // Tear the editor down BEFORE anything below reads whether we
                // are still editing — syncSelector refuses to draw while the
                // input is on screen, so restoring the box has to come after.
                input.remove()

                labelRef.current = value
                labelNode.value = value
                labelNode.opacity = renderedOpacity
                two.update()
                // Editing is over — put the box back if it was there before and
                // the point is still selected.
                if (restoreSelectorAfterEditRef.current) {
                    syncSelectorRef.current?.()
                }
                restoreSelectorAfterEditRef.current = false

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
            window.removeEventListener(
                'triggerTextInput',
                handleTriggerTextInput
            )
            window.removeEventListener('mousedown', onGlobalMouseDown)
            interact(`#${group.id}`).unset()
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
            // Counter-scale is near-1 in apparent terms but not exactly, so the
            // box's outline is re-normalised too rather than drifting thick or
            // hairline at the extremes of the zoom range.
            selectorRef.current?.setScale(scale * group.scale)
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
