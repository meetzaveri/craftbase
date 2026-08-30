import React, { Suspense } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'

import ErrorBoundary from './errorBoundary'
import CraftbaseLoader from '../../components/common/craftbaseLoader'
import { GET_COMPONENTS_FOR_BASE_QUERY } from '../../schema/queries'
import { normalizeServerBaseConfig } from '../../baseTypes/serverConfig'
import { baseTypePath } from '../../utils/baseRoutes'
import './index.css'
import type { BaseProps } from '../../types/base'

const BaseViewPage = React.lazy(() => import('./base'))

// Loading gate lives here, NOT inside BaseViewPage. BaseViewPage runs
// hundreds of hooks; an early `return <Spinner/>` mid-component (gated on the
// persisted-base query's `loading`) truncated its hook list on the first
// render and restored it on the next, throwing "Rendered more hooks than
// during the previous render". Deciding loading in this parent keeps
// BaseViewPage's hook order invariant. BaseViewPage's own copy of this
// query (same vars, cache-first) then resolves from cache instantly.
//
// The gate carries a second load now: the query also returns the base ROW, and
// its `type` and `mapAnchor` must be settled before the canvas mounts. The
// canvas restores the camera under a per-type viewport key, clamps it to
// per-type zoom limits, and hands the anchor to the map provider — all in its
// mount effect, none of it revisited. A base type that arrived a beat later
// would restore the wrong camera and mount the map on the wrong geography.
const BaseViewContainer: React.FC<BaseProps> = (props) => {
    const { id: baseIdFromUrl } = useParams()
    const location = useLocation()
    const isPersisted = !!baseIdFromUrl

    const { loading, data } = useQuery(GET_COMPONENTS_FOR_BASE_QUERY, {
        variables: { baseId: baseIdFromUrl ?? '' },
        fetchPolicy: 'cache-first',
        skip: !isPersisted,
    })

    const serverBaseConfig = normalizeServerBaseConfig(data?.base)

    if (isPersisted && loading) {
        return (
            <Suspense fallback={<CraftbaseLoader />}>
                <ErrorBoundary>
                    <CraftbaseLoader caption="loading your canvas" />
                </ErrorBoundary>
            </Suspense>
        )
    }

    // One canonical URL per base: a map-typed base always lives at /map/:id.
    // Redirecting here — before BaseViewPage is even lazy-loaded — means no
    // canvas has mounted yet, so there is no half-built camera to leave behind.
    //
    // Only ever redirects AWAY from an unpinned route, never from /map/:id
    // itself, so the two routes can't bounce off each other. The query string
    // is carried across or a legacy `?vx&vy&vs` share link would lose its
    // viewport hand-off in transit.
    if (
        isPersisted &&
        !props.pinnedBaseType &&
        serverBaseConfig?.type === 'map' &&
        baseIdFromUrl
    ) {
        return (
            <Navigate
                replace
                to={{
                    pathname: baseTypePath(baseIdFromUrl, 'map'),
                    search: location.search,
                }}
            />
        )
    }

    return (
        <Suspense fallback={<CraftbaseLoader />}>
            <ErrorBoundary>
                <BaseViewPage {...props} serverBaseConfig={serverBaseConfig} />
            </ErrorBoundary>
        </Suspense>
    )
}

export default BaseViewContainer
