import React, { Fragment, useEffect, useMemo, useState } from 'react'

import { useBoardContext } from '../../views/Board/boardContext'
import { useMediaQueryUtils } from '../../constants/exportHooks'
import ColorPicker from '../utils/colorPicker'
import OpacitySlider from '../utils/opacitySlider'
import Tooltip from '../common/tooltip'
import { TEXT_SIZES_ARRAY, fillEssentialShades } from '../../utils/constants'
import { MIXED, inspectGroupValues } from '../../utils/groupInspect'
import { isStandaloneTextType } from '../../constants/misc'
import type { ReorderOp } from '../canvasContextMenu'
import BringToFrontIcon from '../../assets/bring-to-front.svg?react'
import BringForwardIcon from '../../assets/bring-forward.svg?react'
import SendBackwardIcon from '../../assets/send-backward.svg?react'
import SendToBackIcon from '../../assets/send-to-back.svg?react'

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

const STROKE_WIDTHS = [
    { label: '0', value: 0, strokeHeight: '0px' },
    { label: '2', value: 2, strokeHeight: '2px' },
    { label: '4', value: 4, strokeHeight: '4px' },
    { label: '6', value: 6, strokeHeight: '6px' },
]

// What sections each "set" should render, in display order.
const SETS = {
    SHAPE: ['fill', 'stroke', 'strokeWidth', 'strokeType', 'opacity'],
    ARROW: ['stroke', 'strokeWidth', 'strokeType', 'opacity'],
    PENCIL: ['stroke', 'strokeWidth', 'strokeType'],
    TEXT: ['textColor', 'textSize', 'textFont', 'opacity'],
    // Geo objects: stroke-centric. Area's fill is auto-derived from stroke, so
    // no fill control — but its outline still takes width/type like a route.
    // Point has no edit-area set: its category is chosen from the point drawer
    // in the shapes toolbar (resolveSetKey returns null for points).
    GEO_AREA: ['stroke', 'strokeWidth', 'strokeType'],
    GEO_ROUTE: ['stroke', 'strokeWidth', 'strokeType'],
    RECT_WITH_TEXT: [
        'fill',
        'stroke',
        'strokeWidth',
        'strokeType',
        'opacity',
        'textColor',
        'textSize',
        'textFont',
    ],
    // GROUP: union of every property — toolbar shows them all when a group
    // is focused. applyGroupProperty silently skips children whose element
    // type doesn't accept a given property.
    GROUP: [
        'fill',
        'stroke',
        'strokeWidth',
        'strokeType',
        'opacity',
        'textColor',
        'textSize',
        'textFont',
    ],
}

