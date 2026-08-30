import {
    cloneElement,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import type {
    FocusEvent,
    PointerEvent as ReactPointerEvent,
    ReactElement,
    ReactNode,
    Ref,
} from 'react'

import Portal from './portal'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
    /** Content shown on hover / keyboard focus. Falsy → tooltip is suppressed. */
    label: ReactNode
    /** Exactly one hoverable/focusable trigger element. */
    children: ReactElement
    placement?: TooltipPlacement
    /**
     * ms to wait before showing. Defaults to 0 so the hint appears effectively
     * instantly (a short opacity fade still smooths it out). Bump it if you want
     * a hover-intent delay.
     */
    delay?: number
    disabled?: boolean
}

// Gap in px between the trigger and the tooltip bubble.
const GAP = 8
// Min distance the bubble keeps from the viewport edges when clamped.
const EDGE_MARGIN = 6

interface Pos {
    top: number
    left: number
}

/**
 * Lightweight, dependency-free tooltip.
 *
 * - Wraps a SINGLE trigger and shows `label` on MOUSE hover or keyboard focus.
 *
 *   Deliberately not on touch. A tap fires the compatibility mouse sequence
 *   (`mouseover`/`mouseenter` → `mousedown` → `mouseup` → `click`) and then
 *   leaves the element hovered — there is no `mouseleave` until the finger
 *   touches something else that is itself hoverable, which the canvas under the
 *   toolbar never is. So a tapped button's tooltip simply stayed on screen, for
 *   the rest of the session. Focus has the same shape: Chrome for Android
 *   focuses a tapped `<button>` and blur only lands when focus truly moves.
 *
 *   Gating on `pointerType` rather than on a device check is what keeps a
 *   touchscreen laptop correct: the mouse still gets hints, the finger does
 *   not. And a tooltip is a hover affordance anyway — on touch the control's
 *   `aria-label`/`title` carries the same words, with no bubble to dismiss.
 * - Clones the child (no extra wrapper DOM) so the trigger keeps its slot in
 *   flex/grid layouts.
 * - Renders the bubble through a Portal, so it is never clipped by an ancestor's
 *   `overflow` (e.g. the scrollable floating toolbar) and positions it with
 *   `position: fixed` off the trigger's viewport rect, clamped on-screen.
 *
 * Reuse anywhere a control needs a hint:
 *   <Tooltip label="Bring to Front"><button>…</button></Tooltip>
 */
const Tooltip = ({
    label,
    children,
    placement = 'top',
    delay = 0,
    disabled = false,
}: TooltipProps): ReactElement => {
    const triggerRef = useRef<HTMLElement | null>(null)
    const bubbleRef = useRef<HTMLDivElement | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // `anchor` holds the trigger rect while the tooltip is open; `pos` is the
    // measured/clamped bubble position. Two phases avoid an off-screen flash:
    // render hidden at the anchor, measure, then place + fade in.
    const [anchor, setAnchor] = useState<DOMRect | null>(null)
    const [pos, setPos] = useState<Pos | null>(null)

    const show = useCallback((): void => {
        if (disabled || !label) return
        const open = (): void => {
            const el = triggerRef.current
            if (el) setAnchor(el.getBoundingClientRect())
        }
        if (delay <= 0) {
            open()
            return
        }
        timerRef.current = setTimeout(open, delay)
    }, [delay, disabled, label])

    const hide = useCallback((): void => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        setAnchor(null)
        setPos(null)
    }, [])

    /**
     * Nothing outlives the interaction that opened it.
     *
     * `pointerleave` covers the cursor moving off, but not the trigger being
     * scrolled away, the window losing focus, or a tooltip that got opened by
     * some route we did not anticipate. Cheap to listen for, and it means a
     * stuck bubble is not a thing this component can do.
     */
    useEffect(() => {
        if (!anchor) return
        const onAway = (): void => hide()
        window.addEventListener('pointerdown', onAway, true)
        window.addEventListener('scroll', onAway, true)
        window.addEventListener('blur', onAway)
        document.addEventListener('visibilitychange', onAway)
        return (): void => {
            window.removeEventListener('pointerdown', onAway, true)
            window.removeEventListener('scroll', onAway, true)
            window.removeEventListener('blur', onAway)
            document.removeEventListener('visibilitychange', onAway)
        }
    }, [anchor, hide])

    useLayoutEffect(() => {
        if (!anchor) return
        const bubble = bubbleRef.current
        if (!bubble) return
        const { width: bw, height: bh } = bubble.getBoundingClientRect()

        let top: number
        let left: number
        switch (placement) {
            case 'bottom':
                top = anchor.bottom + GAP
                left = anchor.left + anchor.width / 2 - bw / 2
                break
            case 'left':
                top = anchor.top + anchor.height / 2 - bh / 2
                left = anchor.left - GAP - bw
                break
            case 'right':
                top = anchor.top + anchor.height / 2 - bh / 2
                left = anchor.right + GAP
                break
            case 'top':
            default:
                top = anchor.top - GAP - bh
                left = anchor.left + anchor.width / 2 - bw / 2
        }

        // Keep the bubble fully on-screen.
        left = Math.max(
            EDGE_MARGIN,
            Math.min(left, window.innerWidth - bw - EDGE_MARGIN)
        )
        top = Math.max(
            EDGE_MARGIN,
            Math.min(top, window.innerHeight - bh - EDGE_MARGIN)
        )
        setPos({ top, left })
    }, [anchor, placement])

    // Merge our ref + open/close handlers onto the child, preserving any the
    // caller already passed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child = children as ReactElement<any> & { ref?: Ref<HTMLElement> }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const childProps: any = child.props

    const trigger = cloneElement(child, {
        ref: (node: HTMLElement | null): void => {
            triggerRef.current = node
            const r = child.ref
            if (typeof r === 'function') r(node)
            else if (r && typeof r === 'object')
                (r as { current: HTMLElement | null }).current = node
        },
        // Pointer events, not mouse events, so the trigger can tell a cursor
        // from a finger. `pointerenter` fires for touch too — hence the
        // explicit check rather than just swapping the event name.
        onPointerEnter: (e: ReactPointerEvent): void => {
            if (e.pointerType === 'mouse') show()
            childProps.onPointerEnter?.(e)
        },
        onPointerLeave: (e: ReactPointerEvent): void => {
            hide()
            childProps.onPointerLeave?.(e)
        },
        // A tap on a button focuses it in some browsers, so plain `focus` would
        // put the bubble back up by another route. `:focus-visible` is the
        // browser's own answer to "was this focus worth showing chrome for" —
        // true for keyboard, false for a tap.
        onFocus: (e: FocusEvent): void => {
            const el = e.target as HTMLElement
            if (typeof el?.matches === 'function') {
                try {
                    if (el.matches(':focus-visible')) show()
                } catch {
                    // Ancient engine without :focus-visible — skip the hint
                    // rather than risk a sticky one.
                }
            }
            childProps.onFocus?.(e)
        },
        onBlur: (e: FocusEvent): void => {
            hide()
            childProps.onBlur?.(e)
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    return (
        <>
            {trigger}
            {anchor && (
                <Portal>
                    <div
                        ref={bubbleRef}
                        role="tooltip"
                        className="fixed z-[200] pointer-events-none px-2 py-1 rounded-md bg-ink text-card-bg text-xs font-medium whitespace-nowrap transition-opacity duration-75"
                        style={{
                            top: pos?.top ?? 0,
                            left: pos?.left ?? 0,
                            opacity: pos ? 1 : 0,
                        }}
                    >
                        {label}
                    </div>
                </Portal>
            )}
        </>
    )
}

export default Tooltip
