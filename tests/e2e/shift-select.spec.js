import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    drawRectangle,
    drawLine,
    clickPointerTool,
    getDraftComponents,
    triggerUndoKeyboard,
} from './helpers/index.js'

/**
 * Shift-click multi-select.
 *
 * Shift-click toggles an element in the current selection. Two or more
 * elements become the same group overlay the drag-select box builds, so a
 * property applied from the group toolbar reaches every member that accepts
 * it, as one undo step. Assertions read the persisted draft, so they cover
 * what the user keeps, not just what's painted.
 */

// useLocalDraftPersistence flushes with a 500ms debounce.
const DRAFT_DEBOUNCE_MS = 600
const STROKE_COLOR = '#0065FF'
const GROUP_OVERLAY = '[data-label="groupobject_coord"]'

async function applyGroupStroke(page) {
    await page.click(
        `#floating-toolbar [data-section="stroke"] [title="${STROKE_COLOR}"]`
    )
}

async function strokesById(page) {
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
    const draft = await getDraftComponents(page)
    return Object.fromEntries(
        Object.values(draft).map((c) => [c.id, c.stroke])
    )
}

test.describe('Shift-click multi-select', () => {
    let box
    let rectA
    let rectB
    let line

    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
        box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.6
        const cy = box.y + box.height * 0.55

        rectA = { x: cx - 160, y: cy - 60 }
        rectB = { x: cx + 40, y: cy - 60 }
        line = { x: cx - 20, y: cy + 80 }

        await drawRectangle(page, {
            startX: rectA.x - 50,
            startY: rectA.y - 30,
            endX: rectA.x + 50,
            endY: rectA.y + 30,
        })
        await drawRectangle(page, {
            startX: rectB.x - 50,
            startY: rectB.y - 30,
            endX: rectB.x + 50,
            endY: rectB.y + 30,
        })
        await drawLine(page, {
            startX: line.x - 120,
            startY: line.y,
            endX: line.x + 120,
            endY: line.y,
        })
        await clickPointerTool(page)
    })

    test('shift-clicking three elements groups them; one stroke edit reaches all and undoes in one step', async ({
        page,
    }) => {
        const before = await strokesById(page)
        expect(Object.keys(before)).toHaveLength(3)

        await page.mouse.click(rectA.x, rectA.y)
        await page.keyboard.down('Shift')
        await page.mouse.click(rectB.x, rectB.y)
        await page.locator(GROUP_OVERLAY).waitFor()
        await page.mouse.click(line.x, line.y)
        await page.keyboard.up('Shift')
        await page.locator(GROUP_OVERLAY).waitFor()

        await applyGroupStroke(page)
        // Deselect: members re-render from the store once the group blurs.
        await page.mouse.click(box.x + box.width - 40, box.y + box.height - 40)

        const after = await strokesById(page)
        for (const id of Object.keys(before)) {
            expect(after[id]).toBe(STROKE_COLOR)
        }

        await triggerUndoKeyboard(page)
        expect(await strokesById(page)).toEqual(before)
    })

    test('shift-clicking a member removes it from the selection', async ({
        page,
    }) => {
        const before = await strokesById(page)

        await page.mouse.click(rectA.x, rectA.y)
        await page.keyboard.down('Shift')
        await page.mouse.click(rectB.x, rectB.y)
        await page.mouse.click(line.x, line.y)
        await page.locator(GROUP_OVERLAY).waitFor()
        // Toggle rectB back out.
        await page.mouse.click(rectB.x, rectB.y)
        await page.keyboard.up('Shift')
        await page.waitForTimeout(300)
        await page.locator(GROUP_OVERLAY).waitFor()

        await applyGroupStroke(page)
        await page.mouse.click(box.x + box.width - 40, box.y + box.height - 40)

        const after = await strokesById(page)
        const changed = Object.keys(after).filter(
            (id) => after[id] !== before[id]
        )
        expect(changed).toHaveLength(2)
        const draft = await getDraftComponents(page)
        const changedTypes = changed.map((id) => draft[id].componentType).sort()
        expect(changedTypes).toEqual(['line', 'rectangle'])
    })

    test('removing down to one member falls back to a single selection', async ({
        page,
    }) => {
        await page.mouse.click(rectA.x, rectA.y)
        await page.keyboard.down('Shift')
        await page.mouse.click(rectB.x, rectB.y)
        await page.locator(GROUP_OVERLAY).waitFor()
        await page.mouse.click(rectB.x, rectB.y)
        await page.keyboard.up('Shift')

        await expect(page.locator(GROUP_OVERLAY)).toHaveCount(0)
        // The single-element toolbar is back, not the group one.
        await expect(page.locator('#floating-toolbar')).toBeVisible()
        await expect(page.locator('#floating-toolbar')).not.toContainText(
            'Group'
        )
    })

    test('shift-click with nothing selected selects like a plain click', async ({
        page,
    }) => {
        await page.keyboard.down('Shift')
        await page.mouse.click(rectA.x, rectA.y)
        await page.keyboard.up('Shift')

        await expect(page.locator(GROUP_OVERLAY)).toHaveCount(0)
        await expect(page.locator('#floating-toolbar')).toBeVisible()
    })
})
