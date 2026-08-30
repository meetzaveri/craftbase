import { useState, useEffect } from 'react'
import type { ReactElement } from 'react'
import { useQuery } from '@apollo/client'

import ShapesToolbar from './shapesToolbar'
import BaseTypeSwitcher from './baseTypeSwitcher'
import PlaceSearch from './placeSearch'
import GeoTextZoomHint from '../geoTextZoomHint'
import { GET_COMPONENT_TYPES } from '../../schema/queries'
import SpinnerWithSize from '../common/spinnerWithSize'
import { generateUUID } from '../../utils/misc'
import { prefetchElementModule } from '../../elementModules'
import { useBaseContext } from '../../views/Base/baseContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import type { ComponentRecord } from '../../types/base'
import {
    GEO_TYPE_DEFAULTS,
    GEO_CIRCLE_DEFAULTS,
    POINT_COLOR,
    POINT_RADIUS,
    DEFAULT_GEO_RESIST,
    GEO_DRAW_MODE_KEY,
    GEO_DRAW_TYPE_KEY,
    GEO_DRAW_PROPS_KEY,
    GEO_POINT_PLACE_MODE_KEY,
    LAST_ADDED_ELEMENT_ID_KEY,
    pointLabelSizeFor,
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
        baseId,
        updateLastAddedElement,
        togglePointer,
        togglePencilMode,
        togglePanMode,
        addToLocalComponentStore,
        enableTextDrawMode,
        setArrowDrawModeInBase,
        setRubberModeInBase,
        cancelPendingElement,
        defaultLinewidth,
        defaultStrokeType,
        defaultFill,
        defaultStrokeColor,
        defaultTextFontFamily,
        defaultTextSize,
        activeBaseType,
    } = useBaseContext()
    const isMapBaseType = activeBaseType === 'map'
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
                        baseId,
                        baseName: null,
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
                baseId,
                baseName: null,
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
        setArrowDrawModeInBase(true)
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
    // text/arrow flow) then let the canvas position it on the next click, which
    // also opens its label editor.
    const handlePointElement = (): void => {
        togglePencilMode(false)
        togglePointer(false)

        const userId = localStorage.getItem('userId')
        const generateId = generateUUID()
        const geoDef = GEO_TYPE_DEFAULTS.point

        const shapeData: ComponentRecord = {
            id: generateId,
            componentType: 'point',
            objectClass: 'geo',
            linewidth: geoDef.linewidth,
            strokeType: null,
            // `fill` is the circle's colour and the one the user can change;
            // `stroke` mirrors it so anything reading either sees one colour.
            stroke: POINT_COLOR,
            children: {},
            x: -9999,
            y: -9999,
            x1: 0,
            x2: 0,
            y1: 0,
            y2: 0,
            baseId,
            baseName: null,
            radius: null,
            iconStroke: null,
            isDummy: null,
            createdAt: null,
            metadata: {
                // Named on placement — the canvas opens the editor as soon as
                // the element mounts.
                label: '',
                resist: DEFAULT_GEO_RESIST,
                // The label picks up the current text style, exactly like a new
                // text element does (see buildTextShapeData). The size default
                // travels as a ladder LABEL, so 'XL' chosen on a map label
                // becomes the POINT ladder's XL here — the same intent, sized
                // for a pin.
                textFontSize: pointLabelSizeFor(defaultTextSize),
                ...(defaultTextFontFamily && {
                    textFontFamily: defaultTextFontFamily,
                }),
            },
            width: POINT_RADIUS * 2,
            height: POINT_RADIUS * 2,
            fill: POINT_COLOR,
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
            baseId,
            baseName: null,
            textColor: null,
            updatedBy: localStorage.getItem('userId'),
        }

        localStorage.setItem(GEO_DRAW_MODE_KEY, 'true')
        localStorage.setItem(GEO_DRAW_TYPE_KEY, label)
        localStorage.setItem(GEO_DRAW_PROPS_KEY, JSON.stringify(baseProps))
        const root = document.getElementById('main-two-root')
        if (root) root.style.cursor = 'crosshair'

        // Nudge banner: only the curved line gets the "press Esc/Enter" hint.
        const hint = document.getElementById('multi-click-draw-hint')
        if (hint && !isGeo) {
            hint.style.opacity = '1'
            hint.style.zIndex = '20'
        }
        // Mobile has no Esc/Enter, no double-click and no right-click, so the
        // ✓/✗ controls (base.tsx) are the ONLY way to finish or abandon a
        // multi-click draw there. That's true of every tool in this family, so
        // all three raise it — area and route were left out back when they were
        // expected to finish through a consumer's own map UI, and there is no
        // consumer any more. The canvas already handles the `finishGeoDraw` /
        // `cancelGeoDraw` those buttons fire for any draw type.
        window.dispatchEvent(new CustomEvent('multiClickDrawStart'))
    }

    const addElement = (label: string): void => {
        // Warm the shape's lazy chunk NOW, while the user moves to the canvas
        // and drags (~700ms–1s). By mouseup the chunk is cached, so the
        // component mounts instantly instead of the freshly-drawn shape sitting
        // dimmed during a first-time network fetch on prod.
        if (DRAW_SHAPE_TYPES.includes(label)) {
            prefetchElementModule(label)
        }
        cancelPendingElement()
        if (label !== 'rubber') setRubberModeInBase(false)
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
                setRubberModeInBase(true)
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
                handlePointElement()
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
                                baseId,
                                baseName: null,
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
                        baseId,
                        baseName: null,
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

                // A circle drawn on a map base is a geo object, not a
                // whiteboard shape: map-only (objectClass is what
                // isRecordVisibleOnBaseType reads), half-transparent so the
                // basemap reads through it, and its outline starts as its fill
                // so it lands as one mark. Everything else about it — factory,
                // component, resize, undo, clipboard — is the whiteboard
                // circle, unchanged. Same trick the pencil plays.
                //
                // opacity goes on the top-level column, not metadata.opacity:
                // readOpacity prefers the column, and the column is what the
                // insert input and the base-load query carry.
                if (isMapBaseType && label === 'circle' && shapeData) {
                    const geoFill = GEO_CIRCLE_DEFAULTS.fill
                    shapeData = {
                        ...(shapeData as ComponentRecord),
                        objectClass: 'geo',
                        fill: geoFill,
                        stroke: geoFill,
                        linewidth:
                            defaultLinewidth ?? GEO_CIRCLE_DEFAULTS.linewidth,
                        opacity: GEO_CIRCLE_DEFAULTS.opacity,
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
            <BaseTypeSwitcher />
            <PlaceSearch />
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
            {/* One-shot tip for the "Zoom resistant" switch. Shares the
                top: 55px slot above and stands down while a multi-click draw
                is armed. */}
            <GeoTextZoomHint />
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

                {/* Both are hidden on the map base for now. They occupy the
                    same top-right corner as the place search, and the theme
                    switcher has nothing to switch there anyway — the basemap
                    ships light-only (see POINT_LABEL_COLOR's note). */}
                {!isMobile && !isMapBaseType && <ThemeSwitcher />}
                {/* Share is available everywhere — on the map base (which is
                    the whole point of a shareable map) and on mobile. The theme
                    switcher keeps both gates: it shares this corner, and the
                    basemap ships light-only so it has nothing to switch there. */}
                <ShareLinkPopup />
            </div>
        </>
    )
}

export default PrimarySidebar
