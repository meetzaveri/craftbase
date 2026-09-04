import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    drawShape,
    drawRectangle,
    addTextToRectangle,
    readGroupText,
    getCanvasBox,
} from './helpers/index.js'

// All shapes are drawn in the lower-right quadrant (65% from left, 60% from top)
// to stay clear of the top toolbar and the Defaults panel on the left.
function safeArea(box) {
    const cx = box.x + box.width * 0.65
    const cy = box.y + box.height * 0.60
    return { cx, cy }
}

// --- Resize + copy/paste dimension-preservation helpers ---

// A shape's body renders as a path (rectangle/diamond) or ellipse (circle).
const GEOM_SELECTOR = 'ellipse, path, rect, circle'
// Mirrors SELECTION_PADDING in src/canvas/selectionController.ts. At the default
// scale (1) surface units ≈ screen px, so a corner handle sits this many px
// outside the shape's rendered corner.
const SELECTION_PADDING = 5
// Clones render identically; allow a couple px for subpixel/stroke rounding.
const SIZE_TOL = 2

// Reads the rendered geometry box (screen px) of a shape's body node. Size is
// position-independent, so it lets us compare an original against its pasted
// clone regardless of where paste drops the copy.
async function geomRect(handle) {
    return handle.$eval(GEOM_SELECTOR, (el) => {
        const r = el.getBoundingClientRect()
        return {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
        }
    })
}

// Clicks a shape's current center to select it, waiting for the selection
// chrome (.shape-selected on the canvas root) so the corner handles exist.
async function selectShape(page, handle) {
    const r = await geomRect(handle)
    await page.mouse.click(r.left + r.width / 2, r.top + r.height / 2)
    await page.waitForSelector('.shape-selected')
}

// Drags the SE corner handle of an already-selected shape by (dx, dy) to grow
// its width/height. The handle sits ~SELECTION_PADDING outside the rendered
// SE corner.
async function resizeFromSECorner(page, handle, dx, dy) {
    const r = await geomRect(handle)
    const startX = r.right + SELECTION_PADDING
    const startY = r.bottom + SELECTION_PADDING
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + dx, startY + dy, { steps: 10 })
    await page.mouse.up()
}

