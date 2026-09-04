import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    placeText,
    triggerUndoKeyboard,
    getCanvasBox,
    drawRectangle,
    addTextToRectangle,
    readGroupText,
} from './helpers/index.js'

// Regression coverage for multiline STANDALONE text. A multiline text element
// is a stack of Two.Text line nodes (line 1 + satellites), each rendered as a
// separate <text> SVG node. Three bugs were fixed:
//   1. Toolbar size/family/color only mutated line 1.
//   2. Undo/redo only reverted line 1.
//   3. Copy-paste only cloned line 1.
// These tests assert the change/undo/clone reaches EVERY line node.

const SETTLE_MS = 400

// Lower-right quadrant, clear of the top toolbar and the left Defaults panel.
function safeArea(box) {
    return { cx: box.x + box.width * 0.65, cy: box.y + box.height * 0.6 }
}

const fontSizesOf = (handle) =>
    handle.$$eval('text', (ns) => ns.map((n) => n.getAttribute('font-size')))
const fillsOf = (handle) =>
    handle.$$eval('text', (ns) => ns.map((n) => n.getAttribute('fill')))
const lineCountOf = (handle) => handle.$$eval('text', (ns) => ns.length)
// Per-line text content, space-joined (word-wrap consumes the separator, so
// joining the line nodes reconstructs the visible content).
const contentOf = (handle) =>
    handle
        .$$eval('text', (ns) => ns.map((n) => n.textContent))
        .then((vs) => vs.filter(Boolean).join(' '))

// Press undo until the joined line content matches `expected`. Absorbs the
// odd extra no-op history entry so a single stray Meta+z can't flake the test.
async function undoUntilContent(page, read, expected, tries = 4) {
    for (let i = 0; i < tries - 1; i++) {
        await triggerUndoKeyboard(page)
        try {
            await expect.poll(read, { timeout: 1_500 }).toBe(expected)
            return
        } catch {
            // not reverted yet — pop the next entry
        }
    }
    await triggerUndoKeyboard(page)
    await expect.poll(read, { timeout: 2_000 }).toBe(expected)
}
const allComponentIds = (page) =>
    page.$$eval('[data-component-id]', (els) =>
        els.map((e) => e.getAttribute('data-component-id'))
    )

const dedupSorted = (arr) => [...new Set(arr)].sort()

// Place a standalone text element and give it two hard-newline lines.
//
// placeText already dispatches `triggerTextInput`, so the inline editor
// auto-opens ~100ms after placement. We use THAT editor (filling '\n'
// directly so the blur handler splits it into 2 line nodes) instead of
// double-clicking to open a second one — racing two editors was the source
// of a lingering `.temp-input-area`.
async function createMultilineText(page, content = 'AAAAA\nBBBBB') {
    const box = await getCanvasBox(page)
    const { cx, cy } = safeArea(box)
    const handle = await placeText(page, { x: cx, y: cy })

    const editor = page.locator('.temp-input-area')
    await editor.waitFor({ state: 'visible' })
    await editor.fill(content)
    await page.keyboard.press('Tab')
    // Editor must be fully closed before any copy — the clipboard handler
    // bails when the active element is a textarea.
    await expect(editor).toHaveCount(0)
    // Poll via the stable Playwright handle (the Two.js DOM id churns on
    // re-render, so getElementById(staleId) is flaky).
    await expect.poll(() => lineCountOf(handle)).toBeGreaterThanOrEqual(2)
    return { handle, cx, cy }
}

// Click empty canvas to clear any draw/edit state, then click the element and
// confirm selection by waiting for the floating toolbar (it only renders
// while something is selected).
async function selectText(page, handle, emptyX, emptyY) {
    await page.mouse.click(emptyX, emptyY)
    const b = await handle.boundingBox()
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    await page.locator('#floating-toolbar').waitFor({
        state: 'visible',
    })
}

