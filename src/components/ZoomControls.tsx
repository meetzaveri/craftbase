import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../views/Board/boardContext'
import ZoomInIcon from '../assets/zoom-in.svg?react'
import ZoomOutIcon from '../assets/zoom-out.svg?react'

type ZuiWrapperLike = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zui: any
    syncBackgroundToCamera?: () => void
} | null

const ZoomControls = (): ReactElement => {
    const { zuiInBoard, twoJSInstance, scaleToDisplay } = useBoardContext()
    const zui = zuiInBoard as ZuiWrapperLike
    const [scale, setScale] = useState(1)

    useEffect(() => {
        if (zui) {
            setScale(zui.zui.scale)
        }
    }, [zui])

    useEffect(() => {
        const handler = (e: Event): void => {
            const detail = (e as CustomEvent<{ scale: number }>).detail
            if (detail) setScale(detail.scale)
        }
        window.addEventListener('zoomChanged', handler)
        return (): void => window.removeEventListener('zoomChanged', handler)
    }, [])

    const zoom = (delta: number): void => {
        if (!zui || !twoJSInstance) return
        zui.zui.zoomBy(delta, window.innerWidth / 2, window.innerHeight / 2)
        twoJSInstance.update()
        zui.syncBackgroundToCamera?.()
        window.dispatchEvent(
            new CustomEvent('zoomChanged', {
                detail: { scale: zui.zui.scale },
            })
        )
    }

    return (
        <div
            style={{ position: 'fixed', bottom: 20, left: 10, zIndex: 10 }}
            className="flex items-center gap-1 bg-card-bg text-ink rounded-lg px-2 py-1 border border-border-panel"
        >
            <button
                onClick={(): void => zoom(-0.2)}
                className="w-7 h-7 flex items-center justify-center rounded text-ink-muted hover:bg-accent hover:text-ink transition-colors duration-150"
                title="Zoom out"
            >
                {/* stroke/color="currentColor" cancels the SVG's hardcoded
                    #000 so it follows the theme-aware text color. */}
                <ZoomOutIcon
                    className="w-5 h-5"
                    stroke="currentColor"
                    color="currentColor"
                    aria-label="Zoom out"
                />
            </button>
            <span className="text-xs font-medium w-10 text-center select-none">
                {scaleToDisplay
                    ? scaleToDisplay(scale)
                    : `${Math.round(scale * 100)}%`}
            </span>
            <button
                onClick={(): void => zoom(0.2)}
                className="w-7 h-7 flex items-center justify-center rounded text-ink-muted hover:bg-accent hover:text-ink transition-colors duration-150"
                title="Zoom in"
            >
                <ZoomInIcon
                    className="w-5 h-5"
                    stroke="currentColor"
                    color="currentColor"
                    aria-label="Zoom in"
                />
            </button>
        </div>
    )
}

export default ZoomControls
