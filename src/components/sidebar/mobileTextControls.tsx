// Mobile controls for editing an element's text.
//
// Two states, one corner:
//
//   • Editing → ✓ / ✗. A phone has no Enter or Escape, so the only way out of
//     an open label editor was to tap somewhere else and hope that counted as
//     "done" — and there was no way at all to abandon an edit. Mirrors the ✓/✗
//     the multi-click geo draw already puts in this slot.
//   • A text element selected, not editing → ✏️. Entering the editor was a
//     double-TAP on a label a few pixels tall; the pencil is the same thing
//     with a target you can hit.
//
// Both talk to the element's own imperative editor through the window events in
// constants/misc.ts — the editors are DOM overlays built inside the Two.js
// element components, with no React surface to reach them by.

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { useBaseContext } from '../../views/Base/baseContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import {
    TEXT_EDIT_CANCEL_EVENT,
    TEXT_EDIT_COMMIT_EVENT,
    TEXT_EDIT_END_EVENT,
    TEXT_EDIT_START_EVENT,
} from '../../constants/misc'
import OkIcon from '../../assets/ok.svg?react'
import CloseIcon from '../../assets/close.svg?react'
// The same pencil the toolbar's freehand tool uses (utils/constants.ts) — one
// pencil in the product, not two.
import PencilIcon from '../../wireframeAssets/pencil.svg?react'

/** Element kinds whose text is edited through an overlay we can drive. */
const EDITABLE_TEXT_TYPES: ReadonlySet<string> = new Set([
    'geoText',
    'point',
    'newText',
])

interface MobileTextControlsProps {
    /** True while a multi-click draw owns this corner with its own ✓/✗. */
    drawInProgress: boolean
}

const MobileTextControls = ({
    drawInProgress,
}: MobileTextControlsProps): ReactElement | null => {
    const { selectedComponent, isRubberMode, isPencilMode } = useBaseContext()
    const { isMobile } = useMediaQueryUtils()

    // Which element's editor is open, if any. Tracked by id rather than a bare
    // boolean so the buttons address exactly that editor — two labels can be on
    // screen and only one of them is being typed into.
    const [editingId, setEditingId] = useState<string | null>(null)

    useEffect(() => {
        const onStart = (e: Event): void => {
            const id = (e as CustomEvent<{ id?: string }>).detail?.id
            setEditingId(id ?? null)
        }
        const onEnd = (): void => setEditingId(null)
        window.addEventListener(TEXT_EDIT_START_EVENT, onStart)
        window.addEventListener(TEXT_EDIT_END_EVENT, onEnd)
        return (): void => {
            window.removeEventListener(TEXT_EDIT_START_EVENT, onStart)
            window.removeEventListener(TEXT_EDIT_END_EVENT, onEnd)
        }
    }, [])

    if (!isMobile) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected = selectedComponent as any
    const selectedId: string | undefined =
        selected?.group?.data?.elementData?.id
    const selectedType: string | undefined =
        selected?.group?.data?.elementData?.componentType

    // Keep the open editor focused: a press that moves focus blurs it, and blur
    // is what commits.
    const keepFocus = (e: { preventDefault: () => void }): void =>
        e.preventDefault()

    const request = (eventName: string): void => {
        window.dispatchEvent(
            new CustomEvent(eventName, { detail: { id: editingId } })
        )
    }

    if (editingId) {
        return (
            <div
                style={{
                    position: 'fixed',
                    bottom: '64px',
                    right: '10px',
                    zIndex: 20,
                }}
                className="flex flex-col gap-2"
            >
                <button
                    type="button"
                    title="Done editing"
                    aria-label="Done editing"
                    // preventDefault on the press, act on the click. Two things
                    // hang on that split. The press must NOT move focus, or the
                    // editor blurs and commits before we can say which of the
                    // two answers this is — ✗ would silently become ✓. And the
                    // action must NOT run on the press, because ending the edit
                    // swaps this button out for the delete button that shares
                    // this slot: the tap's own click then landed on the delete
                    // button that had appeared under the finger, and the
                    // element the user was editing was gone.
                    onPointerDown={keepFocus}
                    onMouseDown={keepFocus}
                    onClick={(): void => request(TEXT_EDIT_COMMIT_EVENT)}
                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-greens-g400 text-white shadow-md transition-colors duration-150"
                >
                    <OkIcon className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    title="Discard changes"
                    aria-label="Discard text changes"
                    onPointerDown={keepFocus}
                    onMouseDown={keepFocus}
                    onClick={(): void => request(TEXT_EDIT_CANCEL_EVENT)}
                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-reds-r400 text-white shadow-md transition-colors duration-150"
                >
                    <CloseIcon className="w-5 h-5" />
                </button>
            </div>
        )
    }

    if (drawInProgress || isRubberMode || isPencilMode) return null
    if (!selectedId || !selectedType) return null
    if (!EDITABLE_TEXT_TYPES.has(selectedType)) return null

    return (
        <button
            type="button"
            title="Edit text"
            aria-label="Edit text"
            onClick={(): void => {
                // The same event placement uses to open a fresh element's
                // editor; point.tsx and geoText.tsx both answer it.
                window.dispatchEvent(
                    new CustomEvent('triggerTextInput', {
                        detail: { elementId: selectedId },
                    })
                )
            }}
            style={{
                position: 'fixed',
                // Above the delete button (64), which is above the
                // element-properties button (16).
                bottom: '112px',
                right: '10px',
                zIndex: 20,
            }}
            className="w-10 h-10 rounded-lg flex items-center justify-center
                bg-card-bg text-ink-mid border border-border-panel shadow-md
                transition-colors duration-150"
        >
            <PencilIcon
                width={18}
                height={18}
                stroke="currentColor"
                color="currentColor"
                aria-hidden="true"
            />
        </button>
    )
}

export default MobileTextControls
