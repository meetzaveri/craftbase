import React, { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'

import ErrorBoundary from './errorBoundary'
import CraftbaseLoader from '../../components/common/craftbaseLoader'
import { GET_COMPONENTS_FOR_BOARD_QUERY } from '../../schema/queries'
import './index.css'
import type { BoardProps } from '../../types/board'

const BoardViewPage = React.lazy(() => import('./board'))

// Loading gate lives here, NOT inside BoardViewPage. BoardViewPage runs
// hundreds of hooks; an early `return <Spinner/>` mid-component (gated on the
// persisted-board query's `loading`) truncated its hook list on the first
// render and restored it on the next, throwing "Rendered more hooks than
// during the previous render". Deciding loading in this parent keeps
// BoardViewPage's hook order invariant. BoardViewPage's own copy of this
// query (same vars, cache-first) then resolves from cache instantly.
const BoardViewContainer: React.FC<BoardProps> = (props) => {
    const { id: boardIdFromUrl } = useParams()
    const isPersisted = !!boardIdFromUrl

    const { loading } = useQuery(GET_COMPONENTS_FOR_BOARD_QUERY, {
        variables: { boardId: boardIdFromUrl ?? '' },
        fetchPolicy: 'cache-first',
        skip: !isPersisted,
    })

    return (
        <Suspense fallback={<CraftbaseLoader />}>
            <ErrorBoundary>
                {isPersisted && loading ? (
                    <CraftbaseLoader caption="loading your board" />
                ) : (
                    <BoardViewPage {...props} />
                )}
            </ErrorBoundary>
        </Suspense>
    )
}

export default BoardViewContainer
