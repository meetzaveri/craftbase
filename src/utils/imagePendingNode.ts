// Loading placeholder for an image that is still being decoded, re-encoded and
// stored (see useImageDrop). It is a plain SVG node appended to the Two.js
// scene's <g>, not a Two.js shape and not a store record, so it follows pan
// and zoom for free but never reaches the draft, history or z-order logic.
//
// It starts as a spinner at the drop point. Once the decoded size is known,
// setSize() reveals a dashed frame matching the image element's own
// placeholder, so the handoff to the mounted element doesn't jump.

import { SVG_NS } from './svgExportShared'
import { IMAGE_PLACEHOLDER_FILL, IMAGE_PLACEHOLDER_STROKE } from './imageNode'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any

export const IMAGE_PENDING_ATTR = 'data-cb-image-pending'

// Spinner geometry in screen px; divided by the camera scale at creation.
const SPINNER_RADIUS_PX = 12
const SPINNER_STROKE_PX = 2.5

export interface PendingImageNode {
    /** Reveal the frame at the image's final size (surface units). */
    setSize: (width: number, height: number) => void
    remove: () => void
}

const NOOP_NODE: PendingImageNode = {
    setSize: () => undefined,
    remove: () => undefined,
}

export function createPendingImageNode(
    two: TwoLike,
    x: number,
    y: number
): PendingImageNode {
    const sceneEl: Element | undefined = two?.scene?._renderer?.elem
    if (!sceneEl) return NOOP_NODE
    const scale = two.scene.scale || 1

    const root = document.createElementNS(SVG_NS, 'g')
    root.setAttribute(IMAGE_PENDING_ATTR, '1')
    root.setAttribute('transform', `translate(${x} ${y})`)
    root.setAttribute('pointer-events', 'none')

    const frame = document.createElementNS(SVG_NS, 'rect')
    frame.setAttribute('fill', IMAGE_PLACEHOLDER_FILL)
    frame.setAttribute('stroke', IMAGE_PLACEHOLDER_STROKE)
    frame.setAttribute('stroke-width', '1')
    frame.setAttribute('stroke-dasharray', '4 4')
    frame.setAttribute('visibility', 'hidden')
    root.appendChild(frame)

    const r = SPINNER_RADIUS_PX / scale
    const strokeWidth = String(SPINNER_STROKE_PX / scale)
    const spinner = document.createElementNS(SVG_NS, 'g')
    // Rotate around the spinner's own center, and hold still for users who
    // ask for reduced motion.
    spinner.setAttribute('class', 'motion-safe:animate-spin')
    spinner.setAttribute(
        'style',
        'transform-box: fill-box; transform-origin: center'
    )
    const track = document.createElementNS(SVG_NS, 'circle')
    track.setAttribute('r', String(r))
    track.setAttribute('fill', 'none')
    track.setAttribute('stroke', IMAGE_PLACEHOLDER_FILL)
    track.setAttribute('stroke-width', strokeWidth)
    const arc = document.createElementNS(SVG_NS, 'circle')
    const circumference = 2 * Math.PI * r
    arc.setAttribute('r', String(r))
    arc.setAttribute('fill', 'none')
    arc.setAttribute('stroke', IMAGE_PLACEHOLDER_STROKE)
    arc.setAttribute('stroke-width', strokeWidth)
    arc.setAttribute('stroke-linecap', 'round')
    arc.setAttribute(
        'stroke-dasharray',
        `${circumference * 0.25} ${circumference}`
    )
    spinner.appendChild(track)
    spinner.appendChild(arc)
    root.appendChild(spinner)

    sceneEl.appendChild(root)

    return {
        setSize: (width: number, height: number): void => {
            frame.setAttribute('x', String(-width / 2))
            frame.setAttribute('y', String(-height / 2))
            frame.setAttribute('width', String(width))
            frame.setAttribute('height', String(height))
            frame.removeAttribute('visibility')
        },
        remove: (): void => root.remove(),
    }
}
