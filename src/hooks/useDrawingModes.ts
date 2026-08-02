import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
    RUBBER_MODE_KEY,
    ARROW_DRAW_MODE_KEY,
    TEXT_DRAW_MODE_KEY,
    PENDING_SHAPE_TYPE_KEY,
    PENDING_SHAPE_PROPS_KEY,
    LAST_ADDED_ELEMENT_ID_KEY,
    PENCIL_MODE_KEY,
    PAN_MODE_KEY,
    ERASER_SIZE_KEY,
    DEFAULT_ERASER_SIZE,
    ERASER_SIZES,
    type EraserSize,
} from '../constants/misc'

// Toggle helpers accept an optional options bag that lets the caller plug
// in the surrounding board state (selection clear, pending-element cancel,
// toolbar visibility). Each callback is optional — the hook only fires
// what's provided.
export interface DrawingModeToggleOptions {
    cancelPendingElement?: () => void
    setSelectedComponent?: (component: unknown) => void
    toggleToolbar?: (open: boolean) => void
}

export interface DrawingModesApi {
    pointerToggle: boolean
    setPointerToggle: Dispatch<SetStateAction<boolean>>
    isPencilMode: boolean
    setPencilMode: Dispatch<SetStateAction<boolean>>
    isArrowDrawMode: boolean
    setIsArrowDrawMode: Dispatch<SetStateAction<boolean>>
    isTextDrawMode: boolean
    setIsTextDrawMode: Dispatch<SetStateAction<boolean>>
    isRubberMode: boolean
    eraserSize: EraserSize
    isPanMode: boolean
    setPanMode: Dispatch<SetStateAction<boolean>>
    togglePointer: (
        pointerVal: boolean,
        options?: DrawingModeToggleOptions
    ) => void
    togglePencilMode: (
        value: boolean,
        options?: Pick<
            DrawingModeToggleOptions,
            'cancelPendingElement' | 'toggleToolbar'
        >
    ) => void
    togglePanMode: (
        value: boolean,
        options?: DrawingModeToggleOptions
    ) => void
    setRubberModeInBoard: (val: boolean) => void
    setEraserSizeInBoard: (val: EraserSize) => void
    setArrowDrawModeInBoard: (val: boolean) => void
    setTextDrawModeInBoard: (val: boolean) => void
    clearDrawModesFromStorage: () => void
}

