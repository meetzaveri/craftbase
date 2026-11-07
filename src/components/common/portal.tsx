import React from 'react'
import ReactDOM from 'react-dom'
import type { ReactNode, ReactPortal } from 'react'
import { getPortalRoot } from '../../utils/embedRoot'

interface PortalProps {
    children: ReactNode
    parent?: HTMLElement | null
    className?: string
}

export default function Portal({
    children,
    parent,
    className,
}: PortalProps): ReactPortal {
    const el = React.useMemo(() => document.createElement('div'), [])
    React.useEffect(() => {
        const target = parent ?? getPortalRoot()
        const classList = ['portal-container']
        if (className)
            className.split(' ').forEach((item) => classList.push(item))
        classList.forEach((item) => el.classList.add(item))
        target.appendChild(el)
        return (): void => {
            target.removeChild(el)
        }
    }, [el, parent, className])
    return ReactDOM.createPortal(children, el)
}
