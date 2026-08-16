// Delete the current selection, on mobile.
//
// Desktop deletes with the Delete/Backspace key; a phone has no such key, so
// the only way to remove something you had drawn was to undo your way back to
// it. This is that missing affordance — and nothing more: it presses the same
// key the desktop user presses (see dispatchDeleteKey), so the two can't drift.
//
// It appears only for a SELECTION, never as part of drawing. Being mid-draw is
// not being mid-edit: offering "delete" while the user is still placing vertices
// would sit exactly where the ✓/✗ draw controls go and mean something different
// from both of them.

import type { ReactElement } from 'react'
import { useBoardContext } from '../../views/Board/boardContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import { dispatchDeleteKey } from '../../utils/deleteKey'

const TrashIcon = (): ReactElement => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
    >
        <path
            d="M2 3.5h10M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M6 6v4M8 6v4M3 3.5l.7 7a1 1 0 001 .9h4.6a1 1 0 001-.9l.7-7"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

interface MobileDeleteButtonProps {
    /** True while a multi-click draw owns this corner with its ✓/✗ controls. */
    drawInProgress: boolean
}

const MobileDeleteButton = ({
    drawInProgress,
}: MobileDeleteButtonProps): ReactElement | null => {
    const {
        selectedComponent,
        selectedGroup,
        isRubberMode,
        isPencilMode,
        isArrowDrawMode,
        isTextDrawMode,
        deleteComponentFromLocalStore,
        stateRefForComponentStore,
    } = useBoardContext()
    const { isMobile } = useMediaQueryUtils()

    if (!isMobile) return null
    if (drawInProgress) return null
    // Any live draw tool means the user is creating, not editing.
    if (isRubberMode || isPencilMode || isArrowDrawMode || isTextDrawMode) {
        return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = selectedGroup as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const single = selectedComponent as any
    if (!group && !single) return null

    // The selected element's own SVG node. Several delete handlers are bound
    // there rather than to the window, and on mobile the synthetic mouse events
    // never move browser focus — so aiming the key at the node is what makes
    // arrows, lines, geoText and groups deletable at all.
    const nodeId: string | undefined = group?.id ?? single?.group?.id

    // The store id of a single selection, used by the safety net below.
    const singleId: string | undefined = group
        ? undefined
        : single?.group?.data?.elementData?.id

    const handleDelete = (): void => {
        // Commit any open text editor FIRST.
        //
        // Every delete handler refuses to fire while an INPUT/TEXTAREA holds
        // focus — otherwise typing "delete" into a label would wipe the element
        // you were labelling. That guard is right for a keystroke and wrong for
        // this button, which is an unambiguous "remove this". So instead of
        // bypassing the guard we satisfy it: blurring commits the edit, exactly
        // as tapping away would, and then the delete proceeds.
        const focused = document.activeElement as HTMLElement | null
        const tag = focused?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') focused?.blur()

        const node = nodeId ? document.getElementById(nodeId) : null
        dispatchDeleteKey(node)

        // Safety net. The key is claimed by whichever owner holds the selection,
        // and several of them are bound to a focused SVG node — but mobile's
        // synthetic mouse events never move browser focus, so the key can land
        // with nobody listening and fail silently. Rather than trust that, check
        // afterwards: if the record is still in the store, remove it here.
        //
        // Deliberately a store delete and nothing more. Dropping the record
        // unmounts the element component, whose cleanup owns `two.remove` — so
        // this stays the single teardown owner CLAUDE.md's subtractions note
        // calls for, instead of competing with it.
        if (!singleId) return
        requestAnimationFrame(() => {
            if (!stateRefForComponentStore?.current?.[singleId]) return
            deleteComponentFromLocalStore?.(singleId)
            window.dispatchEvent(new CustomEvent('clearSelector', {}))
        })
    }

    return (
        <button
            type="button"
            title="Delete selection"
            aria-label="Delete selection"
            onClick={handleDelete}
            style={{
                position: 'fixed',
                // Directly above the element-properties button, which sits at
                // bottom 16. Same slot the draw controls use — they are mutually
                // exclusive with a selection, which is why this hides for them.
                bottom: '64px',
                right: '10px',
                zIndex: 20,
            }}
            className="w-10 h-10 rounded-lg flex items-center justify-center
                bg-reds-r400 text-white shadow-md transition-colors duration-150"
        >
            <TrashIcon />
        </button>
    )
}

export default MobileDeleteButton
