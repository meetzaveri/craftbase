import React from 'react'
import type { ReactElement, ReactNode } from 'react'
import styled from 'styled-components'

import Portal from './portal'

const Backdrop = styled.div`
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    /* Above every piece of canvas chrome, so an open modal actually OWNS the
       screen. Without a stacking order of its own the backdrop painted below
       the toolbars (z-index 10–20) and the toast (50): the dimmed page still
       took clicks, so the base switcher, menu, share, primary toolbar and the
       element-properties button all stayed live behind a modal that had the
       user's full attention. Kept under the dev perf overlay (10000). */
    z-index: 1000;
    background-color: rgba(51, 51, 51, 0.3);
    backdrop-filter: blur(1px);
    opacity: 0;
    transition: all 100ms cubic-bezier(0.4, 0, 0.2, 1);
    transition-delay: 200ms;
    display: flex;
    align-items: center;
    justify-content: center;

    & .modal-content {
        transform: translateY(100px);
        transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
    }

    &.active {
        transition-duration: 250ms;
        transition-delay: 0ms;
        opacity: 1;

        & .modal-content {
            transform: translateY(0);
            opacity: 1;
            transition-delay: 150ms;
            transition-duration: 350ms;
        }
    }
`

const Content = styled.div`
    position: relative;
    padding: 20px;
    box-sizing: border-box;
    min-height: 50px;
    min-width: 50px;
    /* Phones, not just desktop. A max-width of 80% left a 390px screen a 312px
       box, and once the 20px padding came off, 272px of usable width — less
       than the 400-440px minWidths the modal bodies ask for, so their content
       spilled out of the rounded box. Bound to the viewport instead and let
       each body cap its own width (they all do). The overflow rule is the
       other half: max-height used to clip tall content with no way to reach
       it. NB: no backticks in here — this is a template literal. */
    max-height: 85vh;
    max-width: calc(100vw - 32px);
    overflow: auto;
    box-shadow:
        0 3px 6px rgba(0, 0, 0, 0.16),
        0 3px 6px rgba(0, 0, 0, 0.23);
    background-color: white;
    border-radius: 2px;
`

export interface ModalProps {
    open: boolean
    onClose: () => void
    locked?: boolean
    children?: ReactNode
}

export default function Modal(props: ModalProps): ReactElement {
    const [active, setActive] = React.useState(false)
    const { open, onClose, locked } = props
    const backdrop = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const { current } = backdrop

        const transitionEnd = (): void => setActive(open)

        const keyHandler = (e: KeyboardEvent): void => {
            if (!locked && e.which === 27) onClose()
        }

        const clickHandler = (e: MouseEvent): void => {
            if (!locked && e.target === current) onClose()
        }

        if (current) {
            current.addEventListener('transitionend', transitionEnd)
            current.addEventListener('click', clickHandler)
            window.addEventListener('keyup', keyHandler)
        }

        if (open) {
            window.setTimeout(() => {
                ;(document.activeElement as HTMLElement | null)?.blur()
                setActive(open)
            }, 10)
        }

        return (): void => {
            if (current) {
                current.removeEventListener('transitionend', transitionEnd)
                current.removeEventListener('click', clickHandler)
            }
            window.removeEventListener('keyup', keyHandler)
        }
        // `active` MUST be a dependency even though the body only reads `open`.
        //
        // The backdrop is rendered while `open || active`, so closing goes
        // open:false (still rendered, listeners re-attached) → transitionend →
        // active:false (unmounted). That last step changes no dependency, so
        // without `active` here the effect never re-runs, its cleanup never
        // runs, and the window-level Escape handler survives the modal it
        // belonged to — for the whole session, holding the old `onClose`.
        //
        // Harmless while every onClose merely set some state to false. It
        // stopped being harmless once one of them had a side effect: the map's
        // first-run location prompt writes an anchor on dismiss, so a stray
        // Escape long after it closed (finishing an area/route draw, say)
        // silently moved the user's map.
    }, [open, active, locked, onClose])

    return (
        <React.Fragment>
            {(open || active) && (
                <Portal className="modal-portal">
                    <Backdrop
                        ref={backdrop}
                        className={active && open ? 'active' : ''}
                    >
                        <Content className="modal-content">
                            {props.children}
                        </Content>
                    </Backdrop>
                </Portal>
            )}
        </React.Fragment>
    )
}
