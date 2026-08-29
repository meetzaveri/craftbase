// "Where should the map open?" — asked once, on a base's first visit to the
// map base, before there is any map content to disturb.
//
// Two doors, offered rather than forced:
//
//   1. Use my current location — hands off to the browser's own permission
//      sheet. This is NOT the automatic geolocation prompt this modal once
//      replaced: it fires from a tap, so the sheet arrives with context, and
//      every failure lands on the timezone city with an explanation instead of
//      a dead end. See `utils/geolocation.ts`.
//   2. Search for a place — the original flow, unchanged. A city name is what a
//      person actually thinks in when choosing where to start drawing.
//
// Declining stays a first-class answer at every step. The map is ALREADY
// showing the timezone city behind this dialog, so dismissing is not a dead end
// — it is acceptance of what is on screen, and the place search in the toolbar
// can change it any time.

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import Modal from '../common/modal'
import Button from '../common/button'
import OriginIcon from '../../assets/origin.svg?react'
import SearchIcon from '../../assets/search.svg?react'
import { searchPlaces } from '../../utils/placeSearch'
import { requestCurrentLocation } from '../../utils/geolocation'
import type { GeolocationFailure } from '../../utils/geolocation'
import type { PlaceResult } from '../../utils/placeSearch'
import type { MapAnchor } from '../../baseTypes/types'

/** Matches PlaceSearch: Nominatim asks for ~1 req/sec, so this is politeness. */
const DEBOUNCE_MS = 450

/** Which face of the dialog is showing. */
type Step = 'choose' | 'locating' | 'search'

interface MapStartLocationModalProps {
    open: boolean
    /** City we already put them on, named so the fallback isn't a mystery. */
    fallbackCity: string
    /** User picked a place — re-anchor the map there and close. */
    onPick: (anchor: MapAnchor) => void
    /** User declined — keep the timezone city and stop asking. */
    onSkip: () => void
    /**
     * A location lookup failed. Commits the timezone city as the real anchor so
     * the base is settled either way, but leaves the dialog open so the user can
     * still search — a denied permission must not become a dead end.
     */
    onFallbackToTimezone: () => void
}

/** Explanations, in the user's terms. Never blames them for declining. */
const FAILURE_COPY: Record<GeolocationFailure, string> = {
    denied: 'No problem — location is off, so we’ve started you near',
    timeout: 'Your browser didn’t answer in time, so we’ve started you near',
    unavailable:
        'Your browser can’t share a location here, so we’ve started you near',
}

