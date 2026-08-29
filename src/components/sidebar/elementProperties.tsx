import React, { Fragment, useEffect, useMemo, useState } from 'react'

import { useBaseContext } from '../../views/Base/baseContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import ColorPicker from '../utils/colorPicker'
import OpacitySlider from '../utils/opacitySlider'
import Tooltip from '../common/tooltip'
import ToggleSwitch from '../common/toggleSwitch'
import {
    TEXT_SIZES_ARRAY,
    fillEssentialShades,
    pointFillEssentialShades,
} from '../../utils/constants'
import { MIXED, inspectGroupValues } from '../../utils/groupInspect'
import { readOpacity } from '../../utils/canvasUtils'
import { isStandaloneTextType, POINT_LABEL_SIZES } from '../../constants/misc'
import { pointFontFamilyOf, pointFontSizeOf } from '../../factory/point'
import type { ReorderOp } from '../canvasContextMenu'
import BringToFrontIcon from '../../assets/bring-to-front.svg?react'
import BringForwardIcon from '../../assets/bring-forward.svg?react'
import SendBackwardIcon from '../../assets/send-backward.svg?react'
import SendToBackIcon from '../../assets/send-to-back.svg?react'
import ColoursIcon from '../../assets/colours.svg?react'
import EllypsisIcon from '../../assets/ellypsis.svg?react'
import TextIcon from '../../assets/text.svg?react'
import SunsetIcon from '../../assets/sunset.svg?react'

// Reorder icon tone — matches the toolbar's ink-mid text. The source SVGs
// hardcode a blue stroke; SVGR spreads props after the original attrs so this
// override wins (same trick as canvasContextMenu).
const REORDER_ICON_STROKE = '#8C7E6A'

const REORDER_BUTTONS: {
    op: ReorderOp
    label: string
    Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
}[] = [
    { op: 'front', label: 'Bring to Front', Icon: BringToFrontIcon },
    { op: 'forward', label: 'Bring Forward', Icon: BringForwardIcon },
    { op: 'backward', label: 'Send Backward', Icon: SendBackwardIcon },
    { op: 'back', label: 'Send to Back', Icon: SendToBackIcon },
]

const STROKE_TYPES = [
    { label: '—', value: 'solid' },
    { label: '- -', value: 'dashed' },
    { label: '...', value: 'dotted' },
]

// Mobile-only: the property groups are collapsed into a 4-way segmented control
// (one group visible at a time) so the panel never overflows a small screen.
// Each tab is a whole section, colour included — the stroke tab carries the
// stroke palette, the text tab the text palette — so editing one property
// never bounces you to another tab.
// `extras` folds opacity + reorder together. Tab icons live in src/assets and
// hardcode a blue stroke; SVGR spreads props after the original attrs so the
// `stroke` override below wins (same trick as the reorder icons).
type MobileTab = 'fill' | 'stroke' | 'text' | 'extras'

const MOBILE_TAB_ICON_ACTIVE = '#C4901A'
const MOBILE_TAB_ICON_INACTIVE = '#8C7E6A'

const MOBILE_TABS: {
    key: MobileTab
    label: string
    Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
}[] = [
    { key: 'fill', label: 'Fill', Icon: ColoursIcon },
    { key: 'stroke', label: 'Stroke', Icon: EllypsisIcon },
    { key: 'text', label: 'Text', Icon: TextIcon },
    { key: 'extras', label: 'Opacity & order', Icon: SunsetIcon },
]

// `inner` is the diameter (px) of the inner circle that visually nudges
// the actual stroke width inside a constant outer ring. `0` renders the
// "no stroke" state (a diagonal slash) instead of an inner circle.
const STROKE_WIDTHS = [
    { label: '0', value: 0, inner: 0 },
    { label: '1', value: 1, inner: 4 },
    { label: '2', value: 2, inner: 6 },
    { label: '4', value: 4, inner: 9 },
    { label: '6', value: 6, inner: 12 },
    { label: '8', value: 8, inner: 15 },
]

