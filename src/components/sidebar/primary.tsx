import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { useQuery } from '@apollo/client'

import ShapesToolbar from './shapesToolbar'
import { GET_COMPONENT_TYPES } from '../../schema/queries'
import SpinnerWithSize from '../common/spinnerWithSize'
import { generateUUID } from '../../utils/misc'
import { prefetchElementModule } from '../../elementModules'
import { useBoardContext } from '../../views/Board/boardContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import type { ComponentRecord } from '../../types/board'
import {
    GEO_TYPE_DEFAULTS,
    POINT_CATEGORIES,
    DEFAULT_POINT_CATEGORY,
    DEFAULT_GEO_RESIST,
    DEFAULT_GEO_RING_RADIUS,
    GEO_DRAW_MODE_KEY,
    GEO_DRAW_TYPE_KEY,
    GEO_DRAW_PROPS_KEY,
    GEO_POINT_PLACE_MODE_KEY,
    LAST_ADDED_ELEMENT_ID_KEY,
} from '../../constants/misc'

import './sidebar.css'
import ShareLinkPopup from './shareLinkPopup'
import ThemeSwitcher from './themeSwitcher'
import MenuDrawer from './menuDrawer'

const DRAW_SHAPE_TYPES = ['circle', 'rectangle', 'diamond']

// Defaults used when the Hasura componentTypes catalog isn't reachable
// (craftbase runs standalone as a library without a backend). Keeps shape
// creation working end-to-end without DB seeds.
const FALLBACK_CATALOG: Record<
    string,
    { width: number; height: number; fill: string; textColor: string | null }
> = {
    rectangle: { width: 160, height: 160, fill: '#fff', textColor: '#000' },
    circle: { width: 160, height: 160, fill: '#fff', textColor: '#000' },
    diamond: { width: 160, height: 160, fill: '#fff', textColor: '#000' },
    arrowLine: { width: 100, height: 0, fill: 'transparent', textColor: null },
    line: { width: 100, height: 0, fill: 'transparent', textColor: null },
    divider: { width: 100, height: 0, fill: 'transparent', textColor: null },
    text: { width: 120, height: 36, fill: 'transparent', textColor: '#3A342C' },
}

