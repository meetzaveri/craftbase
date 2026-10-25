// Paint an image element's bitmap as a native SVG <image> inside its Two.js
// group. Two.Image would render the bitmap as a pattern-filled path, whose
// pattern offset/scale drifts on resize; a raw <image> sized to the frame rect
// is exact and survives the exporters (they clone the live SVG).
//
// Two.js only writes nodes it owns, so a foreign child inserted at the front of
// the group's <g> is left alone across renders. The frame rect stays on top as
// the transparent hit/selection/resize target.

import { getImageAssetUrl } from './imageAssetStore'
import { scheduleRender } from './renderScheduler'
import { SVG_NS } from './svgExportShared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

export interface ImageMetadata {
    assetId?: string | null
    url?: string | null
    mimeType?: string
    naturalWidth?: number
    naturalHeight?: number
    opacity?: number
}

// Marker on the injected node so exporters can find it.
export const IMAGE_NODE_ATTR = 'data-cb-image'

// Fill/stroke of the frame rect before the bitmap loads, and when the asset
// is missing. Once loaded the frame goes transparent: it stays only as the
// hit/selection/resize target, with the native <image> painted under it.
export const IMAGE_PLACEHOLDER_FILL = 'rgba(128, 128, 128, 0.12)'
export const IMAGE_PLACEHOLDER_STROKE = 'rgba(128, 128, 128, 0.6)'

/** Prefer a remote URL (future shared-board uploads), else the local asset. */
async function resolveImageSrc(meta: ImageMetadata): Promise<string | null> {
    if (meta.url) return meta.url
    if (meta.assetId) return getImageAssetUrl(meta.assetId)
    return null
}

function isInScene(two: TwoLike, shape: ShapeLike): boolean {
    let node = shape
    while (node) {
        if (node === two.scene) return true
        node = node.parent
    }
    return false
}

/**
 * Resolve the bitmap and keep an <image> glued to `frame`'s size. Returns a
 * disposer. With `autoDispose` (group-select member copies, which nothing
 * explicitly tears down) the binding also releases itself once the group
 * leaves the scene.
 */
export function attachImageNode(
    two: TwoLike,
    group: ShapeLike,
    frame: ShapeLike,
    meta: ImageMetadata,
    autoDispose: boolean
): () => void {
    let disposed = false
    let imageEl: SVGImageElement | null = null
    let lastW = -1
    let lastH = -1

    const sync = (): void => {
        if (!imageEl) return
        const w = frame.width
        const h = frame.height
        if (w === lastW && h === lastH) return
        lastW = w
        lastH = h
        imageEl.setAttribute('x', String(-w / 2))
        imageEl.setAttribute('y', String(-h / 2))
        imageEl.setAttribute('width', String(w))
        imageEl.setAttribute('height', String(h))
    }

    const onUpdate = (): void => {
        if (autoDispose && !isInScene(two, group)) {
            dispose()
            return
        }
        sync()
    }

    const dispose = (): void => {
        if (disposed) return
        disposed = true
        two.unbind('update', onUpdate)
        imageEl?.remove()
        imageEl = null
    }

    const showMissing = (): void => {
        frame.fill = IMAGE_PLACEHOLDER_FILL
        frame.stroke = IMAGE_PLACEHOLDER_STROKE
        scheduleRender(two)
    }

    resolveImageSrc(meta)
        .then((src) => {
            if (disposed) return
            if (!src) {
                showMissing()
                return
            }
            // The group's <g> only exists after a render; batch with the frame.
            scheduleRender(two, () => {
                if (disposed) return
                const groupEl: Element | undefined = group._renderer?.elem
                if (!groupEl) return
                const el = document.createElementNS(SVG_NS, 'image')
                el.setAttribute(IMAGE_NODE_ATTR, '1')
                el.setAttribute('href', src)
                el.setAttribute('preserveAspectRatio', 'none')
                el.addEventListener('error', showMissing)
                groupEl.insertBefore(el, groupEl.firstChild)
                imageEl = el
                sync()
                frame.fill = 'transparent'
                frame.noStroke()
                two.bind('update', onUpdate)
                scheduleRender(two)
            })
        })
        .catch(showMissing)

    return dispose
}
