import React, { useEffect, useState, useRef } from 'react'
import type { ReactElement } from 'react'
import interact from 'interactjs'
import { useImmer } from 'use-immer'
import { useBoardContext } from '../../views/Board/boardContext'

import { elementOnBlurHandler } from '../../utils/misc'
import getEditComponents from '../utils/editWrapper'
import NewTextFactory from '../../factory/newText'
import {
    TEXT_SIZES_OBJECT,
    MOBILE_TEXT_SIZES_OBJECT,
} from '../../utils/constants'
import { lineHeightFor } from '../../utils/textLayout'
import { readOpacity } from '../../utils/canvasUtils'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import { computeCounterScale } from '../../utils/counterScale'
import {
    DEFAULT_GEO_RESIST,
    DEFAULT_TEXT_FONT_FAMILY,
} from '../../constants/misc'

// GeoText is a clone of NewText (it reuses the same NewTextFactory for
// rendering) with one extra behavior: like a point pin, the whole group is
// counter-scaled on every camera change so the label stays legible when the
// world zooms way out. See point.tsx for the resist rationale and
// counterScale.ts for the math. Everything else — multiline editing, resize
// handles, the floating toolbar contract — matches NewText.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementProps = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalState = Record<string, any>

interface ResizeState {
    centerX: number
    centerY: number
    startDist: number
    startSize: number
}

