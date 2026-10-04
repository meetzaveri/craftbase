import React from 'react'
import type { ReactElement } from 'react'

import CurvedArrowFactory from '../../factory/curvedArrow'
import CurvedPathElement from '../utils/curvedPathElement'

// A multi-point curved line with an arrowhead on its last vertex. All behavior
// lives in CurvedPathElement, shared with curvedLine.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CurvedArrow(props: any): ReactElement {
    return <CurvedPathElement {...props} factory={CurvedArrowFactory} />
}

export default CurvedArrow
