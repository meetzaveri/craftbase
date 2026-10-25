import Main from './main'
import {
    attachImageNode,
    IMAGE_PLACEHOLDER_FILL,
    IMAGE_PLACEHOLDER_STROKE,
} from '../utils/imageNode'
import type { ImageMetadata } from '../utils/imageNode'

export interface ImageProperties {
    width?: number
    height?: number
    metadata?: ImageMetadata | null
    /**
     * Set by the image element component, which disposes the bitmap node in
     * its own cleanup. Unset for group-select member copies, whose node
     * releases itself once the copy leaves the scene.
     */
    ownsImageNode?: boolean
    /** Called once the bitmap has painted or turned out to be missing. */
    onImageSettled?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

export default class ImageFactory extends Main<ImageProperties> {
    createElement(): {
        group: ShapeLike
        frame: ShapeLike
        disposeImageNode: () => void
    } {
        const two = this.two
        const { width, height, metadata, ownsImageNode, onImageSettled } =
            this.properties

        const frame = two.makeRectangle(0, 0, width || 240, height || 160)
        frame.fill = IMAGE_PLACEHOLDER_FILL
        frame.stroke = IMAGE_PLACEHOLDER_STROKE
        frame.linewidth = 1
        frame.dashes = [4, 4]

        const group = two.makeGroup(frame)
        group.translation.x = parseInt(String(this.x))
        group.translation.y = parseInt(String(this.y))

        const disposeImageNode = attachImageNode(
            two,
            group,
            frame,
            metadata || {},
            !ownsImageNode,
            onImageSettled
        )

        return { group, frame, disposeImageNode }
    }
}
