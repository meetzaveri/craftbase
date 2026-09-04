import Two from 'two.js'
import { markSelectionChrome } from '../../utils/svgExportShared'
import { scheduleRender } from '../../utils/renderScheduler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GroupLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any

interface SelectorVertices {
    x1: number
    x2: number
    y1: number
    y2: number
}

export default class Selector {
    two: TwoLike
    group: GroupLike
    area: ShapeLike = null
    circle1: ShapeLike = null
    circle2: ShapeLike = null
    circle3: ShapeLike = null
    circle4: ShapeLike = null
    circleGroup: ShapeLike = null
    areaGroup: ShapeLike = null
    showCircles: unknown
    vertices: SelectorVertices

    constructor(
        instance: TwoLike,
        group: GroupLike,
        x1: number,
        x2: number,
        y1: number,
        y2: number,
        showCircles: unknown
    ) {
        this.two = instance
        this.group = group
        this.showCircles = showCircles
        this.vertices = { x1, x2, y1, y2 }
    }

    create(): void {
        const { x1, x2, y1, y2 } = this.vertices

        const area = this.two.makePath(x1, y1, x2, y1, x2, y2, x1, y2)
        area.fill = 'rgba(0,0,0,0)'
        area.opacity = 1
        area.linewidth = 2
        area.stroke = '#C4901A'
        this.area = area

        let circleGroup: ShapeLike = null
        if (this.showCircles) {
            switch (this.showCircles) {
                case 2: {
                    const yAxisMidpoint = (y1 + y2) / 2
                    const circleLeft = this.two.makeCircle(x1, yAxisMidpoint, 3)
                    const circleRight = this.two.makeCircle(
                        x2,
                        yAxisMidpoint,
                        3
                    )
                    this.circle1 = circleLeft
                    this.circle2 = circleRight
                    this.circle3 = null
                    this.circle4 = null
                    circleGroup = this.two.makeGroup(circleLeft, circleRight)
                    this.circleGroup = circleGroup
                    break
                }
                case 4: {
                    const circle1 = this.two.makeCircle(x1, y1, 4)
                    const circle2 = this.two.makeCircle(x2, y1, 4)
                    const circle3 = this.two.makeCircle(x2, y2, 4)
                    const circle4 = this.two.makeCircle(x1, y2, 4)
                    this.circle1 = circle1
                    this.circle2 = circle2
                    this.circle3 = circle3
                    this.circle4 = circle4
                    circleGroup = this.two.makeGroup(
                        circle1,
                        circle2,
                        circle3,
                        circle4
                    )
                    circleGroup.linewidth = 1.5
                    circleGroup.opacity = 0
                    circleGroup.stroke = '#C4901A'
                    this.circleGroup = circleGroup
                    break
                }
                default:
                    break
            }
        }

        const areaGroup = this.two.makeGroup(area, circleGroup)

        this.areaGroup = areaGroup
        this.group.add(areaGroup)
        // Batched, NOT a direct two.update(): this runs once per element that
        // has edit chrome (every pencil), so a synchronous full-scene render
        // here is O(N²) across a board load. markSelectionChrome reads
        // `_renderer.elem`, so it must wait for the render — hence afterRender.
        scheduleRender(this.two, () => {
            // Tag the overlay so SVG/PNG exports can strip it — it lives inside
            // the group's <g>, so a clone of the group would otherwise carry it.
            markSelectionChrome(areaGroup)
        })

        const clearSelector = (): void => {
            this.areaGroup.opacity = 0
        }
        window.addEventListener('clearSelector', clearSelector, false)
    }

    show(): void {
        this.areaGroup.opacity = 1
    }

    hide(): void {
        this.areaGroup.opacity = 0
    }

    getInstance(): string {
        return this.areaGroup.id
    }

    setScale(scale: number): void {
        const s = scale > 0 ? scale : 1
        this.area.linewidth = 2 / s
        if (this.showCircles && this.circle1) {
            // Cap radius at 3× base so circles don't obscure the bounding box at extreme zoom-out
            const radius = Math.min(4 / s, 12)
            this.circle1.radius = radius
            this.circle2.radius = radius
            if (this.showCircles === 4) {
                this.circle3.radius = radius
                this.circle4.radius = radius
                this.circleGroup.linewidth = Math.min(1.5 / s, 4.5)
            }
        }
    }

    update(x1: number, x2: number, y1: number, y2: number, scale = 1): void {
        this.vertices = { x1, x2, y1, y2 }

        this.area.vertices = [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x1,
                y1,
                null,
                null,
                null,
                null,
                (Two as any).Commands.line
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x2,
                y1,
                null,
                null,
                null,
                null,
                (Two as any).Commands.line
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x2,
                y2,
                null,
                null,
                null,
                null,
                (Two as any).Commands.line
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Anchor(
                x1,
                y2,
                null,
                null,
                null,
                null,
                (Two as any).Commands.line
            ),
        ]

        if (this.showCircles) {
            this.circleGroup.opacity = 1
            switch (this.showCircles) {
                case 2: {
                    const yAxisMidpoint = (y1 + y2) / 2
                    this.circle1.translation.set(x1, yAxisMidpoint)
                    this.circle2.translation.set(x2, yAxisMidpoint)
                    break
                }
                case 4:
                    this.circle1.translation.set(x1, y1)
                    this.circle2.translation.set(x2, y1)
                    this.circle3.translation.set(x2, y2)
                    this.circle4.translation.set(x1, y2)
                    break
                default:
                    break
            }
        }

        this.setScale(scale)
        this.areaGroup.opacity = 1
        this.two.update()
    }
}
