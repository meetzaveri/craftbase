import { test, expect } from './helpers/test.js'
import {
    setupLocalBase,
    drawLine,
    getDraftComponents,
    getCanvasBox,
} from './helpers/index.js'

// useLocalDraftPersistence flushes componentStore → localStorage with a 500ms
// debounce; round up so we always read the post-debounce snapshot.
const DRAFT_DEBOUNCE_MS = 700

// All shapes drawn in the lower-right quadrant to stay clear of the top
// toolbar and the left Defaults panel (mirrors copy-paste.spec.js).
function safeArea(box) {
    const cx = box.x + box.width * 0.65
    const cy = box.y + box.height * 0.6
    return { cx, cy }
}

test.describe('Copy-paste — line', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBase(page)
    })

    /**
     * Regression: useCanvasClipboard.ts only special-cases componentType
     * 'arrowLine' when reading live endpoint vertices (copy) and recomputing
     * relative x1/y1/x2/y2 (paste). The `line` factory (src/factory/line.ts)
     * is structurally identical to arrowLine — same endpoint-drag machinery
     * (isLineLikeType in newCanvas.tsx groups them for exactly this reason)
     * — but is missing from both checks.
     *
     * A freshly-drawn, never-edited line happens to paste fine (x1/y1 are
     * always 0 right after a draw-drag). The bug only surfaces once an
     * endpoint has been dragged — a completely ordinary edit — after which
     * x1/y1 are non-zero. The copy handler then reads the stale mounted
     * elementData instead of the live post-drag vertices, and the pasted
     * clone collapses to a zero-length line (x1=y1=x2=y2=0): an invisible
     * point instead of a segment.
     */
    test('pasting a line whose endpoint was dragged preserves it as a visible segment', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)
        const startX = cx - 120
        const startY = cy - 40
        const endX = cx + 120
        const endY = cy + 40

        const handle = await drawLine(page, { startX, startY, endX, endY })
        const id = await handle.getAttribute('data-component-id')
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        // Select the line, then drag its LEFT endpoint handle to a new spot —
        // an ordinary endpoint edit, not a fresh draw. This is what makes
        // x1/y1 diverge from (0, 0).
        const midX = (startX + endX) / 2
        const midY = (startY + endY) / 2
        await page.mouse.click(midX, midY)
        await page.waitForSelector(
            `[data-line-id][data-direction="left"]`
        )
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(startX - 40, startY - 50, { steps: 10 })
        await page.mouse.up()
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        const beforeCopy = (await getDraftComponents(page))[id]
        expect(beforeCopy.componentType).toBe('line')
        // Sanity: the drag actually moved the start endpoint off (0, 0).
        expect(beforeCopy.x1).not.toBe(0)
        expect(beforeCopy.y1).not.toBe(0)
        const originalDx = beforeCopy.x2 - beforeCopy.x1
        const originalDy = beforeCopy.y2 - beforeCopy.y1

        // The endpoint drag re-selects the shape already (no extra click
        // needed) — copy it, then paste on an empty area of the canvas.
        await page.keyboard.press('Meta+c')
        await page.mouse.move(cx - 300, cy - 250)
        await page.waitForTimeout(100)
        await page.keyboard.press('Meta+v')

        await page.waitForFunction(
            () => document.querySelectorAll('[data-component-id]').length >= 2
        )
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        const draft = await getDraftComponents(page)
        const pasted = Object.values(draft).find((c) => c.id !== id)
        expect(pasted).toBeTruthy()
        expect(pasted.componentType).toBe('line')

        const pastedDx = pasted.x2 - pasted.x1
        const pastedDy = pasted.y2 - pasted.y1

        // The pasted line must be the SAME segment (same length/direction),
        // just relocated — not collapsed to a zero-length point.
        expect(pastedDx === 0 && pastedDy === 0).toBe(false)
        expect(pastedDx).toBe(originalDx)
        expect(pastedDy).toBe(originalDy)

        // Also verify visually: the pasted <line>/<path> body must have a
        // non-zero rendered length on screen.
        // The line body is the first <path> (endpoint-handle circles are
        // also <path> elements, rendered after it).
        const pastedPath = page
            .locator(`[data-component-id="${pasted.id}"] path`)
            .first()
        const pathLength = await pastedPath.evaluate((el) => {
            const box = el.getBBox()
            return Math.hypot(box.width, box.height)
        })
        expect(pathLength).toBeGreaterThan(10)
    })
})