const SET_LABELS = {
    SHAPE: 'Shape',
    ARROW: 'Arrow',
    PENCIL: 'Pencil',
    TEXT: 'Text',
    RECT_WITH_TEXT: 'Shape',
    GROUP: 'Group',
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
        // otherwise fall into the SHAPE branch below. Points have no edit-area
        // panel — their category is set from the toolbar drawer.
        if (elementType === 'point') return null
        if (elementType === 'area') return 'GEO_AREA'
        if (elementType === 'route') return 'GEO_ROUTE'
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
        }
    }

    const shapeData = selectedComponent?.shape?.data
    const elementData = selectedComponent?.group?.data?.elementData
    const textData = selectedComponent?.text?.data

    // For rectangle-with-text + plain text, the text properties live in
    // different places. Resolve here so the rest is symmetric.
    const isText = isStandaloneTextType(selectedComponent?.shape?.type)
    const textNode = isText ? shapeData : textData

    const textSizeNumeric = textNode?.size
    const textSizeLabel =
        TEXT_SIZES_ARRAY.find((s) =>
            isMobile
                ? s.mobileValue === textSizeNumeric
                : s.value === textSizeNumeric
        )?.label || defaults.defaultTextSize

    return {
        fill: shapeData?.fill ?? defaults.defaultFill,
        stroke: shapeData?.stroke ?? defaults.defaultStrokeColor,
        linewidth: shapeData?.linewidth ?? defaults.defaultLinewidth,
        strokeType: elementData?.strokeType ?? 'solid',
        opacity: elementData?.metadata?.opacity ?? 1,
        textColor: isText
            ? (shapeData?.fill ?? defaults.defaultTextColor)
            : (textData?.fill ?? defaults.defaultTextColor),
        textSize: textSizeLabel,
        textFontFamily: textNode?.family ?? defaults.defaultTextFontFamily,
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
        className="pt-2 px-2 pb-2 border-b border-[#EDE7D7]"
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
        <div className="flex gap-2">
            {STROKE_WIDTHS.map(({ value: w, strokeHeight }) => {
                const isSelected = value === w
                return (
                    <button
                        key={w}
                        onClick={() => onChange(w)}
                        className={`flex-1 w-4 h-6 flex items-center justify-center rounded cursor-pointer transition-all ease-in-out duration-200 ${
                            isSelected ? 'bg-accent/20' : 'hover:bg-accent/20'
                        }`}
                        style={{
                            border: isSelected
                                ? '2px solid #C4901A'
                                : '2px solid #C4B89A',
                        }}
                    >
                        {w === 0 ? (
                            <div
                                className="my-2 w-0.5 h-0.5 rotate-45"
                                style={{
                                    background: isSelected
                                        ? '#C4901A'
                                        : '#8C7E6A',
                                }}
                            />
                        ) : (
                            <div
                                className="w-full my-2 mx-1 rounded-full"
                                style={{
                                    height: strokeHeight,
                                    backgroundColor: isSelected
                                        ? '#C4901A'
                                        : '#8C7E6A',
                                }}
                            />
                        )}
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
}: {
    value: string
    onChange: (v: string) => void
}) => (
    <div className="pt-3 px-2">
        <SectionLabel>Text Size</SectionLabel>
        <div className="flex flex-row gap-2">
            {TEXT_SIZES_ARRAY.map(({ label }) => {
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
                {families.map(({ family }) => {
                    const isSelected = value === family
                    return (
                        <button
                            key={family}
                            onClick={() => onChange(family)}
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

const ElementPropertiesToolbar = () => {
    const ctx = useBoardContext()

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

    const toggleSection = (key: string): void =>
        setExpandedSection((prev) => (prev === key ? null : key))

    // Collapse any open color picker when context changes (new selection, mode switch).
    useEffect(() => {
        setExpandedSection(null)
    }, [setKey, selectedComponent, selectedGroup])

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
            className="secondary-sidebar-content fixed bg-card-bg block text-left pb-4 rounded-card shadow-card border border-border-panel overflow-y-auto tablet:max-h-128"
            style={
                isMobile
                    ? {
                          bottom: '60px',
                          right: '10px',
                          width: '208px',
                          zIndex: 20,
                      }
                    : { left: '10px', top: '56px', width: '13rem' }
            }
        >
            <div className="w-full px-2 font-semibold text-xs pt-1 pb-1 border-b border-border-panel text-ink-muted">
                {SET_LABELS[setKey as keyof typeof SET_LABELS]}
            </div>

            {sections.includes('fill') && (
                <div
                    data-section="fill"
                    className="pt-2 px-2 pb-2 border-b border-[#EDE7D7]"
                >
                    <ColorPicker
                        title="Fill"
                        currentColor={values.fill}
                        onChangeComplete={handle('fill')}
                        isExpanded={expandedSection === 'fill'}
                        onToggleExpand={() => toggleSection('fill')}
                        essentialColors={fillEssentialShades}
                    />
                </div>
            )}

            {sections.includes('stroke') && (
                <div
                    data-section="stroke"
                    className="pt-2 px-2 pb-2 border-b border-[#EDE7D7]"
                >
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

            {sections.includes('textColor') && (
                <div
                    data-section="textColor"
                    className="pt-2 px-2 pb-2 border-b border-[#EDE7D7]"
                >
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
                />
            )}

            {sections.includes('textFont') && (
                <FontFamilyRow
                    value={values.textFontFamily}
                    onChange={handle('textFontFamily')}
                />
            )}

            {sections.includes('opacity') && (
                <div className="pt-3 px-2">
                    <SectionLabel>Opacity</SectionLabel>
                    <OpacitySlider
                        currentOpacity={values.opacity}
                        handleOnDrag={(arr): void =>
                            // Live preview while dragging: applies to the scene
                            // only (no store/history write) so the element fades
                            // in real time. The release (handleOnChange) commits.
                            handle('opacity', { preview: true })(arr[0])
                        }
                        handleOnChange={(arr) => handle('opacity')(arr[0])}
                    />
                </div>
            )}

            {showReorder && <ReorderRow onReorder={reorderSelected} />}
        </div>
    )
}

export default ElementPropertiesToolbar