const PrimarySidebar = (): ReactElement => {
    const {
        boardId,
        updateLastAddedElement,
        togglePointer,
        togglePencilMode,
        togglePanMode,
        addToLocalComponentStore,
        enableTextDrawMode,
        setArrowDrawModeInBoard,
        setRubberModeInBoard,
        cancelPendingElement,
        defaultLinewidth,
        defaultStrokeType,
        defaultFill,
        defaultStrokeColor,
        defaultTextFontFamily,
    } = useBoardContext()
    const [hintText, setHintText] = useState(
        'Click anywhere to place element there.'
    )
    const { loading: getComponentTypesLoading, data: getComponentTypesData } =
        useQuery(GET_COMPONENT_TYPES)

    // Verify component-type seeds are present.
    useEffect(() => {
        if (
            !getComponentTypesLoading &&
            getComponentTypesData &&
            getComponentTypesData.componentTypes.length < 1
        ) {
            console.error(
                'Error : The component types are not available from the DB. Hint: Please check if component types seeds are already populated in component type table in DB '
            )
        }
    }, [getComponentTypesData, getComponentTypesLoading])

    const handleArrowElement = (label: string): void => {
        togglePencilMode(false)
        togglePointer(false)

        const savingEl = document.getElementById('show-saving-loader')
        if (savingEl) {
            savingEl.style.opacity = '1'
            savingEl.style.zIndex = '1'
        }

        setTimeout(() => {
            if (savingEl) {
                savingEl.style.opacity = '0'
                savingEl.style.zIndex = '-1'
            }
        }, 100)

        let shapeData: ComponentRecord | null = null
        const generateId = generateUUID()

        if (getComponentTypesData) {
            getComponentTypesData.componentTypes.forEach((item) => {
                if (item.label === label) {
                    const userId = localStorage.getItem('userId')
                    shapeData = {
                        id: generateId,
                        componentType: label,
                        linewidth: defaultLinewidth,
                        strokeType: defaultStrokeType,
                        stroke: defaultStrokeColor ?? '#3A342C',
                        children: {},
                        x: -9999,
                        y: -9999,
                        x1: 0,
                        x2: 0,
                        y1: 0,
                        y2: 0,
                        boardId,
                        boardName: null,
                        radius: null,
                        iconStroke: null,
                        isDummy: null,
                        createdAt: null,
                        metadata: {
                            ...((item.metadata as Record<string, unknown>) ??
                                {}),
                            opacity: 1,
                            ...(defaultTextFontFamily && {
                                textFontFamily: defaultTextFontFamily,
                            }),
                        },
                        width: item.width ?? 120,
                        height: item.height ?? 120,
                        fill: item.fill ?? '#f4f4f2',
                        textColor: item.textColor ?? null,
                        updatedBy: userId,
                    }
                }
            })
        }

        // Fallback when the Hasura catalog isn't reachable.
        if (!shapeData && FALLBACK_CATALOG[label]) {
            const userId = localStorage.getItem('userId')
            const fb = FALLBACK_CATALOG[label]
            shapeData = {
                id: generateId,
                componentType: label,
                linewidth: defaultLinewidth,
                strokeType: defaultStrokeType,
                stroke: defaultStrokeColor ?? '#3A342C',
                children: {},
                x: -9999,
                y: -9999,
                x1: 0,
                x2: 0,
                y1: 0,
                y2: 0,
                boardId,
                boardName: null,
                radius: null,
                iconStroke: null,
                isDummy: null,
                createdAt: null,
                metadata: {
                    opacity: 1,
                    ...(defaultTextFontFamily && {
                        textFontFamily: defaultTextFontFamily,
                    }),
                },
                width: fb.width,
                height: fb.height,
                fill: fb.fill,
                textColor: fb.textColor,
                updatedBy: userId,
            }
        }

        if (!shapeData) return

        updateLastAddedElement(shapeData)
        const root = document.getElementById('main-two-root')
        if (root) root.style.cursor = 'crosshair'
        localStorage.setItem('arrowDrawMode', 'true')
        localStorage.setItem('lastAddedElementId', generateId)
        setArrowDrawModeInBoard(true)
        addToLocalComponentStore(
            (shapeData as ComponentRecord).id,
            (shapeData as ComponentRecord).componentType,
            shapeData
        )
    }

    const handleTextElement = (
        componentType: 'newText' | 'geoText' = 'newText'
    ): void => {
        const savingEl = document.getElementById('show-saving-loader')
        if (savingEl) {
            savingEl.style.opacity = '1'
            savingEl.style.zIndex = '1'
        }

        setTimeout(() => {
            if (savingEl) {
                savingEl.style.opacity = '0'
                savingEl.style.zIndex = '-1'
            }
        }, 100)

        enableTextDrawMode(componentType)
    }

    // Point: single click-to-place. Pre-create the element off-screen (like the
    // text/arrow flow) then let the canvas position it on the next click.
    const handlePointElement = (categoryArg?: string): void => {
        togglePencilMode(false)
        togglePointer(false)

        const userId = localStorage.getItem('userId')
        const generateId = generateUUID()
        const geoDef = GEO_TYPE_DEFAULTS.point
        // Category is chosen up front from the point drawer (defaults to the
        // generic pin). It drives the pin's fill/icon — stroke/fill mirror the
        // category color for any legacy reads.
        const category =
            categoryArg && POINT_CATEGORIES[categoryArg]
                ? categoryArg
                : DEFAULT_POINT_CATEGORY
        const cat = POINT_CATEGORIES[category]!

        const shapeData: ComponentRecord = {
            id: generateId,
            componentType: 'point',
            objectClass: 'geo',
            linewidth: geoDef.linewidth,
            strokeType: null,
            stroke: cat.bg,
            children: {},
            x: -9999,
            y: -9999,
            x1: 0,
            x2: 0,
            y1: 0,
            y2: 0,
            boardId,
            boardName: null,
            radius: null,
            iconStroke: null,
            isDummy: null,
            createdAt: null,
            metadata: {
                category,
                svgIcon: cat.svgIcon,
                resist: DEFAULT_GEO_RESIST,
                ringRadius: DEFAULT_GEO_RING_RADIUS,
            },
            width: DEFAULT_GEO_RING_RADIUS * 2,
            height: DEFAULT_GEO_RING_RADIUS * 2,
            fill: cat.bg,
            textColor: null,
            updatedBy: userId,
        }

        updateLastAddedElement(shapeData)
        localStorage.setItem(GEO_POINT_PLACE_MODE_KEY, 'true')
        localStorage.setItem(LAST_ADDED_ELEMENT_ID_KEY, generateId)
        addToLocalComponentStore(
            shapeData.id,
            shapeData.componentType,
            shapeData
        )
        const root = document.getElementById('main-two-root')
        if (root) root.style.cursor = 'crosshair'
    }

    // Multi-click vertex placement. Powers the geo area/route tools AND the
    // generic curved line — they share the canvas vertex-collection machinery
    // (collect on click, finish on Esc/Enter/double-click). `curvedLine` is NOT
    // a geo object, so it carries no `objectClass: 'geo'` and pulls its
    // stroke/width from the shared element defaults instead of GEO_TYPE_DEFAULTS.
    const handleMultiClickDraw = (
        label: 'area' | 'route' | 'curvedLine'
    ): void => {
        togglePencilMode(false)
        togglePointer(false)

        const isGeo = label !== 'curvedLine'
        const geoDef = isGeo ? GEO_TYPE_DEFAULTS[label] : null
        const baseProps = {
            componentType: label,
            ...(isGeo ? { objectClass: 'geo' as const } : {}),
            stroke: geoDef ? geoDef.stroke : (defaultStrokeColor ?? '#3A342C'),
            linewidth: geoDef ? geoDef.linewidth : (defaultLinewidth ?? 2.5),
            strokeType: isGeo ? null : defaultStrokeType,
            fill: 'transparent',
            boardId,
            boardName: null,
            textColor: null,
            updatedBy: localStorage.getItem('userId'),
        }

        localStorage.setItem(GEO_DRAW_MODE_KEY, 'true')
        localStorage.setItem(GEO_DRAW_TYPE_KEY, label)
        localStorage.setItem(GEO_DRAW_PROPS_KEY, JSON.stringify(baseProps))
        const root = document.getElementById('main-two-root')
        if (root) root.style.cursor = 'crosshair'

        // Nudge banner: only the curved line gets the "press Esc/Enter" hint
        // (geo area/route live in the consumer's map UI with their own affordances).
        const hint = document.getElementById('multi-click-draw-hint')
        if (hint && !isGeo) {
            hint.style.opacity = '1'
            hint.style.zIndex = '20'
        }
        // Mobile has no Esc/Enter — signal board.tsx to show the ✓/✗ draw
        // controls for the curved-line draw (matches the nudge lifecycle).
        if (!isGeo) {
            window.dispatchEvent(new CustomEvent('multiClickDrawStart'))
        }
    }

    const addElement = (label: string, category?: string): void => {
        // Warm the shape's lazy chunk NOW, while the user moves to the canvas
        // and drags (~700ms–1s). By mouseup the chunk is cached, so the
        // component mounts instantly instead of the freshly-drawn shape sitting
        // dimmed during a first-time network fetch on prod.
        if (DRAW_SHAPE_TYPES.includes(label)) {
            prefetchElementModule(label)
        }
        cancelPendingElement()
        if (label !== 'rubber') setRubberModeInBoard(false)
        if (label !== 'pan') togglePanMode(false)
        switch (label) {
            case 'pointer':
                togglePointer(true)
                break
            case 'pan':
                togglePanMode(true)
                break
            case 'pencil':
                togglePencilMode(true)
                break
            case 'rubber':
                togglePencilMode(false)
                togglePointer(false)
                setRubberModeInBoard(true)
                break
            case 'arrowLine':
                handleArrowElement(label)
                break
            case 'line':
                // A plain line draws with the exact same drag gesture as an
                // arrow (and reuses SCENARIO_ARROW_DRAW); only componentType
                // differs, which strips the arrowhead via the line factory.
                handleArrowElement(label)
                break
            case 'curvedLine':
                handleMultiClickDraw('curvedLine')
                break
            case 'text':
                handleTextElement()
                break
            case 'geoText':
                // Same one-shot click-to-place flow as text, but tagged so the
                // canvas renders the zoom-resistant geoText component.
                handleTextElement('geoText')
                break
            case 'point':
                handlePointElement(category)
                break
            case 'area':
            case 'route':
                handleMultiClickDraw(label)
                break
            default: {
                togglePencilMode(false)
                togglePointer(false)

                const savingEl = document.getElementById('show-saving-loader')
                if (savingEl) {
                    savingEl.style.opacity = '1'
                    savingEl.style.zIndex = '1'
                }

                setTimeout(() => {
                    if (DRAW_SHAPE_TYPES.includes(label)) {
                        setHintText('Click and drag to draw shape')
                    } else {
                        setHintText('Click anywhere to place element there.')
                    }
                    const clickEl = document.getElementById(
                        'show-click-anywhere-btn'
                    )
                    if (clickEl) clickEl.style.opacity = '1'
                    if (savingEl) {
                        savingEl.style.opacity = '0'
                        savingEl.style.zIndex = '-1'
                    }
                }, 100)

                let shapeData: ComponentRecord | null = null
                const randomNumber = Math.floor(Math.random() * 80 + 30)
                const generateId = generateUUID()

                if (getComponentTypesData) {
                    getComponentTypesData.componentTypes.forEach((item) => {
                        if (item.label === label) {
                            const userId = localStorage.getItem('userId')
                            const useShapeFill =
                                DRAW_SHAPE_TYPES.includes(label)
                            shapeData = {
                                id: generateId,
                                componentType: label,
                                linewidth: defaultLinewidth,
                                strokeType: defaultStrokeType,
                                stroke: defaultStrokeColor ?? '#3A342C',
                                children: {},
                                x: Math.floor(
                                    window.outerWidth -
                                        (randomNumber * window.outerWidth) / 100
                                ),
                                y: Math.floor(
                                    window.outerHeight -
                                        (randomNumber * window.outerHeight) /
                                            100
                                ),
                                x1: 0,
                                x2: label.includes('divider') ? 100 : 0,
                                y1: 0,
                                y2: 0,
                                boardId,
                                boardName: null,
                                radius: null,
                                iconStroke: null,
                                isDummy: null,
                                createdAt: null,
                                metadata: {
                                    ...((item.metadata as Record<
                                        string,
                                        unknown
                                    >) ?? {}),
                                    opacity: 1,
                                    ...(defaultTextFontFamily && {
                                        textFontFamily: defaultTextFontFamily,
                                    }),
                                },
                                width: item.width ?? 120,
                                height: item.height ?? 120,
                                fill: useShapeFill
                                    ? (defaultFill ?? item.fill ?? '#f4f4f2')
                                    : (item.fill ?? '#f4f4f2'),
                                textColor: item.textColor ?? null,
                                updatedBy: userId,
                            }
                        }
                    })
                }

                // Fallback when the DB catalog isn't reachable / doesn't
                // seed this label. Lets craftbase work standalone as a
                // library without a Hasura backend.
                if (!shapeData && FALLBACK_CATALOG[label]) {
                    const userId = localStorage.getItem('userId')
                    const fb = FALLBACK_CATALOG[label]
                    const useShapeFill = DRAW_SHAPE_TYPES.includes(label)
                    shapeData = {
                        id: generateId,
                        componentType: label,
                        linewidth: defaultLinewidth,
                        strokeType: defaultStrokeType,
                        stroke: defaultStrokeColor ?? '#3A342C',
                        children: {},
                        x: Math.floor(
                            window.outerWidth -
                                (randomNumber * window.outerWidth) / 100
                        ),
                        y: Math.floor(
                            window.outerHeight -
                                (randomNumber * window.outerHeight) / 100
                        ),
                        x1: 0,
                        x2: label.includes('divider') ? 100 : 0,
                        y1: 0,
                        y2: 0,
                        boardId,
                        boardName: null,
                        radius: null,
                        iconStroke: null,
                        isDummy: null,
                        createdAt: null,
                        metadata: {
                            opacity: 1,
                            ...(defaultTextFontFamily && {
                                textFontFamily: defaultTextFontFamily,
                            }),
                        },
                        width: fb.width,
                        height: fb.height,
                        fill: useShapeFill ? (defaultFill ?? fb.fill) : fb.fill,
                        textColor: fb.textColor,
                        updatedBy: userId,
                    }
                }

                if (!shapeData) return

                if (DRAW_SHAPE_TYPES.includes(label)) {
                    // Draw-to-place: store pending shape props, canvas creates on mouseup
                    localStorage.setItem('pendingShapeType', label)
                    localStorage.setItem(
                        'pendingShapeProps',
                        JSON.stringify(shapeData)
                    )
                    const root = document.getElementById('main-two-root')
                    if (root) root.style.cursor = 'crosshair'
                } else {
                    updateLastAddedElement(shapeData)
                    localStorage.setItem('lastAddedElementId', generateId)
                    addToLocalComponentStore(
                        (shapeData as ComponentRecord).id,
                        (shapeData as ComponentRecord).componentType,
                        shapeData
                    )
                }
            }
        }
    }
    const { isMobile } = useMediaQueryUtils()
    const isLiveSession = false
    return (
        <>
            <ShapesToolbar addElement={addElement} />
            <MenuDrawer />
            <div
                id="show-click-anywhere-btn"
                className="fixed w-full flex justify-center top-0  opacity-0
                transition-opacity ease-out duration-300"
            >
                <div
                    className="w-auto mt-2
                         bg-reds-r400 text-reds-r50
                            px-4 py-2 rounded-md shadow-md
                            "
                >
                    <div className="flex items-center  ">
                        <div className="w-auto text-sm text-left">
                            {hintText}
                        </div>
                    </div>
                </div>
            </div>
            {/* Curved-line draw nudge. Sits just under the shapes toolbar.
                Shown by handleMultiClickDraw('curvedLine'); hidden by the
                canvas on finish/cancel (finishGeoDraw / cancelGeoDraw).
                Desktop-only: mobile has no Esc/Enter and uses the on-screen
                ✓/✗ draw controls instead, so the keyboard nudge is omitted. */}
            {!isMobile && (
                <div
                    id="multi-click-draw-hint"
                    className="fixed w-full flex justify-center pointer-events-none
                opacity-0 transition-opacity ease-out duration-300"
                    style={{ top: '55px', zIndex: -1 }}
                >
                    <div className="w-auto bg-ink text-card-bg px-4 py-2 rounded-md shadow-md">
                        <div className="text-sm text-center whitespace-nowrap">
                            Click to add points · press{' '}
                            <kbd className="px-1 rounded border border-current">
                                Enter
                            </kbd>{' '}
                            or{' '}
                            <kbd className="px-1 rounded border border-current">
                                Esc
                            </kbd>{' '}
                            to finish
                        </div>
                    </div>
                </div>
            )}
            <div className="absolute top-2 right-1rem flex items-center px-2 gap-1">
                <div
                    id="show-saving-loader"
                    className="w-28 h-9 pr-2 transition-all opacity-0"
                    style={{ zIndex: -1 }}
                >
                    <div className="w-auto bg-greens-g400 text-greens-g75 px-4 py-2 rounded-md shadow-md">
                        <div className="flex items-center ">
                            <div className="w-auto text-sm text-left">
                                Saving
                            </div>
                            <div>
                                <SpinnerWithSize
                                    loaderSize="sm"
                                    customStyles={{
                                        margin: 0,
                                        marginLeft: '4px',
                                        borderBottomColor: '#ABF5D1',
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {isLiveSession && (
                    <div className="w-9 h-9 text-sm pr-2">
                        <a className="flex items-center px-4 py-2 rounded-card bg-card-bg text-ink">
                            <span className="text-sm ">Live</span>
                            <div className="ml-2  w-2 h-2 bg-reds-r400 rounded-50-percent ">
                                <div className="w-2 h-2 bg-reds-r400 rounded-50-percent animate-ping "></div>
                            </div>
                        </a>
                    </div>
                )}

                {!isMobile && <ThemeSwitcher />}
                {!isMobile && <ShareLinkPopup />}
            </div>
        </>
    )
}

export default PrimarySidebar
