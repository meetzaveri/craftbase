import type { ReactElement } from 'react'
import Modal from '../common/modal'
import { isMac } from '../../utils/misc'

interface ShortcutsModalProps {
    open: boolean
    onClose: () => void
}

// A key token is either a literal cap ('Z', '[', 'Enter') or a symbolic
// modifier that resolves per-OS. Keeping them as tokens (not pre-joined
// strings) lets us render each as its own <kbd> chip and swap the mac/other
// glyphs in one place. Mirrors the metaKey-on-mac / ctrlKey-elsewhere split the
// keyboard handlers use (see newCanvas.tsx + useCanvasClipboard.ts).
type KeyToken =
    | { type: 'mod' } // ⌘ on mac, Ctrl elsewhere
    | { type: 'shift' }
    | { type: 'alt' } // ⌥ on mac, Alt elsewhere
    | { type: 'key'; label: string }

const mod = (): KeyToken => ({ type: 'mod' })
const shift = (): KeyToken => ({ type: 'shift' })
const alt = (): KeyToken => ({ type: 'alt' })
const key = (label: string): KeyToken => ({ type: 'key', label })

const tokenLabel = (token: KeyToken): string => {
    switch (token.type) {
        case 'mod':
            return isMac ? '⌘' : 'Ctrl'
        case 'shift':
            // Always spelled out as the word "Shift" (not the ⇧ glyph), on all
            // platforms, per product preference.
            return 'Shift'
        case 'alt':
            return isMac ? '⌥' : 'Alt'
        case 'key':
            return token.label
    }
}

interface Shortcut {
    label: string
    // One or more key combinations. Multiple entries render as "A or B".
    combos: KeyToken[][]
}

interface ShortcutGroup {
    title: string
    items: Shortcut[]
}

const GROUPS: ShortcutGroup[] = [
    {
        title: 'Essentials',
        items: [
            { label: 'Undo', combos: [[mod(), key('Z')]] },
            { label: 'Redo', combos: [[mod(), shift(), key('Z')]] },
            { label: 'Copy selection', combos: [[mod(), key('C')]] },
            { label: 'Paste', combos: [[mod(), key('V')]] },
            {
                label: 'Delete selection',
                combos: [[key('Delete')], [key('Backspace')]],
            },
            {
                label: 'Export selection as SVG',
                combos: [[mod(), shift(), key('D')]],
            },
        ],
    },
    {
        title: 'Tools',
        items: [
            {
                label: 'Create text (on empty canvas)',
                combos: [[key('double-click')]],
            },
        ],
    },
    {
        title: 'Arrange (z-order)',
        items: [
            { label: 'Bring forward', combos: [[key(']')]] },
            { label: 'Send backward', combos: [[key('[')]] },
            { label: 'Bring to front', combos: [[mod(), key(']')]] },
            { label: 'Send to back', combos: [[mod(), key('[')]] },
        ],
    },
    {
        title: 'Drawing & text editing',
        items: [
            {
                label: 'Constrain arrow to horizontal / vertical',
                combos: [[shift(), key('drag')]],
            },
            {
                label: 'Finish line / area / route',
                combos: [[key('Enter')], [key('Esc')], [key('double-click')]],
            },
            { label: 'Commit text edit', combos: [[key('Enter')]] },
            {
                label: 'New line while editing text',
                combos: [[shift(), key('Enter')]],
            },
            { label: 'Cancel text edit', combos: [[key('Esc')]] },
        ],
    },
    {
        title: 'Transform',
        items: [
            {
                label: 'Keep aspect ratio while resizing',
                combos: [[shift(), key('drag')]],
            },
            {
                label: 'Resize from center',
                combos: [[alt(), key('drag')]],
            },
        ],
    },
    {
        title: 'Canvas navigation',
        items: [
            { label: 'Pan', combos: [[key('scroll')]] },
            { label: 'Zoom', combos: [[mod(), key('scroll')]] },
            {
                label: 'Open context menu',
                combos: [[key('right-click')]],
            },
        ],
    },
]

const Kbd = ({ children }: { children: string }): ReactElement => (
    <kbd
        className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5
            rounded border border-border-panel bg-accent/20 text-ink-mid
            text-xs font-medium leading-none whitespace-nowrap"
    >
        {children}
    </kbd>
)

const Combo = ({ tokens }: { tokens: KeyToken[] }): ReactElement => (
    <span className="inline-flex items-center gap-1">
        {tokens.map((token, i) => (
            <Kbd key={i}>{tokenLabel(token)}</Kbd>
        ))}
    </span>
)

const ShortcutsModal = ({
    open,
    onClose,
}: ShortcutsModalProps): ReactElement => {
    return (
        <Modal open={open} onClose={onClose}>
            <div className="w-[520px] max-w-[calc(80vw_-_2.5rem)] max-h-[70vh] overflow-y-auto overflow-x-hidden">
                <h2 className="text-lg font-semibold mb-1 font-display">
                    Keyboard shortcuts
                </h2>
                <p className="text-xs text-ink-muted mb-4">
                    Shown for {isMac ? 'macOS' : 'Windows / Linux'}.
                </p>

                <div className="flex flex-col gap-5">
                    {GROUPS.map((group) => (
                        <div key={group.title}>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
                                {group.title}
                            </h3>
                            <div className="flex flex-col gap-1.5">
                                {group.items.map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                                    >
                                        <span className="text-sm text-ink-mid">
                                            {item.label}
                                        </span>
                                        <span className="flex items-center gap-1.5 flex-wrap justify-start sm:shrink-0 sm:justify-end">
                                            {item.combos.map((combo, i) => (
                                                <span
                                                    key={i}
                                                    className="flex items-center gap-1.5"
                                                >
                                                    {i > 0 && (
                                                        <span className="text-[10px] text-ink-muted">
                                                            or
                                                        </span>
                                                    )}
                                                    <Combo tokens={combo} />
                                                </span>
                                            ))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    )
}

export default ShortcutsModal
