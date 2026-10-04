import Two from 'two.js'
import Main from './main'
import { buildArrowLineVertices } from '../utils/updateVertices'
import { strokeTypeToDashes } from '../utils/misc'

export interface ArrowLineProperties {
    fill?: string
    stroke?: string
    x1?: number
    x2?: number
    y1?: number
    y2?: number
    linewidth?: number
    strokeType?: string | null
    isMobile?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

export default class ArrowLineFactory extends Main<ArrowLineProperties> {
    createElement(): {
        group: ShapeLike
        pointCircle1Group: ShapeLike
        pointCircle2Group: ShapeLike
        pointCircle1: ShapeLike
        pointCircle2: ShapeLike
        line: ShapeLike
    } {
        const two = this.two
        const prevX = this.x
        const prevY = this.y
        const {
            stroke,
            x1 = 20,
            x2 = 100,
            y1 = 10,
            y2 = 10,
            linewidth,
            strokeType,
            isMobile,
        } = this.properties

        const lw = linewidth ? linewidth : 1
        // Same Path flags as Two's makeArrow (open, straight, manual commands),
        // but the head comes from the shared arrowhead geometry so it matches
        // curvedArrow's (utils/arrowHead.ts).
        const line = new (Two as ShapeLike).Path(
            buildArrowLineVertices(Two, x1, y1, x2, y2, lw),
            false,
            false,
            true
        )
        line.noFill()
        line.cap = 'round'
        line.join = 'round'
        two.add(line)
        line.linewidth = lw
        line.dashes = strokeTypeToDashes(strokeType)
        line.fill = 'none'
        if (stroke) line.stroke = stroke

        const circleRadius = isMobile ? 6 : 4
        // Larger transparent hit target behind each visible endpoint dot so an
        // imprecise tap/click still grabs the endpoint (see line.ts for the
        // rationale). `transparent` hit-tests while staying invisible; it rides
        // the group's counter-scale and select-time opacity toggle.
        const hitRadius = isMobile ? 18 : 9

        const pointCircle1 = two.makeCircle(0, 0, circleRadius)
        pointCircle1.fill = '#f4f4f2'
        pointCircle1.stroke = '#3A342C'
        pointCircle1.linewidth = 1.5

        const pointCircle2 = two.makeCircle(0, 0, circleRadius)
        pointCircle2.fill = '#f4f4f2'
        pointCircle2.stroke = '#3A342C'
        pointCircle2.linewidth = 1.5

        const hitCircle1 = two.makeCircle(0, 0, hitRadius)
        hitCircle1.fill = 'transparent'
        hitCircle1.noStroke()

        const hitCircle2 = two.makeCircle(0, 0, hitRadius)
        hitCircle2.fill = 'transparent'
        hitCircle2.noStroke()

        // Hit circle first (rendered beneath) so the visible dot stays on top.
        const pointCircle1Group = two.makeGroup(hitCircle1, pointCircle1)
        const pointCircle2Group = two.makeGroup(hitCircle2, pointCircle2)

        const group = two.makeGroup(line, pointCircle1Group, pointCircle2Group)

        pointCircle1Group.translation.x = line.vertices[0].x
        pointCircle1Group.translation.y = line.vertices[0].y
        pointCircle2Group.translation.x = line.vertices[1].x
        pointCircle2Group.translation.y = line.vertices[1].y
        pointCircle1Group.opacity = 0
        pointCircle2Group.opacity = 0

        group.translation.x = parseInt(String(prevX))
        group.translation.y = parseInt(String(prevY))

        return {
            group,
            pointCircle1Group,
            pointCircle2Group,
            pointCircle1,
            pointCircle2,
            line,
        }
    }
}
