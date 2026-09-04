import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_BOARD_COMPONENT_COUNT_QUERY } from '../schema/queries'
import {
    PERFORMANCE_WARNING_THRESHOLD,
    countBoardElements,
} from '../utils/countBoardElements'
import type { ComponentStore } from '../types/board'

interface UseElementCountWarningArgs {
    componentStore: ComponentStore
    isPersisted: boolean
    boardId: string
}

interface UseElementCountWarningResult {
    showPerfWarning: boolean
    dismissPerfWarning: () => void
}

/**
 * Warns once when a board grows past the point where the canvas starts to feel
 * slow — either by crossing the threshold live, or by opening/refreshing a
 * board that is already over it.
 *
 * Two sources feed the same one-shot latch:
 *   - saved boards: a server-side aggregate count, which lands well before the
 *     full component store has loaded and mounted, so the user is warned
 *     *before* the slow render rather than after it.
 *   - both modes: the live component store, for crossings during a session.
 *
 * The latch re-arms if the board drops back under the threshold, so a user who
 * deletes their way down and builds back up is warned again.
 */
export const useElementCountWarning = ({
    componentStore,
    isPersisted,
    boardId,
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

    // Saved boards: authoritative count straight from the server.
    const { data: countData } = useQuery(GET_BOARD_COMPONENT_COUNT_QUERY, {
        variables: { boardId },
        fetchPolicy: 'network-only',
        skip: !isPersisted || !boardId,
    })

    useEffect(() => {
        const count = countData?.components?.aggregate?.count
        if (count != null && count > PERFORMANCE_WARNING_THRESHOLD) warnOnce()
    }, [countData, warnOnce])

    // Live crossings during a session.
    useEffect(() => {
        const count = countBoardElements(componentStore)
        if (count > PERFORMANCE_WARNING_THRESHOLD) {
            warnOnce()
        } else if (count > 0) {
            // Re-arm only on a real drop below the threshold. An empty store
            // means the board hasn't loaded yet, and disarming against it would
            // let the aggregate's warning fire a second time once rows arrive.
            hasWarnedRef.current = false
        }
    }, [componentStore, warnOnce])

    return { showPerfWarning, dismissPerfWarning }
}
