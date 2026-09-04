import type { RandomUsername } from '../types/board'

// True on macOS/iOS, where ⌘ (metaKey) is the primary shortcut modifier; Ctrl
// elsewhere. Prefer the modern userAgentData.platform, fall back to the legacy
// navigator.platform. Computed once at module load — the OS doesn't change.
export const isMac: boolean =
    typeof navigator !== 'undefined' &&
    /mac|iphone|ipad|ipod/i.test(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).userAgentData?.platform || navigator.platform || ''
    )

/** Display label for the primary shortcut modifier: '⌘' on mac, 'Ctrl' else. */
export const PRIMARY_MOD_LABEL: string = isMac ? '⌘' : 'Ctrl'

export function strokeTypeToDashes(strokeType: string | null | undefined): number[] {
    if (strokeType === 'dashed') return [8]
    if (strokeType === 'dotted') return [4]
    return []
}

// Area (closed geo polygon) fill is always a light shade of its stroke: the
// stroke color at 0.7 opacity. Never stored — re-derived on every render and on
// every stroke edit. Handles #rgb / #rrggbb / rgb() / rgba(); falls back to the
// input (so 'transparent' / named colors pass through unchanged).
const AREA_FILL_ALPHA = 0.7

export function strokeToAreaFill(
    stroke: string | null | undefined,
    alpha: number = AREA_FILL_ALPHA
): string {
    if (!stroke) return `rgba(0,0,0,${alpha})`
    const hex = stroke.trim()

    // #rgb or #rrggbb
    const shortHex = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex)
    const longHex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
    if (shortHex) {
        const r = parseInt(shortHex[1]! + shortHex[1]!, 16)
        const g = parseInt(shortHex[2]! + shortHex[2]!, 16)
        const b = parseInt(shortHex[3]! + shortHex[3]!, 16)
        return `rgba(${r},${g},${b},${alpha})`
    }
    if (longHex) {
        const r = parseInt(longHex[1]!, 16)
        const g = parseInt(longHex[2]!, 16)
        const b = parseInt(longHex[3]!, 16)
        return `rgba(${r},${g},${b},${alpha})`
    }

    // rgb(r,g,b) or rgba(r,g,b,a) → override alpha
    const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(hex)
    if (rgb) {
        return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`
    }

    return stroke
}

// Two.js SVG renderer only sets stroke-dasharray when dashes.length > 0,
// but never removes the attribute when dashes = []. Call this after setting
// dashes = [] on a shape to ensure the SVG attribute is cleared.
//
// Typed loosely: the renderer-internal `_renderer.elem` lives on every Two.js
// Shape but isn't part of the published types we depend on here. Sharpen when
// Stages 7–9 converge on a canonical Two.js shape type.
export function clearDashesOnTwoJSShape(shape: {
    _renderer?: { elem?: SVGElement }
} | null | undefined): void {
    if (shape?._renderer?.elem) {
        shape._renderer.elem.removeAttribute('stroke-dasharray')
        shape._renderer.elem.removeAttribute('stroke-dashoffset')
    }
}

// elementOnBlurHandler is called from canvas event paths with raw DOM events
// and a Two.js instance. Internals are still JS — keep parameters loose.
export const elementOnBlurHandler = (
    e: FocusEvent | null | undefined,
    selectorInstance: { hide?: () => void } | null | undefined,
    two: { update: () => void }
): void => {
    const blurListenerCB = (innerEvent: FocusEvent): void => {
        const target = innerEvent?.relatedTarget as HTMLElement | null
        if (target?.dataset?.parent === 'floating-toolbar') {
            // no action required
        } else {
            selectorInstance?.hide?.()
        }
    }

    const related = e?.relatedTarget as HTMLElement | null
    if (
        related?.id === 'floating-toolbar' ||
        related?.dataset?.parent === 'floating-toolbar'
    ) {
        document
            .getElementById('floating-toolbar')
            ?.addEventListener('blur', blurListenerCB as EventListener)
    } else {
        selectorInstance?.hide?.()
    }
    two.update()
}

export const generateRandomUsernames = (): RandomUsername => {
    const names = [
        'cake_salad',
        'raspberry_waffle',
        'tropical_owl',
        'high_antopera',
        'banestick_watermelon',
        'zephyr_pomegranate',
        'optimus_prime',
        'network_tea',
        'floral_cake',
        'volcano_bee',
        'hurricane_cat',
        'juice_walrus',
        'groundhog_day',
        'spacex_dragon',
        'icecream_fox',
        'astronout_fly',
        'icecoffee_cat',
        'pumpkin_bat',
        'anonymous_galileo',
        'raspberry_cat',
        'water_rabbit',
        'violet_turtle',
    ]

    const rB = Math.floor(Math.random() * names.length)
    const name = names[rB]!
    const [firstName, lastName] = name.split('_') as [string, string]

    return { nickname: name, firstName, lastName }
}

export const generateUUID = (): string => {
    let d = new Date().getTime()
    let d2 =
        (typeof performance !== 'undefined' &&
            performance.now &&
            performance.now() * 1000) ||
        0
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        let r = Math.random() * 16
        if (d > 0) {
            r = ((d + r) % 16) | 0
            d = Math.floor(d / 16)
        } else {
            r = ((d2 + r) % 16) | 0
            d2 = Math.floor(d2 / 16)
        }
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}
