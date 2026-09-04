import Main from './main'
import { DEFAULT_TEXT_FONT_FAMILY } from '../constants/misc'
import { scheduleRender } from '../utils/renderScheduler'

export interface NewTextMetadata {
    content?: string
    fontSize?: number
    textFontFamily?: string
}

export interface NewTextProperties {
    textColor?: string
    metadata?: NewTextMetadata
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

export default class NewTextFactory extends Main<NewTextProperties> {
    createElement(): { group: ShapeLike; twoText: ShapeLike } {
        const two = this.two
        const prevX = this.x
        const prevY = this.y
        const { textColor } = this.properties || {}
        const {
            content = '',
            fontSize = 36,
            textFontFamily = DEFAULT_TEXT_FONT_FAMILY,
        } = this.properties?.metadata ?? {}

        // Use native Two.js text instead of a foreignObject wrapper
        const twoText = two.makeText(content || '', 0, 0)
        twoText.fill = textColor || '#3A342C'
        twoText.size = fontSize
        twoText.alignment = 'left'
        twoText.baseline = 'middle'
        twoText.family = textFontFamily

        const group = two.makeGroup(twoText)
        group.translation.x = parseInt(String(prevX))
        group.translation.y = parseInt(String(prevY))

        // Batched, NOT a direct two.update(): this fires once per text element,
        // so a synchronous full-scene render here is O(N²) across a board load.
        scheduleRender(two)

        return { group, twoText }
    }
}
