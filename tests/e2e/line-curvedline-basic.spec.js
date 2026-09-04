import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    drawRectangle,
    drawLine,
    drawCurvedLine,
    clickPointerTool,
    triggerUndoKeyboard,
    triggerRedoKeyboard,
    getDraftComponents,
} from './helpers/index.js'

// Keep the anchor + drawn shapes clear of the top toolbar (~y<60) and the left
// Defaults/properties panel (~x<200).
const ANCHOR_COORDS = { startX: 620, startY: 180, endX: 740, endY: 260 }
const LINE_COORDS = { startX: 300, startY: 250, endX: 540, endY: 250 }
// 4 clicked vertices → a curvedLine with >2 vertices (an S curve).
const CURVED_POINTS = [
    { x: 300, y: 430 },
    { x: 360, y: 350 },
    { x: 440, y: 450 },
    { x: 520, y: 360 },
]

const DRAFT_DEBOUNCE_MS = 700

const SHAPES = [
    {
        name: 'line',
        type: 'line',
        draw: (page) => drawLine(page, LINE_COORDS),
    },
    {
        name: 'curvedLine',
        type: 'curvedLine',
        draw: (page) => drawCurvedLine(page, CURVED_POINTS),
    },
]

async function waitForIdRemovedFromDraft(page, id) {
    await page.waitForFunction(
        (cid) => {
            const raw = localStorage.getItem('craftbase_local_draft')
            if (!raw) return true
            const draft = JSON.parse(raw)
            return !draft.components || !draft.components[cid]
        },
        id,
        { timeout: 3_000 }
    )
}

async function waitForIdInDraft(page, id) {
    await page.waitForFunction(
        (cid) => {
            const raw = localStorage.getItem('craftbase_local_draft')
            if (!raw) return false
            const draft = JSON.parse(raw)
            return !!(draft.components && draft.components[cid])
        },
        id,
        { timeout: 3_000 }
    )
}

test.describe('Line & CurvedLine — draw', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('draws a plain line and stores it as a line component', async ({
        page,
    }) => {
        const handle = await drawLine(page, LINE_COORDS)
        const id = await handle.getAttribute('data-component-id')
        expect(id).toBeTruthy()
        await expect(page.locator('[data-component-id]')).toHaveCount(1)

        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const draft = await getDraftComponents(page)
        expect(draft?.[id]?.componentType).toBe('line')
    })

    test('draws a curved line with more than 2 vertices', async ({ page }) => {
        const handle = await drawCurvedLine(page, CURVED_POINTS)
        const id = await handle.getAttribute('data-component-id')
        expect(id).toBeTruthy()
        await expect(page.locator('[data-component-id]')).toHaveCount(1)

        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const draft = await getDraftComponents(page)
        const record = draft?.[id]
        expect(record?.componentType).toBe('curvedLine')
        // The curvedLine geometry lives as an absolute vertex array in metadata.
        expect(Array.isArray(record?.metadata)).toBe(true)
        expect(record.metadata.length).toBeGreaterThan(2)
    })
})

test.describe('Line & CurvedLine — undo removes the drawn element', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    for (const { name, draw } of SHAPES) {
        test(`undo removes the drawn ${name}`, async ({ page }) => {
            // Anchor keeps the store non-empty after undo so the debounced
            // draft save still fires (skips empty-store saves).
            const anchor = await drawRectangle(page, ANCHOR_COORDS)
            const anchorId = await anchor.getAttribute('data-component-id')

            const handle = await draw(page)
            const id = await handle.getAttribute('data-component-id')
            expect(id).not.toBe(anchorId)
            await expect(page.locator('[data-component-id]')).toHaveCount(2)

            await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
            const before = await getDraftComponents(page)
            expect(before?.[id]).toBeTruthy()

            await triggerUndoKeyboard(page)

            await expect(page.locator('[data-component-id]')).toHaveCount(1)
            await waitForIdRemovedFromDraft(page, id)
            const after = await getDraftComponents(page)
            expect(after?.[anchorId]).toBeTruthy()
        })
    }
})

test.describe('Line & CurvedLine — redo restores an undone element', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    for (const { name, draw } of SHAPES) {
        test(`redo restores the ${name} (verified in pointer mode)`, async ({
            page,
        }) => {
            const anchor = await drawRectangle(page, ANCHOR_COORDS)
            const anchorId = await anchor.getAttribute('data-component-id')

            const handle = await draw(page)
            const id = await handle.getAttribute('data-component-id')
            await expect(page.locator('[data-component-id]')).toHaveCount(2)
            await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

            // "delete it" — undo removes the drawn element.
            await triggerUndoKeyboard(page)
            await expect(page.locator('[data-component-id]')).toHaveCount(1)
            await waitForIdRemovedFromDraft(page, id)

            // Redo brings it back.
            await triggerRedoKeyboard(page)

            // Land in pointer/select mode and blur, then assert it's back.
            await clickPointerTool(page)
            await expect(page.locator('[data-component-id]')).toHaveCount(2)
            await expect(
                page.locator(`[data-component-id="${id}"]`)
            ).toBeVisible()
            await waitForIdInDraft(page, id)
            const after = await getDraftComponents(page)
            expect(after?.[id]).toBeTruthy()
            expect(after?.[anchorId]).toBeTruthy()
        })
    }
})
