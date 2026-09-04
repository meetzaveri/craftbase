import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    drawShape,
    drawArrow,
    placeText,
    addTextToRectangle,
    clickPointerTool,
    triggerUndoKeyboard,
} from './helpers/index.js'

/**
 * Opacity handling suite.
 *
 * Opacity is applied at the GROUP level (see src/utils/applyProperty.ts and the
 * *-with-text element components), NOT on the shape/text leaves. The group's own
 * `opacity` repaints reliably and uniformly dims the shape PLUS any embedded
 * text-layer nodes in one shot — a leaf-level write would only surface after the
 * next full repaint (e.g. on deselect) because the rounded-rect path is
 * double-referenced in group.children.
 *
 * Two.js renders `group.opacity` as the `opacity` attribute on the
 * <g data-component-id> element (node_modules/two.js/src/renderers/svg.js group
 * render → `elem.setAttribute('opacity', this._opacity)`). So a single read of
 * that attribute is the user-facing truth: when it reads 0.5, the shape and any
 * text inside dim together. These assertions deliberately read the rendered SVG,
 * never the draft/store.
 */

// Lower-right quadrant keeps shapes clear of the top toolbar and the
// Defaults/floating panel on the left (mirrors copy-paste.spec.js).
function safeArea(box) {
    return { cx: box.x + box.width * 0.65, cy: box.y + box.height * 0.6 }
}

/**
 * Switches to Pointer mode (clearing any leftover draw-mode flags) and clicks
 * the element's centre to select it, then waits for the opacity slider to mount
 * inside the floating toolbar. For a horizontal arrow the bounding-box centre
 * lands on the line, so the same centre-click selects it too.
 */
async function selectElement(page, handle) {
    await clickPointerTool(page)
    const box = await handle.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForSelector('#floating-toolbar #slider-main')
}

/**
 * Drags the opacity slider handle to the track's horizontal midpoint. The
 * ranger snaps to stepSize 0.1 (min 0, max 1), so the midpoint commits 0.5.
 * The drag fires the live-preview path on every move and the commit path on
 * release — exercising both, exactly like a real user.
 *
 * The floating toolbar caps its height (max-h-128) and scrolls internally, so
 * for element kinds with many property sections (e.g. RECT_WITH_TEXT) the
 * opacity slider starts below the toolbar's clipped fold. We must scroll it
 * into view first — otherwise the raw mouse coordinates land on the canvas
 * underneath and a bare-canvas mousedown deselects the element.
 */
async function setOpacityToHalf(page) {
    await page
        .locator('#floating-toolbar #slider-handle')
        .scrollIntoViewIfNeeded()
    const track = await page
        .locator('#floating-toolbar #slider-main')
        .boundingBox()
    const handle = await page
        .locator('#floating-toolbar #slider-handle')
        .boundingBox()
    const y = handle.y + handle.height / 2
    await page.mouse.move(handle.x + handle.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(track.x + track.width * 0.5, y, { steps: 12 })
    await page.mouse.up()
}

// Reads the rendered group opacity. A fresh element carries opacity="1" (or no
// attribute), so treat a missing attribute as fully opaque.
async function readGroupOpacity(page, id) {
    return page.$eval(`[data-component-id="${id}"]`, (el) => {
        const v = el.getAttribute('opacity')
        return v == null ? 1 : parseFloat(v)
    })
}

const idOf = (handle) => handle.getAttribute('data-component-id')

// 0.5 ± 0.05 — confirms the drag landed on the 50% step, not merely "dimmed".
function expectHalfOpacity(value, label) {
    expect(value, `${label}: opacity should drop below full`).toBeLessThan(1)
    expect(value, `${label}: opacity should read ~0.5`).toBeCloseTo(0.5, 1)
}

test.describe('Opacity — changing the slider dims the selected element', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('shape with text: both the shape and its text dim to 50%', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const handle = await drawShape(page, 'rectangle', {
            startX: cx - 90,
            startY: cy - 55,
            endX: cx + 90,
            endY: cy + 55,
        })
        await addTextToRectangle(page, handle, 'Hi')
        const id = await idOf(handle)

        // Sanity: the group actually carries a <text> node, so a single
        // group-opacity read genuinely covers "shape + text".
        const hasText = await page.$eval(
            `[data-component-id="${id}"]`,
            (el) => !!el.querySelector('text') && !!el.querySelector('path')
        )
        expect(hasText, 'shape-with-text must render both path and text').toBe(
            true
        )

        await selectElement(page, handle)
        await setOpacityToHalf(page)

        await expect
            .poll(() => readGroupOpacity(page, id))
            .toBeGreaterThan(0)
        expectHalfOpacity(await readGroupOpacity(page, id), 'shape-with-text')
    })

    test('shape without text: the shape dims to 50%', async ({ page }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const handle = await drawShape(page, 'rectangle', {
            startX: cx - 90,
            startY: cy - 55,
            endX: cx + 90,
            endY: cy + 55,
        })
        const id = await idOf(handle)

        const hasText = await page.$eval(
            `[data-component-id="${id}"]`,
            (el) => !!el.querySelector('text')
        )
        expect(hasText, 'plain shape should have no text node').toBe(false)

        await selectElement(page, handle)
        await setOpacityToHalf(page)

        await expect
            .poll(() => readGroupOpacity(page, id))
            .toBeGreaterThan(0)
        expectHalfOpacity(await readGroupOpacity(page, id), 'plain shape')
    })

    test('arrow: the arrow dims to 50%', async ({ page }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const handle = await drawArrow(page, {
            startX: cx - 120,
            startY: cy,
            endX: cx + 120,
            endY: cy,
        })
        const id = await idOf(handle)

        await selectElement(page, handle)
        await setOpacityToHalf(page)

        await expect
            .poll(() => readGroupOpacity(page, id))
            .toBeGreaterThan(0)
        expectHalfOpacity(await readGroupOpacity(page, id), 'arrow')
    })

    test('text: the text dims to 50%', async ({ page }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const handle = await placeText(page, { x: cx, y: cy })
        const id = await idOf(handle)

        await selectElement(page, handle)
        await setOpacityToHalf(page)

        await expect
            .poll(() => readGroupOpacity(page, id))
            .toBeGreaterThan(0)
        expectHalfOpacity(await readGroupOpacity(page, id), 'text')
    })

    test('shape with text: undo restores opacity to 100%', async ({ page }) => {
        const box = await getCanvasBox(page)
        const { cx, cy } = safeArea(box)

        const handle = await drawShape(page, 'rectangle', {
            startX: cx - 90,
            startY: cy - 55,
            endX: cx + 90,
            endY: cy + 55,
        })
        await addTextToRectangle(page, handle, 'Hi')
        const id = await idOf(handle)

        await selectElement(page, handle)
        await setOpacityToHalf(page)
        expectHalfOpacity(await readGroupOpacity(page, id), 'before undo')

        await triggerUndoKeyboard(page)

        // After undo the group must be fully opaque again (both shape and text).
        await expect.poll(() => readGroupOpacity(page, id)).toBe(1)
    })
})
