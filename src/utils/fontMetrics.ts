/**
 * Font metrics for optically centring canvas text.
 *
 * Two.js renders `baseline: 'middle'` as SVG `dominant-baseline: middle`, and
 * that keyword centres the **x-height**, not the glyphs: the alphabetic
 * baseline lands half an x-height below the anchor, so a line of mixed-case
 * text floats above whatever it is supposed to line up with by
 * `(capHeight - xHeight) / 2` — 9% of the font size in Geist, 12% in Caveat
 * Brush. Small enough to look like a rendering wobble, big enough to see next
 * to a point's circle at XL.
 *
 * The fix is to draw on the alphabetic baseline and place it ourselves, which
 * needs the font's real cap height — hence measuring rather than guessing.
 */

// Cap height as a fraction of the font size, per family. Ratios are
// size-invariant, so one measurement covers every size.
const capRatioCache = new Map<string, number>()

// Used when there is no canvas to measure with, or the measurement comes back
// nonsense. Close to the families this app ships (0.66–0.71).
const FALLBACK_CAP_RATIO = 0.68

// Measured at a large size so rounding in the metrics costs less.
const MEASURE_SIZE = 100

/**
 * Cap height of `family`, as a fraction of the font size.
 *
 * A webfont that hasn't finished loading measures as the fallback face, which
 * is why the result is only cached once the browser confirms the family is
 * loaded — otherwise the first point placed on a cold page would pin the wrong
 * ratio for the rest of the session.
 */
export function capHeightRatio(family: string): number {
    const cached = capRatioCache.get(family)
    if (cached !== undefined) return cached

    if (typeof document === 'undefined') return FALLBACK_CAP_RATIO

    let ratio = FALLBACK_CAP_RATIO
    try {
        const ctx = document.createElement('canvas').getContext('2d')
        if (ctx) {
            ctx.font = `${MEASURE_SIZE}px "${family}"`
            // 'H' has no overshoot and no descender, so its ink ascent is the
            // cap height.
            const ascent = ctx.measureText('H').actualBoundingBoxAscent
            if (Number.isFinite(ascent) && ascent > 0) {
                ratio = ascent / MEASURE_SIZE
            }
        }
    } catch {
        // Keep the fallback — a mis-centred label beats a canvas that throws.
    }

    const loaded = document.fonts?.check?.(`${MEASURE_SIZE}px "${family}"`)
    if (loaded !== false) capRatioCache.set(family, ratio)
    return ratio
}

/**
 * How far DOWN to place a text node drawn on the alphabetic baseline
 * (`baseline: 'baseline'`) so its cap band — baseline up to cap height — is
 * centred on the node's anchor point.
 *
 * The cap band, deliberately, rather than the full ink box: centring on the ink
 * would make a label hop the moment someone typed a descender.
 */
export function capCenterOffset(family: string, size: number): number {
    return (capHeightRatio(family) * size) / 2
}
