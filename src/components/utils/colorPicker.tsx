import { Fragment, useState, useEffect } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { allColorShades, essentialShades } from '../../utils/constants'
import { flipThemeColor } from '../../utils/themeColorFlip'
import { motion, AnimatePresence } from 'framer-motion'
import { MIXED } from '../../utils/groupInspect'

const STORAGE_KEY = 'craftbase_saved_colors'
const MAX_SAVED = 8

// Checkerboard shown behind a transparent swatch so it reads as "no paint"
// instead of rendering invisibly.
const TRANSPARENT_SWATCH_BG =
    'repeating-conic-gradient(rgb(var(--color-border-card)) 0% 25%, rgb(var(--color-canvas)) 0% 50%) 0 0 / 8px 8px'

// True for any rgba()/hsla() color with alpha 0.
const isTransparentColor = (color?: string | null): boolean => {
    if (!color) return false
    const inner = /(?:rgba|hsla)\(([^)]+)\)/i.exec(color)?.[1]
    if (!inner) return false
    const parts = inner.split(',').map((s) => s.trim())
    return parts.length === 4 && parseFloat(parts[3] ?? '1') === 0
}

// Background style for a swatch/preview: checkerboard for transparent,
// the color itself otherwise, falling back to a transparent box.
const swatchBackground = (color?: string | null): string =>
    isTransparentColor(color) ? TRANSPARENT_SWATCH_BG : (color ?? 'transparent')

const loadSavedColors = (): string[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? (JSON.parse(stored) as string[]) : []
    } catch {
        return []
    }
}

const persistSavedColors = (colors: string[]): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
    } catch {
        /* noop */
    }
}

export interface ColorPickerProps {
    title?: string
    onChangeComplete: (color: string) => void
    currentColor?: string
    isExpanded?: boolean
    onToggleExpand?: () => void
    // Quick-access swatch row. Defaults to the shared essentialShades; the
    // Fill picker passes fillEssentialShades to surface a transparent option.
    essentialColors?: string[]
}

