import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useBaseContext } from '../../views/Base/baseContext'
import { MENU_BUTTON_ID, BASE_TYPE_SWITCHER_ID } from './shapesToolbarId'
import Dropdown from '../common/dropdown'
import type { DropdownOption } from '../common/dropdown'
import SwapIcon from '../../assets/swap-horizontal.svg?react'
import MapIcon from '../../assets/map.svg?react'
import ImageIcon from '../../assets/image.svg?react'
import PencilIcon from '../../wireframeAssets/pencil.svg?react'
import type { BaseType } from '../../baseTypes/types'

/**
 * The switcher lists bases that are *designed*, which is one more than the set
 * that is *built* — the image base is still to come. Widening `BaseType` itself
 * would be the wrong way to show it: `isBaseType` gates what may come back out of
 * localStorage and an import file, and `registry.LOADERS` is keyed exhaustively
 * on it, so an unbuilt member would be a crash waiting for the first user who
 * picks it. Keeping the placeholder local to the menu means the type still says
 * exactly what the app can render.
 */
type BaseTypeOptionId = BaseType | 'image'

const OPTIONS: readonly DropdownOption<BaseTypeOptionId>[] = [
    { value: 'board', label: 'Whiteboard', icon: PencilIcon },
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
 * Base-type picker — the control that says which substrate the base is drawn on.
 *
 * Sits immediately right of the hamburger menu on every screen size, and its
 * left edge is *measured* from that button rather than set by a constant: the
 * two must stay flush, and a hard-coded offset silently drifts the moment the
 * button's size or padding changes.
 *
 * Top-left on mobile too, deliberately. This is configuration — which surface
 * am I drawing on — and it used to sit bottom-right, in the band mobile
 * reserves for *acting on what you are doing*: the properties button, and the
 * ✓/✗ that finish or discard a multi-click draw. Config living in the action
 * band both crowded those controls and misrepresented what it does.
 */
const BaseTypeSwitcher = (): ReactElement | null => {
    const { activeBaseType, switchBaseType, baseTypeSwitcherEnabled } = useBaseContext()
    const selfRef = useRef<HTMLDivElement | null>(null)
    const [left, setLeft] = useState<number | null>(null)

    useLayoutEffect(() => {
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
    }, [activeBaseType])

    // Switching bases tears down and remounts a backdrop renderer, so ignore
    // repeat picks until the new base is live rather than queueing mounts.
    const [busy, setBusy] = useState(false)
    useEffect(() => {
        setBusy(false)
    }, [activeBaseType])

    // A consumer painting its own backdrop owns the substrate — offering the
    // switcher would let the user stack craftbase's map under theirs.
    if (!baseTypeSwitcherEnabled) return null

    const handleChange = (id: BaseTypeOptionId): void => {
        // The unbuilt base is already `disabled` in the list; this is the type
        // narrowing that makes that fact checkable rather than trusted.
        if (id === 'image') return
        if (id === activeBaseType || busy) return
        setBusy(true)
        switchBaseType(id)
    }

    return (
        <div
            ref={selfRef}
            id={BASE_TYPE_SWITCHER_ID}
            className="fixed bg-card-bg border border-border-panel rounded-card"
            style={{
                top: '8px',
                // Hidden until measured, so it never flashes at the viewport
                // edge on first paint.
                left: left ?? -9999,
                visibility: left === null ? 'hidden' : 'visible',
                zIndex: 10,
            }}
        >
            <Dropdown<BaseTypeOptionId>
                value={activeBaseType}
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
                align="left"
                placement="bottom"
                panelMinWidth={168}
            />
        </div>
    )
}

export default BaseTypeSwitcher
