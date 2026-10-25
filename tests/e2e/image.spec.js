import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    getDraftComponents,
    drawRectangle,
    drawPencilStroke,
    clickPointerTool,
} from './helpers/index.js'

/**
 * Image elements (local mode only).
 *
 * Covers both entry points (drag-and-drop onto the canvas, and the toolbar's
 * Image tool) plus the basic edits on a placed image: resize, delete, drag,
 * and z-order against elements drawn on top of it.
 *
 * Playwright can't drag a file from the OS, so the drop test builds a real
 * File inside the page, wraps it in a DataTransfer, and dispatches
 * dragover + drop on #main-two-root. That is the same event shape the browser
 * delivers, and useImageDrop reads only `dataTransfer.files` and the client
 * coords from it.
 *
 * The record's x/y is the image CENTER (the factory centers the frame rect on
 * the group translation), so position checks compare against centers.
 */

// Matches the debounce in useLocalDraftPersistence (500ms) plus headroom.
const DRAFT_DEBOUNCE_MS = 700
// Mirrors SELECTION_PADDING in src/canvas/selectionController.ts.
const SELECTION_PADDING = 5
// Natural size of the test bitmap. Under IMAGE_DROP_MAX_SCREEN_PX (480), so
// at scale 1 the element keeps this size.
const IMG_W = 400
const IMG_H = 300
// Rounding slack for screen px vs surface units.
const POS_TOL = 3

const IMAGE_GROUP = '[data-component-type="image"]'
const IMAGE_NODE = 'image[data-cb-image]'
// Mirrors IMAGE_PENDING_ATTR in src/utils/imagePendingNode.ts.
const PENDING_NODE = '[data-cb-image-pending]'

// Encodes a solid-color PNG in the page and returns its bytes to Node, so the
// same buffer can feed both the drop DataTransfer and the file chooser.
async function makePng(page, { width, height, color }) {
    const base64 = await page.evaluate(
        ({ width, height, color }) => {
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = color
            ctx.fillRect(0, 0, width, height)
            return canvas.toDataURL('image/png').split(',')[1]
        },
        { width, height, color }
    )
    return Buffer.from(base64, 'base64')
}

async function dropImageFile(page, buffer, { clientX, clientY }) {
    const dataTransfer = await page.evaluateHandle((base64) => {
        const bin = atob(base64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        const dt = new DataTransfer()
        dt.items.add(new File([bytes], 'test.png', { type: 'image/png' }))
        return dt
    }, buffer.toString('base64'))

    const init = { dataTransfer, clientX, clientY, bubbles: true }
    await page.dispatchEvent('#main-two-root', 'dragover', init)
    await page.dispatchEvent('#main-two-root', 'drop', init)
}

async function insertImageViaToolbar(page, buffer) {
    const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('[aria-label="Image"]'),
    ])
    await chooser.setFiles({
        name: 'picked.png',
        mimeType: 'image/png',
        buffer,
    })
}

// Waits until the bitmap is painted (not just the placeholder frame) and
// returns the element's group handle.
async function waitForImageElement(page) {
    await page.waitForSelector(`${IMAGE_GROUP} ${IMAGE_NODE}`, {
        state: 'attached',
    })
    return page.$(IMAGE_GROUP)
}

async function getImageRecord(page) {
    const draft = (await getDraftComponents(page)) || {}
    return Object.values(draft).find((c) => c.componentType === 'image')
}

