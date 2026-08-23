import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { useBaseContext } from '../views/Base/baseContext'
import ZoomInIcon from '../assets/zoom-in.svg?react'
import ZoomOutIcon from '../assets/zoom-out.svg?react'

type ZuiWrapperLike = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zui: any
    syncBackgroundToCamera?: () => void
    notifyCameraChange?: () => void
} | null

const ZoomControls = (): ReactElement => {
    const {
        zuiInBase,
        twoJSInstance,
        scaleToDisplay,
        zoomStep,
        activeBaseType,
        readBaseTypeConfig,
    } = useBaseContext()
    const zui = zuiInBase as ZuiWrapperLike
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

    const zoom = (direction: 1 | -1): void => {
        if (!zui || !twoJSInstance) return
        // Step size belongs to the base: a whole map zoom level on the map,
        // finer grain on the whiteboard (BaseTypeProvider.zoomStep).
        const delta = direction * (zoomStep || 0.2)
        zui.zui.zoomBy(delta, window.innerWidth / 2, window.innerHeight / 2)
        twoJSInstance.update()
        zui.syncBackgroundToCamera?.()
        // This zoom happens outside addZUI's event handlers, so nothing else
        // will announce it — without this the active base's backdrop (e.g. the
        // map) stays frozen at the previous camera.
        zui.notifyCameraChange?.()
        window.dispatchEvent(
            new CustomEvent('zoomChanged', {
                detail: { scale: zui.zui.scale },
            })
        )
    }

    // On the map, a percentage of an arbitrary surface is meaningless — and
    // once the range reaches whole-world zoom it reads "0%". Show the map zoom
    // level instead, which is the number the camera is actually expressed in
    // (mapZoom = anchor.zoom + log2(scale)).
    const mapAnchor = activeBaseType === 'map' ? readBaseTypeConfig().mapAnchor : null
    const label = scaleToDisplay
        ? scaleToDisplay(scale)
        : mapAnchor
          ? `z${Math.round(mapAnchor.zoom + Math.log2(scale))}`
          : `${Math.round(scale * 100)}%`

    return (
        <div
            style={{ position: 'fixed', bottom: 20, left: 10, zIndex: 10 }}
            className="flex items-center gap-1 bg-card-bg text-ink rounded-lg px-2 py-1 border border-border-panel"
        >
            <button
                onClick={(): void => zoom(-1)}
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
                {label}
            </span>
            <button
                onClick={(): void => zoom(1)}
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
