import { componentTypes } from '../constants/misc'
import {
    lineHeightFor,
    wrapText,
    widestCharWidth,
    type FontSpec,
} from './textLayout'

// Per-shape geometry tying a shape's box to the text it can hold. All values
// are in Two.js surface units (the same units as shape.width / shape.height).
//
// Decoupled model (no iteration / oscillation): the usable text width is a
// fixed fraction of the shape width, and the shape height needed for N lines
// is a fixed function of the line count. Narrower width -> fewer chars/line
// -> more lines -> taller shape. Squeezing works because the wrapper
// guarantees >= 1 char/line even when the usable width is below one glyph.

const RECT_PAD_X = 24
const RECT_PAD_Y = 12
const DIAMOND_PAD_X = 12
const DIAMOND_PAD_Y = 6
const CIRCLE_PAD_X = 14
const CIRCLE_PAD_Y = 10

// Fraction of the shape width usable for a centered text block, and the
// inverse factor mapping text-block height back to the shape height.
const DIAMOND_WIDTH_FACTOR = 0.6 // text lives in the central band
const CIRCLE_WIDTH_FACTOR = 1 / Math.SQRT2 // largest box inscribed in ellipse

type ShapeKind = string

function pads(kind: ShapeKind): { px: number; py: number } {
    if (kind === componentTypes.diamond)
        return { px: DIAMOND_PAD_X, py: DIAMOND_PAD_Y }
    if (kind === componentTypes.circle)
        return { px: CIRCLE_PAD_X, py: CIRCLE_PAD_Y }
    return { px: RECT_PAD_X, py: RECT_PAD_Y }
}

// Width available for text given the shape's current width.
export function usableTextWidth(kind: ShapeKind, width: number): number {
    const { px } = pads(kind)
    let inner = width
    if (kind === componentTypes.diamond) inner = width * DIAMOND_WIDTH_FACTOR
    else if (kind === componentTypes.circle)
        inner = width * CIRCLE_WIDTH_FACTOR
    return Math.max(inner - px * 2, 1)
}

// Shape height needed to contain `lineCount` lines at `fontSize`.
export function requiredShapeHeight(
    kind: ShapeKind,
    lineCount: number,
    fontSize: number
): number {
    const { py } = pads(kind)
    const blockH = Math.max(lineCount, 1) * lineHeightFor(fontSize) + py * 2
    if (kind === componentTypes.diamond)
        return Math.ceil(blockH / DIAMOND_WIDTH_FACTOR)
    if (kind === componentTypes.circle)
        return Math.ceil(blockH / CIRCLE_WIDTH_FACTOR)
    return Math.ceil(blockH)
}

// Smallest shape width that still lets each line hold its widest single
// character — the floor for the resize squeeze (1 char per line).
export function minShapeWidthForText(
    kind: ShapeKind,
    rawText: string,
    font: FontSpec
): number {
    const { px } = pads(kind)
    const glyph = widestCharWidth(rawText, font)
    let inner = glyph + px * 2
    if (kind === componentTypes.diamond) inner = inner / DIAMOND_WIDTH_FACTOR
    else if (kind === componentTypes.circle)
        inner = inner / CIRCLE_WIDTH_FACTOR
    return Math.ceil(inner)
}

export interface ReflowResult {
    lines: string[]
    requiredHeight: number
    usableWidth: number
}

// Width-driven reflow: wrap `rawText` to the width the shape currently
// affords, then report the height the shape must grow to so every wrapped
// line is visible. Used by the resize controller and shape components.
export function reflowTextForShape(
    kind: ShapeKind,
    width: number,
    rawText: string,
    font: FontSpec
): ReflowResult {
    const usableWidth = usableTextWidth(kind, width)
    const lines = wrapText(rawText, usableWidth, font)
    const requiredHeight = requiredShapeHeight(kind, lines.length, font.size)
    return { lines, requiredHeight, usableWidth }
}

// A shape's height is auto-fitted to its text (typing grows it, a style change
// re-fits it) unless the user deliberately dragged it taller. We tell the two
// apart by re-deriving the height the text needed at the PREVIOUS style: if the
// shape is still sitting at (or within a hair of) that height, only auto-fit
// put it there, so it may shrink as well as grow.
//
// The slack absorbs rounding noise — the typing-growth path measures the DOM at
// the current zoom and divides back into surface units, so it can land a couple
// of units above the analytic height. Half a line is well above that error and
// well below any slack a user would deliberately drag in.
const AUTO_HEIGHT_SLACK_RATIO = 0.5

/**
 * Height a shape-with-text should take after its text style (size or family)
 * changes.
 *
 * - Auto-fitted box → exactly the height the new style needs (shrinks or grows).
 * - User-heightened → never shrinks below the user's height; grows if needed.
 * - No text         → untouched.
 *
 * Width is user-driven throughout and never enters the decision.
 */
export function resolveHeightForTextStyleChange(args: {
    kind: ShapeKind
    width: number
    rawText: string
    prevFont: FontSpec
    nextFont: FontSpec
    currentHeight: number
}): number {
    const { kind, width, rawText, prevFont, nextFont, currentHeight } = args
    if (!rawText) return currentHeight

    const { requiredHeight: nextRequired } = reflowTextForShape(
        kind,
        width,
        rawText,
        nextFont
    )
    const { requiredHeight: prevRequired } = reflowTextForShape(
        kind,
        width,
        rawText,
        prevFont
    )
    const slack = lineHeightFor(prevFont.size) * AUTO_HEIGHT_SLACK_RATIO
    const wasAutoFitted = currentHeight <= prevRequired + slack

    return wasAutoFitted ? nextRequired : Math.max(currentHeight, nextRequired)
}

// Editor-growth direction: given a measured text box (surface units), the
// minimum (w, h) the host shape must be so the text fits. Replaces the inline
// `fitShape` previously in newCanvas.tsx; keeps the shape from shrinking.
export function growShapeToFitText(
    kind: ShapeKind,
    currentW: number,
    currentH: number,
    textW: number,
    textH: number
): { w: number; h: number } {
    const { px, py } = pads(kind)
    const TW = textW + px * 2
    const TH = textH + py * 2
    if (kind === componentTypes.diamond) {
        return {
            w: Math.max(currentW, Math.ceil(TW / DIAMOND_WIDTH_FACTOR)),
            h: Math.max(currentH, Math.ceil(TH / DIAMOND_WIDTH_FACTOR)),
        }
    }
    if (kind === componentTypes.circle) {
        return {
            w: Math.max(currentW, Math.ceil(TW / CIRCLE_WIDTH_FACTOR)),
            h: Math.max(currentH, Math.ceil(TH / CIRCLE_WIDTH_FACTOR)),
        }
    }
    return {
        w: Math.max(currentW, Math.ceil(TW)),
        h: Math.max(currentH, Math.ceil(TH)),
    }
}
