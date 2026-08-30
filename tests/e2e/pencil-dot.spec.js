import { test, expect } from './helpers/test.js'
import {
    setupLocalBase,
    getCanvasBox,
    getDraftComponents,
    triggerUndoKeyboard,
} from './helpers/index.js'

const DRAFT_DEBOUNCE_MS = 700

// A pencil click with no drag commits a dot: the mouseup handler turns the
// single raw point into a hair-length segment (PENCIL_DOT_SEGMENT in
// newCanvas.tsx) so the pencil's round caps paint it as a round mark. Two
// identical anchors would NOT work — Two.js collapses them into a lone `M`
// command that draws nothing.
async function clickDot(page, x, y) {
    const countBefore = await page.$$eval(
        '[data-component-id]',
        (els) => els.length
    )
    await page.click('[aria-label="Pencil"]')
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForFunction(
        (n) => document.querySelectorAll('[data-component-id]').length > n,
        countBefore
    )
    const els = await page.$$('[data-component-id]')
    return els[els.length - 1]
}

test.describe('Pencil — click without drag draws a dot', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBase(page)
    })

    test('commits a pencil component that actually paints', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const handle = await clickDot(
            page,
            box.x + box.width * 0.5,
            box.y + box.height * 0.5
        )
        const id = await handle.getAttribute('data-component-id')

        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const draft = await getDraftComponents(page)
        const record = draft?.[id]
        expect(record?.componentType).toBe('pencil')
        // Two vertices, a hair apart — not a zero-length (invisible) path.
        expect(Array.isArray(record?.metadata)).toBe(true)
        expect(record.metadata.length).toBe(2)
        expect(record.metadata[1].x).toBeGreaterThan(record.metadata[0].x)

        // The stroke path is the group's last <path>; it must carry round caps
        // and a non-empty `d` with a line segment, or nothing is drawn.
        const stroke = await handle.$$eval('path', (els) => {
            const el = els[els.length - 1]
            return {
                d: el.getAttribute('d') || '',
                cap: getComputedStyle(el).strokeLinecap,
            }
        })
        expect(stroke.cap).toBe('round')
        expect(stroke.d).toContain('L')
    })

    test('survives a reload', async ({ page }) => {
        const box = await getCanvasBox(page)
        await clickDot(page, box.x + box.width * 0.5, box.y + box.height * 0.5)

        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        await page.reload()
        await page.waitForSelector('[data-component-id]')
        await expect(page.locator('[data-component-id]')).toHaveCount(1)
    })

    test('undo removes it', async ({ page }) => {
        const box = await getCanvasBox(page)
        await clickDot(page, box.x + box.width * 0.5, box.y + box.height * 0.5)

        await triggerUndoKeyboard(page)
        await expect(page.locator('[data-component-id]')).toHaveCount(0)
    })
})
