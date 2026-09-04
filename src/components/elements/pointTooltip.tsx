import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { useBoardContext } from '../../views/Board/boardContext'
import {
    POINT_CATEGORIES,
    DEFAULT_POINT_CATEGORY,
    sizedCategoryIcon,
} from '../../constants/misc'

// Display-only tooltip card for the currently-selected point (the HTML
// "tooltip card" variant). Content comes from `metadata.tooltip`; editing is a
// later task, so it falls back to the category label until then.
//
// Anchored to the pin's on-screen box via a requestAnimationFrame loop — the
// pin is a Two.js node outside React, and pan/zoom/drag emit no single event we
// can hook, so we re-read getBoundingClientRect each frame while visible (cheap:
// one node, and we only re-render when the box actually moves).

interface PointTooltipData {
    title?: string
    subtitle?: string
    info?: string
    tag?: string
}

interface Box {
    left: number
    top: number
    width: number
    bottom: number
}

const TOOLTIP_WIDTH = 160

function PointTooltip(): ReactElement | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { selectedComponent } = useBoardContext() as any
    const [box, setBox] = useState<Box | null>(null)
    const lastBoxRef = useRef<Box | null>(null)

    const elementData = selectedComponent?.group?.data?.elementData
    const isPoint = elementData?.componentType === 'point'
    const componentId: string | undefined = elementData?.id

    useEffect(() => {
        if (!isPoint || !componentId) {
            setBox(null)
            lastBoxRef.current = null
            return
        }

        let raf = 0
        const tick = (): void => {
            const el = document.querySelector(
                `[data-component-id="${componentId}"]`
            )
            if (el) {
                const r = el.getBoundingClientRect()
                const next: Box = {
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    bottom: r.bottom,
                }
                const prev = lastBoxRef.current
                // Only re-render when the pin actually moved (sub-pixel jitter
                // from the camera shouldn't churn React every frame).
                if (
                    !prev ||
                    Math.abs(prev.left - next.left) > 0.5 ||
                    Math.abs(prev.bottom - next.bottom) > 0.5 ||
                    Math.abs(prev.width - next.width) > 0.5
                ) {
                    lastBoxRef.current = next
                    setBox(next)
                }
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return (): void => cancelAnimationFrame(raf)
    }, [isPoint, componentId])

    if (!isPoint || !box) return null

    const category = elementData?.metadata?.category ?? DEFAULT_POINT_CATEGORY
    const cat =
        POINT_CATEGORIES[category] ?? POINT_CATEGORIES[DEFAULT_POINT_CATEGORY]!
    const tip: PointTooltipData = elementData?.metadata?.tooltip ?? {}

    const title = tip.title || 'Untitled point'
    const subtitle = tip.subtitle || `${cat.label} · Active`

    const left = Math.max(
        8,
        box.left + box.width / 2 - TOOLTIP_WIDTH / 2
    )
    const top = box.bottom + 8

    return (
        <div
            className="fixed z-30 rounded-xl border border-border-panel bg-card-bg px-3 py-2.5 pointer-events-none"
            style={{
                left,
                top,
                width: TOOLTIP_WIDTH,
                boxShadow: '4px 4px 0 #C4B89A',
            }}
        >
            <div className="flex items-center gap-2 mb-1.5">
                <span
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                        background: cat.bg,
                        border: cat.border ? `1.5px solid ${cat.border}` : 'none',
                    }}
                    dangerouslySetInnerHTML={{
                        __html: sizedCategoryIcon(cat.svgIcon, 14),
                    }}
                />
                <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink truncate">
                        {title}
                    </div>
                    <div className="text-[10px] text-ink-muted leading-tight truncate">
                        {subtitle}
                    </div>
                </div>
            </div>
            {tip.info ? (
                <div className="text-[10px] text-ink-muted leading-snug">
                    {tip.info}
                </div>
            ) : null}
            {tip.tag ? (
                <span className="inline-block mt-1.5 text-[9px] font-semibold tracking-wide rounded border border-border-panel bg-canvas px-1.5 py-0.5 text-accent-dark uppercase">
                    {tip.tag}
                </span>
            ) : null}
        </div>
    )
}

export default PointTooltip