// What sections each "set" should render, in display order.
const SETS = {
    SHAPE: ['fill', 'stroke', 'strokeWidth', 'strokeType', 'opacity'],
    ARROW: ['stroke', 'strokeWidth', 'strokeType', 'opacity'],
    // Plain line + curved (multi-point) line — stroke-centric, no fill.
    LINE: ['stroke', 'strokeWidth', 'strokeType', 'opacity'],
    PENCIL: ['stroke', 'strokeWidth', 'strokeType', 'opacity'],
    TEXT: ['textColor', 'textSize', 'textFont', 'opacity'],
    // Map text. Same controls as whiteboard text plus the zoom-resistance
    // switch, which only geoText counter-scales for — see resolveResist in
    // utils/counterScale.ts. Keeping it out of TEXT is the point of the split:
    // a plain newText has nothing to toggle.
    GEO_TEXT: ['textColor', 'textSize', 'textFont', 'zoomResist', 'opacity'],
    // Geo objects: stroke-centric. Area's fill is auto-derived from stroke, so
    // no fill control — but its outline still takes width/type like a route.
    // A point is a filled circle plus a label whose colour is fixed by design,
    // so what is editable is the pin's fill and the label's size and font. Both
    // text controls run off the point's own ladder/record — see applyProperty.
    GEO_POINT: ['fill', 'textSize', 'textFont'],
    GEO_AREA: ['stroke', 'strokeWidth', 'strokeType'],
    GEO_ROUTE: ['stroke', 'strokeWidth', 'strokeType'],
    RECT_WITH_TEXT: [
        'fill',
        'stroke',
        'strokeWidth',
        'strokeType',
        'textColor',
        'textSize',
        'textFont',
        'opacity',
    ],
    // GROUP: union of every property — toolbar shows them all when a group
    // is focused. applyGroupProperty silently skips children whose element
    // type doesn't accept a given property.
    GROUP: [
        'fill',
        'stroke',
        'strokeWidth',
        'strokeType',
        'textColor',
        'textSize',
        'textFont',
        'opacity',
    ],
}

const SET_LABELS = {
    SHAPE: 'Shape',
    ARROW: 'Arrow',
    LINE: 'Line',
    PENCIL: 'Pencil',
    TEXT: 'Text',
    GEO_TEXT: 'Text',
    RECT_WITH_TEXT: 'Shape',
    GROUP: 'Group',
    GEO_POINT: 'Point',
    GEO_AREA: 'Area',
    GEO_ROUTE: 'Route',
}

interface ResolveSetKeyOptions {
    isRubberMode: boolean
    isPencilMode: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedComponent: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedGroup: any
    isTextDrawMode: boolean
    // Active tool from the toolbar (e.g. 'route'/'area'/'point' while a geo
    // draw is in progress, before any vertex/element is selected).
    currentElement: string | null
}