function GeoText(props: ElementProps): ReactElement {
    const {
        updateComponentBulkPropertiesInLocalStore,
        isPencilMode,
        isArrowDrawMode,
        isTextDrawMode,
        isArrowSelected,
        zuiInBoard,
    } = useBoardContext()

    const { isMobile } = useMediaQueryUtils()
    const [showToolbar, toggleToolbar] = useState(false)
    const [, setShowMobilePanel] = useState(false)
    const [internalState, setInternalState] = useImmer<InternalState>({})
    const mobileTriggerRef = useRef<HTMLElement | null>(null)
    const [textValue, setTextValue] = useState<string>(
        props?.metadata?.content || ''
    )
    const [, setTextSize] = useState<number>(props?.metadata?.fontSize || 36)
    const textValueRef = useRef(textValue)
    const twoTextRef = useRef<ShapeLike>(null)
    // The Two.js group, mirrored to a ref so the zoom listener (registered in
    // its own effect) can counter-scale it without a stale closure.
    const groupRef = useRef<ShapeLike>(null)
    // Satellite Two.Text nodes for lines 2..N (line 1 stays `twoText`), and a
    // ref to the layout sync so the metadata effect can re-run it.
    const extraLineNodesRef = useRef<ShapeLike[]>([])
    const syncMultilineRef = useRef<(() => void) | null>(null)

    const two = props.twoJSInstance
    // Zoom-resistance strength (0 = screen-fixed, 1 = scales with world).
    const resist = props.metadata?.resist ?? DEFAULT_GEO_RESIST

    let selectorInstance: ShapeLike = null
    let groupObject: ShapeLike = null

    function onBlurHandler(e: FocusEvent): void {
        elementOnBlurHandler(e, selectorInstance, two)
        if (groupObject) {
            document
                .getElementById(`${groupObject.id}`)
                ?.removeEventListener('keydown', handleKeyDown)
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
        const prevX = props.x
        const prevY = props.y
        let handleGlobalMousedown: ((e: MouseEvent) => void) | null = null

        const elementFactory = new NewTextFactory(two, prevX, prevY, props)
        const { group, twoText } = elementFactory.createElement()
        group.elementData = { ...props.itemData, ...props }
        twoText.opacity = readOpacity(props)

        twoTextRef.current = twoText
        groupObject = group
        groupRef.current = group

        // Seed the counter-scale from the current camera so the label is sized
        // correctly before the first zoom event fires (mirrors point.tsx). The
        // live scale lives on the nested ZUI instance (fall back to the scene
        // scale).
        const initialScale =
            (zuiInBoard as ShapeLike)?.zui?.scale ?? two?.scene?.scale
        if (initialScale) {
            group.scale = computeCounterScale(initialScale, resist)
        }

        // Multiline rendering: `twoText` holds line 1; satellite Two.Text nodes
        // hold lines 2..N. We honor only hard newlines (Shift+Enter). The whole
        // block is vertically centered around the group origin.
        const syncMultilineLayout = (): void => {
            const t = twoTextRef.current
            if (!t) return
            const lines = (textValueRef.current || '').split('\n')
            const n = lines.length
            const lineH = lineHeightFor(t.size || 36)
            const extra = extraLineNodesRef.current

            t.value = lines[0] ?? ''
            t.translation.set(0, (0 - (n - 1) / 2) * lineH)

            for (let i = 1; i < n; i++) {
                let node = extra[i - 1]
                if (!node) {
                    node = two.makeText(lines[i] ?? '', 0, 0)
                    group.add(node)
                    extra[i - 1] = node
                }
                node.value = lines[i] ?? ''
                node.fill = t.fill
                node.size = t.size
                node.family = t.family
                node.alignment = t.alignment
                node.baseline = t.baseline
                node.opacity = t.opacity
                node.translation.set(0, (i - (n - 1) / 2) * lineH)
            }
            if (extra.length > n - 1) {
                const surplus = extra.splice(Math.max(n - 1, 0))
                if (surplus.length > 0) group.remove(surplus)
            }
            two.update()
        }
        syncMultilineRef.current = syncMultilineLayout

        // Union screen box over every line node so the selection rectangle
        // encloses the whole multiline block (not just line 1). Reads
        // getBoundingClientRect, so it already reflects the group's counter-scale.
        const blockRect = (): {
            left: number
            right: number
            top: number
            bottom: number
            width: number
            height: number
        } => {
            const nodes = [
                twoTextRef.current,
                ...extraLineNodesRef.current,
            ].filter(Boolean)
            let L = Infinity
            let R = -Infinity
            let T = Infinity
            let B = -Infinity
            nodes.forEach((nd) => {
                const r = nd.getBoundingClientRect(true)
                L = Math.min(L, r.left)
                R = Math.max(R, r.right)
                T = Math.min(T, r.top)
                B = Math.max(B, r.bottom)
            })
            if (L === Infinity) {
                return twoText.getBoundingClientRect(true)
            }
            return {
                left: L,
                right: R,
                top: T,
                bottom: B,
                width: R - L,
                height: B - T,
            }
        }

        // Render any persisted multiline content as the stacked block.
        syncMultilineLayout()

        const { selector } = getEditComponents(two, group, 4)
        selectorInstance = selector
        two.update()

        // Resize via corner handles (proportional font-size scaling).
        const cornerCircles: ShapeLike[] = [
            selectorInstance.circle1,
            selectorInstance.circle2,
            selectorInstance.circle3,
            selectorInstance.circle4,
        ].filter(Boolean)

        const resizeCursors = [
            'nwse-resize', // circle1 = TL
            'nesw-resize', // circle2 = TR
            'nwse-resize', // circle3 = BR
            'nesw-resize', // circle4 = BL
        ]

        let resizeState: ResizeState | null = null

        const onResizeMouseMove = (e: MouseEvent): void => {
            if (!resizeState) return
            const { centerX, centerY, startDist, startSize } = resizeState
            const currentDist = Math.sqrt(
                (e.clientX - centerX) ** 2 + (e.clientY - centerY) ** 2
            )
            const scale = currentDist / Math.max(startDist, 1)
            const newSize = Math.round(
                Math.min(Math.max(startSize * scale, 8), 300)
            )

            twoText.size = newSize
            twoText.leading = newSize
            extraLineNodesRef.current.forEach((nd) => {
                nd.size = newSize
                nd.leading = newSize
            })
            // Re-stack for the new line height, then box the whole block.
            syncMultilineLayout()

            const bRect = blockRect()
            selectorInstance.update(
                bRect.left - 4,
                bRect.right + 4,
                bRect.top - 4,
                bRect.bottom + 4
            )

            setTextSize(newSize)
        }

        const onResizeMouseUp = (): void => {
            if (!resizeState) return
            const finalSize = twoText.size
            resizeState = null

            window.removeEventListener('mousemove', onResizeMouseMove)
            window.removeEventListener('mouseup', onResizeMouseUp)

            const bRect = blockRect()
            const newWidth = Math.round(bRect.width || 60)
            const newHeight = Math.round(bRect.height || twoText.size)

            const resizeMetadata = {
                ...props.metadata,
                fontSize: finalSize,
                content: textValueRef.current,
            }
            updateComponentBulkPropertiesInLocalStore(props.id, {
                width: newWidth,
                height: newHeight,
                metadata: resizeMetadata,
            })
            if (group.elementData) {
                group.elementData.metadata = resizeMetadata
            }
        }

        cornerCircles.forEach((circle, index) => {
            const circleElem = circle._renderer?.elem as HTMLElement | undefined
            if (!circleElem) return

            circleElem.style.cursor = resizeCursors[index] ?? 'pointer'
            circleElem.style.pointerEvents = 'all'

            circleElem.addEventListener('mousedown', (e: MouseEvent) => {
                if (selectorInstance.areaGroup.opacity === 0) return

                e.stopPropagation()
                e.preventDefault()

                const textDomElem = twoText._renderer.elem
                const textScreenRect = textDomElem.getBoundingClientRect()
                const centerX = textScreenRect.left + textScreenRect.width / 2
                const centerY = textScreenRect.top + textScreenRect.height / 2

                const startDist = Math.sqrt(
                    (e.clientX - centerX) ** 2 + (e.clientY - centerY) ** 2
                )

                resizeState = {
                    centerX,
                    centerY,
                    startDist,
                    startSize: twoText.size || 16,
                }

                window.addEventListener('mousemove', onResizeMouseMove)
                window.addEventListener('mouseup', onResizeMouseUp)
            })
        })

        const groupEl = document.getElementById(group.id)
        if (groupEl) {
            groupEl.setAttribute('class', 'dragger-picker')
            groupEl.setAttribute('data-component-id', props.id)
        }

        setInternalState((draft) => {
            draft.group = { id: group.id, data: group }
            draft.twoText = { id: twoText.id, data: twoText }
            draft.shape = { id: twoText.id, data: twoText }
            draft.text = { id: twoText.id, data: twoText }
            draft.icon = { data: {} }
        })

        const getGroupElementFromDOM = document.getElementById(`${group.id}`)
        getGroupElementFromDOM?.addEventListener('focus', onFocusHandler)
        getGroupElementFromDOM?.addEventListener('blur', onBlurHandler)

        const showTextInput = (): void => {
            const groupDomElem = document.getElementById(`${group.id}`)
            if (!groupDomElem) return

            const textDomElem = twoText._renderer.elem as HTMLElement
            const screenRect = textDomElem.getBoundingClientRect()

            groupDomElem.style.display = 'none'

            // The on-screen text size folds in the group's counter-scale on top
            // of the scene scale, so the editing overlay must do the same to
            // line up with the rendered glyphs.
            const fontSize = twoText.size || 36
            const sceneScale = two?.scene?.scale || 1
            const groupScale =
                typeof group.scale === 'number' ? group.scale : 1
            const cssFontSize = fontSize * sceneScale * groupScale
            const lineH = Math.ceil(cssFontSize * 1.6)
            const vertPad = Math.ceil((lineH - cssFontSize) / 2) + 4

            const input = document.createElement('textarea')
            const randomId = Math.floor(Math.random() * 90 + 10)
            input.id = `geo-text-input-area-${randomId}`
            input.value = textValueRef.current
            input.rows = 1
            input.style.border = 'none'
            input.style.background = 'transparent'
            input.style.padding = `${vertPad}px 8px`
            input.style.color = twoText.fill || '#3A342C'
            input.style.fontSize = `${cssFontSize}px`
            input.style.fontFamily = twoText.family || DEFAULT_TEXT_FONT_FAMILY
            input.style.fontWeight = twoText.weight || 'normal'
            input.style.lineHeight = `${lineH}px`
            input.style.letterSpacing = '0px'
            input.style.textAlign = 'left'
            input.style.position = 'absolute'
            input.style.outline = 'none'
            input.style.resize = 'none'
            input.style.overflow = 'visible'
            input.style.whiteSpace = 'pre'
            input.style.boxSizing = 'border-box'
            input.className = 'temp-input-area'

            const centerY = screenRect.top + screenRect.height / 2
            const leftAnchor = screenRect.left - 8

            document.getElementById('main-two-root')?.append(input)

            const measureSpan = document.createElement('span')
            measureSpan.style.position = 'absolute'
            measureSpan.style.visibility = 'hidden'
            measureSpan.style.whiteSpace = 'pre'
            measureSpan.style.fontSize = `${cssFontSize}px`
            measureSpan.style.fontFamily =
                twoText.family || DEFAULT_TEXT_FONT_FAMILY
            measureSpan.style.fontWeight = twoText.weight || 'normal'
            measureSpan.style.lineHeight = `${lineH}px`
            measureSpan.style.letterSpacing = '0px'
            measureSpan.style.padding = '0'
            document.body.appendChild(measureSpan)

            const autoSizeAndCenter = (): void => {
                const val = input.value || 'M'
                measureSpan.textContent = val

                const measuredW = measureSpan.offsetWidth
                const measuredH = measureSpan.offsetHeight

                const contentWidth = Math.max(
                    measuredW + 40,
                    screenRect.width + 40,
                    80
                )
                const contentHeight = Math.max(
                    measuredH + vertPad * 2,
                    lineH + vertPad * 2
                )

                input.style.width = `${contentWidth}px`
                input.style.height = `${contentHeight}px`

                input.style.left = `${leftAnchor}px`
                input.style.top = `${centerY - contentHeight / 2}px`
            }

            autoSizeAndCenter()

            input.addEventListener('input', autoSizeAndCenter)

            input.onfocus = function (): void {
                const bRect = blockRect()
                selectorInstance.update(
                    bRect.left - 4,
                    bRect.right + 4,
                    bRect.top - 4,
                    bRect.bottom + 4
                )
                selectorInstance.show()
                two.update()
            }

            input.focus()

            input.addEventListener('keydown', (event: KeyboardEvent) => {
                if (event.key === 'Enter') {
                    if (event.shiftKey) {
                        // Shift+Enter inserts a newline (textarea is
                        // whiteSpace:'pre'); hard newlines are preserved.
                        return
                    }
                    // Plain Enter commits and closes the editor.
                    event.preventDefault()
                    input.blur()
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    input.blur()
                }
            })

            input.addEventListener('blur', () => {
                input.removeEventListener('input', autoSizeAndCenter)
                if (measureSpan.parentNode) {
                    measureSpan.parentNode.removeChild(measureSpan)
                }

                groupDomElem.style.display = 'block'

                // Raw text — may contain hard newlines from Shift+Enter.
                const newContent = input.value
                setTextValue(newContent)
                textValueRef.current = newContent

                syncMultilineLayout()

                const bRect = blockRect()
                const newWidth = Math.round(bRect.width || 60)
                const newHeight = Math.round(bRect.height || twoText.size)

                selectorInstance.update(
                    bRect.left - 4,
                    bRect.right + 4,
                    bRect.top - 4,
                    bRect.bottom + 4
                )
                selectorInstance.hide()
                two.update()

                const updatedMetadata = {
                    ...props.metadata,
                    content: textValueRef.current,
                }
                updateComponentBulkPropertiesInLocalStore(props.id, {
                    width: newWidth,
                    height: newHeight,
                    metadata: updatedMetadata,
                })

                if (group.elementData) {
                    group.elementData.metadata = updatedMetadata
                }

                input.remove()
            })
        }

        twoText._renderer.elem.addEventListener('dblclick', () => {
            showTextInput()
        })
        getGroupElementFromDOM?.addEventListener('dblclick', () => {
            showTextInput()
        })

        const handleTriggerTextInput = (e: Event): void => {
            const detail = (e as CustomEvent<{ elementId: string }>).detail
            if (detail?.elementId === props.id) {
                setTimeout(() => showTextInput(), 100)
            }
        }
        window.addEventListener('triggerTextInput', handleTriggerTextInput)

        interact(`#${group.id}`).on('click', () => {
            const bRect = blockRect()
            selector.update(
                bRect.left - 4,
                bRect.right + 4,
                bRect.top - 4,
                bRect.bottom + 4
            )
            two.update()
            toggleToolbar(true)
        })

        handleGlobalMousedown = (e: MouseEvent): void => {
            const path: EventTarget[] = e.composedPath
                ? e.composedPath()
                : []
            const isOnGroup = path.some(
                (el: EventTarget) => (el as HTMLElement)?.id === group.id
            )
            const isOnToolbar = path.some(
                (el: EventTarget) =>
                    (el as HTMLElement)?.id === 'floating-toolbar'
            )
            const isOnMobileTrigger =
                mobileTriggerRef.current &&
                path.includes(mobileTriggerRef.current)
            if (!isOnGroup && !isOnToolbar && !isOnMobileTrigger) {
                selectorInstance.hide()
                toggleToolbar(false)
                two.update()
            }
        }
        window.addEventListener('mousedown', handleGlobalMousedown)

        return (): void => {
            window.removeEventListener(
                'triggerTextInput',
                handleTriggerTextInput
            )
            if (handleGlobalMousedown) {
                window.removeEventListener('mousedown', handleGlobalMousedown)
            }
            window.removeEventListener('mousemove', onResizeMouseMove)
            window.removeEventListener('mouseup', onResizeMouseUp)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Counter-scale the whole group on every camera change so the label stays
    // legible when the world zooms out (same contract as point.tsx). Reads the
    // scale from the event each fire — no stale closure.
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
        if (internalState?.group?.data) {
            internalState.group.data.translation.x = props.x
            internalState.group.data.translation.y = props.y
            two.update()
        }

        if (internalState?.twoText?.data) {
            const twoText = internalState.twoText.data

            if (props.textColor) {
                twoText.fill = props.textColor
            }
            if (props.metadata?.fontSize) {
                twoText.size = props.metadata.fontSize
                setTextSize(props.metadata.fontSize)
            }
            if (props.metadata?.textFontFamily) {
                twoText.family = props.metadata.textFontFamily
            }
            if (
                props.metadata?.content !== undefined &&
                props.metadata.content !== textValueRef.current
            ) {
                textValueRef.current = props.metadata.content
                setTextValue(props.metadata.content)
            }

            // Propagate style/content changes across every line node and
            // restack (handles font-size/family/color from the toolbar and
            // group-apply, plus external content updates).
            syncMultilineRef.current?.()

            two.update()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.x, props.y, props.textColor, props.metadata])

    // Undo/redo reverts text via the history hook, but ElementRenderWrapper
    // freezes our props at mount so the metadata effect above never re-fires.
    // The hook dispatches this event instead; we re-stack through the
    // component's own multiline path so extraLineNodesRef stays consistent.
    useEffect(() => {
        const handleTextReverted = ((
            e: CustomEvent<{ id: string; content: string }>
        ): void => {
            if (e.detail?.id !== props.id) return
            const content = e.detail.content ?? ''
            textValueRef.current = content
            setTextValue(content)
            syncMultilineRef.current?.()
            two?.update()
        }) as EventListener
        window.addEventListener('standaloneTextReverted', handleTextReverted)
        return () =>
            window.removeEventListener(
                'standaloneTextReverted',
                handleTextReverted
            )
    }, [props.id, two])

    useEffect(() => {
        if (!showToolbar) setShowMobilePanel(false)
    }, [showToolbar])

    useEffect(() => {
        const groupId = internalState?.group?.id
        const el = groupId ? document.getElementById(groupId) : null
        if (el) {
            el.style.pointerEvents =
                isPencilMode ||
                isArrowDrawMode ||
                isTextDrawMode ||
                isArrowSelected
                    ? 'none'
                    : 'auto'
        }
    }, [
        isPencilMode,
        isArrowDrawMode,
        isTextDrawMode,
        isArrowSelected,
        internalState?.group?.id,
    ])

    // TEXT_SIZES_OBJECT and MOBILE_TEXT_SIZES_OBJECT used by callbacks
    // wired in via the toolbar; keep imports referenced via a no-op.
    void TEXT_SIZES_OBJECT
    void MOBILE_TEXT_SIZES_OBJECT

    return (
        <React.Fragment>
            <div id="two-geo-text"></div>
        </React.Fragment>
    )
}

export default GeoText
