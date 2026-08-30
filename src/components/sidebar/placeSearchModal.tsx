// Place search, as a modal. The mobile face of the same control the desktop
// pins to the top bar (placeSearch.tsx).
//
// A phone's top row has room for the menu, the base switcher and the share
// button — and that is already the whole width. The search field squeezed in
// beside them was a few characters wide, so it moved into the menu: tap "Search
// a place", get a dialog with the field at the top and the suggestions filling
// the screen underneath, which is where a list of place names wants to be on a
// phone anyway.

import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import Modal from '../common/modal'
import { usePlaceSearch } from '../../hooks/usePlaceSearch'
import type { PlaceResult } from '../../utils/placeSearch'

interface PlaceSearchModalProps {
    open: boolean
    onClose: () => void
    onPick: (place: PlaceResult) => void
}

const PlaceSearchModal = ({
    open,
    onClose,
    onPick,
}: PlaceSearchModalProps): ReactElement => {
    const { query, setQuery, results, searching, reset } = usePlaceSearch(open)
    const inputRef = useRef<HTMLInputElement | null>(null)

    // Open with the field focused and empty: the dialog exists to be typed
    // into, and a stale query from last time is noise, not a shortcut.
    useEffect(() => {
        if (!open) {
            reset()
            return
        }
        const timer = setTimeout(() => inputRef.current?.focus(), 120)
        return (): void => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const handlePick = (place: PlaceResult): void => {
        onPick(place)
        onClose()
    }

    return (
        <Modal open={open} onClose={onClose}>
            {/* Bounded by the viewport, not a fixed width: the modal shell caps
                at `100vw - 32px`, and this fills whatever that leaves on a
                phone while staying a normal dialog on a desktop. */}
            <div className="w-[min(420px,calc(100vw-72px))] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-ink m-0">
                        Search a place
                    </h2>
                    <button
                        type="button"
                        aria-label="Close search"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded
                            text-ink-muted hover:bg-accent/50 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    placeholder="Search a place…"
                    aria-label="Search a place"
                    onChange={(e): void => setQuery(e.target.value)}
                    onKeyDown={(e): void => {
                        // Enter takes the first suggestion — on a phone that
                        // saves a deliberate tap into a list that has only just
                        // finished loading.
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        const first = results[0]
                        if (first) handlePick(first)
                    }}
                    className="w-full h-11 px-3 text-base bg-card-bg text-ink rounded-card
                        border border-border-panel outline-none
                        placeholder:text-ink-muted focus:border-accent-dark"
                />

                {/* Scrolls inside the dialog rather than growing it past the
                    modal's 85vh cap, so the field stays put while the list moves. */}
                <div className="mt-2 max-h-[50vh] overflow-y-auto">
                    {query.trim() !== '' && searching && (
                        <div className="px-1 py-3 text-sm text-ink-muted">
                            Searching…
                        </div>
                    )}
                    {query.trim() !== '' &&
                        !searching &&
                        results.length === 0 && (
                            <div className="px-1 py-3 text-sm text-ink-muted">
                                No places found
                            </div>
                        )}
                    {!searching &&
                        results.map((place) => (
                            <button
                                key={place.id}
                                type="button"
                                onClick={(): void => handlePick(place)}
                                className="w-full text-left px-3 py-3 text-sm text-ink
                                    border-b border-border-panel last:border-b-0
                                    hover:bg-accent/50 active:bg-accent/50 cursor-pointer block"
                            >
                                {place.label}
                            </button>
                        ))}
                </div>
            </div>
        </Modal>
    )
}

export default PlaceSearchModal
