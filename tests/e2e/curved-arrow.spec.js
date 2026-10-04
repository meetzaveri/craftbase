import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    drawRectangle,
    drawCurvedArrow,
    clickPointerTool,
    getDraftComponents,
    triggerUndoKeyboard,
} from './helpers/index.js'

/**
 * Curved arrow: a multi-point curved line with an arrowhead on its last
 * vertex, picked from the Arrows drawer (whose bare-click default stays the
 * straight arrow).
 */

const DRAFT_DEBOUNCE_MS = 700
// 4 clicked vertices → an S curve ending at the last point.
const POINTS = [
    { x: 320, y: 470 },
    { x: 420, y: 340 },
    { x: 540, y: 480 },
    { x: 660, y: 360 },
]
const SECOND_POINTS = POINTS.map((p) => ({ x: p.x + 420, y: p.y }))
const BLUR_POINT = { x: 1200, y: 800 }

async function draftRows(page, type) {
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
    const draft = await getDraftComponents(page)
    return Object.values(draft ?? {}).filter((c) => c.componentType === type)
}

// The rendered strokes of a curved arrow: the curve and its head. Excludes the
// transparent hit band and the vertex handles.
async function renderedStrokes(page, id) {
    return page.$$eval(`g[data-component-id="${id}"] path`, (paths) =>
        paths
            .filter(
                (p) =>
                    !p.classList.contains('is-vertex-handle') &&
                    p.getAttribute('stroke') !== 'transparent'
            )
            .map((p) => ({
                stroke: p.getAttribute('stroke'),
                width: p.getAttribute('stroke-width'),
            }))
    )
}

test.describe('Curved arrow', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('draws from the Arrows drawer with a head that matches the curve', async ({
        page,
    }) => {
        await drawCurvedArrow(page, POINTS)

        const [row] = await draftRows(page, 'curvedArrow')
        expect(row).toBeTruthy()
        expect(row.metadata).toHaveLength(POINTS.length)

        const strokes = await renderedStrokes(page, row.id)
        expect(strokes).toHaveLength(2)
        expect(strokes[1]).toEqual(strokes[0])
    })

    test('a stroke width change resizes the head with the curve', async ({
        page,
    }) => {
        await drawCurvedArrow(page, POINTS)
        const [row] = await draftRows(page, 'curvedArrow')

        await clickPointerTool(page)
        await page.mouse.click(POINTS[1].x, POINTS[1].y)
        await page.click('#floating-toolbar [title="8px"]')
        await page.mouse.click(BLUR_POINT.x, BLUR_POINT.y)

        const strokes = await renderedStrokes(page, row.id)
        expect(strokes.map((s) => s.width)).toEqual(['8', '8'])
        const [after] = await draftRows(page, 'curvedArrow')
        expect(after.linewidth).toBe(8)
    })

    test('undo removes a drawn curved arrow', async ({ page }) => {
        // Anchor keeps the store non-empty after undo so the debounced draft
        // save still fires (it skips empty-store saves).
        await drawRectangle(page, {
            startX: 760,
            startY: 180,
            endX: 880,
            endY: 260,
        })
        const handle = await drawCurvedArrow(page, POINTS)
        const id = await handle.getAttribute('data-component-id')
        expect(await draftRows(page, 'curvedArrow')).toHaveLength(1)

        await clickPointerTool(page)
        await triggerUndoKeyboard(page)
        await expect(page.locator(`[data-component-id="${id}"]`)).toHaveCount(0)
        expect(await draftRows(page, 'curvedArrow')).toHaveLength(0)
    })

    test('a bare click on the Arrows icon still draws a straight arrow', async ({
        page,
    }) => {
        await page.click('[aria-label="Arrows"]')
        await page.mouse.move(400, 300)
        await page.mouse.down()
        await page.mouse.move(600, 360, { steps: 8 })
        await page.mouse.up()

        expect(await draftRows(page, 'arrowLine')).toHaveLength(1)
        expect(await draftRows(page, 'curvedArrow')).toHaveLength(0)
    })

    test("an unselected curve's hidden vertex handles don't take clicks", async ({
        page,
    }) => {
        await drawCurvedArrow(page, POINTS)
        await drawCurvedArrow(page, SECOND_POINTS)
        const rows = await draftRows(page, 'curvedArrow')
        const second = rows.find((r) => r.metadata[0].x === SECOND_POINTS[0].x)

        // Select the first arrow, then check the second one's handles.
        await clickPointerTool(page)
        await page.mouse.click(POINTS[1].x, POINTS[1].y)
        await page.mouse.up()

        const pointerEvents = await page.$$eval(
            `g[data-component-id="${second.id}"] .is-vertex-handle`,
            (els) => els.map((el) => getComputedStyle(el).pointerEvents)
        )
        expect(pointerEvents.length).toBe(SECOND_POINTS.length)
        expect(new Set(pointerEvents)).toEqual(new Set(['none']))
    })
})
