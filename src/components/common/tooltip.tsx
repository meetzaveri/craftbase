import {
    cloneElement,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import type {
    FocusEvent,
    MouseEvent,
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
 * - Wraps a SINGLE trigger and shows `label` on hover or keyboard focus.
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
        onMouseEnter: (e: MouseEvent): void => {
            show()
            childProps.onMouseEnter?.(e)
        },
        onMouseLeave: (e: MouseEvent): void => {
            hide()
            childProps.onMouseLeave?.(e)
        },
        onFocus: (e: FocusEvent): void => {
            show()
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
