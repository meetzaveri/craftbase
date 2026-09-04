import React, { Suspense } from 'react'
import ErrorBoundary from './errorBoundary'
import Spinner from '../../components/common/spinner'

const EmbeddablePage = React.lazy(() => import('./embeddable'))

const EmbeddableViewContainer: React.FC = (props) => (
    <Suspense fallback={<Spinner />}>
        <ErrorBoundary>
            <EmbeddablePage {...props} />
        </ErrorBoundary>
    </Suspense>
)

export default EmbeddableViewContainer
