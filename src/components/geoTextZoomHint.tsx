import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

import { useBaseContext } from '../views/Base/baseContext'
import { useMediaQueryUtils } from '../constants/exportHooks'
import { GEO_TEXT_ZOOM_HINT_DISMISSED_KEY } from '../constants/misc'

// How long the tip stays up before fading, and how long the fade takes (must
// match the duration-300 class below).
const VISIBLE_MS = 5000
const FADE_MS = 300
// Trailing debounce on `zoomChanged`. The wheel handler fires this event per
// tick; we only care that a zoom gesture happened, not how many ticks it took.
// A full second, so the tip lands after the user has settled on a zoom rather
// than interrupting the gesture — every tick restarts this.
const DEBOUNCE_MS = 5000

/**
 * One-shot tip pointing at the "Zoom resistant" switch, shown under the primary
 * toolbar the first time a user zooms a map base that has text on it.
 *
 * Desktop only. The mobile toolbar is pinned bottom-left (shapesToolbar.tsx),
 * so there is no "below the toolbar" slot to occupy — mobile users still get
 * the switch itself in the properties panel's text tab.
 *
 * Shares the `top: 55px` slot with #multi-click-draw-hint (the toolbar's
 * computed bottom edge), so it stands down while a multi-click draw is armed.
 */
const GeoTextZoomHint = (): ReactElement | null => {
    const { activeBaseType, componentStore, currentElement } = useBaseContext()
    const { isMobile } = useMediaQueryUtils()

    const [mounted, setMounted] = useState(false)
    const [visible, setVisible] = useState(false)

    // Latched the moment we decide to show, so the debounce can't queue a
    // second showing before the localStorage write lands.
    const shownRef = useRef(false)
    // Last scale we saw. `zoomChanged` also fires for programmatic camera moves
    // — setZoomLimits clamps on every base switch, and fitToContent on load —
    // so a single event is not evidence of a user zooming. Requiring two
    // distinct scales keeps those from burning the one-shot.
    const lastScaleRef = useRef<number | null>(null)

    // Read through refs: the listener is registered once, but these change as
    // the user works.
    const canShowRef = useRef(false)
    canShowRef.current =
        !isMobile &&
        activeBaseType === 'map' &&
        // Nothing to point at until the base actually has map text on it.
        Object.values(componentStore ?? {}).some(
            (c) => c?.componentType === 'geoText'
        ) &&
        // Don't fight #multi-click-draw-hint for the same slot.
        currentElement !== 'area' &&
        currentElement !== 'route' &&
        currentElement !== 'curvedLine'

    useEffect(() => {
        if (isMobile) return
        try {
            if (localStorage.getItem(GEO_TEXT_ZOOM_HINT_DISMISSED_KEY)) {
                shownRef.current = true
                return
            }
        } catch (_) {
            // Private mode / blocked storage: fall through and just show it.
        }

        let debounce: ReturnType<typeof setTimeout> | null = null
        let hideTimer: ReturnType<typeof setTimeout> | null = null
        let unmountTimer: ReturnType<typeof setTimeout> | null = null

        const onZoom = (e: Event): void => {
            if (shownRef.current) return
            const scale = (e as CustomEvent<{ scale: number }>).detail?.scale
            if (!scale) return
            // NOTE: never call two.update() from a zoomChanged listener — the
            // wheel handler renders once after dispatching (see
            // utils/handleScale.ts). This listener only touches React state.
            const previous = lastScaleRef.current
            lastScaleRef.current = scale
            if (previous === null || previous === scale) return

            if (debounce) clearTimeout(debounce)
            debounce = setTimeout(() => {
                if (shownRef.current || !canShowRef.current) return
                shownRef.current = true
                setMounted(true)
                // Next frame, so the opacity transition has a 0 to start from.
                requestAnimationFrame(() => setVisible(true))
                hideTimer = setTimeout(() => setVisible(false), VISIBLE_MS)
                unmountTimer = setTimeout(
                    () => setMounted(false),
                    VISIBLE_MS + FADE_MS
                )
                try {
                    localStorage.setItem(GEO_TEXT_ZOOM_HINT_DISMISSED_KEY, '1')
                } catch (_) {
                    // Nothing to do — worst case the tip shows again next time.
                }
            }, DEBOUNCE_MS)
        }

        window.addEventListener('zoomChanged', onZoom as EventListener)
        return (): void => {
            window.removeEventListener('zoomChanged', onZoom as EventListener)
            if (debounce) clearTimeout(debounce)
            if (hideTimer) clearTimeout(hideTimer)
            if (unmountTimer) clearTimeout(unmountTimer)
        }
    }, [isMobile])

    if (isMobile || !mounted) return null

    return (
        <div
            id="geo-text-zoom-hint"
            className={`fixed w-full flex justify-center pointer-events-none
                transition-opacity ease-out duration-300 ${
                    visible ? 'opacity-100' : 'opacity-0'
                }`}
            style={{ top: '55px', zIndex: 20 }}
        >
            <div className="w-auto bg-ink text-card-bg px-4 py-2 rounded-md shadow-md">
                <div className="text-sm text-center">
                    Map text keeps its size as you zoom — uncheck{' '}
                    <span className="font-semibold">Zoom resistant</span> in the
                    text properties to let it scale with the map.
                </div>
            </div>
        </div>
    )
}

export default GeoTextZoomHint