// Rendered box of the <image> node in screen px.
async function imageRect(handle) {
    return handle.$eval(IMAGE_NODE, (el) => {
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

async function selectImage(page, handle) {
    await clickPointerTool(page)
    const r = await imageRect(handle)
    await page.mouse.click(r.left + r.width / 2, r.top + r.height / 2)
    await page.waitForSelector('.shape-selected')
}

async function placeImageByDrop(page) {
    const box = await getCanvasBox(page)
    const drop = {
        clientX: Math.round(box.x + box.width * 0.55),
        clientY: Math.round(box.y + box.height * 0.55),
    }
    const png = await makePng(page, {
        width: IMG_W,
        height: IMG_H,
        color: '#3b82f6',
    })
    await dropImageFile(page, png, drop)
    const handle = await waitForImageElement(page)
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
    return { handle, drop }
}

test.describe('Image elements (local mode)', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('drag and drop of an image file places it at the drop point', async ({
        page,
    }) => {
        const { handle, drop } = await placeImageByDrop(page)

        const record = await getImageRecord(page)
        expect(record).toBeTruthy()
        expect(record.width).toBe(IMG_W)
        expect(record.height).toBe(IMG_H)
        expect(record.metadata.assetId).toBeTruthy()
        expect(record.metadata.url).toBeNull()
        expect(record.metadata.naturalWidth).toBe(IMG_W)
        expect(record.metadata.naturalHeight).toBe(IMG_H)

        // Rendered centered on the drop point.
        const r = await imageRect(handle)
        expect(Math.abs(r.left + r.width / 2 - drop.clientX)).toBeLessThan(
            POS_TOL
        )
        expect(Math.abs(r.top + r.height / 2 - drop.clientY)).toBeLessThan(
            POS_TOL
        )

        // The blob lives in IndexedDB under the record's assetId, not in
        // the draft.
        const stored = await page.evaluate(
            (id) =>
                new Promise((resolve, reject) => {
                    const open = indexedDB.open('craftbase-assets')
                    open.onerror = () => reject(open.error)
                    open.onsuccess = () => {
                        const req = open.result
                            .transaction('images', 'readonly')
                            .objectStore('images')
                            .get(id)
                        req.onsuccess = () =>
                            resolve(
                                req.result ? req.result.bytes.byteLength : 0
                            )
                        req.onerror = () => reject(req.error)
                    }
                }),
            record.metadata.assetId
        )
        expect(stored).toBeGreaterThan(0)
    })

    test('the toolbar Image tool inserts the picked file at the viewport center', async ({
        page,
    }) => {
        const png = await makePng(page, {
            width: IMG_W,
            height: IMG_H,
            color: '#10b981',
        })
        await insertImageViaToolbar(page, png)
        const handle = await waitForImageElement(page)

        const rootBox = await page.locator('#main-two-root').evaluate((el) => {
            const r = el.getBoundingClientRect()
            return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
        })
        const r = await imageRect(handle)
        expect(Math.abs(r.left + r.width / 2 - rootBox.cx)).toBeLessThan(
            POS_TOL
        )
        expect(Math.abs(r.top + r.height / 2 - rootBox.cy)).toBeLessThan(
            POS_TOL
        )
        expect(r.width).toBeCloseTo(IMG_W, 0)
        expect(r.height).toBeCloseTo(IMG_H, 0)

        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const record = await getImageRecord(page)
        expect(record).toBeTruthy()
        expect(record.metadata.assetId).toBeTruthy()
    })

    test('a placed image can be resized from its corner handle', async ({
        page,
    }) => {
        const { handle } = await placeImageByDrop(page)
        await selectImage(page, handle)

        const before = await imageRect(handle)
        const startX = before.right + SELECTION_PADDING
        const startY = before.bottom + SELECTION_PADDING
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        await page.mouse.move(startX + 80, startY + 60, { steps: 10 })
        await page.mouse.up()

        // The bitmap follows the frame.
        await expect
            .poll(async () => (await imageRect(handle)).width)
            .toBeGreaterThan(before.width + 40)
        const after = await imageRect(handle)
        expect(after.height).toBeGreaterThan(before.height + 30)

        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const record = await getImageRecord(page)
        expect(record.width).toBeGreaterThan(IMG_W + 40)
        expect(record.height).toBeGreaterThan(IMG_H + 30)
    })

    test('a placed image can be deleted', async ({ page }) => {
        // Keep another element on the board. The draft writer skips an empty
        // store, so deleting the only element would leave a stale draft and
        // the draft check below would test that, not the image delete.
        const box = await getCanvasBox(page)
        const keeper = await drawRectangle(page, {
            startX: box.x + box.width * 0.2,
            startY: box.y + box.height * 0.2,
            endX: box.x + box.width * 0.2 + 60,
            endY: box.y + box.height * 0.2 + 60,
        })
        const keeperId = await keeper.getAttribute('data-component-id')

        const { handle } = await placeImageByDrop(page)
        const id = await handle.getAttribute('data-component-id')
        await selectImage(page, handle)

        await page.keyboard.press('Backspace')

        await expect(page.locator(IMAGE_GROUP)).toHaveCount(0)
        await expect(page.locator(IMAGE_NODE)).toHaveCount(0)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const draft = (await getDraftComponents(page)) || {}
        expect(draft[id]).toBeFalsy()
        expect(draft[keeperId]).toBeTruthy()
    })

    test('a placed image can be dragged to a new position', async ({
        page,
    }) => {
        const { handle } = await placeImageByDrop(page)
        const recordBefore = await getImageRecord(page)
        await selectImage(page, handle)

        const before = await imageRect(handle)
        const cx = before.left + before.width / 2
        const cy = before.top + before.height / 2
        const dx = 120
        const dy = 80
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + dx, cy + dy, { steps: 10 })
        await page.mouse.up()

        await expect
            .poll(async () => (await imageRect(handle)).left - before.left)
            .toBeGreaterThan(dx - POS_TOL)
        const after = await imageRect(handle)
        expect(Math.abs(after.top - before.top - dy)).toBeLessThan(POS_TOL)
        // A move keeps the size.
        expect(after.width).toBeCloseTo(before.width, 0)
        expect(after.height).toBeCloseTo(before.height, 0)

        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const record = await getImageRecord(page)
        expect(Math.abs(record.x - recordBefore.x - dx)).toBeLessThan(POS_TOL)
        expect(Math.abs(record.y - recordBefore.y - dy)).toBeLessThan(POS_TOL)
    })

    test('elements drawn on top of an image stack above it', async ({
        page,
    }) => {
        const { handle } = await placeImageByDrop(page)
        const imageId = await handle.getAttribute('data-component-id')
        const r = await imageRect(handle)
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2

        const rect = await drawRectangle(page, {
            startX: cx - 60,
            startY: cy - 40,
            endX: cx + 60,
            endY: cy + 40,
        })
        const rectId = await rect.getAttribute('data-component-id')

        const stroke = await drawPencilStroke(page, {
            startX: r.left + 20,
            startY: r.top + 20,
            endX: r.left + 120,
            endY: r.top + 60,
        })
        const strokeId = await stroke.getAttribute('data-component-id')

        // Document order of sibling groups is the z-order, back to front.
        const order = await page.$$eval(
            '#main-two-root svg [data-component-id]',
            (els) => els.map((e) => e.getAttribute('data-component-id'))
        )
        const known = new Set([imageId, rectId, strokeId])
        expect(order.filter((id) => known.has(id))).toEqual([
            imageId,
            rectId,
            strokeId,
        ])

        // And it's actually painted on top: the topmost component at the
        // overlap point is the rectangle, not the image.
        const topmostId = await page.evaluate(
            ({ x, y }) =>
                document
                    .elementFromPoint(x, y)
                    ?.closest('[data-component-id]')
                    ?.getAttribute('data-component-id') ?? null,
            { x: cx, y: cy }
        )
        expect(topmostId).toBe(rectId)
    })

    test('a loader shows from drop until the bitmap paints', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const drop = {
            clientX: Math.round(box.x + box.width * 0.55),
            clientY: Math.round(box.y + box.height * 0.55),
        }
        // Over the 2048px cap, so the drop takes the slow re-encode path.
        const png = await makePng(page, {
            width: 3000,
            height: 2000,
            color: '#f59e0b',
        })

        // The whole pipeline can finish in tens of ms (a flat-color PNG
        // encodes fast), faster than Playwright polls. So record the loader's
        // lifecycle with a MutationObserver and assert on the log afterwards.
        await page.evaluate(
            (sel) => {
                const log = []
                window.__loaderLog = log
                new MutationObserver((records) => {
                    for (const r of records) {
                        for (const n of r.addedNodes) {
                            if (n.nodeType === 1 && n.matches(sel.pending)) {
                                log.push({
                                    event: 'added',
                                    framed: !n
                                        .querySelector('rect')
                                        .hasAttribute('visibility'),
                                    imagePresent: !!document.querySelector(
                                        sel.image
                                    ),
                                })
                            }
                        }
                        if (
                            r.type === 'attributes' &&
                            r.target.closest?.(sel.pending) &&
                            !r.target.hasAttribute('visibility')
                        ) {
                            log.push({
                                event: 'framed',
                                width: r.target.getAttribute('width'),
                                height: r.target.getAttribute('height'),
                            })
                        }
                        for (const n of r.removedNodes) {
                            if (n.nodeType === 1 && n.matches(sel.pending)) {
                                // The "no blank gap" check: the painted
                                // image must already be there.
                                log.push({
                                    event: 'removed',
                                    imagePresent: !!document.querySelector(
                                        sel.image
                                    ),
                                })
                            }
                        }
                    }
                }).observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['visibility'],
                })
            },
            { pending: PENDING_NODE, image: IMAGE_NODE }
        )

        await dropImageFile(page, png, drop)
        await waitForImageElement(page)
        await expect(page.locator(PENDING_NODE)).toHaveCount(0)

        // Spinner first (no frame, no image yet), then the frame at the final
        // size (3000x2000 fits to 480x320), then removal once painted.
        expect(await page.evaluate(() => window.__loaderLog)).toEqual([
            { event: 'added', framed: false, imagePresent: false },
            { event: 'framed', width: '480', height: '320' },
            { event: 'removed', imagePresent: true },
        ])
    })

    test('a file that fails to decode removes its loader and says why', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        // PNG mime type, garbage bytes: accepted by type, fails in decode.
        await dropImageFile(page, Buffer.from('not really a png'), {
            clientX: Math.round(box.x + box.width * 0.5),
            clientY: Math.round(box.y + box.height * 0.5),
        })

        await expect(
            page.getByText("That image couldn't be read.")
        ).toBeVisible()
        await expect(page.locator(PENDING_NODE)).toHaveCount(0)
        await expect(page.locator(IMAGE_GROUP)).toHaveCount(0)
    })
})
