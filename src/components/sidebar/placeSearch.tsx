import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useBaseContext } from '../../views/Base/baseContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import { SHARE_BUTTON_ID } from './shapesToolbarId'
import { usePlaceSearch } from '../../hooks/usePlaceSearch'
import type { PlaceResult } from '../../utils/placeSearch'

/** Desktop width. */
const DESKTOP_WIDTH = 260
/** Gap kept between this field and the share button it measures against. */
const SHARE_GAP = 8
/** Frames to keep re-measuring the share button while it settles. */
const MEASURE_RETRIES = 10
/** Right margin when nothing needs avoiding in that corner. */
const RIGHT_MARGIN = 10

/**
 * Place search for the map base — the standing "take me somewhere else" control.
 *
 * The first-visit modal (MapStartLocationModal) asks the same question once; this
 * is the answer to changing your mind afterwards, and the recovery path for
 * anyone who skipped it and landed on their timezone city.
 *
 * Only recentres the *backdrop*: the ink stays exactly where it is on the
 * canvas, so searching a new place re-anchors what the drawing sits on rather
 * than moving the drawing.
 *
 * **Desktop only.** A phone's top row is menu + base switcher + share, and that
 * is the whole width — this field was squeezed into what was left and ended up a
 * few characters wide. On mobile the same search is a menu entry that opens
 * `placeSearchModal.tsx`; both share `usePlaceSearch`.
 */
const PlaceSearch = (): ReactElement | null => {
    const { activeBaseType, goToPlace } = useBaseContext()
    const { isMobile } = useMediaQueryUtils()
    const isActive = !isMobile && activeBaseType === 'map'
    const { query, setQuery, results, searching, reset } =
        usePlaceSearch(isActive)
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)

    /**
     * Keep clear of the share button, which shares this corner.
     *
     * Measured, not a constant: the share control's width is not this
     * component's to know, and a hard-coded
     * guess silently overlaps the moment its padding changes. Falls back to the
     * bare right margin when there is no share button to avoid.
     */
    const [rightOffset, setRightOffset] = useState<number>(RIGHT_MARGIN)
    useLayoutEffect(() => {
        if (!isActive) {
            setRightOffset(RIGHT_MARGIN)
            return
        }
        let frame = 0
        let cancelled = false
        const measure = (): void => {
            if (cancelled) return
            const rect = document
                .getElementById(SHARE_BUTTON_ID)
                ?.getBoundingClientRect()
            setRightOffset(
                rect && rect.width > 0
                    ? window.innerWidth - rect.left + SHARE_GAP
                    : RIGHT_MARGIN
            )
            if (frame++ < MEASURE_RETRIES) requestAnimationFrame(measure)
        }
        measure()
        window.addEventListener('resize', measure)
        return (): void => {
            cancelled = true
            window.removeEventListener('resize', measure)
        }
    }, [isActive])

    useEffect(() => {
        if (!open) return
        const handleClickOutside = (e: MouseEvent): void => {
            if (rootRef.current?.contains(e.target as Node)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return (): void =>
            document.removeEventListener('mousedown', handleClickOutside)
    }, [open])

    // Leaving the map base closes and clears — the control is meaningless on a
    // base with nothing to recentre.
    useEffect(() => {
        if (!isActive) {
            setOpen(false)
            reset()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive])

    if (!isActive) return null

    const handlePick = (place: PlaceResult): void => {
        goToPlace(place.anchor)
        setQuery(place.label)
        setOpen(false)
    }

    return (
        <div
            ref={rootRef}
            className="fixed flex flex-col"
            style={{
                top: '8px',
                right: `${rightOffset}px`,
                zIndex: 11,
                width: `${DESKTOP_WIDTH}px`,
            }}
        >
            {/* The shell mirrors the shapes toolbar's chrome exactly — same
                `bg-card-bg` / `border-border-panel` / `rounded-card`, same
                `px-2 py-1` padding around an `h-9` row — so both sit at 46px
                tall on the same 8px top offset and read as one band. Matching
                the toolbar's structure rather than hard-coding a height keeps
                them in step if the toolbar's button size ever changes. */}
            <div className="bg-card-bg border border-border-panel rounded-card px-2 py-1">
                <input
                    type="text"
                    value={query}
                    placeholder="Search a place…"
                    aria-label="Search a place"
                    onChange={(e): void => {
                        setQuery(e.target.value)
                        setOpen(true)
                    }}
                    onFocus={(): void => setOpen(true)}
                    className="w-full h-9 px-1 text-sm bg-transparent text-ink
                        border-0 outline-none placeholder:text-ink-muted"
                />
            </div>

            {open && query.trim() !== '' && (
                <div className="mt-1 bg-card-bg border border-border-panel rounded-card overflow-hidden">
                    {searching && (
                        <div className="px-3 py-2 text-xs text-ink-muted">
                            Searching…
                        </div>
                    )}
                    {!searching && results.length === 0 && (
                        <div className="px-3 py-2 text-xs text-ink-muted">
                            No places found
                        </div>
                    )}
                    {!searching &&
                        results.map((place) => (
                            <button
                                key={place.id}
                                type="button"
                                onClick={(): void => handlePick(place)}
                                className="w-full text-left px-3 py-2 text-xs text-ink
                                    hover:bg-accent/50 cursor-pointer block"
                            >
                                {place.label}
                            </button>
                        ))}
                </div>
            )}
        </div>
    )
}

export default PlaceSearch
