import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    drawRectangle,
    drawShape,
    drawArrow,
    drawPencilStroke,
    placeText,
    getCanvasBox,
} from './helpers/index.js'

test.describe('Smoke — board loads correctly', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('canvas SVG is rendered', async ({ page }) => {
        await expect(page.locator('#main-two-root svg')).toBeVisible()
    })

    test('shapes toolbar is visible', async ({ page }) => {
        // aria-label is set on the icon SVG inside each toolbar button div.
        // On desktop, shapesToolbar.flattenShapesForDesktop hoists Rectangle /
        // Circle / Diamond out of the "Shapes" drawer to top-level buttons.
        // On mobile they remain nested behind the drawer parent.
        await expect(
            page.locator('[aria-label="Rectangle / Square"]')
        ).toBeVisible()
        await expect(page.locator('[aria-label="Circle"]')).toBeVisible()
        await expect(page.locator('[aria-label="Text"]')).toBeVisible()
    })

    test('drawing a rectangle adds it to the canvas', async ({ page }) => {
        // Measure the SVG, not #main-two-root — the wrapper div has
        // height 0 because the SVG is absolutely positioned inside it.
        const box = await getCanvasBox(page)
        // Draw in the lower-right quadrant — away from the top toolbar and
        // the Defaults panel fixed to the left side.
        const cx = box.x + box.width * 0.65
        const cy = box.y + box.height * 0.65

        await drawRectangle(page, {
            startX: cx - 80,
            startY: cy - 50,
            endX: cx + 80,
            endY: cy + 50,
        })

        await expect(page.locator('[data-component-id]')).toHaveCount(1)
    })

    test('drawing a circle adds it to the canvas', async ({ page }) => {
        const box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.65
        const cy = box.y + box.height * 0.65

        await drawShape(page, 'circle', {
            startX: cx - 60,
            startY: cy - 60,
            endX: cx + 60,
            endY: cy + 60,
        })

        await expect(page.locator('[data-component-id]')).toHaveCount(1)
    })

    test('drawing an arrow adds it to the canvas', async ({ page }) => {
        const box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.65
        const cy = box.y + box.height * 0.65

        await drawArrow(page, {
            startX: cx - 100,
            startY: cy,
            endX: cx + 100,
            endY: cy,
        })

        await expect(page.locator('[data-component-id]')).toHaveCount(1)
    })

    test('drawing a pencil stroke adds it to the canvas', async ({ page }) => {
        const box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.65
        const cy = box.y + box.height * 0.65

        await drawPencilStroke(page, {
            startX: cx - 80,
            startY: cy - 30,
            endX: cx + 80,
            endY: cy + 30,
        })

        await expect(page.locator('[data-component-id]')).toHaveCount(1)
    })

    test('drawing a text element adds it to the canvas', async ({ page }) => {
        const box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.65
        const cy = box.y + box.height * 0.65

        await placeText(page, { x: cx, y: cy })

        await expect(page.locator('[data-component-id]')).toHaveCount(1)
    })
})
