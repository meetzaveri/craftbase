import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react'
import {
    staticPrimaryElementData,
    type PrimaryElement,
} from '../../utils/constants'
import { useBoardContext } from '../../views/Board/boardContext'
import { SHAPES_TOOLBAR_ID } from './shapesToolbarId'
import Tooltip from '../common/tooltip'
import UndoIcon from '../../assets/undo_amber.svg?react'
import RedoIcon from '../../assets/redo.svg?react'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import {
    ERASER_SIZES,
    ERASER_DOT_PX,
    type EraserSize,
} from '../../constants/misc'

// Hover labels for the eraser size dots. The dots' pixel sizes come from
// ERASER_DOT_PX rather than living here, because the trail drawn on the board
// reads the same map — that's what keeps the swatch and the beam identical.
const ERASER_SIZE_LABEL: Record<EraserSize, string> = {
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
}

const allElementsRaw = staticPrimaryElementData.flatMap(
    (section) => section.elements
)

// Tools whose secondary drawer behaves like a hover menu: the drawer opens on
// hover (desktop) instead of waiting for a click, and clicking the parent icon
// activates the mapped child straight away rather than only opening the drawer.
// Keyed by parent tool → the child a bare click selects.
const HOVER_DRAWER_DEFAULT_TOOL: Record<string, string> = {
    lines: 'line',
}

// The drawer closes the instant the pointer leaves it or its icon. The two are
// separated visually by a 6px gap, which the pointer would otherwise have to
// cross through dead space — one stray mousemove landing in there would close
// the drawer before it could be reached. So the drawer's hover area is extended
// upward by exactly that gap as transparent padding: the icon and the drawer
// touch as far as the pointer is concerned, while the panel still renders 6px
// clear of the toolbar.
const HOVER_DRAWER_BRIDGE_PX = 6

const flattenShapesForDesktop = (
    elements: PrimaryElement[]
): PrimaryElement[] =>
    elements.flatMap((el) =>
        el.elementName === 'shapes'
            ? el.drawerData.map((d) => ({
                  elementName: d.elementName,
                  elementDisplayName: d.elementDisplayName,
                  elementIcon: d.elementIcon,
                  hasDrawer: false,
                  noAction: false,
                  drawerData: [],
              }))
            : [el]
    )

interface ShapesToolbarProps {
    addElement: (label: string) => void
}

interface DrawerAnchor {
    left: number
    top: number
    rectTop: number
}