// Standalone-text selection reaching the clipboard's getSelectedGroup() is
// driven by a different mechanism than the React floating toolbar, so a copy
// can race ahead of it. A failed copy leaves the clipboard empty and paste is
// a no-op (zero new components), so re-selecting and retrying is safe and
// never duplicates. Returns the new component's data-component-id.
async function copyPasteUntilClone(
    page,
    handle,
    idsBefore,
    emptyX,
    emptyY,
    dropX,
    dropY,
    tries = 4
) {
    const newCount = async () =>
        (await allComponentIds(page)).filter(
            (id) => !idsBefore.includes(id)
        ).length
    for (let i = 0; i < tries; i++) {
        await selectText(page, handle, emptyX, emptyY)
        await page.keyboard.press('Meta+c')
        await page.mouse.move(dropX, dropY)
        await page.keyboard.press('Meta+v')
        try {
            await expect.poll(newCount, { timeout: 2_500 }).toBe(1)
            const ids = await allComponentIds(page)
            return ids.find((id) => !idsBefore.includes(id))
        } catch {
            // copy didn't register (clipboard empty → paste no-op) — retry
        }
    }
    await expect.poll(newCount, { timeout: 2_500 }).toBe(1)
    const ids = await allComponentIds(page)
    return ids.find((id) => !idsBefore.includes(id))
}

// Press undo until the (deduped) per-line values match `expected`. The
// regression being guarded is "all line nodes move together" — if undo
// reverted only line 1, the deduped set would still contain the changed
// value and never match. Repeating absorbs the extra no-op history entry a
// toolbar color/size picker can emit (a single Meta+z would otherwise land
// on a value→same-value entry and look like a no-op).
async function undoUntil(page, read, expected, tries = 4) {
    for (let i = 0; i < tries - 1; i++) {
        await triggerUndoKeyboard(page)
        try {
            await expect
                .poll(async () => dedupSorted(await read()), {
                    timeout: 1_500,
                })
                .toEqual(expected)
            return
        } catch {
            // not reverted yet — pop the next entry
        }
    }
    await triggerUndoKeyboard(page)
    await expect
        .poll(async () => dedupSorted(await read()), { timeout: 2_000 })
        .toEqual(expected)
}

