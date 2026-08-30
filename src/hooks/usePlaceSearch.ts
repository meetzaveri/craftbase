// The query→suggestions half of place search, with no opinion about chrome.
//
// Two surfaces ask the same question now: the desktop field pinned to the top
// bar, and the mobile modal behind the menu's "Search a place". They must debounce
// identically (Nominatim's usage policy is a per-client budget, not a per-widget
// one) and abort identically, so the behaviour lives here and each surface only
// decides how it looks.

import { useEffect, useState } from 'react'
import { searchPlaces } from '../utils/placeSearch'
import type { PlaceResult } from '../utils/placeSearch'

/**
 * Debounce before hitting Nominatim. Their usage policy asks for ~1 req/sec, so
 * this is a politeness budget as much as a UX one.
 */
export const PLACE_SEARCH_DEBOUNCE_MS = 450

export interface PlaceSearchApi {
    query: string
    setQuery: (value: string) => void
    results: PlaceResult[]
    searching: boolean
    /** Clear the field and any results — used when the surface closes. */
    reset: () => void
}

export function usePlaceSearch(enabled = true): PlaceSearchApi {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PlaceResult[]>([])
    const [searching, setSearching] = useState(false)

    useEffect(() => {
        const trimmed = query.trim()
        if (!enabled || !trimmed) {
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
        }, PLACE_SEARCH_DEBOUNCE_MS)

        return (): void => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query, enabled])

    const reset = (): void => {
        setQuery('')
        setResults([])
        setSearching(false)
    }

    return { query, setQuery, results, searching, reset }
}
