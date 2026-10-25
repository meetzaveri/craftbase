// Export the currently-selected element(s) as a standalone, tightly-cropped
// .svg file with a transparent background and no watermark.
//
// Two.js runs the SVG renderer, so the selected group already has a live
// rendered <g> node at group._renderer.elem. We clone that <g>, drop it inside a
// fresh <svg>, and crop to its content via getBBox() on a transform-free wrapper
// — this sidesteps the ZUI zoom/pan transform entirely: the clone keeps its own
// (unzoomed, scene-space) transform, getBBox reports its bounds in that same
// space, and using those bounds as the viewBox yields a 1:1 portable asset.

import {
    SVG_NS,
    embedFonts,
    inlineImageHrefs,
    stripSelectionChrome,
} from './svgExportShared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GroupLike = any

/**
 * Export a Two.js group (or single-element group) as a downloaded .svg file.
 * Throws if the group has no rendered SVG node or has zero size.
 */
export async function exportSelectionAsSvg(group: GroupLike): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gEl: SVGGElement | undefined = (group as any)?._renderer?.elem
    if (!gEl) throw new Error('No rendered SVG node found for the selection')

    const clone = gEl.cloneNode(true) as SVGGElement

    // Drop any selection-overlay node tagged at its source (the legacy
    // objectSelector area/handles injected into a group's <g>, or the
    // SelectionController box if it ever ends up inside the clone). This is the
    // primary chrome strip; the marquee-specific prune below additionally drops
    // the transparent marquee-sized rect, which carries no tag.
    stripSelectionChrome(clone)

    // A marquee group's <g> also contains the transparent marquee-sized rect and
    // the visible selection border/handles (added as children of the group). For
    // a single-element selection the group's <g> is already clean (its selection
    // UI lives separately in the scene), so we only prune marquee groups. Keep
    // only the direct children that map to real content elements (those carrying
    // elementData.id); everything else is selection chrome.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((group as any)?.elementData?.isGroupSelector) {
        const keepIds = new Set<string>(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((group as any).children || [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((c: any) => c?.elementData?.id)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((c: any) => c?._renderer?.elem?.id)
                .filter((id: unknown): id is string => typeof id === 'string')
        )
        Array.from(clone.children).forEach((node) => {
            if (!keepIds.has(node.id)) node.remove()
        })
    }

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('xmlns', SVG_NS)
    // Transform-free wrapper so getBBox reports bounds in the svg's user space,
    // accounting for the clone's own transform via descendant geometry.
    const wrapper = document.createElementNS(SVG_NS, 'g')
    wrapper.appendChild(clone)
    svg.appendChild(wrapper)

    // getBBox requires the node be laid out (in the DOM, not display:none).
    svg.setAttribute(
        'style',
        'position:fixed;left:-99999px;top:-99999px;opacity:0;pointer-events:none'
    )
    document.body.appendChild(svg)

    try {
        const bb = wrapper.getBBox()
        if (bb.width === 0 || bb.height === 0) {
            throw new Error('Selection has zero size; nothing to export')
        }

        svg.setAttribute('width', String(bb.width))
        svg.setAttribute('height', String(bb.height))
        svg.setAttribute(
            'viewBox',
            `${bb.x} ${bb.y} ${bb.width} ${bb.height}`
        )

        // Font fetch is async; keep the element hidden (style attr) until the
        // synchronous serialize below so it never flashes on-screen.
        await inlineImageHrefs(svg)
        await embedFonts(svg)

        // Strip the off-screen hiding style only from the serialized output.
        svg.removeAttribute('style')
        const svgString = new XMLSerializer().serializeToString(svg)
        downloadSvg(svgString)
    } finally {
        if (svg.parentNode) svg.parentNode.removeChild(svg)
    }
}

/** Trigger a browser download of the SVG markup as a .svg file. */
function downloadSvg(svgString: string): void {
    const blob = new Blob([svgString], {
        type: 'image/svg+xml;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `craftbase-selection-${Date.now()}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
