import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { DEFAULT_TEXT_FONT_FAMILY } from '../constants/misc'

const STORAGE_KEY = 'craftbase:elementDefaults'

export type TextSizeLabel = 'S' | 'M' | 'L' | 'XL'

export interface ElementDefaultsState {
    // Shape defaults — also used by pencil and arrow (single unified set).
    defaultFill: string
    defaultStrokeColor: string
    defaultLinewidth: number
    defaultStrokeType: string | null
    defaultOpacity: number
    // Text defaults
    defaultTextColor: string
    defaultTextSize: TextSizeLabel
    defaultTextFontFamily: string
}

const INITIAL_DEFAULTS: ElementDefaultsState = {
    defaultFill: '#FFFFFF',
    // Pure-black ink baselines so they flip cleanly to #fff in dark mode (the
    // defaults flip on theme toggle — see board.tsx).
    defaultStrokeColor: '#000',
    defaultLinewidth: 2,
    defaultStrokeType: null,
    defaultOpacity: 1,
    defaultTextColor: '#000',
    defaultTextSize: 'M',
    defaultTextFontFamily: DEFAULT_TEXT_FONT_FAMILY,
}

function loadFromStorage(): ElementDefaultsState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return INITIAL_DEFAULTS
        const parsed = JSON.parse(raw) as Partial<ElementDefaultsState>
        return { ...INITIAL_DEFAULTS, ...parsed }
    } catch {
        return INITIAL_DEFAULTS
    }
}

export interface ElementDefaultsApi extends ElementDefaultsState {
    // raw setters (used by undo/history to restore prior defaults silently)
    setDefaultFill: Dispatch<SetStateAction<string>>
    setDefaultStrokeColor: Dispatch<SetStateAction<string>>
    setDefaultLinewidth: Dispatch<SetStateAction<number>>
    setDefaultStrokeType: Dispatch<SetStateAction<string | null>>
    setDefaultOpacity: Dispatch<SetStateAction<number>>
    setDefaultTextColor: Dispatch<SetStateAction<string>>
    setDefaultTextSize: Dispatch<SetStateAction<TextSizeLabel>>
    setDefaultTextFontFamily: Dispatch<SetStateAction<string>>
    // board-facing setters (currently identical to raw; kept for API symmetry)
    setDefaultFillInBoard: (val: string) => void
    setDefaultStrokeColorInBoard: (val: string) => void
    setDefaultLinewidthInBoard: (val: number) => void
    setDefaultStrokeTypeInBoard: (val: string | null) => void
    setDefaultOpacityInBoard: (val: number) => void
    setDefaultTextColorInBoard: (val: string) => void
    setDefaultTextSizeInBoard: (val: TextSizeLabel) => void
    setDefaultTextFontFamilyInBoard: (val: string) => void
    // Restore every default to its factory value (used by "clear canvas" so a
    // leaked default like linewidth:0 doesn't carry over to the next drawing).
    resetDefaults: () => void
}

export function useElementDefaults(): ElementDefaultsApi {
    const initial = loadFromStorage()

    const [defaultFill, setDefaultFill] = useState(initial.defaultFill)
    const [defaultStrokeColor, setDefaultStrokeColor] = useState(
        initial.defaultStrokeColor
    )
    const [defaultLinewidth, setDefaultLinewidth] = useState(
        initial.defaultLinewidth
    )
    const [defaultStrokeType, setDefaultStrokeType] = useState<string | null>(
        initial.defaultStrokeType
    )
    const [defaultOpacity, setDefaultOpacity] = useState(initial.defaultOpacity)

    const [defaultTextColor, setDefaultTextColor] = useState(
        initial.defaultTextColor
    )
    const [defaultTextSize, setDefaultTextSize] = useState<TextSizeLabel>(
        initial.defaultTextSize
    )
    const [defaultTextFontFamily, setDefaultTextFontFamily] = useState(
        initial.defaultTextFontFamily
    )

    const isFirstRender = useRef(true)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    defaultFill,
                    defaultStrokeColor,
                    defaultLinewidth,
                    defaultStrokeType,
                    defaultOpacity,
                    defaultTextColor,
                    defaultTextSize,
                    defaultTextFontFamily,
                })
            )
        } catch {
            /* noop */
        }
    }, [
        defaultFill,
        defaultStrokeColor,
        defaultLinewidth,
        defaultStrokeType,
        defaultOpacity,
        defaultTextColor,
        defaultTextSize,
        defaultTextFontFamily,
    ])

    // Pure setters — these never deselect or close anything.
    const setDefaultLinewidthInBoard = (val: number): void =>
        setDefaultLinewidth(val)
    const setDefaultStrokeTypeInBoard = (val: string | null): void =>
        setDefaultStrokeType(val)
    const setDefaultFillInBoard = (val: string): void => setDefaultFill(val)
    const setDefaultStrokeColorInBoard = (val: string): void =>
        setDefaultStrokeColor(val)
    const setDefaultOpacityInBoard = (val: number): void =>
        setDefaultOpacity(val)
    const setDefaultTextColorInBoard = (val: string): void =>
        setDefaultTextColor(val)
    const setDefaultTextSizeInBoard = (val: TextSizeLabel): void =>
        setDefaultTextSize(val)
    const setDefaultTextFontFamilyInBoard = (val: string): void =>
        setDefaultTextFontFamily(val)

    // Reset all defaults to INITIAL_DEFAULTS. The persistence effect above then
    // rewrites localStorage to the factory values on the resulting state change.
    const resetDefaults = (): void => {
        setDefaultFill(INITIAL_DEFAULTS.defaultFill)
        setDefaultStrokeColor(INITIAL_DEFAULTS.defaultStrokeColor)
        setDefaultLinewidth(INITIAL_DEFAULTS.defaultLinewidth)
        setDefaultStrokeType(INITIAL_DEFAULTS.defaultStrokeType)
        setDefaultOpacity(INITIAL_DEFAULTS.defaultOpacity)
        setDefaultTextColor(INITIAL_DEFAULTS.defaultTextColor)
        setDefaultTextSize(INITIAL_DEFAULTS.defaultTextSize)
        setDefaultTextFontFamily(INITIAL_DEFAULTS.defaultTextFontFamily)
    }

    return {
        defaultFill,
        defaultStrokeColor,
        defaultLinewidth,
        defaultStrokeType,
        defaultOpacity,
        defaultTextColor,
        defaultTextSize,
        defaultTextFontFamily,
        setDefaultFill,
        setDefaultStrokeColor,
        setDefaultLinewidth,
        setDefaultStrokeType,
        setDefaultOpacity,
        setDefaultTextColor,
        setDefaultTextSize,
        setDefaultTextFontFamily,
        setDefaultFillInBoard,
        setDefaultStrokeColorInBoard,
        setDefaultLinewidthInBoard,
        setDefaultStrokeTypeInBoard,
        setDefaultOpacityInBoard,
        setDefaultTextColorInBoard,
        setDefaultTextSizeInBoard,
        setDefaultTextFontFamilyInBoard,
        resetDefaults,
    }
}
