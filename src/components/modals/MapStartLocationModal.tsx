// "Where should the map open?" — asked once, on a board's first visit to the
// map base, before there is any map content to disturb.
//
// It replaces an automatic `navigator.geolocation` prompt, which asked for a
// precise coordinate the feature never needed, fired with no context the instant
// the user switched base, and silently did nothing at all on some mobile
// browsers. A city name is both less invasive and more useful: it is what a
// person actually thinks in when choosing where to start drawing.
//
// Declining is a first-class answer. The map is ALREADY showing the timezone
// city behind this dialog, so "Skip" is not a dead end — it is an acceptance of
// what is on screen, and the place search in the toolbar can change it any time.

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import Modal from '../common/modal'
import Button from '../common/button'
import { searchPlaces } from '../../utils/placeSearch'
import type { PlaceResult } from '../../utils/placeSearch'
import type { MapAnchor } from '../../bases/types'

/** Matches PlaceSearch: Nominatim asks for ~1 req/sec, so this is politeness. */
const DEBOUNCE_MS = 450

interface MapStartLocationModalProps {
    open: boolean
    /** City we already put them on, named so the fallback isn't a mystery. */
    fallbackCity: string
    /** User picked a place — re-anchor the map there. */
    onPick: (anchor: MapAnchor) => void
    /** User declined — keep the timezone city and stop asking. */
    onSkip: () => void
}

export default function MapStartLocationModal({
    open,
    fallbackCity,
    onPick,
    onSkip,
}: MapStartLocationModalProps): ReactElement {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PlaceResult[]>([])
    const [searching, setSearching] = useState(false)
    const inputRef = useRef<HTMLInputElement | null>(null)

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

    // Focus the field on open so a user who knows their answer can just type.
    useEffect(() => {
        if (!open) return
        const t = setTimeout(() => inputRef.current?.focus(), 200)
        return (): void => clearTimeout(t)
    }, [open])

    return (
        // Closing by any route means "skip" — dismissing the dialog IS declining
        // to choose, and leaving it unanswered would re-ask on the next visit.
        <Modal open={open} onClose={onSkip} locked={false}>
            <div
                className="p-2 text-left"
                style={{ minWidth: '360px', maxWidth: '420px' }}
            >
                <h2 className="text-lg font-semibold mb-1 text-ink">
                    Where are you mapping?
                </h2>
                <p className="text-sm text-ink-mid mb-3">
                    Pick a city, state or country to start from — it only sets
                    the view, and you can move the map any time. We&apos;ve put
                    you near <span className="font-medium">{fallbackCity}</span>{' '}
                    based on your timezone.
                </p>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    placeholder="e.g. Lisbon, or Kerala, or Japan"
                    aria-label="Search for a place to start from"
                    onChange={(e): void => setQuery(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-card bg-card-bg text-ink
                        border border-border-panel outline-none
                        placeholder:text-ink-muted focus:border-accent"
                />

                {query.trim() !== '' && (
                    <div className="mt-1 border border-border-panel rounded-card overflow-hidden max-h-48 overflow-y-auto">
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
                                    onClick={(): void => onPick(place.anchor)}
                                    className="w-full text-left px-3 py-2 text-xs text-ink
                                        hover:bg-accent/50 cursor-pointer block"
                                >
                                    {place.label}
                                </button>
                            ))}
                    </div>
                )}

                <div className="flex gap-2 mt-4">
                    <Button
                        intent="secondary"
                        size="medium"
                        label={`Skip, use ${fallbackCity}`}
                        onClick={onSkip}
                    />
                </div>
            </div>
        </Modal>
    )
}
