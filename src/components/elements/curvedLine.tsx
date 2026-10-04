import React from 'react'
import type { ReactElement } from 'react'

import CurvedLineFactory from '../../factory/curvedLine'
import CurvedPathElement from '../utils/curvedPathElement'

// A multi-point curved line. All behavior lives in CurvedPathElement, shared
// with curvedArrow.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CurvedLine(props: any): ReactElement {
    return <CurvedPathElement {...props} factory={CurvedLineFactory} />
}

export default CurvedLine
