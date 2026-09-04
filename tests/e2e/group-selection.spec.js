import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    drawRectangle,
    drawShape,
    drawArrow,
    drawPencilStroke,
    placeText,
    clickPointerTool,
    dragSelectArea,
    getDraftComponents,
} from './helpers/index.js'

// useLocalDraftPersistence flushes componentStore → localStorage with a 500ms
// debounce; round up to 600ms so we always read the post-debounce snapshot.
const DRAFT_DEBOUNCE_MS = 600

const COMPARED_FIELDS = [
    'id',
    'componentType',
    'fill',
    'stroke',
    'linewidth',
    'x',
    'y',
    'width',
    'height',
]

// newText auto-sizes its width/height from the rendered glyph bounds whenever
// the textarea overlay loses focus (newText.js:375-404). That can fire during
// the toolbar click that switches to select/pan mode, so width/height for
// newText is intrinsically racy and unrelated to grouping. Compare every other
// field for newText, and the full set for all other shapes.
const TEXT_EXCLUDED_FIELDS = new Set(['width', 'height'])

function pickComparedFields(component) {
    const out = {}
    const isText = component.componentType === 'newText'
    for (const k of COMPARED_FIELDS) {
        if (isText && TEXT_EXCLUDED_FIELDS.has(k)) continue
        out[k] = component[k]
    }
    return out
}

test.describe('Group selection — marquee drag rolls up 5 elements', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('drag-selecting all 5 element types creates a group with 5 children, originals preserved', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        // Cluster center in the lower-right safe quadrant (away from top
        // toolbar and left Defaults panel).
        const cx = box.x + box.width * 0.65
        const cy = box.y + box.height * 0.6

        // 5 shapes packed into a ~250x180 cluster.
        await drawRectangle(page, {
            startX: cx - 140,
            startY: cy - 90,
            endX: cx - 40,
            endY: cy - 30,
        })
        await drawShape(page, 'circle', {
            startX: cx - 20,
            startY: cy - 90,
            endX: cx + 80,
            endY: cy - 30,
        })
        await drawArrow(page, {
            startX: cx - 140,
            startY: cy,
            endX: cx - 40,
            endY: cy,
        })
        await drawPencilStroke(page, {
            startX: cx - 20,
            startY: cy,
            endX: cx + 80,
            endY: cy,
        })
        await placeText(page, { x: cx, y: cy + 60 })

        // Capture the pre-grouping snapshot from the localStorage draft. The
        // draft already excludes any groupobject, so post-grouping comparisons
        // are apples-to-apples on the 5 individual records.
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const before = await getDraftComponents(page)
        expect(before).not.toBeNull()
        const beforeEntries = Object.values(before)
        expect(beforeEntries).toHaveLength(5)

        const beforeTypes = beforeEntries.map((c) => c.componentType).sort()
        expect(beforeTypes).toEqual(
            ['arrowLine', 'circle', 'newText', 'pencil', 'rectangle'].sort()
        )

        const beforeById = Object.fromEntries(
            beforeEntries.map((c) => [c.id, pickComparedFields(c)])
        )

        // Switch to select/pan mode and marquee-drag around the cluster.
        await clickPointerTool(page)

        const groupHandle = await dragSelectArea(page, {
            startX: cx - 220,
            startY: cy - 160,
            endX: cx + 170,
            endY: cy + 130,
        })
        expect(groupHandle).not.toBeNull()

        // --- Group existence + structure ---

        const groupCount = await page.locator(
            '[data-label="groupobject_coord"]'
        ).count()
        expect(groupCount).toBe(1)

        // Each cloned child is its own Two.js group, so the parent group SVG
        // contains at least 5 nested <g> descendants (arrow endpoints add more).
        const nestedGroupCount = await groupHandle.evaluate(
            (el) => el.querySelectorAll('g').length
        )
        expect(nestedGroupCount).toBeGreaterThanOrEqual(5)

        // Two.js's SVG renderer emits <path> for rectangles/circles/arrow/pencil
        // and a real <text> node for text. Verify both kinds are present:
        // text is the only one with a real cloned <text> child, and the path
        // count must cover wrapper + 4 non-text children plus arrow endpoints.
        const primitives = await groupHandle.evaluate((el) => ({
            text: el.querySelectorAll('text').length,
            path: el.querySelectorAll('path').length,
        }))
        expect(primitives.text).toBeGreaterThanOrEqual(1)
        expect(primitives.path).toBeGreaterThanOrEqual(5)

        // --- Originals preserved in DOM (hidden via opacity=0) ---

        const originalIds = await page.$$eval(
            '[data-component-id]',
            (els) => els.map((el) => el.getAttribute('data-component-id'))
        )
        expect(originalIds).toHaveLength(5)
        expect(new Set(originalIds)).toEqual(new Set(Object.keys(beforeById)))

        const originalOpacities = await page.$$eval(
            '[data-component-id]',
            (els) => els.map((el) => el.getAttribute('opacity'))
        )
        for (const op of originalOpacities) expect(op).toBe('0')

        // --- componentStore records for the 5 originals are unchanged ---

        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const after = await getDraftComponents(page)
        expect(after).not.toBeNull()
        const afterEntries = Object.values(after)
        expect(afterEntries).toHaveLength(5)

        for (const entry of afterEntries) {
            expect(pickComparedFields(entry)).toEqual(beforeById[entry.id])
        }
    })
})