const ShapesToolbar = ({ addElement }: ShapesToolbarProps): ReactElement => {
    const {
        currentElement,
        setCurrentElementInBoard,
        undoLastAction,
        redoLastAction,
        historyLog,
        bucketLog,
        toolset,
        activeBase,
        selectedComponent,
        eraserSize,
        setEraserSizeInBoard,
    } = useBoardContext()
    const { isMobile } = useMediaQueryUtils()
    const [openDrawer, setOpenDrawer] = useState<string | null>(null)
    const [drawerAnchor, setDrawerAnchor] = useState<DrawerAnchor | null>(null)
    const drawerRef = useRef<HTMLDivElement | null>(null)
    // The active base decides the resting tool: the map base makes pan the home
    // tool (dragging should move the world), while the pointer stays available
    // so geo objects can still be selected. The board base keeps pointer.
    const homeTool = toolset.homeTool

    // Eraser size selector: only while the eraser is the active tool and
    // nothing on canvas is selected — a selection competing for the same
    // toolbar space would be confusing, so it steps aside.
    const showEraserSizes = currentElement === 'rubber' && !selectedComponent

    const allElements = (() => {
        const list = (
            isMobile ? allElementsRaw : flattenShapesForDesktop(allElementsRaw)
        )
            // The active base hides the tools that don't suit it (the map base
            // drops the whiteboard shape tools in favour of the geo toolset).
            // Only the toolbar is filtered — shapes already on the canvas keep
            // rendering and stay editable after a base switch.
            .filter((el) => !toolset.hiddenTools.has(el.elementName))
            // ...and contributes its own (point/area/route/geoText on the map).
            .concat(toolset.extraTools)

        // The eraser (rubber) always sits last in the toolbar order, after any
        // geo tools appended above.
        const rubberIdx = list.findIndex((el) => el.elementName === 'rubber')
        if (rubberIdx !== -1) {
            const [rubber] = list.splice(rubberIdx, 1)
            list.push(rubber!)
        }
        return list
    })()

    // Re-runs on every base switch, not just on mount: switching to the map has
    // to actually move the user onto pan, and switching back has to release it.
    // (This was mount-only while the base was a fixed build-time prop.)
    const isFirstBaseRun = useRef(true)
    useEffect(() => {
        if (isFirstBaseRun.current) {
            isFirstBaseRun.current = false
            // Mount: pan needs activating (addElement) to become the live mode;
            // pointer is the board's resting state, so a highlight is enough.
            // Kept exactly as-is so a board-base load behaves as it always did.
            if (homeTool === 'pan') addElement('pan')
            setCurrentElementInBoard(homeTool)
            return
        }
        // A real switch: go through addElement either way, because that's what
        // releases pan (`if (label !== 'pan') togglePanMode(false)`) on the way
        // back to the board base. Highlighting alone would leave pan live.
        addElement(homeTool)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBase])

    useEffect(() => {
        if (!openDrawer) return
        const handleClickOutside = (e: MouseEvent): void => {
            if (
                drawerRef.current &&
                !drawerRef.current.contains(e.target as Node)
            ) {
                setOpenDrawer(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return (): void => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [openDrawer])

    // Hover-menu plumbing for the drawers listed in HOVER_DRAWER_DEFAULT_TOOL.
    // Closing is immediate, so leaving the icon has to be able to tell "the
    // pointer went into the drawer" (keep it open) from "the pointer went
    // anywhere else" (close). It can't wait for the drawer's own mouseenter —
    // by then the drawer would already be unmounted.
    const hoverDrawerRef = useRef<HTMLDivElement | null>(null)

    const closeHoverDrawer = (): void =>
        setOpenDrawer((current) =>
            current && current in HOVER_DRAWER_DEFAULT_TOOL ? null : current
        )

    const movingIntoHoverDrawer = (e: ReactMouseEvent): boolean => {
        const to = e.relatedTarget
        return to instanceof Node && !!hoverDrawerRef.current?.contains(to)
    }

    const btnSize = isMobile ? 'w-8 h-8' : 'w-9 h-9'
    const iconSize = isMobile ? 'w-4 h-4' : 'w-5 h-5'
    // The toolbar is pinned to the bottom of the screen on mobile and the top
    // on desktop — point every tooltip away from the nearer edge so it never
    // has to clamp back over its own trigger.
    const tooltipPlacement = isMobile ? 'top' : 'bottom'

    const shapeDrawerElements =
        allElements.find((el) => el.elementName === openDrawer)?.drawerData ??
        []

    const undoButton = (
        <Tooltip label="Undo" placement={tooltipPlacement}>
            <div
                className={`
                    ${btnSize} flex items-center justify-center rounded cursor-pointer
                    transition-all ease-in-out duration-200 text-ink-muted
                    ${historyLog.length === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-accent/50 hover:text-ink'}
                `}
                onClick={(): void => {
                    if (historyLog.length > 0) {
                        undoLastAction()
                    }
                }}
            >
                <UndoIcon className={iconSize} aria-label="Undo" />
            </div>
        </Tooltip>
    )
    const redoButton = (
        <Tooltip label="Redo" placement={tooltipPlacement}>
            <div
                className={`
                    ${btnSize} flex items-center justify-center rounded cursor-pointer
                    transition-all ease-in-out duration-200 text-ink-muted
                    ${bucketLog.length === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-accent/50 hover:text-ink'}
                `}
                onClick={(): void => {
                    if (bucketLog.length > 0) {
                        redoLastAction()
                    }
                }}
            >
                <RedoIcon className={iconSize} aria-label="Redo" />
            </div>
        </Tooltip>
    )

    return (
        <div ref={drawerRef}>
            {/* Mobile: undo/redo live in their own row above the primary toolbar
                so the bottom row stays uncrowded. Desktop keeps them inline. */}
            {isMobile && (
                <div
                    className="fixed bg-card-bg border border-border-panel rounded-card flex items-center flex-row px-1 py-1 gap-0.5"
                    style={{ bottom: '64px', left: '10px', zIndex: 10 }}
                >
                    {undoButton}
                    {redoButton}
                </div>
            )}
            <div
                id={SHAPES_TOOLBAR_ID}
                className={`fixed bg-card-bg border border-border-panel rounded-card flex items-center flex-row
                    ${isMobile ? 'px-1 py-1 gap-0.5' : 'top-2 left-1/2 px-2 py-1 gap-1'}`}
                style={
                    isMobile
                        ? { bottom: '16px', left: '10px', zIndex: 10 }
                        : { transform: 'translateX(-50%)', zIndex: 10 }
                }
            >
                {allElements.map((element) => {
                    const Icon = element.elementIcon
                    const isActive =
                        currentElement === element.elementName ||
                        openDrawer === element.elementName ||
                        (element.hasDrawer &&
                            element.drawerData.some(
                                (d) => d.elementName === currentElement
                            ))
                    return (
                        <Tooltip
                            key={element.elementName}
                            label={element.elementDisplayName}
                            placement={tooltipPlacement}
                            disabled={element.hasDrawer}
                        >
                            <div
                                className={`
                                ${btnSize} flex items-center justify-center rounded cursor-pointer
                                transition-all ease-in-out duration-200
                                ${
                                    isActive
                                        ? 'bg-accent/50 text-ink dark:bg-accent/50/30 dark:text-white'
                                        : 'text-ink-muted hover:bg-accent/50 dark:hover:bg-accent/50/30 hover:text-ink'
                                }
                            `}
                                onMouseEnter={(e): void => {
                                    if (isMobile) return
                                    if (
                                        !(
                                            element.elementName in
                                            HOVER_DRAWER_DEFAULT_TOOL
                                        )
                                    ) {
                                        // Sliding onto any other tool dismisses an
                                        // open hover drawer.
                                        closeHoverDrawer()
                                        return
                                    }
                                    const rect =
                                        e.currentTarget.getBoundingClientRect()
                                    setDrawerAnchor({
                                        left: rect.left,
                                        top: rect.bottom,
                                        rectTop: rect.top,
                                    })
                                    setOpenDrawer(element.elementName)
                                }}
                                onMouseLeave={(e): void => {
                                    if (isMobile) return
                                    if (movingIntoHoverDrawer(e)) return
                                    closeHoverDrawer()
                                }}
                                onClick={(e): void => {
                                    // Hover-menu tools (e.g. Lines): a bare click
                                    // picks the default child — the drawer is for
                                    // switching to the alternative, not a required
                                    // step. It stays open so that switch is one
                                    // move away.
                                    const defaultTool =
                                        HOVER_DRAWER_DEFAULT_TOOL[
                                            element.elementName
                                        ]
                                    if (defaultTool) {
                                        const rect =
                                            e.currentTarget.getBoundingClientRect()
                                        setDrawerAnchor({
                                            left: rect.left,
                                            top: rect.bottom,
                                            rectTop: rect.top,
                                        })
                                        setOpenDrawer(element.elementName)
                                        addElement(defaultTool)
                                        setCurrentElementInBoard(defaultTool)
                                        return
                                    }
                                    if (element.hasDrawer) {
                                        const rect =
                                            e.currentTarget.getBoundingClientRect()
                                        setDrawerAnchor({
                                            left: rect.left,
                                            top: rect.bottom,
                                            rectTop: rect.top,
                                        })
                                        const isToggleClose =
                                            openDrawer === element.elementName
                                        setOpenDrawer(
                                            isToggleClose
                                                ? null
                                                : element.elementName
                                        )
                                        setCurrentElementInBoard(
                                            isToggleClose
                                                ? homeTool
                                                : element.elementName
                                        )
                                    } else {
                                        setOpenDrawer(null)
                                        if (element.elementName === 'rubber') {
                                            // Anchor for the mobile size
                                            // drawer, which renders above the
                                            // toolbar off this icon's rect.
                                            const rect =
                                                e.currentTarget.getBoundingClientRect()
                                            setDrawerAnchor({
                                                left: rect.left,
                                                top: rect.bottom,
                                                rectTop: rect.top,
                                            })
                                        }
                                        addElement(element.elementName)
                                        setCurrentElementInBoard(
                                            element.elementName
                                        )
                                    }
                                }}
                            >
                                <Icon
                                    className={iconSize}
                                    aria-label={element.elementDisplayName}
                                />
                            </div>
                        </Tooltip>
                    )
                })}
                {/* Eraser size selector — desktop only, inline in the same
                    pill right next to the eraser icon (separated by the same
                    divider style used before undo/redo). Hidden on mobile in
                    favour of the above-toolbar drawer rendered below, since
                    the fixed-width bottom bar has no room to grow inline. */}
                {!isMobile && showEraserSizes && (
                    <>
                        <div className="bg-border-panel w-px h-6 mx-1" />
                        {ERASER_SIZES.map((size) => {
                            const label = ERASER_SIZE_LABEL[size]
                            const dotPx = ERASER_DOT_PX[size]
                            const isActive = eraserSize === size
                            return (
                                <Tooltip
                                    key={size}
                                    label={label}
                                    placement={tooltipPlacement}
                                >
                                    <button
                                        type="button"
                                        aria-label={`Eraser size: `}
                                        className={`
                                        ${btnSize} flex items-center justify-center rounded cursor-pointer
                                        transition-all ease-in-out duration-200
                                        ${
                                            isActive
                                                ? 'bg-accent/50 text-ink dark:bg-accent/50/30 dark:text-white'
                                                : 'text-ink-muted hover:bg-accent/50 dark:hover:bg-accent/50/30 hover:text-ink'
                                        }
                                    `}
                                        onClick={(): void =>
                                            setEraserSizeInBoard(size)
                                        }
                                    >
                                        <span
                                            className="rounded-full bg-current pointer-events-none"
                                            style={{
                                                width: dotPx,
                                                height: dotPx,
                                            }}
                                        />
                                    </button>
                                </Tooltip>
                            )
                        })}
                    </>
                )}
                {!isMobile && (
                    <>
                        <div className="bg-border-panel w-px h-6 mx-1" />
                        {undoButton}
                        {redoButton}
                    </>
                )}
            </div>

            {openDrawer && shapeDrawerElements.length > 0 && drawerAnchor && (
                // Outer element is the hover area, not the visible panel: on
                // desktop it starts flush with the icon's bottom edge and pads
                // the 6px gap transparently (HOVER_DRAWER_BRIDGE_PX), so the
                // pointer never crosses dead space on its way in.
                <div
                    ref={hoverDrawerRef}
                    onMouseLeave={(): void => {
                        if (isMobile) return
                        closeHoverDrawer()
                    }}
                    className="fixed"
                    style={
                        isMobile
                            ? {
                                  bottom:
                                      window.innerHeight -
                                      drawerAnchor.rectTop +
                                      6,
                                  left: drawerAnchor.left,
                                  zIndex: 11,
                              }
                            : {
                                  top: drawerAnchor.top,
                                  left: drawerAnchor.left,
                                  paddingTop: HOVER_DRAWER_BRIDGE_PX,
                                  zIndex: 11,
                              }
                    }
                >
                    <div
                        className={`bg-card-bg rounded-card flex items-center flex-row
                        ${isMobile ? 'px-1 py-1 gap-0.5 border-t-2 border-accent-dark' : 'px-2 py-1 gap-1 border-b-2 border-accent-dark'}`}
                    >
                        {shapeDrawerElements.map((item) => {
                            const Icon = item.elementIcon
                            const isActive = currentElement === item.elementName
                            return (
                                <Tooltip
                                    key={item.elementName}
                                    label={item.elementDisplayName}
                                    placement={tooltipPlacement}
                                >
                                    <div
                                        className={`
                                    ${btnSize} flex items-center justify-center rounded cursor-pointer
                                    transition-all ease-in-out duration-200
                                    ${
                                        isActive
                                            ? 'bg-accent/50 text-ink dark:bg-accent/50/30 dark:text-white'
                                            : 'text-ink-muted hover:bg-accent/50 dark:hover:bg-accent/50/30 hover:text-ink'
                                    }
                                `}
                                        onClick={(): void => {
                                            addElement(item.elementName)
                                            setCurrentElementInBoard(
                                                item.elementName
                                            )
                                            setOpenDrawer(null)
                                        }}
                                    >
                                        <Icon
                                            className={iconSize}
                                            aria-label={item.elementDisplayName}
                                        />
                                    </div>
                                </Tooltip>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Eraser size selector — mobile only. Reuses the same
                above-toolbar drawer anchoring the shape drawers use; desktop
                instead renders the sizes inline (see the divider-separated
                segment next to the eraser icon). */}
            {isMobile && showEraserSizes && drawerAnchor && (
                <div
                    className="fixed bg-card-bg border border-border-panel rounded-card flex items-center flex-row px-1 py-1 gap-0.5"
                    style={{
                        bottom: window.innerHeight - drawerAnchor.rectTop + 6,
                        left: drawerAnchor.left,
                        zIndex: 11,
                    }}
                >
                    {ERASER_SIZES.map((size) => {
                        const label = ERASER_SIZE_LABEL[size]
                        const dotPx = ERASER_DOT_PX[size]
                        const isActive = eraserSize === size
                        return (
                            <Tooltip
                                key={size}
                                label={label}
                                placement={tooltipPlacement}
                            >
                                <button
                                    type="button"
                                    aria-label={`Eraser size: `}
                                    className={`
                                    ${btnSize} flex items-center justify-center rounded cursor-pointer
                                    transition-all ease-in-out duration-200
                                    ${
                                        isActive
                                            ? 'bg-accent/50 text-ink dark:bg-accent/50/30 dark:text-white'
                                            : 'text-ink-muted hover:bg-accent/50 dark:hover:bg-accent/50/30 hover:text-ink'
                                    }
                                `}
                                    onClick={(): void =>
                                        setEraserSizeInBoard(size)
                                    }
                                >
                                    <span
                                        className="rounded-full bg-current pointer-events-none"
                                        style={{
                                            width: dotPx,
                                            height: dotPx,
                                        }}
                                    />
                                </button>
                            </Tooltip>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default ShapesToolbar
