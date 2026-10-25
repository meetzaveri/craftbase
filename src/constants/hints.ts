// Single source of truth for user-facing hints: keyboard shortcuts, modifier
// gestures, and non-keyboard tips. The Keyboard shortcuts modal renders the
// entries that have `combos`; a future docs page can render all of them.
// When a feature adds a hidden gesture or tip, add one entry here.

import { isMac } from '../utils/misc'

// A key token is either a literal cap ('Z', '[', 'Enter'), a symbolic modifier
// that resolves per-OS, or plain connecting text ('Hold') rendered without a
// key chip. Keeping them as tokens (not pre-joined strings) lets each render as
// its own <kbd> chip and swap the mac/other glyphs in one place. Mirrors the
// metaKey-on-mac / ctrlKey-elsewhere split the keyboard handlers use (see
// newCanvas.tsx + useCanvasClipboard.ts).
export type KeyToken =
    | { type: 'mod' } // ⌘ on mac, Ctrl elsewhere
    | { type: 'shift' }
    | { type: 'alt' } // ⌥ on mac, Alt elsewhere
    | { type: 'key'; label: string }
    | { type: 'text'; label: string }

export const mod = (): KeyToken => ({ type: 'mod' })
export const shift = (): KeyToken => ({ type: 'shift' })
export const alt = (): KeyToken => ({ type: 'alt' })
export const key = (label: string): KeyToken => ({ type: 'key', label })
export const text = (label: string): KeyToken => ({ type: 'text', label })

export const keyTokenLabel = (token: KeyToken): string => {
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
        case 'text':
            return token.label
    }
}

export type HintPlatform = 'desktop' | 'mobile'

export interface Hint {
    /** Stable key for React lists and deep links from a docs page. */
    id: string
    title: string
    /** Longer explanation for the docs page. The modal shows only the title. */
    description?: string
    /** One or more key combinations. Multiple entries render as "A or B". */
    combos?: KeyToken[][]
    /** Omitted = available everywhere. */
    platforms?: HintPlatform[]
}

export interface HintCategory {
    title: string
    hints: Hint[]
}

export const HINT_CATEGORIES: HintCategory[] = [
    {
        title: 'Essentials',
        hints: [
            { id: 'undo', title: 'Undo', combos: [[mod(), key('Z')]] },
            {
                id: 'redo',
                title: 'Redo',
                combos: [[mod(), shift(), key('Z')]],
            },
            {
                id: 'copy',
                title: 'Copy selection',
                combos: [[mod(), key('C')]],
            },
            { id: 'paste', title: 'Paste', combos: [[mod(), key('V')]] },
            {
                id: 'delete',
                title: 'Delete selection',
                combos: [[key('Delete')], [key('Backspace')]],
            },
            {
                id: 'export-svg',
                title: 'Export selection as SVG',
                combos: [[mod(), shift(), key('D')]],
            },
        ],
    },
    {
        title: 'Tools',
        hints: [
            {
                id: 'text-dblclick',
                title: 'Create text (on empty canvas)',
                combos: [[key('double-click')]],
            },
            {
                id: 'eraser-keep-images',
                title: 'Erase drawings but keep images (eraser)',
                description:
                    'Hold Shift while erasing to remove strokes and shapes but leave images in place, even where a stroke is drawn over an image.',
                combos: [[text('Hold'), shift()]],
                platforms: ['desktop'],
            },
        ],
    },
    {
        title: 'Arrange (z-order)',
        hints: [
            {
                id: 'bring-forward',
                title: 'Bring forward',
                combos: [[key(']')]],
            },
            {
                id: 'send-backward',
                title: 'Send backward',
                combos: [[key('[')]],
            },
            {
                id: 'bring-to-front',
                title: 'Bring to front',
                combos: [[mod(), key(']')]],
            },
            {
                id: 'send-to-back',
                title: 'Send to back',
                combos: [[mod(), key('[')]],
            },
        ],
    },
    {
        title: 'Drawing & text editing',
        hints: [
            {
                id: 'arrow-constrain',
                title: 'Constrain arrow to horizontal / vertical',
                combos: [[shift(), key('drag')]],
            },
            {
                id: 'finish-multi-click',
                title: 'Finish line / area / route',
                combos: [[key('Enter')], [key('Esc')], [key('double-click')]],
            },
            {
                id: 'text-commit',
                title: 'Commit text edit',
                combos: [[key('Enter')]],
            },
            {
                id: 'text-newline',
                title: 'New line while editing text',
                combos: [[shift(), key('Enter')]],
            },
            {
                id: 'text-cancel',
                title: 'Cancel text edit',
                combos: [[key('Esc')]],
            },
        ],
    },
    {
        title: 'Transform',
        hints: [
            {
                id: 'resize-aspect',
                title: 'Keep aspect ratio while resizing',
                combos: [[shift(), key('drag')]],
            },
            {
                id: 'resize-center',
                title: 'Resize from center',
                combos: [[alt(), key('drag')]],
            },
        ],
    },
    {
        title: 'Canvas navigation',
        hints: [
            { id: 'pan', title: 'Pan', combos: [[key('scroll')]] },
            { id: 'zoom', title: 'Zoom', combos: [[mod(), key('scroll')]] },
            {
                id: 'context-menu',
                title: 'Open context menu',
                combos: [[key('right-click')]],
            },
        ],
    },
]

/** Categories trimmed to hints that have key combos (the shortcuts modal). */
export function shortcutCategories(): HintCategory[] {
    return HINT_CATEGORIES.map((category) => ({
        ...category,
        hints: category.hints.filter((h) => h.combos && h.combos.length > 0),
    })).filter((category) => category.hints.length > 0)
}
