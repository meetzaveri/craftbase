import { test, expect } from './helpers/test.js'
import {
    setupLocalBase,
    drawRectangle,
    drawShape,
    drawArrow,
    drawPencilStroke,
    placeText,
    triggerUndoKeyboard,
    triggerRedoKeyboard,
    clickRedoButton,
    getDraftComponents,
} from './helpers/index.js'

const ANCHOR_COORDS = { startX: 600, startY: 200, endX: 720, endY: 280 }
const RECT_COORDS = { startX: 300, startY: 200, endX: 460, endY: 320 }
const CIRCLE_COORDS = { startX: 300, startY: 200, endX: 420, endY: 320 }
const ARROW_COORDS = { startX: 280, startY: 220, endX: 520, endY: 220 }
const PENCIL_COORDS = { startX: 280, startY: 220, endX: 520, endY: 360 }
const TEXT_COORDS = { x: 360, y: 280 }

const SHAPES = [
    { name: 'rectangle', draw: (page) => drawRectangle(page, RECT_COORDS) },
    { name: 'circle', draw: (page) => drawShape(page, 'circle', CIRCLE_COORDS) },
    { name: 'arrow', draw: (page) => drawArrow(page, ARROW_COORDS) },
    { name: 'pencil', draw: (page) => drawPencilStroke(page, PENCIL_COORDS) },
    { name: 'text', draw: (page) => placeText(page, TEXT_COORDS) },
]

const DRAFT_DEBOUNCE_MS = 700

// Placing a text and committing its editor records three history entries: ADD,
// UPDATE_VERTICES (SCENARIO_TEXT_DRAW), and the editor's blur commit
// (UPDATE_BULK of width/height/metadata — newText.tsx). Three undos remove it;
// three redos restore it.
const TEXT_HISTORY_COUNT = 3

// Placing a text element auto-opens its inline editor with focus, and canvas
// undo/redo deliberately stands down while a text field is focused so Cmd+Z
// reaches the browser's native text undo instead. Dismiss the editor first, the
// same way a user would, so the following shortcuts are canvas undo/redo.
async function dismissTextEditor(page) {
    await page.waitForSelector('.temp-input-area')
    await page.keyboard.press('Escape')
    await page.waitForSelector('.temp-input-area', { state: 'detached' })
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

test.describe('Redo (local mode, keyboard Cmd/Ctrl+Shift+Z)', () => {
    for (const { name, draw } of SHAPES) {
        test(`restores ${name} after undo via keyboard redo`, async ({
            page,
        }) => {
            await setupLocalBase(page)

            // Anchor keeps the component store non-empty so the debounced
            // localStorage save still fires after we undo the target.
            const anchor = await drawRectangle(page, ANCHOR_COORDS)
            const anchorId = await anchor.getAttribute('data-component-id')

            const handle = await draw(page)
            const id = await handle.getAttribute('data-component-id')
            expect(id).toBeTruthy()
            expect(id).not.toBe(anchorId)

            await expect(page.locator('[data-component-id]')).toHaveCount(2)
            await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
            const draftAfterDraw = await getDraftComponents(page)
            expect(draftAfterDraw?.[id]).toBeTruthy()

            if (name === 'text') await dismissTextEditor(page)

            const passes = name === 'text' ? TEXT_HISTORY_COUNT : 1

            for (let i = 0; i < passes; i++) {
                await triggerUndoKeyboard(page)
            }
            await expect(page.locator('[data-component-id]')).toHaveCount(1)
            await waitForIdRemovedFromDraft(page, id)

            for (let i = 0; i < passes; i++) {
                await triggerRedoKeyboard(page)
            }

            await expect(page.locator('[data-component-id]')).toHaveCount(2)
            await expect(
                page.locator(`[data-component-id="${id}"]`)
            ).toBeVisible()
            await waitForIdInDraft(page, id)

            const draftAfterRedo = await getDraftComponents(page)
            expect(draftAfterRedo?.[id]).toBeTruthy()
            expect(draftAfterRedo?.[anchorId]).toBeTruthy()
        })
    }
})

test('Redo button restores the last undone rectangle', async ({ page }) => {
    await setupLocalBase(page)

    const anchor = await drawRectangle(page, ANCHOR_COORDS)
    const anchorId = await anchor.getAttribute('data-component-id')

    const handle = await drawRectangle(page, RECT_COORDS)
    const id = await handle.getAttribute('data-component-id')

    await expect(page.locator('[data-component-id]')).toHaveCount(2)
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

    await triggerUndoKeyboard(page)
    await expect(page.locator('[data-component-id]')).toHaveCount(1)
    await waitForIdRemovedFromDraft(page, id)

    await clickRedoButton(page)

    await expect(page.locator('[data-component-id]')).toHaveCount(2)
    await expect(page.locator(`[data-component-id="${id}"]`)).toBeVisible()
    await waitForIdInDraft(page, id)

    const draftAfterRedo = await getDraftComponents(page)
    expect(draftAfterRedo?.[id]).toBeTruthy()
    expect(draftAfterRedo?.[anchorId]).toBeTruthy()
})