function resolveSetKey({
    isRubberMode,
    isPencilMode,
    selectedComponent,
    selectedGroup,
    isTextDrawMode,
    currentElement,
}: ResolveSetKeyOptions): string | null {
    // A focused group beats every other mode — show the union toolbar.
    if (selectedGroup) return 'GROUP'
    if (isRubberMode) return null
    if (isPencilMode) return 'PENCIL'
    if (selectedComponent) {
        const shapeType = selectedComponent?.shape?.type
        const hasText = typeof selectedComponent?.text?.data?.value === 'string'
        const elementType =
            selectedComponent?.group?.data?.elementData?.componentType
        // Geo objects checked first: area/route are path-typed and would
        // otherwise fall into the SHAPE branch below, and a point's circle
        // would read as a plain shape and offer stroke/width controls it has
        // no use for.
        if (elementType === 'point') return 'GEO_POINT'
        if (elementType === 'area') return 'GEO_AREA'
        if (elementType === 'route') return 'GEO_ROUTE'
        // Map text, before the isStandaloneTextType checks below would fold it
        // into the shared TEXT set. Both spellings are checked because
        // `shape.type` is set from elementData.componentType for a selection
        // made on the canvas, while the elementType fallback covers the paths
        // that don't populate it.
        if (shapeType === 'geoText' || elementType === 'geoText')
            return 'GEO_TEXT'
        // Plain + curved lines: stroke-centric panel (no fill).
        if (elementType === 'line' || elementType === 'curvedLine')
            return 'LINE'
        // rectangle/diamond/circle all carry text the same way — show the
        // shape+text toolbar (text size/color/font) for any of them.
        const isShapeWithText =
            hasText &&
            (shapeType === 'rectangle' ||
                elementType === 'rectangle' ||
                elementType === 'diamond' ||
                elementType === 'circle')
        if (isShapeWithText) return 'RECT_WITH_TEXT'
        if (
            shapeType === 'rectangle' ||
            shapeType === 'circle' ||
            shapeType === 'ellipse' ||
            shapeType === 'diamond' ||
            shapeType === 'path' ||
            shapeType === 'rounded-rectangle'
        )
            return 'SHAPE'
        if (shapeType === 'arrowLine') return 'ARROW'
        if (shapeType === 'line' || shapeType === 'curvedLine') return 'LINE'
        if (isStandaloneTextType(shapeType)) return 'TEXT'
        // Diamond is a custom Path; the elementData carries the type.
        if (
            elementType === 'diamond' ||
            elementType === 'rectangle' ||
            elementType === 'circle'
        )
            return 'SHAPE'
        if (elementType === 'arrowLine') return 'ARROW'
        if (isStandaloneTextType(elementType)) return 'TEXT'
        if (elementType === 'pencil') return 'PENCIL'
        return 'SHAPE'
    }
    // Arrow intentionally has no armed-mode panel: the ARROW toolbar appears
    // only once a drawn arrow is selected (handled above), so merely picking the
    // arrow tool doesn't surface the edit toolbar.
    if (isTextDrawMode) return 'TEXT'
    // Geo draw modes: the toolbar tool is active but nothing is selected yet.
    // Surface the geo property panel so stroke edits seed the next draw — the
    // same way pencil mode shows the pencil panel before the first stroke.
    // Point is excluded: its category lives in the toolbar drawer, not here.
    if (currentElement === 'area') return 'GEO_AREA'
    if (currentElement === 'route') return 'GEO_ROUTE'
    // Curved-line tool armed (multi-click): show the line panel so a stroke
    // tweak seeds the next draw, mirroring pencil/geo behavior.
    if (currentElement === 'curvedLine') return 'LINE'
    // No selection and no active tool — hide the panel. Defaults still apply
    // to the next-created shape (the `useElementDefaults` state is unchanged);
    // users edit them by selecting a shape, which auto-syncs the default per
    // createApplyProperty.
    return null
}

