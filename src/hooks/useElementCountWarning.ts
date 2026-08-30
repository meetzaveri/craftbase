import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_BASE_COMPONENT_COUNT_QUERY } from '../schema/queries'
import {
    PERFORMANCE_WARNING_THRESHOLD,
    countBaseElements,
} from '../utils/countBaseElements'
import type { ComponentStore } from '../types/base'

interface UseElementCountWarningArgs {
    componentStore: ComponentStore
    isPersisted: boolean
    baseId: string
}

interface UseElementCountWarningResult {
    showPerfWarning: boolean
    dismissPerfWarning: () => void
}

/**
 * Warns once when a base grows past the point where the canvas starts to feel
 * slow — either by crossing the threshold live, or by opening/refreshing a
 * base that is already over it.
 *
 * Two sources feed the same one-shot latch:
 *   - saved bases: a server-side aggregate count, which lands well before the
 *     full component store has loaded and mounted, so the user is warned
 *     *before* the slow render rather than after it.
 *   - both modes: the live component store, for crossings during a session.
 *
 * The latch re-arms if the base drops back under the threshold, so a user who
 * deletes their way down and builds back up is warned again.
 */
export const useElementCountWarning = ({
    componentStore,
    isPersisted,
    baseId,
}: UseElementCountWarningArgs): UseElementCountWarningResult => {
    const [showPerfWarning, setShowPerfWarning] = useState(false)
    const hasWarnedRef = useRef(false)

    const warnOnce = useCallback((): void => {
        if (hasWarnedRef.current) return
        hasWarnedRef.current = true
        setShowPerfWarning(true)
    }, [])

    const dismissPerfWarning = useCallback((): void => {
        setShowPerfWarning(false)
    }, [])

    // Saved bases: authoritative count straight from the server.
    const { data: countData } = useQuery(GET_BASE_COMPONENT_COUNT_QUERY, {
        variables: { baseId },
        fetchPolicy: 'network-only',
        skip: !isPersisted || !baseId,
    })

    useEffect(() => {
        const count = countData?.components?.aggregate?.count
        if (count != null && count > PERFORMANCE_WARNING_THRESHOLD) warnOnce()
    }, [countData, warnOnce])

    // Live crossings during a session.
    useEffect(() => {
        const count = countBaseElements(componentStore)
        if (count > PERFORMANCE_WARNING_THRESHOLD) {
            warnOnce()
        } else if (count > 0) {
            // Re-arm only on a real drop below the threshold. An empty store
            // means the base hasn't loaded yet, and disarming against it would
            // let the aggregate's warning fire a second time once rows arrive.
            hasWarnedRef.current = false
        }
    }, [componentStore, warnOnce])

    return { showPerfWarning, dismissPerfWarning }
}
