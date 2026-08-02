import { buildCssFont, type FontSpec } from './textLayout'

// Webfont readiness for text measurement.
//
// `canvas.measureText` does NOT wait for webfonts: asked for a face that hasn't
// arrived, it silently measures the fallback instead and returns metrics for a
// font nobody will ever see. Our faces come from Google Fonts with
// `display=swap`, so the first paint after a reload happens squarely inside that
// window — every wrap computed there is measured against a fallback that is
// wider than e.g. Caveat Brush, breaking lines earlier than the shape's own
// (correctly persisted) layout. The text then renders in the real font once it
// swaps in, but at the fallback's line breaks.
//
// The Font Loading API tells us which case we're in: `check()` reports whether a
// face is live, `load()` requests it and resolves when it is.

function fontSet(): FontFaceSet | undefined {
    if (typeof document === 'undefined') return undefined
    return document.fonts
}

/** True when `font` is live and safe to measure against. */
export function isFontReady(font: FontSpec): boolean {
    const fonts = fontSet()
    // No Font Loading API (older browser, SSR, tests): never block on it —
    // measuring against whatever is installed is the best we can do.
    if (!fonts?.check) return true
    try {
        return fonts.check(buildCssFont(font))
    } catch (_) {
        // A shorthand this API refuses to parse is not worth deferring on.
        return true
    }
}

/**
 * Run `run` once `font`'s real metrics are available — immediately if it is
 * already loaded, otherwise after the load settles (it is also requested, so a
 * face nothing has referenced yet still resolves rather than hanging).
 *
 * Failures resolve too: a font that will never load must not leave the caller's
 * text permanently un-reflowed.
 */
export function runWhenFontReady(font: FontSpec, run: () => void): void {
    if (isFontReady(font)) {
        run()
        return
    }
    const fonts = fontSet()
    if (!fonts?.load) {
        run()
        return
    }
    const spec = buildCssFont(font)
    let request: Promise<unknown>
    try {
        request = fonts.load(spec)
    } catch (_) {
        run()
        return
    }
    request.then(run, run)
}
