import type { ReactElement } from 'react'
import Modal from '../common/modal'
import { isMac } from '../../utils/misc'
import { keyTokenLabel, shortcutCategories } from '../../constants/hints'
import type { KeyToken } from '../../constants/hints'

interface ShortcutsModalProps {
    open: boolean
    onClose: () => void
}

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
        {tokens.map((token, i) =>
            // Connecting words ("Hold") read as plain text, not a key cap.
            token.type === 'text' ? (
                <span key={i} className="text-xs text-ink-muted">
                    {keyTokenLabel(token)}
                </span>
            ) : (
                <Kbd key={i}>{keyTokenLabel(token)}</Kbd>
            )
        )}
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
                    {shortcutCategories().map((group) => (
                        <div key={group.title}>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
                                {group.title}
                            </h3>
                            <div className="flex flex-col gap-1.5">
                                {group.hints.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                                    >
                                        <span className="text-sm text-ink-mid">
                                            {item.title}
                                        </span>
                                        <span className="flex items-center gap-1.5 flex-wrap justify-start sm:shrink-0 sm:justify-end">
                                            {item.combos?.map((combo, i) => (
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
