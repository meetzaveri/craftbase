import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import { MENU_BUTTON_ID } from './shapesToolbarId'
import Dropdown from '../common/dropdown'
import type { DropdownOption } from '../common/dropdown'
import SwapIcon from '../../assets/swap-horizontal.svg?react'
import MapIcon from '../../assets/map.svg?react'
import ImageIcon from '../../assets/image.svg?react'
import PencilIcon from '../../wireframeAssets/pencil.svg?react'
import type { BaseId } from '../../bases/types'

/**
 * The switcher lists bases that are *designed*, which is one more than the set
 * that is *built* — the image base is still to come. Widening `BaseId` itself
 * would be the wrong way to show it: `isBaseId` gates what may come back out of
 * localStorage and an import file, and `registry.LOADERS` is keyed exhaustively
 * on it, so an unbuilt member would be a crash waiting for the first user who
 * picks it. Keeping the placeholder local to the menu means the type still says
 * exactly what the app can render.
 */
type BaseOptionId = BaseId | 'image'

const OPTIONS: readonly DropdownOption<BaseOptionId>[] = [
    { value: 'board', label: 'Board', icon: PencilIcon },
    { value: 'map', label: 'Map', icon: MapIcon },
    {
        value: 'image',
        label: 'Image',
        icon: ImageIcon,
        disabled: true,
        badge: 'Soon',
    },
]

/** Gap in px between the menu button and the switcher. */
const GAP = 8

/**
 * Base picker — the control that says which substrate the board is drawn on.
 *
 * Sits immediately right of the hamburger menu, and its left edge is *measured*
 * from that button rather than set by a constant: the two must stay flush, and
 * a hard-coded offset silently drifts the moment the button's size or padding
 * changes.
 */
const BaseSwitcher = (): ReactElement | null => {
    const { activeBase, switchBase, baseSwitcherEnabled } = useBoardContext()
    const { isMobile } = useMediaQueryUtils()
    const selfRef = useRef<HTMLDivElement | null>(null)
    const [left, setLeft] = useState<number | null>(null)

    useLayoutEffect(() => {
        if (isMobile) return
        const position = (): void => {
            const anchor = document.getElementById(MENU_BUTTON_ID)
            if (!anchor) return
            setLeft(anchor.getBoundingClientRect().right + GAP)
        }

        position()
        const anchor = document.getElementById(MENU_BUTTON_ID)
        const observer = new ResizeObserver(position)
        if (anchor) observer.observe(anchor)
        window.addEventListener('resize', position)
        return (): void => {
            observer.disconnect()
            window.removeEventListener('resize', position)
        }
    }, [isMobile, activeBase])

    // Switching bases tears down and remounts a backdrop renderer, so ignore
    // repeat picks until the new base is live rather than queueing mounts.
    const [busy, setBusy] = useState(false)
    useEffect(() => {
        setBusy(false)
    }, [activeBase])

    // A multi-click draw (area / route / curved line) puts the mobile ✓/✗
    // controls at this exact spot — bottom 64px, right 10px — so the switcher
    // steps aside for the duration. Yielding rather than nudging either control
    // to a new offset: mid-draw is the wrong moment to change the substrate
    // anyway, since the preview vertices are in surface space and the backdrop
    // would slide out from under them.
    const [drawing, setDrawing] = useState(false)
    useEffect(() => {
        const onStart = (): void => setDrawing(true)
        const onEnd = (): void => setDrawing(false)
        window.addEventListener('multiClickDrawStart', onStart)
        window.addEventListener('multiClickDrawEnd', onEnd)
        return (): void => {
            window.removeEventListener('multiClickDrawStart', onStart)
            window.removeEventListener('multiClickDrawEnd', onEnd)
        }
    }, [])

    // A consumer painting its own backdrop owns the substrate — offering the
    // switcher would let the user stack craftbase's map under theirs.
    if (!baseSwitcherEnabled) return null
    // Desktop keeps it: the switcher is top-left there, nowhere near the draw
    // controls, and hiding chrome mid-draw would just make the corner jump.
    if (isMobile && drawing) return null

    const handleChange = (id: BaseOptionId): void => {
        // The unbuilt base is already `disabled` in the list; this is the type
        // narrowing that makes that fact checkable rather than trusted.
        if (id === 'image') return
        if (id === activeBase || busy) return
        setBusy(true)
        switchBase(id)
    }

    return (
        <div
            ref={selfRef}
            id="cb-base-switcher"
            className="fixed bg-card-bg border border-border-panel rounded-card"
            style={
                isMobile
                    ? { bottom: '64px', right: '10px', zIndex: 10 }
                    : {
                          top: '8px',
                          // Hidden until measured, so it never flashes at the
                          // viewport edge on first paint.
                          left: left ?? -9999,
                          visibility: left === null ? 'hidden' : 'visible',
                          zIndex: 10,
                      }
            }
        >
            <Dropdown<BaseOptionId>
                value={activeBase}
                options={OPTIONS}
                onChange={handleChange}
                // The swap glyph, not the active base's icon: this control's job
                // is "change the substrate", and the active base is already
                // named right beside it.
                triggerIcon={SwapIcon}
                ariaLabel="Switch base"
                disabled={busy}
                // Match the hamburger's 40px inner box so the two boxes line up
                // exactly, rather than sitting a few px off each other.
                triggerClassName="h-10 px-2.5"
                // On mobile the switcher lives near the bottom-right corner, so
                // the panel has to open upward and hug the right edge.
                align={isMobile ? 'right' : 'left'}
                placement={isMobile ? 'top' : 'bottom'}
                panelMinWidth={168}
            />
        </div>
    )
}

export default BaseSwitcher