interface ReadEffectiveValuesOptions {
    setKey: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedComponent: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedGroup: any
    isMobile: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaults: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readEffectiveValues({
    setKey,
    selectedComponent,
    selectedGroup,
    isMobile,
    defaults,
}: ReadEffectiveValuesOptions): any {
    // Group mode: walk the group's children and report common values, falling
    // back to defaults when no child carries the property and to MIXED when
    // children disagree.
    if (setKey === 'GROUP' && selectedGroup) {
        const inspected = inspectGroupValues(selectedGroup, defaults)
        // textSize is stored numeric in metadata; map to the toolbar label.
        let textSizeOut = inspected.textSize
        if (textSizeOut !== MIXED) {
            const match = TEXT_SIZES_ARRAY.find((s) =>
                isMobile
                    ? s.mobileValue === textSizeOut
                    : s.value === textSizeOut
            )
            textSizeOut = match?.label ?? defaults.defaultTextSize
        }
        return { ...inspected, textSize: textSizeOut }
    }
    if (!selectedComponent) {
        // Pure default mode — pencil/arrow/shape all share the same defaults.
        return {
            fill: defaults.defaultFill,
            stroke: defaults.defaultStrokeColor,
            linewidth: defaults.defaultLinewidth,
            strokeType: defaults.defaultStrokeType ?? 'solid',
            opacity: defaults.defaultOpacity ?? 1,
            textColor: defaults.defaultTextColor,
            textSize: defaults.defaultTextSize,
            textFontFamily: defaults.defaultTextFontFamily,
            zoomResistant: true,
        }
    }

    const shapeData = selectedComponent?.shape?.data
    const elementData = selectedComponent?.group?.data?.elementData
    const textData = selectedComponent?.text?.data

    // For rectangle-with-text + plain text, the text properties live in
    // different places. Resolve here so the rest is symmetric.
    const isText = isStandaloneTextType(selectedComponent?.shape?.type)
    const textNode = isText ? shapeData : textData

    // A point's label is a bare Two.Text in the point's group, not a text
    // layer, so `textNode` is empty for one — and its size and font are per
    // record, off its own ladder, never the live defaults.
    const isPoint = elementData?.componentType === 'point'
    const textSizeNumeric = isPoint
        ? pointFontSizeOf(elementData)
        : textNode?.size
    const sizeLadder = isPoint ? POINT_LABEL_SIZES : TEXT_SIZES_ARRAY
    const textSizeLabel =
        sizeLadder.find((s) =>
            isMobile && !isPoint
                ? (s as { mobileValue?: number }).mobileValue ===
                  textSizeNumeric
                : s.value === textSizeNumeric
        )?.label || (isPoint ? 'M' : defaults.defaultTextSize)

    return {
        fill: shapeData?.fill ?? defaults.defaultFill,
        stroke: shapeData?.stroke ?? defaults.defaultStrokeColor,
        linewidth: shapeData?.linewidth ?? defaults.defaultLinewidth,
        strokeType: elementData?.strokeType ?? 'solid',
        // Opacity lives in the top-level `opacity` field (legacy rows fall
        // back to metadata.opacity).
        opacity: readOpacity(elementData),
        textColor: isText
            ? (shapeData?.fill ?? defaults.defaultTextColor)
            : (textData?.fill ?? defaults.defaultTextColor),
        textSize: textSizeLabel,
        textFontFamily: isPoint
            ? pointFontFamilyOf(elementData)
            : (textNode?.family ?? defaults.defaultTextFontFamily),
        // Per record, off the element's own row — never a default. Absent/null
        // means the column was never written, which reads as zoom-resistant.
        zoomResistant: elementData?.zoomResistant ?? true,
    }
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="w-full text-ink-muted font-normal text-xs pl-0 mb-2">
        {children}
    </div>
)

const ReorderRow = ({ onReorder }: { onReorder: (op: ReorderOp) => void }) => (
    <div
        data-section="reorder"
        className="pt-2 px-2 pb-2 border-b border-border-panel"
    >
        <SectionLabel>Reorder</SectionLabel>
        <div className="flex gap-2">
            {REORDER_BUTTONS.map(({ op, label, Icon }) => (
                <Tooltip key={op} label={label} placement="top">
                    <button
                        type="button"
                        aria-label={label}
                        onClick={() => onReorder(op)}
                        className="flex-1 h-8 flex items-center justify-center rounded cursor-pointer transition-colors ease-in-out duration-150 border border-border-card hover:bg-accent/20"
                    >
                        <Icon
                            width={15}
                            height={15}
                            stroke={REORDER_ICON_STROKE}
                            strokeWidth={2}
                        />
                    </button>
                </Tooltip>
            ))}
        </div>
    </div>
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StrokeWidthRow = ({
    value,
    onChange,
}: {
    value: any
    onChange: (v: number) => void
}) => (
    <div id="stroke-width-section" className="pt-2 px-2">
        <SectionLabel>Stroke Width</SectionLabel>
        <div className="flex justify-between">
            {STROKE_WIDTHS.map(({ value: w, inner }) => {
                const isSelected = value === w
                const accent = isSelected ? '#C4901A' : '#8C7E6A'
                return (
                    <button
                        key={w}
                        onClick={() => onChange(w)}
                        title={`${w}px`}
                        className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full cursor-pointer border-2 transition-all ease-in-out duration-200 ${
                            isSelected
                                ? 'border-accent-dark'
                                : 'border-transparent hover:border-accent-dark/40'
                        }`}
                    >
                        {/* outer ring (constant) */}
                        <div
                            className="relative flex items-center justify-center rounded-full"
                            style={{
                                width: '20px',
                                height: '20px',
                                border: `1.5px solid ${accent}`,
                            }}
                        >
                            {w === 0 ? (
                                /* "no stroke" — diagonal slash across the ring */
                                <div
                                    className="absolute rotate-45 rounded-full"
                                    style={{
                                        width: '18px',
                                        height: '1.5px',
                                        background: accent,
                                    }}
                                />
                            ) : (
                                /* inner circle nudges the actual stroke width */
                                <div
                                    className="rounded-full"
                                    style={{
                                        width: `${inner}px`,
                                        height: `${inner}px`,
                                        backgroundColor: accent,
                                    }}
                                />
                            )}
                        </div>
                    </button>
                )
            })}
        </div>
    </div>
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StrokeTypeRow = ({
    value,
    onChange,
}: {
    value: any
    onChange: (v: string) => void
}) => (
    <div id="stroke-type-section" className="pt-3 px-2">
        <SectionLabel>Stroke Type</SectionLabel>
        <div className="flex gap-2">
            {STROKE_TYPES.map(({ label, value: v }) => {
                const isSelected = (value ?? 'solid') === v
                return (
                    <button
                        key={v}
                        onClick={() => onChange(v)}
                        className={`flex-1 w-4 h-6 flex items-center justify-center rounded cursor-pointer transition-all ease-in-out duration-200 ${
                            isSelected ? 'bg-accent/20' : 'hover:bg-accent/20'
                        }`}
                        style={{
                            border: isSelected
                                ? '2px solid #C4901A'
                                : '1px solid #C4B89A',
                        }}
                    >
                        <span
                            className="text-base font-bold tracking-widest"
                            style={{
                                color: isSelected ? '#C4901A' : '#8C7E6A',
                                paddingBottom:
                                    v === 'dotted' ? '0.4rem' : '0px',
                            }}
                        >
                            {label}
                        </span>
                    </button>
                )
            })}
        </div>
    </div>
)

const TextSizeRow = ({
    value,
    onChange,
    // The ladder to offer. Defaults to the whiteboard's; a point passes its own
    // (POINT_LABEL_SIZES), which is tighter and starts smaller.
    sizes = TEXT_SIZES_ARRAY,
}: {
    value: string
    onChange: (v: string) => void
    sizes?: { label: string }[]
}) => (
    <div className="pt-3 px-2">
        <SectionLabel>Text Size</SectionLabel>
        <div className="flex flex-row gap-2">
            {sizes.map(({ label }) => {
                const isSelected = value === label
                return (
                    <button
                        key={label}
                        onClick={() => onChange(label)}
                        className={`w-9 h-8 text-xs font-semibold border rounded transition-colors ${
                            isSelected
                                ? 'bg-accent/20 text-accent-dark border-accent-dark border-2'
                                : 'bg-card-bg text-ink-mid border-border-card hover:bg-accent/20'
                        }`}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    </div>
)

const FontFamilyRow = ({
    value,
    onChange,
}: {
    value: string
    onChange: (v: string) => void
}) => {
    const families = [
        { label: 'Caveat', family: 'Caveat' },
        { label: 'Geist', family: 'Geist' },
        { label: 'Caveat Brush', family: 'Caveat Brush' },
    ]
    return (
        <div className="pt-3 px-2">
            <SectionLabel>Font</SectionLabel>
            <div className="flex flex-row gap-2">
                {families.map(({ label, family }) => {
                    const isSelected = value === family
                    return (
                        <button
                            key={family}
                            onClick={() => onChange(family)}
                            aria-label={label}
                            style={{ fontFamily: family }}
                            className={`w-12 h-8 text-sm border rounded transition-colors ${
                                isSelected
                                    ? 'bg-accent/20 text-accent-dark border-accent-dark border-2'
                                    : 'bg-card-bg text-ink-mid border-border-card hover:bg-accent/20'
                            }`}
                        >
                            Aa
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// Map text only. Checked (the default for every record) counter-scales the
// label so it holds a constant on-screen size across the map's 18 zoom stops;
// unchecked drops it to resist 0, so it grows and shrinks with the geography.
// One row per element — see applyProperty's zoomResistant branch.
const ZoomResistRow = ({
    value,
    onChange,
}: {
    value: boolean
    onChange: (v: boolean) => void
}) => (
    <div className="pt-3 px-2 flex items-center justify-between gap-2">
        <label
            htmlFor="zoom-resist-toggle"
            className="text-ink-muted font-normal text-xs"
        >
            Zoom resistant
        </label>
        <ToggleSwitch
            id="zoom-resist-toggle"
            checked={value}
            onChange={onChange}
            label="Zoom resistant"
        />
    </div>
)

const MobileTabBar = ({
    tabs,
    active,
    onSelect,
}: {
    tabs: typeof MOBILE_TABS
    active: MobileTab
    onSelect: (key: MobileTab) => void
}) => (
    <div className="flex gap-1 px-2 py-2 border-t border-border-panel shrink-0">
        {tabs.map(({ key, label, Icon }) => {
            const isActive = active === key
            return (
                <button
                    key={key}
                    type="button"
                    aria-label={label}
                    aria-pressed={isActive}
                    onClick={() => onSelect(key)}
                    className={`flex-1 h-8 flex items-center justify-center rounded cursor-pointer transition-colors ${
                        isActive
                            ? 'bg-accent/20 border-2 border-accent-dark'
                            : 'border border-border-card hover:bg-accent/20'
                    }`}
                >
                    <Icon
                        width={20}
                        height={20}
                        strokeWidth={1.5}
                        stroke={
                            isActive
                                ? MOBILE_TAB_ICON_ACTIVE
                                : MOBILE_TAB_ICON_INACTIVE
                        }
                    />
                </button>
            )
        })}
    </div>
)

const ElementPropertiesToolbar = () => {
    const ctx = useBaseContext()

    const {
        isPencilMode,
        isTextDrawMode,
        isRubberMode,
        selectedComponent,
        selectedGroup,
        currentElement,
        applyProperty,
        applyGroupProperty,
        reorderSelected,
        isElementDragging,
        showMobileToolbarPanel,
        // defaults
        defaultFill,
        defaultStrokeColor,
        defaultLinewidth,
        defaultStrokeType,
        defaultOpacity,
        defaultTextColor,
        defaultTextSize,
        defaultTextFontFamily,
    } = ctx
    const { isMobile } = useMediaQueryUtils()

    const setKey = useMemo(
        () =>
            resolveSetKey({
                isRubberMode,
                isPencilMode,
                selectedComponent,
                selectedGroup,
                isTextDrawMode,
                currentElement,
            }),
        [
            isRubberMode,
            isPencilMode,
            selectedComponent,
            selectedGroup,
            isTextDrawMode,
            currentElement,
        ]
    )

    const defaults = {
        defaultFill,
        defaultStrokeColor,
        defaultLinewidth,
        defaultStrokeType,
        defaultOpacity,
        defaultTextColor,
        defaultTextSize,
        defaultTextFontFamily,
    }

    const [values, setValues] = useState(() =>
        readEffectiveValues({
            setKey: setKey || 'SHAPE',
            selectedComponent,
            selectedGroup,
            isMobile,
            defaults,
        })
    )

    const [expandedSection, setExpandedSection] = useState<string | null>(null)

    // Mobile-only active segment. Resets to the first tab on any context change
    // / panel re-open below. `availableMobileTabs` clamps this to a tab the
    // current element actually has, so a set without a fill (an arrow, a line)
    // lands on its stroke tab rather than an empty one.
    const [mobileTab, setMobileTab] = useState<MobileTab>('fill')

    const toggleSection = (key: string): void =>
        setExpandedSection((prev) => (prev === key ? null : key))

    // Collapse any open color picker + reset the mobile tab to the first group
    // when context changes (new selection, mode switch, panel re-open).
    useEffect(() => {
        setExpandedSection(null)
        setMobileTab('fill')
    }, [setKey, selectedComponent, selectedGroup, showMobileToolbarPanel])

    // Re-sync local UI state whenever the source of truth changes (selection,
    // mode, or any default). Property mutations bump a default, which flows
    // through this effect to refresh the readouts.
    useEffect(() => {
        if (!setKey) return
        setValues(
            readEffectiveValues({
                setKey,
                selectedComponent,
                selectedGroup,
                isMobile,
                defaults,
            })
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        setKey,
        selectedComponent,
        selectedGroup,
        isMobile,
        defaultFill,
        defaultStrokeColor,
        defaultLinewidth,
        defaultStrokeType,
        defaultOpacity,
        defaultTextColor,
        defaultTextSize,
        defaultTextFontFamily,
    ])

    if (!setKey) return null
    if (isMobile && !showMobileToolbarPanel) return null
    // Hide while the selected element/group is being dragged/resized so the
    // fixed panel doesn't sit under it mid-interaction; it returns on release.
    if (isElementDragging) return null

    const sections = SETS[setKey as keyof typeof SETS]
    // Reorder controls apply to an actually-selected element (single shape or
    // group). Hidden in pencil mode (armed pencil has no selection to reorder)
    // and in the default/armed-tool panels where nothing is selected yet.
    const showReorder =
        Boolean(selectedComponent || selectedGroup) && !isPencilMode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle =
        (key: string, opts?: { preview?: boolean }) =>
        (val: any): void => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setValues((prev: any) => ({ ...prev, [key]: val }))
            if (selectedGroup) {
                // textSize comes through as a label (e.g. 'M'); resolve to the
                // numeric Two.js size before forwarding to the bulk apply path.
                // The single-element path goes through handleTextSizeChange which
                // does this conversion internally; the group path doesn't, so we
                // do it here.
                if (key === 'textSize') {
                    const entry = TEXT_SIZES_ARRAY.find((s) => s.label === val)
                    const numeric = entry
                        ? isMobile
                            ? entry.mobileValue
                            : entry.value
                        : val
                    applyGroupProperty?.(key, numeric, opts)
                } else {
                    applyGroupProperty?.(key, val, opts)
                }
                return
            }
            applyProperty?.(key, val, opts)
        }

    // Build each property group once, then lay them out differently per device:
    // desktop stacks them all; mobile shows one group at a time via the bottom
    // segmented bar.
    //
    // A group owns its own colour. The three palettes used to be stacked
    // together above every other control, which read as one undifferentiated
    // corridor of swatches and put "Stroke" three rows away from the stroke
    // width it belongs to. Now each palette sits at the head of the section it
    // edits. Mobile is the sharper case: a tab is a complete section, so the
    // stroke tab no longer sends you back to the colours tab mid-edit.
    const fillGroup = sections.includes('fill') ? (
        <div className="pb-2 border-b border-border-panel">
            <div data-section="fill" className="pt-2 px-2">
                <ColorPicker
                    title="Fill"
                    currentColor={values.fill}
                    onChangeComplete={handle('fill')}
                    isExpanded={expandedSection === 'fill'}
                    onToggleExpand={() => toggleSection('fill')}
                    // A point's quick row runs dark; every other fill
                    // stays pastel. See pointFillEssentialShades.
                    essentialColors={
                        setKey === 'GEO_POINT'
                            ? pointFillEssentialShades
                            : fillEssentialShades
                    }
                />
            </div>
        </div>
    ) : null

    const strokeGroup =
        sections.includes('stroke') ||
        sections.includes('strokeWidth') ||
        sections.includes('strokeType') ? (
            <div className="pb-3 border-b border-border-panel">
                {sections.includes('stroke') && (
                    <div data-section="stroke" className="pt-2 px-2">
                        <ColorPicker
                            title="Stroke"
                            currentColor={values.stroke}
                            onChangeComplete={handle('stroke')}
                            isExpanded={expandedSection === 'stroke'}
                            onToggleExpand={() => toggleSection('stroke')}
                        />
                    </div>
                )}

                {sections.includes('strokeWidth') && (
                    <StrokeWidthRow
                        value={values.linewidth}
                        onChange={handle('linewidth')}
                    />
                )}

                {sections.includes('strokeType') && (
                    <StrokeTypeRow
                        value={values.strokeType}
                        onChange={handle('strokeType')}
                    />
                )}
            </div>
        ) : null

    const textGroup =
        sections.includes('textColor') ||
        sections.includes('textSize') ||
        sections.includes('textFont') ||
        sections.includes('zoomResist') ? (
            <div className="pb-3 border-b border-border-panel">
                {sections.includes('textColor') && (
                    <div data-section="textColor" className="pt-2 px-2">
                        <ColorPicker
                            title="Text"
                            currentColor={values.textColor}
                            onChangeComplete={handle('textColor')}
                            isExpanded={expandedSection === 'textColor'}
                            onToggleExpand={() => toggleSection('textColor')}
                        />
                    </div>
                )}

                {sections.includes('textSize') && (
                    <TextSizeRow
                        value={values.textSize}
                        onChange={handle('textSize')}
                        sizes={
                            setKey === 'GEO_POINT'
                                ? POINT_LABEL_SIZES
                                : undefined
                        }
                    />
                )}

                {sections.includes('textFont') && (
                    <FontFamilyRow
                        value={values.textFontFamily}
                        onChange={handle('textFontFamily')}
                    />
                )}

                {sections.includes('zoomResist') && (
                    <ZoomResistRow
                        value={values.zoomResistant}
                        onChange={handle('zoomResistant')}
                    />
                )}
            </div>
        ) : null

    const opacityGroup = sections.includes('opacity') ? (
        <div className="pt-3 px-2 pb-3 border-b border-border-panel">
            <SectionLabel>Opacity</SectionLabel>
            <OpacitySlider
                isMixed={values.opacity === MIXED}
                currentOpacity={
                    typeof values.opacity === 'number' ? values.opacity : 1
                }
                handleOnDrag={(arr): void =>
                    // Live preview while dragging: applies to the scene only
                    // (no store/history write) so the element fades in real
                    // time. The release (handleOnChange) commits.
                    handle('opacity', { preview: true })(arr[0])
                }
                handleOnChange={(arr) => handle('opacity')(arr[0])}
            />
        </div>
    ) : null

    const reorderGroup = showReorder ? (
        <ReorderRow onReorder={reorderSelected} />
    ) : null

    // Mobile: only surface tabs that actually have content for this element.
    // `extras` folds opacity + reorder together (per the mobile spec).
    const availableMobileTabs = MOBILE_TABS.filter(({ key }) => {
        if (key === 'fill') return Boolean(fillGroup)
        if (key === 'stroke') return Boolean(strokeGroup)
        if (key === 'text') return Boolean(textGroup)
        return Boolean(opacityGroup) || Boolean(reorderGroup)
    })
    // Clamp the active tab to one that exists — the state may still point at a
    // tab the previous selection had but this one doesn't.
    const activeMobileTab: MobileTab = availableMobileTabs.some(
        (t) => t.key === mobileTab
    )
        ? mobileTab
        : (availableMobileTabs[0]?.key ?? 'fill')

    let mobileActiveContent: React.ReactNode
    if (activeMobileTab === 'fill') mobileActiveContent = fillGroup
    else if (activeMobileTab === 'stroke') mobileActiveContent = strokeGroup
    else if (activeMobileTab === 'text') mobileActiveContent = textGroup
    else
        mobileActiveContent = (
            <>
                {opacityGroup}
                {reorderGroup}
            </>
        )

    return (
        <div
            id="floating-toolbar"
            // While a group is focused, prevent the toolbar from stealing
            // DOM focus on mousedown — the group SVG fires `blur` (and tears
            // itself down) the moment focus moves elsewhere. Clicks still
            // fire normally. Skip text inputs so the hex field in ColorPicker
            // can still receive focus.
            onMouseDown={(e): void => {
                if (!selectedGroup) return
                const tag = (e.target as HTMLElement | null)?.tagName
                if (tag === 'INPUT' || tag === 'TEXTAREA') return
                e.preventDefault()
            }}
            className={
                isMobile
                    ? 'secondary-sidebar-content fixed bg-card-bg flex flex-col text-left rounded-card border border-border-panel overflow-hidden'
                    : 'secondary-sidebar-content fixed bg-card-bg block text-left pb-4 rounded-card border border-border-panel overflow-y-auto tablet:max-h-128'
            }
            style={
                isMobile
                    ? {
                          bottom: '60px',
                          right: '10px',
                          width: '208px',
                          zIndex: 20,
                          // Anchored to the bottom; cap the height to the space
                          // above so a tall group still scrolls inside the panel
                          // instead of overflowing past the top of the screen.
                          maxHeight: 'calc(100dvh - 70px)',
                      }
                    : { left: '10px', top: '56px', width: '13rem' }
            }
        >
            <div className="w-full px-2 font-semibold text-xs pt-1 pb-1 border-b border-border-panel text-ink-muted shrink-0">
                {SET_LABELS[setKey as keyof typeof SET_LABELS]}
            </div>

            {isMobile ? (
                <>
                    {/* Content for the active segment, scrollable if tall. */}
                    <div className="flex-1 overflow-y-auto">
                        {mobileActiveContent}
                    </div>
                    <MobileTabBar
                        tabs={availableMobileTabs}
                        active={activeMobileTab}
                        onSelect={setMobileTab}
                    />
                </>
            ) : (
                <>
                    {fillGroup}
                    {strokeGroup}
                    {textGroup}
                    {opacityGroup}
                    {reorderGroup}
                </>
            )}
        </div>
    )
}

export default ElementPropertiesToolbar
