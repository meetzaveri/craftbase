import { Navigate, useParams } from 'react-router-dom'
import type { ReactElement } from 'react'

/**
 * Permanent redirect from the pre-rename `/board/:id` to `/base/:id`.
 *
 * Every link shared before the rename points at `/board/<uuid>`, and the uuid
 * still resolves — the migration renamed the table, not the rows. `replace`
 * keeps the dead path out of the back-button history.
 */
const LegacyBaseRedirect = (): ReactElement => {
    const { id } = useParams()
    return <Navigate to={id ? `/base/${id}` : '/'} replace />
}

export default LegacyBaseRedirect