export default function MapStartLocationModal({
    open,
    fallbackCity,
    onPick,
    onSkip,
    onFallbackToTimezone,
}: MapStartLocationModalProps): ReactElement {
    const [step, setStep] = useState<Step>('choose')
    const [failure, setFailure] = useState<GeolocationFailure | null>(null)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PlaceResult[]>([])
    const [searching, setSearching] = useState(false)
    const inputRef = useRef<HTMLInputElement | null>(null)
    // The dialog can close while a lookup is still outstanding; a late resolve
    // must not commit an anchor to a base the user has already moved on from.
    const liveRef = useRef(true)

    useEffect(() => {
        liveRef.current = open
        // Reopening on another base starts from the choice again.
        if (!open) {
            setStep('choose')
            setFailure(null)
            setQuery('')
        }
    }, [open])

    useEffect(() => {
        return (): void => {
            liveRef.current = false
        }
    }, [])

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

    // Focus the field when the search step opens, so a user who knows their
    // answer can just type.
    useEffect(() => {
        if (!open || step !== 'search') return
        const t = setTimeout(() => inputRef.current?.focus(), 200)
        return (): void => clearTimeout(t)
    }, [open, step])

    const handleUseCurrentLocation = async (): Promise<void> => {
        setStep('locating')
        setFailure(null)
        const outcome = await requestCurrentLocation()
        if (!liveRef.current) return

        if (outcome.ok) {
            onPick(outcome.anchor)
            return
        }
        // Settle the base on the timezone city right away, then drop the user
        // into search so the failure costs them nothing.
        setFailure(outcome.reason)
        setStep('search')
        onFallbackToTimezone()
    }

    return (
        // Closing by any route means "skip" — dismissing the dialog IS declining
        // to choose, and leaving it unanswered would re-ask on the next visit.
        <Modal open={open} onClose={onSkip} locked={false}>
            <div
                className="p-2 text-left"
                style={{
                    minWidth: 'min(360px, calc(100vw - 96px))',
                    maxWidth: '420px',
                }}
            >
                <h2 className="text-lg font-semibold mb-1 text-ink">
                    Where are you mapping?
                </h2>

                {step === 'choose' && (
                    <>
                        <p className="text-sm text-ink-mid mb-4">
                            This only sets your starting view — you can move the
                            map any time.
                        </p>

                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={(): void => {
                                    void handleUseCurrentLocation()
                                }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-card
                                    border border-border-panel bg-card-bg text-left
                                    text-sm text-ink hover:border-accent cursor-pointer"
                            >
                                <OriginIcon
                                    width={20}
                                    height={20}
                                    strokeWidth={1.6}
                                    // The asset hardcodes a blue stroke AND its
                                    // own `color`, so `stroke="currentColor"`
                                    // alone would resolve against that blue.
                                    // Overriding `color` first makes it inherit
                                    // the button's ink. SVGR spreads props after
                                    // the original attrs, so these win.
                                    color="currentColor"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                    focusable="false"
                                    className="shrink-0"
                                />
                                <span className="flex flex-col">
                                    <span className="font-medium">
                                        Use my current location
                                    </span>
                                    <span className="text-xs text-ink-muted">
                                        Your browser will ask permission first
                                    </span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={(): void => setStep('search')}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-card
                                    border border-border-panel bg-card-bg text-left
                                    text-sm text-ink hover:border-accent cursor-pointer"
                            >
                                <SearchIcon
                                    width={20}
                                    height={20}
                                    strokeWidth={1.6}
                                    color="currentColor"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                    focusable="false"
                                    className="shrink-0"
                                />
                                <span className="flex flex-col">
                                    <span className="font-medium">
                                        No, let me search
                                    </span>
                                    <span className="text-xs text-ink-muted">
                                        Pick a city, state or country
                                    </span>
                                </span>
                            </button>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <Button
                                intent="secondary"
                                size="medium"
                                label={`Skip, use ${fallbackCity}`}
                                onClick={onSkip}
                            />
                        </div>
                    </>
                )}

                {step === 'locating' && (
                    <div className="py-6 flex flex-col items-center gap-3 text-center">
                        <div
                            className="h-6 w-6 rounded-full border-2 border-border-panel
                                border-t-accent animate-spin"
                            aria-hidden="true"
                        />
                        <p className="text-sm text-ink-mid">
                            Waiting for your browser’s location permission…
                        </p>
                        <button
                            type="button"
                            onClick={(): void => setStep('search')}
                            className="text-xs text-ink-muted underline cursor-pointer"
                        >
                            Search for a place instead
                        </button>
                    </div>
                )}

                {step === 'search' && (
                    <>
                        {failure !== null ? (
                            <p className="text-sm text-ink-mid mb-3">
                                {FAILURE_COPY[failure]}{' '}
                                <span className="font-medium">
                                    {fallbackCity}
                                </span>
                                . Search below to start somewhere else.
                            </p>
                        ) : (
                            <p className="text-sm text-ink-mid mb-3">
                                Pick a city, state or country to start from — it
                                only sets the view, and you can move the map any
                                time. We’ve put you near{' '}
                                <span className="font-medium">
                                    {fallbackCity}
                                </span>{' '}
                                based on your timezone.
                            </p>
                        )}

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
                                            onClick={(): void =>
                                                onPick(place.anchor)
                                            }
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
                    </>
                )}
            </div>
        </Modal>
    )
}
