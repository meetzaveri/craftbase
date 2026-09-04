import {
    strokeTypeToDashes,
    clearDashesOnTwoJSShape,
    strokeToAreaFill,
} from './misc'
import { getShapeTextNodes } from './canvasUtils'
import { buildPointVisual } from '../factory/point'
import {
    POINT_CATEGORIES,
    DEFAULT_POINT_CATEGORY,
    DEFAULT_GEO_RING_RADIUS,
} from '../constants/misc'

// Scene-bound selectedComponent shape: `.shape.data`, `.text.data`, and
// `.group.data.elementData` are scaffolded by newCanvas / element renderers
// (Stages 7–9). Loose-but-bounded here so applyProperty can compile without
// dragging in the still-JS canvas types.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SelectedComponentLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentRow = Record<string, any>

type PropertyKey =
    | 'fill'
    | 'stroke'
    | 'linewidth'
    | 'strokeType'
    | 'opacity'
    | 'textColor'
    | 'textSize'
    | 'textFontFamily'

export interface ApplyPropertyDeps {
    selectedComponent: SelectedComponentLike | null
    twoJSInstance: TwoLike | null
    updateComponentBulkPropertiesInLocalStore: (
        id: string,
        bulkObj: Partial<ComponentRow>
    ) => void
    updateBulkPropsForRectangleWithText?: (
        id: string,
        bulkObj: Partial<ComponentRow>
    ) => void
    handleTextSizeChange?: (value: unknown) => void
    handleRectangleTextSizeChange?: (value: unknown) => void
    handleTextFontFamilyChange?: (value: unknown) => void
    handleRectangleTextFontFamilyChange?: (value: unknown) => void
    setDefaultFill: (value: string) => void
    setDefaultStrokeColor: (value: string) => void
    setDefaultLinewidth: (value: number) => void
    setDefaultStrokeType: (value: string | null) => void
    setDefaultOpacity: (value: number) => void
    setDefaultTextColor: (value: string) => void
    setDefaultTextSize: (value: string) => void
    setDefaultTextFontFamily: (value: string) => void
}

