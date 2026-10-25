// Shared helpers for the SVG-based export flows (viewport PNG export and
// selection SVG export). Two.js runs the SVG renderer, so both flows clone the
// live SVG and need to inline the canvas web font(s) — the SVG→<canvas>
// rasterizer and any standalone .svg consumer have no access to the document's
// loaded fonts, so without embedding, canvas text falls back to a system font.

import { DEFAULT_TEXT_FONT_FAMILY } from '../constants/misc'
import { blobToDataUrl } from './imageAssetStore'

export const SVG_NS = 'http://www.w3.org/2000/svg'

// DOM marker stamped on the SVG node of any selection-overlay element (the
// selection box/handles drawn by the SelectionController, and the legacy
// `objectSelector` area + handles injected into a group's <g>). Exports clone
// live SVG, so without a way to tell content from chrome the selection overlay
// leaks into the downloaded file. We tag chrome once at its source and strip it
// from every export clone. Two.js's renderer only writes its own known
// attributes, so a custom data-* attribute survives subsequent re-renders.
export const SELECTION_CHROME_ATTR = 'data-cb-selection-chrome'

/**
 * Tag a Two.js overlay object's rendered SVG node as selection chrome so export
 * flows can strip it. No-op until the object has been rendered at least once
 * (its `_renderer.elem` exists); callers invoke this right after `two.update()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function markSelectionChrome(twoObject: any): void {
    const el: Element | undefined = twoObject?._renderer?.elem
    if (el) el.setAttribute(SELECTION_CHROME_ATTR, '1')
}

/** Remove every selection-chrome node from a cloned SVG subtree, in place. */
export function stripSelectionChrome(root: Element): void {
    root.querySelectorAll(`[${SELECTION_CHROME_ATTR}]`).forEach((n) =>
        n.remove()
    )
}

/**
 * Image elements paint via `<image href="blob:...">` (see utils/imageNode.ts).
 * Blob URLs are tab-local, and an SVG rasterized through <img> can't load
 * external resources at all, so swap each one for an inline data URL in the
 * export clone. Failures leave the href as-is (the image just won't show).
 */
export async function inlineImageHrefs(root: Element): Promise<void> {
    const nodes = Array.from(root.querySelectorAll('image'))
    await Promise.all(
        nodes.map(async (node) => {
            const href = node.getAttribute('href')
            if (!href?.startsWith('blob:')) return
            try {
                const blob = await (await fetch(href)).blob()
                node.setAttribute('href', await blobToDataUrl(blob))
            } catch {
                // Leave it; the rest of the export still succeeds.
            }
        })
    )
}

/**
 * Collect the distinct font families actually used by <text> elements in the
 * given SVG. Two.js writes the live `font-family` onto each <text>, so this is
 * what the exported text will request — we must embed exactly these, not just
 * the default. The default is always included (the watermark uses it).
 */
function collectUsedFamilies(svg: SVGSVGElement): string[] {
    const families = new Set<string>([DEFAULT_TEXT_FONT_FAMILY])
    svg.querySelectorAll('text').forEach((text) => {
        const raw =
            text.getAttribute('font-family') || text.style.fontFamily || ''
        // font-family can be a comma list of fallbacks; take the primary and
        // strip any surrounding quotes Two.js / the browser may have added.
        const primary = raw.split(',')[0]?.trim().replace(/^["']|["']$/g, '')
        if (primary) families.add(primary)
    })
    return [...families]
}

/**
 * Fetch one Google font family's CSS with its url() references inlined as
 * base64 data URIs. Returns the inlined CSS, or null on any failure. Only the
 * Regular 400 weight is requested (canvas text is always 400). Each family is
 * fetched independently so an unavailable family can't void the whole export.
 */
async function fetchInlinedFontCss(family: string): Promise<string | null> {
    try {
        const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
            family
        )}:wght@400&display=swap`
        const cssResp = await fetch(cssUrl)
        if (!cssResp.ok) return null
        let css = await cssResp.text()

        const urls = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(
            (m) => m[1] as string
        )
        const uniqueUrls = [...new Set(urls)]
        await Promise.all(
            uniqueUrls.map(async (url) => {
                const dataUri = await fetchAsDataUri(url)
                if (dataUri) css = css.split(url).join(dataUri)
            })
        )
        return css
    } catch {
        return null
    }
}

/**
 * Inline the Google web font(s) used by the SVG's text as base64 inside a
 * <style>. Embeds every family actually present on the canvas — not just the
 * default — so exported text keeps its on-screen font instead of falling back.
 * Best-effort: any failure leaves the SVG unmodified.
 */
export async function embedFonts(svg: SVGSVGElement): Promise<void> {
    try {
        const families = collectUsedFamilies(svg)
        const cssChunks = await Promise.all(families.map(fetchInlinedFontCss))
        const css = cssChunks.filter((c): c is string => c !== null).join('\n')
        if (!css) return

        const style = document.createElementNS(SVG_NS, 'style')
        style.textContent = css
        svg.insertBefore(style, svg.firstChild)
    } catch (err) {
        // Non-fatal: keep going without embedded fonts.
        console.warn('Font embedding failed; exporting with fallback font', err)
    }
}

/** Fetch a font binary and return a base64 data URI, or null on failure. */
export async function fetchAsDataUri(url: string): Promise<string | null> {
    try {
        const resp = await fetch(url)
        if (!resp.ok) return null
        const buf = await resp.arrayBuffer()
        const mime = resp.headers.get('content-type') || 'font/woff2'
        let binary = ''
        const bytes = new Uint8Array(buf)
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i] as number)
        }
        return `data:${mime};base64,${btoa(binary)}`
    } catch {
        return null
    }
}
