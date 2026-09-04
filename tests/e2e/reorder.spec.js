import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    drawShape,
    clickPointerTool,
} from './helpers/index.js'

/**
 * Z-order reorder suite (Bring Forward / Bring to Front / Send Backward /
 * Send to Back).
 *
 * Every test seeds the SAME three non-overlapping shapes, inserted in this
 * order: circle (1st) → rectangle (2nd) → diamond (3rd). New elements stack on
 * top (position = max+1), so the initial z-order, back→front, is:
 *
 *     [circle, rectangle, diamond]
 *
 * We assert against the RENDERED SVG, not the store/draft. Each shape group is
 * a sibling <g data-component-id> under the Two.js scene root (<g id="two-0">),
 * and reconcileZOrder physically reorders those sibling nodes. So the document
 * order of [data-component-id] nodes IS the z-order (back→front) — exactly the
 * nested-<g> approach described in the hint.
 *
 * All reorder operations are performed on the FIRST element (circle) only. The
 * circle starts backmost, so Send Backward / Send to Back would be no-ops on
 * it; those two tests first bring the circle to front (still a circle-only op)
 * to create a meaningful starting state, then apply the operation under test.
 *
 * Shortcuts (post tab-switch-collision fix): bare [ /] = backward/forward,
 * ⌘[ /⌘] = to back / to front. The handler accepts metaKey OR ctrlKey, so
 * Meta+[ / Meta+] work on Linux/CI too.
 */

// Draw the three shapes spread across the lower band so each is clickable on
// its own centre (z-order is independent of x/y, but non-overlap guarantees a
// centre-click selects the intended shape). Kept clear of the top toolbar
// (~y < 60) and the left Defaults panel (~x < 160).
async function setupThreeShapes(page) {
    const box = await getCanvasBox(page)
    const cy = box.y + box.height * 0.6
    const half = 40

    const centres = {
        circle: box.x + box.width * 0.3,
        rectangle: box.x + box.width * 0.5,
        diamond: box.x + box.width * 0.7,
    }

    const drawAt = (type) =>
        drawShape(page, type, {
            startX: centres[type] - half,
            startY: cy - half,
            endX: centres[type] + half,
            endY: cy + half,
        })

    // Insert in the required order: circle → rectangle → diamond.
    const circle = await drawAt('circle')
    const rectangle = await drawAt('rectangle')
    const diamond = await drawAt('diamond')

    const ids = {
        circle: await circle.getAttribute('data-component-id'),
        rectangle: await rectangle.getAttribute('data-component-id'),
        diamond: await diamond.getAttribute('data-component-id'),
    }
    return { handles: { circle, rectangle, diamond }, ids }
}

// Document (z) order of our three shapes, back→front. Filtered to the known
// ids so any selection-overlay nodes are ignored.
async function getZOrder(page, ids) {
    const order = await page.$$eval(
        '#main-two-root svg [data-component-id]',
        (els) => els.map((e) => e.getAttribute('data-component-id'))
    )
    const known = new Set(Object.values(ids))
    return order.filter((id) => known.has(id))
}

// Select a single shape by clicking its centre in Pointer mode. Waits for the
// floating toolbar so we know selectionController.currentGroup is set (which is
// what getSelectedGroup — and therefore the reorder shortcuts — read).
async function selectShape(page, handle) {
    await clickPointerTool(page)
    const b = await handle.boundingBox()
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForSelector('#floating-toolbar')
}

// Map our three ids to readable labels for nicer assertion diffs.
function asLabels(order, ids) {
    const byId = {
        [ids.circle]: 'circle',
        [ids.rectangle]: 'rectangle',
        [ids.diamond]: 'diamond',
    }
    return order.map((id) => byId[id])
}

test.describe('Reorder — z-order operations on the first element (circle)', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('initial insertion order is circle → rectangle → diamond (back→front)', async ({
        page,
    }) => {
        const { ids } = await setupThreeShapes(page)
        const order = await getZOrder(page, ids)
        expect(asLabels(order, ids)).toEqual(['circle', 'rectangle', 'diamond'])
    })

    test('Bring Forward (]) moves circle ahead of rectangle but behind diamond', async ({
        page,
    }) => {
        const { handles, ids } = await setupThreeShapes(page)
        await selectShape(page, handles.circle)

        await page.keyboard.press(']')

        await expect
            .poll(async () => asLabels(await getZOrder(page, ids), ids))
            .toEqual(['rectangle', 'circle', 'diamond'])
    })

    test('Bring to Front (⌘]) moves circle ahead of both rectangle and diamond', async ({
        page,
    }) => {
        const { handles, ids } = await setupThreeShapes(page)
        await selectShape(page, handles.circle)

        await page.keyboard.press('Meta+]')

        await expect
            .poll(async () => asLabels(await getZOrder(page, ids), ids))
            .toEqual(['rectangle', 'diamond', 'circle'])
    })

    test('Send Backward ([) moves circle behind diamond but ahead of rectangle', async ({
        page,
    }) => {
        const { handles, ids } = await setupThreeShapes(page)
        await selectShape(page, handles.circle)

        // Setup: bring circle to front so a backward step is meaningful.
        // [circle, rectangle, diamond] -> [rectangle, diamond, circle]
        await page.keyboard.press('Meta+]')
        await expect
            .poll(async () => asLabels(await getZOrder(page, ids), ids))
            .toEqual(['rectangle', 'diamond', 'circle'])

        // Operation under test: one step back.
        // [rectangle, diamond, circle] -> [rectangle, circle, diamond]
        await page.keyboard.press('[')
        await expect
            .poll(async () => asLabels(await getZOrder(page, ids), ids))
            .toEqual(['rectangle', 'circle', 'diamond'])
    })

    test('Send to Back (⌘[) moves circle behind both rectangle and diamond', async ({
        page,
    }) => {
        const { handles, ids } = await setupThreeShapes(page)
        await selectShape(page, handles.circle)

        // Setup: bring circle to front so a send-to-back is meaningful.
        // [circle, rectangle, diamond] -> [rectangle, diamond, circle]
        await page.keyboard.press('Meta+]')
        await expect
            .poll(async () => asLabels(await getZOrder(page, ids), ids))
            .toEqual(['rectangle', 'diamond', 'circle'])

        // Operation under test: send all the way to the back.
        // [rectangle, diamond, circle] -> [circle, rectangle, diamond]
        await page.keyboard.press('Meta+[')
        await expect
            .poll(async () => asLabels(await getZOrder(page, ids), ids))
            .toEqual(['circle', 'rectangle', 'diamond'])
    })
})
