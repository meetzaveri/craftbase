import { useEffect, useRef, useState } from 'react'
import type { ReactElement, FunctionComponent, SVGProps } from 'react'

import Portal from './common/portal'
import { isMac } from '../utils/misc'
import LayersIcon from '../assets/layers.svg?react'
import BringToFrontIcon from '../assets/bring-to-front.svg?react'
import BringForwardIcon from '../assets/bring-forward.svg?react'
import SendBackwardIcon from '../assets/send-backward.svg?react'
import SendToBackIcon from '../assets/send-to-back.svg?react'
import ChevronRightIcon from '../assets/chevron-right.svg?react'
import { getCanvasSize } from '../utils/embedRoot'

export type ReorderOp = 'front' | 'forward' | 'backward' | 'back'

interface CanvasContextMenuProps {
    x: number
    y: number
    onClose: () => void
    onExportSvg: () => void
    onReorder: (op: ReorderOp) => void
}

const MENU_WIDTH = 240
const SUBMENU_WIDTH = 240
const MENU_MARGIN = 8

// Shared icon tone — matches the menu's ink-mid text. The source SVGs hardcode
// a blue stroke; SVGR spreads props after the original attrs, so this wins.
const ICON_STROKE = '#8C7E6A'

const itemClass =
    `w-full flex items-center justify-between px-3 py-2 mx-0 text-sm text-ink-mid ` +
    `hover:bg-accent/30 rounded cursor-pointer transition-colors ease-in-out duration-150`

const shortcutClass = 'text-[10px] text-ink-muted tracking-wide'

// Format a shortcut for the host OS: compact symbols on mac (⌘]), the
// conventional spelled-out form elsewhere (Ctrl+]). Kept in sync with the
// keyboard handler in newCanvas.tsx, which acts on metaKey on mac / ctrlKey on
// the rest. Reorder uses bare brackets for forward/back-one and ⌘/Ctrl+bracket
// for to-front/to-back (no Shift — ⌘⇧[/] are reserved tab-switch on mac Chrome).
export const fmtShortcut = (
    key: string,
    { cmd = false, shift = false }: { cmd?: boolean; shift?: boolean } = {}
): string =>
    isMac
        ? `${cmd ? '⌘' : ''}${shift ? '⇧' : ''}${key}`
        : `${cmd ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${key}`

type ReorderItem = {
    op: ReorderOp
    label: string
    shortcut: string
    Icon: FunctionComponent<SVGProps<SVGSVGElement>>
}

const REORDER_ITEMS: ReorderItem[] = [
    {
        op: 'front',
        label: 'Bring to Front',
        shortcut: fmtShortcut(']', { cmd: true }),
        Icon: BringToFrontIcon,
    },
    {
        op: 'forward',
        label: 'Bring Forward',
        shortcut: fmtShortcut(']'),
        Icon: BringForwardIcon,
    },
    {
        op: 'backward',
        label: 'Send Backward',
        shortcut: fmtShortcut('['),
        Icon: SendBackwardIcon,
    },
    {
        op: 'back',
        label: 'Send to Back',
        shortcut: fmtShortcut('[', { cmd: true }),
        Icon: SendToBackIcon,
    },
]

/**
 * Small fixed-position menu opened on canvas right-click / two-finger tap.
 * Closes on outside click or Escape. Positioned at the cursor and clamped to
 * the viewport so it never overflows off-screen. The Reorder entry opens a
 * flyout submenu to the right (or left, near the screen edge).
 */
const CanvasContextMenu = ({
    x,
    y,
    onClose,
    onExportSvg,
    onReorder,
}: CanvasContextMenuProps): ReactElement => {
    const refNode = useRef<HTMLDivElement | null>(null)
    const [height, setHeight] = useState(0)
    const [reorderOpen, setReorderOpen] = useState(false)

    useEffect(() => {
        if (refNode.current) setHeight(refNode.current.offsetHeight)
    }, [])

    useEffect(() => {
        const handleClick = (e: MouseEvent): void => {
            if (refNode.current?.contains(e.target as Node)) return
            onClose()
        }
        const handleKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('mousedown', handleClick, false)
        document.addEventListener('keydown', handleKey, false)
        return (): void => {
            document.removeEventListener('mousedown', handleClick, false)
            document.removeEventListener('keydown', handleKey, false)
        }
    }, [onClose])

    // x/y are canvas-box-local (see the setCtxMenu call in newCanvas).
    const { width: boxW, height: boxH } = getCanvasSize()
    const left = Math.min(x, boxW - MENU_WIDTH - MENU_MARGIN)
    const top = Math.min(y, boxH - (height || 60) - MENU_MARGIN)
    const clampedLeft = Math.max(MENU_MARGIN, left)

    // Flip the flyout to the left when there isn't room on the right.
    const openLeft =
        clampedLeft + MENU_WIDTH + SUBMENU_WIDTH + MENU_MARGIN > boxW

    return (
        <Portal>
            <div
                ref={refNode}
                className="fixed z-[100] bg-card-bg border border-border-panel rounded-lg shadow-lg py-1"
                style={{
                    left: clampedLeft,
                    top: Math.max(MENU_MARGIN, top),
                    width: MENU_WIDTH,
                }}
            >
                <div
                    className="relative"
                    onMouseEnter={() => setReorderOpen(true)}
                    onMouseLeave={() => setReorderOpen(false)}
                >
                    <button
                        type="button"
                        onClick={() => setReorderOpen((v) => !v)}
                        className={itemClass}
                    >
                        <div className="flex items-center gap-2.5">
                            <LayersIcon
                                width={15}
                                height={15}
                                stroke={ICON_STROKE}
                                strokeWidth={2}
                            />
                            Reorder
                        </div>
                        <ChevronRightIcon
                            width={15}
                            height={15}
                            stroke={ICON_STROKE}
                            strokeWidth={2}
                        />
                        {/* <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M3.5 2l3 3-3 3"
                                stroke={ICON_STROKE}
                                strokeWidth="1.1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg> */}
                    </button>

                    {reorderOpen && (
                        <div
                            className="absolute top-0 bg-card-bg border border-border-panel rounded-lg shadow-lg py-1 z-[101]"
                            style={{
                                width: SUBMENU_WIDTH,
                                ...(openLeft
                                    ? { right: '100%' }
                                    : { left: '100%' }),
                            }}
                        >
                            {REORDER_ITEMS.map(
                                ({ op, label, shortcut, Icon }) => (
                                    <button
                                        key={op}
                                        type="button"
                                        onClick={() => onReorder(op)}
                                        className={itemClass}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Icon
                                                width={15}
                                                height={15}
                                                stroke={ICON_STROKE}
                                                strokeWidth={2}
                                            />
                                            {label}
                                        </div>
                                        <span className={shortcutClass}>
                                            {shortcut}
                                        </span>
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>

                <div className="my-1 mx-2 border-t border-border-panel" />

                <button
                    type="button"
                    onClick={onExportSvg}
                    className={itemClass}
                >
                    <div className="flex items-center gap-2.5">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M7 1v8M7 9L4.5 6.5M7 9l2.5-2.5"
                                stroke={ICON_STROKE}
                                strokeWidth="1.1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M2 10v1.5a1 1 0 001 1h8a1 1 0 001-1V10"
                                stroke={ICON_STROKE}
                                strokeWidth="1.1"
                                strokeLinecap="round"
                            />
                        </svg>
                        Export selection as SVG
                    </div>
                    <span className={shortcutClass}>
                        {fmtShortcut('D', { cmd: true, shift: true })}
                    </span>
                </button>
            </div>
        </Portal>
    )
}

export default CanvasContextMenu