// Applies a property change to the relevant default and (if present) the
// currently-selected element. This is the single mutation path used by the
// unified element-properties toolbar.
//
// Property keys are toolbar-facing names:
//   fill, stroke, linewidth, strokeType, opacity,
//   textColor, textSize, textFontFamily
//
// strokeType values are the UI labels: 'solid' | 'dashed' | 'dotted'.
// Defaults store null for 'solid' (matches what primary.js feeds into new
// shapes); DB rows store the literal 'solid'/'dashed'/'dotted' string.
export function createApplyProperty(deps: ApplyPropertyDeps) {
    return function applyProperty(
        propertyKey: PropertyKey | string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any,
        // `preview` applies the change to the live Two.js scene only, skipping
        // the store/history/default writes — used for continuous slider drags so
        // the element updates in real time without spamming the undo stack. The
        // final value is committed normally (no preview) on release.
        opts?: { preview?: boolean }
    ): void {
        const {
            selectedComponent,
            twoJSInstance,
            updateComponentBulkPropertiesInLocalStore,
            updateBulkPropsForRectangleWithText,
            handleTextSizeChange,
            handleRectangleTextSizeChange,
            handleTextFontFamilyChange,
            handleRectangleTextFontFamilyChange,
            setDefaultFill,
            setDefaultStrokeColor,
            setDefaultLinewidth,
            setDefaultStrokeType,
            setDefaultTextColor,
            setDefaultTextSize,
            setDefaultTextFontFamily,
        } = deps

        // 1. Update the matching default. Opacity is deliberately excluded — it
        // is a per-element property only and must never persist as a default,
        // otherwise drawing a new shape after dimming one (e.g. to 0%) would
        // produce an invisible shape. Skipped entirely in preview mode.
        if (!opts?.preview) {
            if (propertyKey === 'fill') setDefaultFill(value)
            else if (propertyKey === 'stroke') setDefaultStrokeColor(value)
            else if (propertyKey === 'linewidth') setDefaultLinewidth(value)
            else if (propertyKey === 'strokeType')
                setDefaultStrokeType(value === 'solid' ? null : value)
            else if (propertyKey === 'textColor') setDefaultTextColor(value)
            else if (propertyKey === 'textSize') setDefaultTextSize(value)
            else if (propertyKey === 'textFontFamily')
                setDefaultTextFontFamily(value)
        }

        // 2. If nothing is selected, we're done.
        if (!selectedComponent) return

        const id = selectedComponent?.group?.data?.elementData?.id
        if (!id) return

        // Point category: not a simple shape.data field — re-skin the whole
        // pin group in place (frozen props mean React won't re-render it) and
        // persist the new category + derived colors to the store.
        if (propertyKey === 'pointCategory') {
            const group = selectedComponent?.group?.data
            const elementData = group?.elementData
            if (!group || !elementData) return
            const cat =
                POINT_CATEGORIES[value] ??
                POINT_CATEGORIES[DEFAULT_POINT_CATEGORY]!
            const existingMeta = elementData.metadata ?? {}
            const ringRadius = existingMeta.ringRadius ?? DEFAULT_GEO_RING_RADIUS
            const updatedMeta = {
                ...existingMeta,
                category: cat.id,
                svgIcon: cat.svgIcon,
            }
            buildPointVisual(twoJSInstance, group, {
                category: cat.id,
                ringRadius,
            })
            elementData.metadata = updatedMeta
            elementData.stroke = cat.bg
            elementData.fill = cat.bg
            updateComponentBulkPropertiesInLocalStore(id, {
                metadata: updatedMeta,
                stroke: cat.bg,
                fill: cat.bg,
            })
            twoJSInstance?.update()
            return
        }

        const shapeType = selectedComponent?.shape?.type
        const elementType =
            selectedComponent?.group?.data?.elementData?.componentType
        // rectangle/diamond/circle all embed text the same way; route all
        // three through the shape-with-text handlers.
        const isShapeWithText =
            typeof selectedComponent?.text?.data?.value === 'string' &&
            (shapeType === 'rectangle' ||
                elementType === 'rectangle' ||
                elementType === 'diamond' ||
                elementType === 'circle')

        // 3. Route text properties — these have their own bulky resize logic.
        if (propertyKey === 'textSize') {
            if (isShapeWithText) handleRectangleTextSizeChange?.(value)
            else handleTextSizeChange?.(value)
            return
        }
        if (propertyKey === 'textFontFamily') {
            if (isShapeWithText)
                handleRectangleTextFontFamilyChange?.(value)
            else handleTextFontFamilyChange?.(value)
            return
        }
        if (propertyKey === 'textColor') {
            if (isShapeWithText) {
                // Apply to EVERY line node in the text layer, not just the
                // first — otherwise multiline only updates on reload.
                getShapeTextNodes(selectedComponent?.group?.data).forEach(
                    (n) => (n.fill = value)
                )
                updateBulkPropsForRectangleWithText?.(id, { textColor: value })
            } else {
                // Standalone text is a stack of Two.Text line nodes (line 1
                // + satellites). Color EVERY node, not just line 1 — sel.shape
                // .data is only the first node.
                const textNodes = getShapeTextNodes(
                    selectedComponent?.group?.data
                )
                if (textNodes.length > 0) {
                    textNodes.forEach((n) => (n.fill = value))
                } else if (selectedComponent?.shape?.data) {
                    selectedComponent.shape.data.fill = value
                }
                if (selectedComponent?.group?.data?.elementData) {
                    selectedComponent.group.data.elementData.textColor = value
                }
                updateComponentBulkPropertiesInLocalStore(id, {
                    textColor: value,
                })
            }
            twoJSInstance?.update()
            return
        }

        // 4. Non-text properties: apply via shape.data + sync elementData.
        const shapeData = selectedComponent?.shape?.data
        const elementData = selectedComponent?.group?.data?.elementData

        if (propertyKey === 'fill') {
            if (shapeData) shapeData.fill = value
            if (elementData) elementData.fill = value
            updateComponentBulkPropertiesInLocalStore(id, { fill: value })
        } else if (propertyKey === 'stroke') {
            if (shapeData) shapeData.stroke = value
            if (elementData) elementData.stroke = value
            // Area fill is a light shade of its stroke — re-derive on the
            // Two.js path only; fill is never persisted for geo objects.
            if (elementType === 'area' && shapeData) {
                shapeData.fill = strokeToAreaFill(value)
            }
            updateComponentBulkPropertiesInLocalStore(id, { stroke: value })
        } else if (propertyKey === 'linewidth') {
            if (shapeData) shapeData.linewidth = value
            if (elementData) elementData.linewidth = value
            updateComponentBulkPropertiesInLocalStore(id, { linewidth: value })
        } else if (propertyKey === 'strokeType') {
            const dbValue = value === 'solid' ? 'solid' : value
            if (shapeData) {
                shapeData.dashes = strokeTypeToDashes(value)
                if (value === 'solid') clearDashesOnTwoJSShape(shapeData)
            }
            if (elementData) elementData.strokeType = dbValue
            updateComponentBulkPropertiesInLocalStore(id, {
                strokeType: dbValue,
            })
        } else if (propertyKey === 'opacity') {
            // Apply opacity at the GROUP level, not the shape leaf. The leaf
            // path is double-referenced in group.children (the *-with-text
            // components unshift the factory's already-added shape), which
            // leaves leaf-level opacity flags unprocessed on render — so a leaf
            // write only appears after the next full repaint (e.g. on deselect).
            // The group's own opacity always repaints, and it uniformly dims the
            // shape plus any embedded text-layer nodes in one shot.
            const groupObj = selectedComponent?.group?.data
            if (groupObj) groupObj.opacity = value
            // Neutralize any leaf/text opacity so it doesn't compound with the
            // group's (e.g. shapes mounted before this change carried leaf-level
            // opacity).
            if (shapeData) shapeData.opacity = 1
            getShapeTextNodes(selectedComponent?.group?.data).forEach(
                (n) => (n.opacity = 1)
            )
            // Preview = live drag: mutate the scene only, defer the
            // store/history write to the commit on release.
            if (!opts?.preview) {
                // Opacity persists in the top-level `opacity` column for every
                // element type (pencil's `metadata` is its vertex array and
                // never used metadata.opacity; the rest were migrated off it).
                if (elementData) elementData.opacity = value
                updateComponentBulkPropertiesInLocalStore(id, {
                    opacity: value,
                })
            }
        }

        twoJSInstance?.update()
    }
}