test.describe('Multiline standalone text', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('text size: change + undo apply to EVERY line node', async ({
        page,
    }) => {
        const { handle, cx, cy } = await createMultilineText(page)

        const before = await fontSizesOf(handle)
        expect(before.length).toBeGreaterThanOrEqual(2)
        // Default standalone text size is the user default "M" (36 desktop).
        expect(new Set(before)).toEqual(new Set(['36']))

        await selectText(page, handle, cx - 350, cy)
        await page
            .locator('#floating-toolbar')
            .getByRole('button', { name: 'XL', exact: true })
            .click()
        await page.waitForTimeout(SETTLE_MS)

        const afterChange = await fontSizesOf(handle)
        // Every line node — not just line 1 — must be XL (72 on desktop).
        expect(afterChange.length).toBe(before.length)
        expect(new Set(afterChange)).toEqual(new Set(['72']))

        await page.mouse.click(cx - 350, cy)
        await undoUntil(page, () => fontSizesOf(handle), dedupSorted(before))
    })

    test('text color: change + undo apply to EVERY line node', async ({
        page,
    }) => {
        const TEXT_COLOR = '#FF5630'
        const { handle, cx, cy } = await createMultilineText(page)

        const before = await fillsOf(handle)
        expect(before.length).toBeGreaterThanOrEqual(2)
        // All lines start the same colour (and none is the target colour).
        expect(new Set(before).size).toBe(1)
        expect(before[0]).not.toBe(TEXT_COLOR)

        await selectText(page, handle, cx - 350, cy)
        await page.click(
            `#floating-toolbar [data-section="textColor"] [title="${TEXT_COLOR}"]`
        )
        await page.waitForTimeout(SETTLE_MS)

        const afterChange = await fillsOf(handle)
        expect(new Set(afterChange)).toEqual(new Set([TEXT_COLOR]))

        await page.mouse.click(cx - 350, cy)
        await undoUntil(page, () => fillsOf(handle), dedupSorted(before))
    })

    test('copy-paste preserves all lines of multiline text', async ({
        page,
    }) => {
        const { handle, cx, cy } = await createMultilineText(
            page,
            'AAAAA\nBBBBB'
        )

        const idsBefore = await allComponentIds(page)
        const pastedId = await copyPasteUntilClone(
            page,
            handle,
            idsBefore,
            cx - 350,
            cy,
            cx - 320,
            cy
        )

        const pasted = page.locator(`[data-component-id="${pastedId}"]`)
        // Both lines must survive the clone, not just line 1.
        await expect
            .poll(() => pasted.locator('text').count())
            .toBeGreaterThanOrEqual(2)
        // Word-wrap breaks at spaces and consumes the separator, so
        // space-joining the per-line <text> nodes reconstructs the content.
        const lines = await pasted.locator('text').allTextContents()
        expect(lines.filter(Boolean).join(' ')).toBe('AAAAA BBBBB')
    })

    // Regression: editing multiline text (remove a line) + commit + undo must
    // restore the ORIGINAL content. Undo reverts the store, but the element's
    // props are frozen at mount (ElementRenderWrapper), so the fix re-stacks
    // the line nodes from the history hook. Pre-fix: undo left the edited text.
    test('edit content + undo restores the removed line', async ({ page }) => {
        const { handle, cx, cy } = await createMultilineText(
            page,
            'AAAAA\nBBBBB\nCCCCC'
        )
        await expect.poll(() => lineCountOf(handle)).toBe(3)
        expect(await contentOf(handle)).toBe('AAAAA BBBBB CCCCC')

        // Re-open the inline editor and drop the middle line.
        await page.mouse.click(cx - 350, cy)
        const b = await handle.boundingBox()
        await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
        const editor = page.locator('.temp-input-area')
        await editor.waitFor({ state: 'visible' })
        await editor.fill('AAAAA\nCCCCC')
        await page.keyboard.press('Enter')
        await expect(editor).toHaveCount(0)

        await expect.poll(() => lineCountOf(handle)).toBe(2)
        expect(await contentOf(handle)).toBe('AAAAA CCCCC')

        await page.mouse.click(cx - 350, cy)
        await undoUntilContent(
            page,
            () => contentOf(handle),
            'AAAAA BBBBB CCCCC'
        )
        expect(await lineCountOf(handle)).toBe(3)
    })
})

test.describe('Shape-with-text undo', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    // Same regression as standalone, for rectangle-with-text. The history hook
    // reflows the text layer via applyShapeText on undo (the component's
    // metadata-reflow effect can't fire — props are frozen at mount).
    test('rectangle: edit content + undo restores the removed line', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.6
        const cy = box.y + box.height * 0.55

        const rectHandle = await drawRectangle(page, {
            startX: cx - 110,
            startY: cy - 70,
            endX: cx + 110,
            endY: cy + 70,
        })
        await addTextToRectangle(page, rectHandle, 'AAAAA\nBBBBB\nCCCCC')
        await expect
            .poll(() => readGroupText(rectHandle))
            .toBe('AAAAA BBBBB CCCCC')

        const rb = await rectHandle.boundingBox()
        await page.mouse.dblclick(rb.x + rb.width / 2, rb.y + rb.height / 2)
        const editor = page.locator('.temp-input-area')
        await editor.waitFor({ state: 'visible' })
        await editor.fill('AAAAA\nCCCCC')
        await page.keyboard.press('Enter')
        await expect(editor).toHaveCount(0)

        await expect.poll(() => readGroupText(rectHandle)).toBe('AAAAA CCCCC')

        await page.mouse.click(cx - 360, cy)
        await undoUntilContent(
            page,
            () => readGroupText(rectHandle),
            'AAAAA BBBBB CCCCC'
        )
    })
})
