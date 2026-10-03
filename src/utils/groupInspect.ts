// Inspect the children of a focused group and report, per property:
//   - the common value, if every child that *can* accept the property has it
//     and they all agree
//   - MIXED sentinel, if there's disagreement among accepting children
//   - null, if no child in the group accepts the property at all
//
// The toolbar uses this to show a real value (or a "Mixed" indicator) when a
// group is focused, instead of always falling back to defaults.

import { GROUP_PROPERTY_ACCEPTS as ACCEPTS } from './groupAccepts'
import type { GroupPropertyKey } from './groupAccepts'

export const MIXED = '__MIXED__'

type InspectableProperty = GroupPropertyKey

interface ChildMetadata {
    opacity?: number
    textFill?: string
    textFontSize?: number
    textFontFamily?: string
    [key: string]: unknown
}

// Loose: child entries come from componentStore rows whose precise type is
// being tightened across Stages 3–10. Index access via `[key]` covers the
// fields read in readChildValue without locking the row shape down here.
interface ChildEntry {
    componentType?: string
    fill?: string
    stroke?: string
    linewidth?: number
    strokeType?: string | null
    textColor?: string
    metadata?: ChildMetadata | unknown[] | null
    [key: string]: unknown
}

interface SelectedGroupLike {
    elementData?: {
        children?: ChildEntry[]
    }
}

interface DefaultsForInspect {
    defaultFill: string
    defaultStrokeColor: string
    defaultLinewidth: number
    defaultStrokeType: string | null
    defaultOpacity: number
    defaultTextColor: string
    defaultTextSize: string | number
    defaultTextFontFamily: string
}

function readChildValue(child: ChildEntry, key: InspectableProperty): unknown {
    if (!child) return undefined
    const meta =
        child.metadata && !Array.isArray(child.metadata)
            ? (child.metadata as ChildMetadata)
            : null
    switch (key) {
        case 'fill':
            return child.fill
        case 'stroke':
            return child.stroke
        case 'linewidth':
            return child.linewidth
        case 'strokeType':
            return child.strokeType ?? 'solid'
        case 'opacity':
            // Opacity lives in the top-level `opacity` field (legacy rows fall
            // back to metadata.opacity; pencil never used metadata).
            if (typeof child.opacity === 'number') return child.opacity
            return meta?.opacity ?? 1
        case 'textColor':
            if (
                child.componentType === 'newText' ||
                child.componentType === 'geoText'
            )
                return child.textColor
            return meta?.textFill
        case 'textSize':
            return meta?.textFontSize
        case 'textFontFamily':
            return meta?.textFontFamily
        default:
            return undefined
    }
}

function valueKey(v: unknown): string {
    if (v === undefined) return 'undefined'
    if (v === null) return 'null'
    if (typeof v === 'number') return `n:${v}`
    if (typeof v === 'string') return `s:${v}`
    return JSON.stringify(v)
}

export function inspectGroup(
    selectedGroup: SelectedGroupLike | null | undefined,
    propertyKey: InspectableProperty
): unknown {
    const children = selectedGroup?.elementData?.children
    if (!Array.isArray(children) || children.length === 0) return null
    const acceptSet = ACCEPTS[propertyKey]
    if (!acceptSet) return null

    let firstValue: unknown
    let firstKey: string | undefined
    let any = false
    for (let i = 0; i < children.length; i++) {
        const c = children[i]
        if (!c) continue
        if (!acceptSet.has(String(c.componentType))) continue
        const v = readChildValue(c, propertyKey)
        const k = valueKey(v)
        if (!any) {
            firstValue = v
            firstKey = k
            any = true
            continue
        }
        if (k !== firstKey) return MIXED
    }
    if (!any) return null
    return firstValue
}

export function inspectGroupValues(
    selectedGroup: SelectedGroupLike | null | undefined,
    defaults: DefaultsForInspect
): {
    fill: unknown
    stroke: unknown
    linewidth: unknown
    strokeType: unknown
    opacity: unknown
    textColor: unknown
    textSize: unknown
    textFontFamily: unknown
} {
    const get = (key: InspectableProperty, fallback: unknown): unknown => {
        const v = inspectGroup(selectedGroup, key)
        if (v === null || v === undefined) return fallback
        return v
    }
    return {
        fill: get('fill', defaults.defaultFill),
        stroke: get('stroke', defaults.defaultStrokeColor),
        linewidth: get('linewidth', defaults.defaultLinewidth),
        strokeType: get('strokeType', defaults.defaultStrokeType ?? 'solid'),
        opacity: get('opacity', defaults.defaultOpacity ?? 1),
        textColor: get('textColor', defaults.defaultTextColor),
        textSize: get('textSize', defaults.defaultTextSize),
        textFontFamily: get('textFontFamily', defaults.defaultTextFontFamily),
    }
}
