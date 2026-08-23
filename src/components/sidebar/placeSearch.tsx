import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useBaseContext } from '../../views/Base/baseContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import {
    BASE_TYPE_SWITCHER_ID,
    MENU_BUTTON_ID,
    SHARE_BUTTON_ID,
} from './shapesToolbarId'
import { searchPlaces } from '../../utils/placeSearch'
import type { PlaceResult } from '../../utils/placeSearch'

/**
 * Debounce before hitting Nominatim. Their usage policy asks for ~1 req/sec, so
 * this is a politeness budget as much as a UX one.
 */
const DEBOUNCE_MS = 450

/** Desktop width. Mobile takes whatever the top row has left instead. */
const DESKTOP_WIDTH = 260
/** Gap between the base switcher and the search field on mobile. */
const MOBILE_GAP = 8
/** Frames to keep re-measuring the switcher while it settles. */
const MEASURE_RETRIES = 10
/**
 * Where the mobile field starts before the switcher has been measured. Roughly
 * menu + switcher + gaps, so the field is usable on the very first frame
 * instead of collapsing to zero width and then popping into place.
 */
const MOBILE_FALLBACK_LEFT = 160
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
 */
const PlaceSearch = (): ReactElement | null => {
    const { activeBaseType, goToPlace } = useBaseContext()
    const { isMobile } = useMediaQueryUtils()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PlaceResult[]>([])
    const [searching, setSearching] = useState(false)
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)

    /**
     * Mobile only: start just past the base switcher so the top row reads
     * menu → switcher → search, and take the rest of the width.
     *
     * Measured rather than a `calc()` against a hard-coded switcher width,
     * because that width changes with the active base's label ("Board" vs
     * "Map"). The retry window covers the first frames: the switcher positions
     * itself from its own layout effect, so a single measurement here can read
     * it while it is still parked off-screen at its pre-measurement -9999.
     */
    const [leftOffset, setLeftOffset] = useState<number | null>(null)
    useLayoutEffect(() => {
        if (!isMobile || activeBaseType !== 'map') {
            setLeftOffset(null)
            return
        }
        let frame = 0
        let cancelled = false
        const measure = (): void => {
            if (cancelled) return
            // The switcher is absent on a pinned route (`/map/:id`), where the
            // URL already names the type. Fall back to the menu button so the
            // field starts just past whatever IS there, rather than leaving a
            // switcher-sized hole where no switcher exists.
            const el =
                document.getElementById(BASE_TYPE_SWITCHER_ID) ??
                document.getElementById(MENU_BUTTON_ID)
            const rect = el?.getBoundingClientRect()
            if (rect && rect.left >= 0) {
                setLeftOffset(rect.right + MOBILE_GAP)
            }
            if (frame++ < MEASURE_RETRIES) requestAnimationFrame(measure)
        }
        measure()
        window.addEventListener('resize', measure)
        return (): void => {
            cancelled = true
            window.removeEventListener('resize', measure)
        }
    }, [isMobile, activeBaseType])

    /**
     * Keep clear of the share button, which shares this corner.
     *
     * Measured, not a constant, for the same reason the mobile offset is: the
     * share control's width is not this component's to know, and a hard-coded
     * guess silently overlaps the moment its padding changes. Falls back to the
     * bare right margin when there is no share button to avoid.
     */
    const [rightOffset, setRightOffset] = useState<number>(RIGHT_MARGIN)
    useLayoutEffect(() => {
        if (activeBaseType !== 'map') {
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
                    ? window.innerWidth - rect.left + MOBILE_GAP
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
    }, [activeBaseType])

    useEffect(() => {
        const trimmed = query.trim()
        if (!trimmed) {
            setResults([])
            setSearching(false)
            return
        }

        setSearching(true)
        const controller = new AbortController()
        const timer = setTimeout(() => {
            void searchPlaces(trimmed, controller.signal).then((found) => {
                if (controller.signal.aborted) return
                setResults(found)
                setSearching(false)
            })
        }, DEBOUNCE_MS)

        return (): void => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query])

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
        if (activeBaseType !== 'map') {
            setOpen(false)
            setQuery('')
            setResults([])
        }
    }, [activeBaseType])

    if (activeBaseType !== 'map') return null

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
                // Desktop: a fixed field hugging the right edge. Mobile: span
                // from the switcher to the right margin, so the three top-row
                // controls share the width instead of overlapping.
                ...(isMobile
                    ? { left: leftOffset ?? MOBILE_FALLBACK_LEFT }
                    : { width: `${DESKTOP_WIDTH}px` }),
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