const ColorPicker = ({
    title,
    onChangeComplete,
    currentColor,
    isExpanded,
    onToggleExpand,
    essentialColors = essentialShades,
}: ColorPickerProps): ReactElement => {
    // In dark mode the quick-access tray shows each essential's dark counterpart
    // (flipThemeColor), so picking a swatch stores the theme-appropriate value —
    // which flips back to the light essential when the theme is toggled.
    const isDarkTheme =
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark')
    const displayEssentials = isDarkTheme
        ? essentialColors.map((c) => flipThemeColor(c) as string)
        : essentialColors
    const [localExpanded, setLocalExpanded] = useState(false)
    const [savedColors, setSavedColors] = useState<string[]>(loadSavedColors)
    const [removingColor, setRemovingColor] = useState<string | null>(null)
    const isMixed = currentColor === MIXED
    const [hexInput, setHexInput] = useState(
        isMixed || isTransparentColor(currentColor)
            ? ''
            : (currentColor?.replace(/^#/, '') ?? '')
    )

    // Support both controlled (isExpanded prop) and uncontrolled (local state) modes.
    const controlled = isExpanded !== undefined
    const expanded = controlled ? isExpanded : localExpanded
    const handleToggle =
        onToggleExpand ?? ((): void => setLocalExpanded((p) => !p))

    useEffect(() => {
        if (currentColor === MIXED || isTransparentColor(currentColor)) {
            setHexInput('')
            return
        }
        setHexInput(currentColor?.replace(/^#/, '') ?? '')
    }, [currentColor])

    useEffect(() => {
        persistSavedColors(savedColors)
    }, [savedColors])

    const handleColorSelect = (color: string): void => {
        onChangeComplete(color)
    }

    const handleHexSubmit = (): void => {
        const full = `#${hexInput.toUpperCase()}`
        if (/^#[0-9A-Fa-f]{6}$/.test(full)) {
            onChangeComplete(full)
        }
    }

    const handleSaveColor = (): void => {
        if (
            !currentColor ||
            savedColors.includes(currentColor) ||
            savedColors.length >= MAX_SAVED
        )
            return
        setSavedColors((prev) => [...prev, currentColor])
    }

    const handleRemoveColor = (color: string): void => {
        setSavedColors((prev) => prev.filter((c) => c !== color))
        setRemovingColor(null)
    }

    // Live preview for the swatch beside the hex field: reflects the typed or
    // pasted value as soon as it is a full 6-digit hex, before it's committed.
    const hexPreview = /^[0-9A-Fa-f]{6}$/.test(hexInput)
        ? `#${hexInput.toUpperCase()}`
        : null

    const hasColor = !!currentColor && !isMixed
    const isTransparent = isTransparentColor(currentColor)
    const mixedSwatchBg =
        'repeating-linear-gradient(45deg, rgb(var(--color-border-card)) 0 4px, rgb(var(--color-canvas)) 4px 8px)'

    const swatchStyle = (color: string): CSSProperties => ({
        background: swatchBackground(color),
        border:
            color === '#FFFFFF' || isTransparentColor(color)
                ? '1.5px solid rgb(var(--color-ink))'
                : 'none',
        outline:
            currentColor === color
                ? '2px solid rgb(var(--color-accent-dark))'
                : 'none',
        outlineOffset: '1.5px',
    })

    return (
        <Fragment>
            <div className="flex items-center justify-between mb-2">
                {title && (
                    <span className="text-xs text-ink-muted font-normal">
                        {title}
                    </span>
                )}
                <button
                    onClick={handleToggle}
                    className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        expanded
                            ? 'bg-accent/20 border-[1.5px] border-accent-dark text-ink'
                            : 'bg-canvas border border-border-card text-ink-mid'
                    }`}
                >
                    <div
                        className="w-3.5 h-3.5 rounded-[3px] flex-shrink-0"
                        style={{
                            background: isMixed
                                ? mixedSwatchBg
                                : isTransparent
                                  ? TRANSPARENT_SWATCH_BG
                                  : hasColor
                                    ? currentColor
                                    : 'transparent',
                            border:
                                (hasColor && !isTransparent) || isMixed
                                    ? 'none'
                                    : '1.5px solid rgb(var(--color-ink))',
                        }}
                    />
                    <span className="font-mono">
                        {isMixed
                            ? 'Mixed'
                            : isTransparent
                              ? 'Transparent'
                              : hasColor
                                ? currentColor.toUpperCase()
                                : 'None'}
                    </span>
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        className={
                            expanded ? 'text-accent-dark' : 'text-ink-muted'
                        }
                    >
                        <path
                            d={
                                expanded
                                    ? 'M7.5 6L5 3.5L2.5 6'
                                    : 'M2.5 4L5 6.5L7.5 4'
                            }
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-2"
                    >
                        <div className="bg-canvas border border-border-panel rounded-lg p-2.5 space-y-2">
                            <div className="flex items-center gap-1.5">
                                <div
                                    className="w-7 h-7 rounded-[6px] flex-shrink-0"
                                    style={{
                                        background: isMixed
                                            ? mixedSwatchBg
                                            : swatchBackground(currentColor),
                                        border: '2px solid rgb(var(--color-accent-dark))',
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] text-ink-muted mb-0.5">
                                        Selected
                                    </div>
                                    <div className="text-[11px] font-semibold text-ink font-mono truncate">
                                        {isMixed
                                            ? 'Mixed'
                                            : isTransparent
                                              ? 'Transparent'
                                              : (currentColor?.toUpperCase() ??
                                                '—')}
                                    </div>
                                </div>
                                <button
                                    className="bg-card-bg border border-border-card rounded-[5px] p-1 flex-shrink-0 hover:bg-sidebar transition-colors"
                                    onClick={(): void => {
                                        if (currentColor) {
                                            navigator.clipboard?.writeText(
                                                currentColor
                                            )
                                        }
                                    }}
                                    title="Copy hex"
                                >
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        className="text-ink-muted"
                                    >
                                        <rect
                                            x="1"
                                            y="3"
                                            width="8"
                                            height="8"
                                            rx="1.5"
                                            stroke="currentColor"
                                            strokeWidth="1.2"
                                        />
                                        <path
                                            d="M3 3V2a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-1"
                                            stroke="currentColor"
                                            strokeWidth="1.2"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-1">
                                {[...allColorShades, ...savedColors].map(
                                    (color, i) => (
                                        <button
                                            key={`${color}-${i}`}
                                            onClick={(): void =>
                                                handleColorSelect(color)
                                            }
                                            onContextMenu={(e): void => {
                                                if (
                                                    savedColors.includes(color)
                                                ) {
                                                    e.preventDefault()
                                                    setRemovingColor(
                                                        removingColor === color
                                                            ? null
                                                            : color
                                                    )
                                                }
                                            }}
                                            title={color}
                                            className="relative w-[22px] h-[22px] rounded-[5px] flex-shrink-0 transition-transform hover:scale-110"
                                            style={swatchStyle(color)}
                                        >
                                            <AnimatePresence>
                                                {removingColor === color && (
                                                    <motion.span
                                                        initial={{
                                                            opacity: 0,
                                                            scale: 0.5,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            scale: 1,
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            scale: 0.5,
                                                        }}
                                                        className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] leading-none"
                                                        onClick={(e): void => {
                                                            e.stopPropagation()
                                                            handleRemoveColor(
                                                                color
                                                            )
                                                        }}
                                                    >
                                                        ×
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                        </button>
                                    )
                                )}
                            </div>

                            <div className="flex items-center gap-1.5">
                                <div
                                    className="w-5 h-5 rounded-[4px] flex-shrink-0 border border-border-card"
                                    style={{
                                        background: swatchBackground(
                                            hexPreview ?? currentColor
                                        ),
                                    }}
                                />
                                <div className="flex-1 flex items-center bg-card-bg border border-border-card rounded-[5px] px-2 py-1 gap-1">
                                    <span className="text-[10px] text-ink-muted font-semibold">
                                        #
                                    </span>
                                    <input
                                        className="text-[11px] text-ink font-mono font-medium bg-transparent outline-none w-full"
                                        value={hexInput}
                                        onChange={(e): void =>
                                            setHexInput(
                                                e.target.value
                                                    .replace(
                                                        /[^0-9A-Fa-f]/g,
                                                        ''
                                                    )
                                                    .slice(0, 6)
                                            )
                                        }
                                        onBlur={handleHexSubmit}
                                        onKeyDown={(e): void => {
                                            if (e.key === 'Enter')
                                                handleHexSubmit()
                                        }}
                                        placeholder="3DB88A"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveColor}
                                    title="Save current color"
                                    className="w-[26px] self-stretch rounded-[5px] flex-shrink-0 flex items-center justify-center bg-canvas border-dashed border-[1.5px] border-border-card hover:border-accent-dark transition-colors"
                                >
                                    <svg
                                        width="10"
                                        height="10"
                                        viewBox="0 0 10 10"
                                        fill="none"
                                        className="text-ink-muted"
                                    >
                                        <path
                                            d="M5 2V8M2 5H8"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-center gap-1">
                {displayEssentials.map((color) => (
                    <button
                        key={color}
                        onClick={(): void => handleColorSelect(color)}
                        title={
                            isTransparentColor(color) ? 'Transparent' : color
                        }
                        className="mr-1 w-5 h-5 rounded-full flex-shrink-0 transition-transform hover:scale-110"
                        style={{
                            background: swatchBackground(color),
                            border:
                                color.toLowerCase() === '#ffffff' ||
                                isTransparentColor(color)
                                    ? '1.5px solid rgb(var(--color-ink))'
                                    : 'none',
                            outline:
                                currentColor === color
                                    ? '2.5px solid rgb(var(--color-accent-dark))'
                                    : 'none',
                            outlineOffset: '1.5px',
                        }}
                    />
                ))}
                <button
                    onClick={handleToggle}
                    title="Handle toggle"
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-dashed border-[1.5px] border-border-card bg-canvas hover:border-accent-dark transition-colors"
                >
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        className="text-ink-muted"
                    >
                        <path
                            d="M5 2V8M2 5H8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </div>
        </Fragment>
    )
}

export default ColorPicker