test.describe('Copy-paste', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    /**
     * Regression: pasting a rectangle-with-text produced a rectangle with no text.
     *
     * Root cause: group.elementData (read by the copy handler) is set at component
     * mount and never re-synced when metadata.textContent is updated via double-click
     * editing. The copy handler reads stale metadata, so the clone has no text.
     */
    test('pasted rectangle-with-text preserves original text content', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const rectHandle = await drawRectangle(page, {
            startX: cx - 100,
            startY: cy - 60,
            endX: cx + 100,
            endY: cy + 60,
        })

        const TEXT = 'Hello Craftbase'
        await addTextToRectangle(page, rectHandle, TEXT)

        // Click the rectangle to select it
        const rectBox = await rectHandle.boundingBox()
        await page.mouse.click(
            rectBox.x + rectBox.width / 2,
            rectBox.y + rectBox.height / 2
        )

        await page.keyboard.press('Meta+c')

        // Move mouse to an empty area to the left before pasting
        await page.mouse.move(cx - 300, cy)
        await page.keyboard.press('Meta+v')

        await page.waitForFunction(
            () => document.querySelectorAll('[data-component-id]').length >= 2
        )

        const originalId = await rectHandle.getAttribute('id')
        const allGroups = await page.$$('[data-component-id]')
        let pastedHandle = null
        for (const group of allGroups) {
            const id = await group.getAttribute('id')
            if (id !== originalId) {
                pastedHandle = group
                break
            }
        }
        expect(pastedHandle).not.toBeNull()

        // The pasted rectangle must preserve the full text. At the user
        // default size ("M") "Hello Craftbase" wraps to two <text> line
        // nodes inside the 200px-wide rectangle, so read the whole stack
        // (not just line 1) and reconstruct the space-separated content.
        const pastedText = await readGroupText(pastedHandle)
        expect(pastedText).toBe(TEXT)
    })

    test('pasting a plain rectangle (no text) produces a rectangle with no text node', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const rectHandle = await drawRectangle(page, {
            startX: cx - 100,
            startY: cy - 60,
            endX: cx + 100,
            endY: cy + 60,
        })

        const rectBox = await rectHandle.boundingBox()
        await page.mouse.click(
            rectBox.x + rectBox.width / 2,
            rectBox.y + rectBox.height / 2
        )
        await page.keyboard.press('Meta+c')
        await page.mouse.move(cx - 300, cy)
        await page.keyboard.press('Meta+v')

        await page.waitForFunction(
            () => document.querySelectorAll('[data-component-id]').length >= 2
        )

        const originalId = await rectHandle.getAttribute('id')
        const allGroups = await page.$$('[data-component-id]')
        let pastedHandle = null
        for (const group of allGroups) {
            const id = await group.getAttribute('id')
            if (id !== originalId) {
                pastedHandle = group
                break
            }
        }
        expect(pastedHandle).not.toBeNull()

        // No text node expected on a plain rectangle
        const textNode = await pastedHandle.$('text')
        expect(textNode).toBeNull()
    })

    test('pasting a circle preserves fill color', async ({ page }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const circleHandle = await drawShape(page, 'circle', {
            startX: cx - 60,
            startY: cy - 60,
            endX: cx + 60,
            endY: cy + 60,
        })

        const originalFill = await circleHandle.$eval(
            'ellipse, path, circle',
            (el) => el.getAttribute('fill')
        )

        const circleBox = await circleHandle.boundingBox()
        await page.mouse.click(
            circleBox.x + circleBox.width / 2,
            circleBox.y + circleBox.height / 2
        )
        await page.keyboard.press('Meta+c')
        await page.mouse.move(cx - 300, cy)
        await page.keyboard.press('Meta+v')

        await page.waitForFunction(
            () => document.querySelectorAll('[data-component-id]').length >= 2
        )

        const originalId = await circleHandle.getAttribute('id')
        const allGroups = await page.$$('[data-component-id]')
        let pastedHandle = null
        for (const group of allGroups) {
            const id = await group.getAttribute('id')
            if (id !== originalId) {
                pastedHandle = group
                break
            }
        }
        expect(pastedHandle).not.toBeNull()

        const pastedFill = await pastedHandle.$eval(
            'ellipse, path, circle',
            (el) => el.getAttribute('fill')
        )
        expect(pastedFill).toBe(originalFill)
    })

    /**
     * Regression: copy-paste does not preserve a fill that was changed via the
     * floating toolbar's Background color picker. The pasted clone reverts to
     * the default fill instead of the user-applied color.
     *
     * Flow exercised:
     *   1. Draw circle (default fill #f4f4f2)
     *   2. Click circle → floating toolbar opens
     *   3. Click #FFF0B3 swatch in Background section → fill updated in store
     *   4. Cmd+C → Cmd+V on empty area
     *   5. Pasted circle's <ellipse> fill should be #FFF0B3, not the default
     */
    test('pasting a circle with user-modified fill preserves the new fill', async ({
        page,
    }) => {
        const NEW_FILL = '#FFF0B3'

        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const circleHandle = await drawShape(page, 'circle', {
            startX: cx - 60,
            startY: cy - 60,
            endX: cx + 60,
            endY: cy + 60,
        })

        // Select the circle so the floating toolbar opens
        const circleBox = await circleHandle.boundingBox()
        await page.mouse.click(
            circleBox.x + circleBox.width / 2,
            circleBox.y + circleBox.height / 2
        )

        // Each ColorPicker section in the floating toolbar wraps its picker
        // in a div with data-section ("fill" | "stroke" | "textColor").
        // Scope to data-section="fill" so we don't accidentally click the
        // matching swatch in the Stroke or Text picker.
        const swatch = page.locator(
            `#floating-toolbar [data-section="fill"] [title="${NEW_FILL}"]`
        )
        await swatch.first().click()

        // Wait until the original circle's <ellipse> fill reflects the new color
        const originalId = await circleHandle.getAttribute('id')
        await page.waitForFunction(
            ({ id, color }) => {
                const node = document
                    .getElementById(id)
                    ?.querySelector('ellipse, path, circle')
                return node?.getAttribute('fill') === color
            },
            { id: originalId, color: NEW_FILL }
        )

        // Click off the shape to deselect, so Cmd+V pastes via the canvas
        // copy/paste handler rather than into a focused toolbar input.
        await page.mouse.click(cx - 350, cy)

        // Re-select the circle (deselect cleared it) and copy
        await page.mouse.click(
            circleBox.x + circleBox.width / 2,
            circleBox.y + circleBox.height / 2
        )
        await page.keyboard.press('Meta+c')

        await page.mouse.move(cx - 300, cy)
        await page.keyboard.press('Meta+v')

        await page.waitForFunction(
            () => document.querySelectorAll('[data-component-id]').length >= 2
        )

        const allGroups = await page.$$('[data-component-id]')
        let pastedHandle = null
        for (const group of allGroups) {
            const id = await group.getAttribute('id')
            if (id !== originalId) {
                pastedHandle = group
                break
            }
        }
        expect(pastedHandle).not.toBeNull()

        const pastedFill = await pastedHandle.$eval(
            'ellipse, path, circle',
            (el) => el.getAttribute('fill')
        )
        expect(pastedFill).toBe(NEW_FILL)
    })

    // Resizing commits new width/height (the radius/diameter for circles) to the
    // shape. These guard the regression risk that the copy handler reads stale
    // pre-resize geometry — the same class of bug as the rectangle-with-text
    // staleness above — so the pasted clone must carry the *resized* dimensions,
    // not the draw-time ones. One test per shape, including circle.
    const RESIZE_CASES = [
        {
            type: 'rectangle',
            name: 'pasted rectangle preserves width/height set by a prior resize',
            draw: (cx, cy) => ({
                startX: cx - 100,
                startY: cy - 60,
                endX: cx + 100,
                endY: cy + 60,
            }),
        },
        {
            type: 'circle',
            name: 'pasted circle preserves size (radius) set by a prior resize',
            draw: (cx, cy) => ({
                startX: cx - 60,
                startY: cy - 60,
                endX: cx + 60,
                endY: cy + 60,
            }),
        },
        {
            type: 'diamond',
            name: 'pasted diamond preserves width/height set by a prior resize',
            draw: (cx, cy) => ({
                startX: cx - 70,
                startY: cy - 70,
                endX: cx + 70,
                endY: cy + 70,
            }),
        },
    ]

    for (const shapeCase of RESIZE_CASES) {
        test(shapeCase.name, async ({ page }) => {
            const box = await getCanvasBox(page)
            const { cx, cy } = safeArea(box)
            // Empty canvas point (left of the shape, clear of the top toolbar
            // and the left Defaults panel) used for blur and re-blur clicks.
            const emptyPoint = {
                x: box.x + box.width * 0.3,
                y: box.y + box.height * 0.85,
            }

            const handle = await drawShape(
                page,
                shapeCase.type,
                shapeCase.draw(cx, cy)
            )

            // Blur: click empty canvas to drop any post-draw selection.
            await page.mouse.click(emptyPoint.x, emptyPoint.y)

            // Re-select, then grow the shape via its SE corner handle.
            await selectShape(page, handle)
            const beforeResize = await geomRect(handle)
            await resizeFromSECorner(page, handle, 80, 80)
            const afterResize = await geomRect(handle)

            // Sanity: the resize actually enlarged the shape.
            expect(afterResize.width).toBeGreaterThan(beforeResize.width + 20)
            expect(afterResize.height).toBeGreaterThan(beforeResize.height + 20)

            // Deselect → re-select → copy (mirrors the proven select-before-copy
            // sequence above), then paste on empty canvas.
            await page.mouse.click(emptyPoint.x, emptyPoint.y)
            await selectShape(page, handle)
            await page.keyboard.press('Meta+c')
            await page.mouse.move(cx - 300, cy)
            await page.keyboard.press('Meta+v')

            await page.waitForFunction(
                () =>
                    document.querySelectorAll('[data-component-id]').length >= 2
            )

            // The pasted clone is the element whose id differs from the original.
            const originalId = await handle.getAttribute('id')
            const allGroups = await page.$$('[data-component-id]')
            let pastedHandle = null
            for (const group of allGroups) {
                const id = await group.getAttribute('id')
                if (id !== originalId) {
                    pastedHandle = group
                    break
                }
            }
            expect(pastedHandle).not.toBeNull()

            // The pasted clone must carry the resized dimensions, not pre-resize.
            const pasted = await geomRect(pastedHandle)
            expect(
                Math.abs(pasted.width - afterResize.width)
            ).toBeLessThanOrEqual(SIZE_TOL)
            expect(
                Math.abs(pasted.height - afterResize.height)
            ).toBeLessThanOrEqual(SIZE_TOL)
        })
    }
})