export function useDrawingModes(): DrawingModesApi {
    const [pointerToggle, setPointerToggle] = useState(false)
    const [isPencilMode, setPencilMode] = useState(false)
    const [isArrowDrawMode, setIsArrowDrawMode] = useState(false)
    const [isTextDrawMode, setIsTextDrawMode] = useState(false)
    const [isRubberMode, setIsRubberMode] = useState<boolean>(() => {
        try {
            return localStorage.getItem(RUBBER_MODE_KEY) === 'true'
        } catch {
            return false
        }
    })
    const [isPanMode, setPanMode] = useState<boolean>(() => {
        try {
            return localStorage.getItem(PAN_MODE_KEY) === 'true'
        } catch {
            return false
        }
    })
    const [eraserSize, setEraserSize] = useState<EraserSize>(() => {
        try {
            const stored = localStorage.getItem(ERASER_SIZE_KEY)
            return (ERASER_SIZES as string[]).includes(stored ?? '')
                ? (stored as EraserSize)
                : DEFAULT_ERASER_SIZE
        } catch {
            return DEFAULT_ERASER_SIZE
        }
    })

    const togglePointer: DrawingModesApi['togglePointer'] = (
        pointerVal,
        { cancelPendingElement, setSelectedComponent, toggleToolbar } = {}
    ) => {
        setPointerToggle(pointerVal)
        setPencilMode(false)
        if (pointerVal) {
            cancelPendingElement?.()
            setSelectedComponent?.(null)
            toggleToolbar?.(false)
            setIsRubberMode(false)
            setPanMode(false)
            try {
                localStorage.removeItem(RUBBER_MODE_KEY)
                localStorage.removeItem(PAN_MODE_KEY)
            } catch {
                /* noop */
            }
            const el = document.getElementById('main-two-root')
            if (el) el.style.cursor = 'default'
        }
    }

    const togglePencilMode: DrawingModesApi['togglePencilMode'] = (
        value,
        { cancelPendingElement, toggleToolbar } = {}
    ) => {
        toggleToolbar?.(false)
        setPencilMode(value)
        if (value) {
            cancelPendingElement?.()
            setIsRubberMode(false)
            setPanMode(false)
            try {
                localStorage.removeItem(RUBBER_MODE_KEY)
                localStorage.removeItem(PAN_MODE_KEY)
            } catch {
                /* noop */
            }
            localStorage.setItem(PENCIL_MODE_KEY, 'TRUE')
            const el = document.getElementById('main-two-root')
            if (el) el.style.cursor = 'crosshair'
        } else {
            localStorage.removeItem(PENCIL_MODE_KEY)
        }
    }

    const togglePanMode: DrawingModesApi['togglePanMode'] = (
        value,
        { cancelPendingElement, setSelectedComponent, toggleToolbar } = {}
    ) => {
        setPanMode(value)
        const root = document.getElementById('main-two-root')
        if (value) {
            cancelPendingElement?.()
            setSelectedComponent?.(null)
            toggleToolbar?.(false)
            setPencilMode(false)
            setIsRubberMode(false)
            try {
                localStorage.setItem(PAN_MODE_KEY, 'true')
                localStorage.removeItem(PENCIL_MODE_KEY)
                localStorage.removeItem(RUBBER_MODE_KEY)
                localStorage.removeItem(ARROW_DRAW_MODE_KEY)
                localStorage.removeItem(TEXT_DRAW_MODE_KEY)
                localStorage.removeItem(PENDING_SHAPE_TYPE_KEY)
                localStorage.removeItem(PENDING_SHAPE_PROPS_KEY)
            } catch {
                /* noop */
            }
            if (root) root.style.cursor = 'grab'
            // Clear any active selection so single-finger drag pans cleanly.
            try {
                window.dispatchEvent(new CustomEvent('clearSelector', {}))
            } catch {
                /* noop */
            }
        } else {
            try {
                localStorage.removeItem(PAN_MODE_KEY)
            } catch {
                /* noop */
            }
            if (root) root.style.cursor = 'default'
        }
    }

    const setRubberModeInBoard = (val: boolean): void => {
        setIsRubberMode(!!val)
        if (val) {
            setPanMode(false)
            try {
                localStorage.removeItem(PAN_MODE_KEY)
            } catch {
                /* noop */
            }
            localStorage.setItem(RUBBER_MODE_KEY, 'true')
            const el = document.getElementById('main-two-root')
            if (el) el.style.cursor = 'crosshair'
        } else {
            localStorage.removeItem(RUBBER_MODE_KEY)
            const el = document.getElementById('main-two-root')
            if (el) el.style.cursor = 'default'
        }
    }

    const setEraserSizeInBoard = (val: EraserSize): void => {
        setEraserSize(val)
        try {
            localStorage.setItem(ERASER_SIZE_KEY, val)
        } catch {
            /* noop */
        }
    }

    const setArrowDrawModeInBoard = (val: boolean): void =>
        setIsArrowDrawMode(val)
    const setTextDrawModeInBoard = (val: boolean): void =>
        setIsTextDrawMode(val)

    // Reflect any active draw mode as a class on #main-two-root so CSS can
    // force the crosshair cursor on inner SVG nodes (.dragger-picker, text)
    // that would otherwise win with their own cursor: pointer rule.
    useEffect(() => {
        const root = document.getElementById('main-two-root')
        if (!root) return
        const active = isPencilMode || isArrowDrawMode || isRubberMode
        root.classList.toggle('draw-mode-active', active)
        // Pan mode shows a grab cursor across the canvas (see common.css).
        root.classList.toggle('pan-mode-active', isPanMode)
    }, [isPencilMode, isArrowDrawMode, isRubberMode, isPanMode])

    const clearDrawModesFromStorage = (): void => {
        localStorage.removeItem(PENDING_SHAPE_TYPE_KEY)
        localStorage.removeItem(PENDING_SHAPE_PROPS_KEY)
        localStorage.removeItem(ARROW_DRAW_MODE_KEY)
        localStorage.removeItem(TEXT_DRAW_MODE_KEY)
        localStorage.removeItem(LAST_ADDED_ELEMENT_ID_KEY)
        localStorage.removeItem(RUBBER_MODE_KEY)
        localStorage.removeItem(PAN_MODE_KEY)
        setIsRubberMode(false)
        setPanMode(false)
    }

    return {
        pointerToggle,
        setPointerToggle,
        isPencilMode,
        setPencilMode,
        isArrowDrawMode,
        setIsArrowDrawMode,
        isTextDrawMode,
        setIsTextDrawMode,
        isRubberMode,
        eraserSize,
        isPanMode,
        setPanMode,
        togglePointer,
        togglePencilMode,
        togglePanMode,
        setRubberModeInBoard,
        setEraserSizeInBoard,
        setArrowDrawModeInBoard,
        setTextDrawModeInBoard,
        clearDrawModesFromStorage,
    }
}
