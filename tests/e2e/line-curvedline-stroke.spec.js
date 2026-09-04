import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    drawLine,
    drawCurvedLine,
    setDefaultStrokeWidth,
    clickPointerTool,
    getDraftComponents,
} from './helpers/index.js'

// Horizontal line — its midpoint lies on the stroke, so a single click there
// selects it. CurvedLine is selected by clicking one of its vertices (the
// curve passes through every clicked point).
const LINE_COORDS = { startX: 300, startY: 250, endX: 540, endY: 250 }
const LINE_SELECT = { x: 420, y: 250 }
const CURVED_POINTS = [
    { x: 300, y: 430 },
    { x: 360, y: 350 },
    { x: 440, y: 450 },
    { x: 520, y: 360 },
]
const CURVED_SELECT = { x: 360, y: 350 }

const DRAFT_DEBOUNCE_MS = 700
// Empty spot for the deselect/blur click, clear of both shapes and the panel.
const BLUR_POINT = { x: 950, y: 550 }

// Stroke Type buttons render in STROKE_TYPES order: solid(1), dashed(2),
// dotted(3) — see elementProperties.js.
const STROKE_TYPE_INDEX = { solid: 1, dashed: 2, dotted: 3 }

const SHAPES = [
    {
        name: 'line',
        draw: (page) => drawLine(page, LINE_COORDS),
        select: LINE_SELECT,
    },
    {
        name: 'curvedLine',
        draw: (page) => drawCurvedLine(page, CURVED_POINTS),
        select: CURVED_SELECT,
    },
]

// Enters pointer mode and clicks the given point to select the element, then
// waits for the LINE property panel (stroke width section) to mount inside the
// floating toolbar.
async function selectAt(page, point) {
    await clickPointerTool(page)
    await page.mouse.click(point.x, point.y)
    await page.waitForSelector('#floating-toolbar #stroke-width-section')
}

// Clicks empty canvas to blur/deselect, then waits for the debounced draft.
async function blur(page) {
    await page.mouse.click(BLUR_POINT.x, BLUR_POINT.y)
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
}

test.describe('Line & CurvedLine — stroke edits persist after blur', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    for (const { name, draw, select } of SHAPES) {
        test(`${name}: stroke width change persists on blur`, async ({
            page,
        }) => {
            const handle = await draw(page)
            const id = await handle.getAttribute('data-component-id')

            await selectAt(page, select)
            await setDefaultStrokeWidth(page, '6')
            await blur(page)

            const draft = await getDraftComponents(page)
            expect(draft?.[id]?.linewidth).toBe(6)
        })

        test(`${name}: stroke color change persists on blur`, async ({
            page,
        }) => {
            const handle = await draw(page)
            const id = await handle.getAttribute('data-component-id')

            await selectAt(page, select)
            // Pick the red essential swatch inside the Stroke color section.
            await page.click('[data-section="stroke"] button[title="#FF5630"]')
            await blur(page)

            const draft = await getDraftComponents(page)
            expect(draft?.[id]?.stroke).toBe('#FF5630')
        })

        test(`${name}: stroke type change persists on blur`, async ({
            page,
        }) => {
            const handle = await draw(page)
            const id = await handle.getAttribute('data-component-id')

            await selectAt(page, select)
            await page.click(
                `#stroke-type-section button:nth-of-type(${STROKE_TYPE_INDEX.dashed})`
            )
            await blur(page)

            const draft = await getDraftComponents(page)
            expect(draft?.[id]?.strokeType).toBe('dashed')
        })
    }
})
