import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    drawShape,
    placeText,
    addTextToRectangle,
    clickPointerTool,
    dragSelectArea,
} from './helpers/index.js'

/**
 * Group "apply property" regression suite.
 *
 * Bugs being captured (all manifest in the LIVE Two.js scene, not the
 * componentStore — the store/draft is already correct, so these assertions
 * deliberately read the rendered SVG of each element, never the draft):
 *
 *   1. fill / stroke / strokeWidth on a group propagate through the Two.js
 *      Group setter onto the nested text node of rectangle-with-text /
 *      diamond-with-text (text vanishes / gets an outline).
 *   2. strokeType on a group writes `group.dashes`, which Two.js Group has no
 *      setter for, so the dash pattern never reaches the child Path — the
 *      scene doesn't update even though the store does.
 *   3. textColor / textSize / textFontFamily skip diamond-with-text entirely
 *      (diamond was missing from ACCEPTS and the rectangle special-cases).
 *
 * Workflow mirrors a real user: create the cluster, snapshot the rendered
 * SVG, marquee-select into a group, apply exactly one property from the group
 * floating toolbar, then click empty canvas to deselect (the originals only
 * re-render with the applied change once the group blurs — Escape does NOT
 * deselect, an empty-canvas click does). Then assert:
 *   - the targeted attribute changed on the elements that accept it, and
 *   - every other captured attribute is byte-for-byte unchanged on every
 *     element.
 */

// Colours picked from the always-rendered swatch row in the collapsed
// ColorPicker so we can click them by their `title` attribute without
// expanding the picker. None equal the seeded defaults (shape fill #FFFFFF,
// text fill #3A342C). NOTE: the Fill picker uses fillEssentialShades (which
// dropped green #36B37E for a transparent swatch), while stroke/text use the
// shared essentialShades — so FILL_COLOR must come from fillEssentialShades.
const FILL_COLOR = '#FFF0B3'
const STROKE_COLOR = '#0065FF'
const TEXT_COLOR = '#FF5630'

const ATTR_KEYS = [
    'pathFill',
    'pathStroke',
    'pathStrokeWidth',
    'pathDash',
    'textFill',
    'textStroke',
    'textStrokeWidth',
    'textSize',
    'textFamily',
]

/**
 * Reads the rendered SVG attributes of an element's scene group
 * (<g data-component-id>). Two.js emits the shape as <path> and the label as
 * a real <text> node; we read the presentation attributes the renderer sets
 * (node_modules/two.js/src/renderers/svg.js).
 */
async function readAttrs(page, id) {
    return page.$eval(`[data-component-id="${id}"]`, (el) => {
        const p = el.querySelector('path')
        const t = el.querySelector('text')
        const g = (n, a) => (n ? n.getAttribute(a) : null)
        return {
            hasText: !!t,
            pathFill: g(p, 'fill'),
            pathStroke: g(p, 'stroke'),
            pathStrokeWidth: g(p, 'stroke-width'),
            pathDash: g(p, 'stroke-dasharray'),
            textFill: g(t, 'fill'),
            textStroke: g(t, 'stroke'),
            textStrokeWidth: g(t, 'stroke-width'),
            textSize: g(t, 'font-size'),
            textFamily: g(t, 'font-family'),
        }
    })
}

const norm = (v) => (v == null ? v : String(v).toLowerCase())

/**
 * Creates the element cluster in a fixed order and returns
 * { box, elements: [{ id, label, hasText }] } in creation order. Coordinates
 * stay in the upper-middle safe quadrant (clear of the top toolbar and the
 * left Defaults/floating panels). Does NOT group — the caller snapshots first.
 */
async function createCluster(page, { includeNewText }) {
    const box = await getCanvasBox(page)
    const bx = box.x + box.width * 0.4
    const by = box.y + box.height * 0.28
    const COL = 165
    const ROW = 150
    const W = 92
    const H = 56

    const shapeBox = (cx, cy) => ({
        startX: cx,
        startY: cy,
        endX: cx + W,
        endY: cy + H,
    })

    const elements = []
    const add = async (handle, label, hasText) =>
        elements.push({
            id: await handle.getAttribute('data-component-id'),
            label,
            hasText,
        })

    await add(
        await drawShape(page, 'rectangle', shapeBox(bx, by)),
        'rectangle',
        false
    )

    let h = await drawShape(page, 'rectangle', shapeBox(bx + COL, by))
    await addTextToRectangle(page, h, 'Rt')
    await add(h, 'rectangle-with-text', true)

    await add(
        await drawShape(page, 'diamond', shapeBox(bx + 2 * COL, by)),
        'diamond',
        false
    )

    h = await drawShape(page, 'diamond', shapeBox(bx, by + ROW))
    await addTextToRectangle(page, h, 'Dt')
    await add(h, 'diamond-with-text', true)

    await add(
        await drawShape(page, 'circle', shapeBox(bx + COL, by + ROW)),
        'circle',
        false
    )

    h = await drawShape(page, 'circle', shapeBox(bx + 2 * COL, by + ROW))
    await addTextToRectangle(page, h, 'Ct')
    await add(h, 'circle-with-text', true)

    if (includeNewText) {
        h = await placeText(page, {
            x: bx + W / 2,
            y: by + 2 * ROW + H / 2,
        })
        await add(h, 'newText', true)
    }

    for (const e of elements) {
        expect(
            e.id,
            'every created element must expose a data-component-id'
        ).toBeTruthy()
    }
    return { box, bx, by, COL, ROW, W, H, elements }
}

async function selectGroup(page, layout) {
    const { bx, by, COL, ROW, W, H } = layout
    await clickPointerTool(page)
    const groupHandle = await dragSelectArea(page, {
        startX: bx - 55,
        startY: by - 55,
        endX: bx + 2 * COL + W + 60,
        endY: by + 2 * ROW + H + 60,
    })
    expect(groupHandle).not.toBeNull()
    await page.waitForSelector('#floating-toolbar')
}

/**
 * Deselects the focused group by clicking empty canvas (Escape does not blur
 * the group; an empty-canvas click does). Waits until the groupobject is gone
 * so the originals have re-rendered with the applied change.
 */
async function deselectGroup(page, layout) {
    const { box } = layout
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height - 40)
    await page.waitForFunction(
        () =>
            document.querySelectorAll('[data-label="groupobject_coord"]')
                .length === 0,
        null
    )
}

async function snapshot(page, elements) {
    const map = {}
    for (const e of elements) map[e.id] = await readAttrs(page, e.id)
    return map
}

/**
 * Core assertion: `changedKeys` must differ for the elements selected by
 * `shouldChange`; EVERY other attribute on EVERY element must be identical to
 * the pre-apply snapshot.
 */
function assertOnlyChanged({
    elements,
    before,
    after,
    changedKeys,
    shouldChange,
    expected,
}) {
    for (const el of elements) {
        const b = before[el.id]
        const a = after[el.id]
        const mustChange = shouldChange(el)

        for (const key of ATTR_KEYS) {
            const isTarget = changedKeys.includes(key)
            if (isTarget && mustChange) {
                expect(
                    norm(a[key]),
                    `${el.label}: ${key} should have changed`
                ).not.toBe(norm(b[key]))
                expect(
                    a[key],
                    `${el.label}: ${key} should be non-empty after change`
                ).toBeTruthy()
                if (expected) {
                    expect(
                        norm(a[key]),
                        `${el.label}: ${key} should equal the applied value`
                    ).toBe(norm(expected))
                }
            } else {
                expect(
                    norm(a[key]),
                    `${el.label}: ${key} must be untouched`
                ).toBe(norm(b[key]))
            }
        }
    }
}

const SETTLE_MS = 400

test.describe('Group apply property — only the targeted property changes', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('fill: only path fill changes; text fill/stroke untouched', async ({
        page,
    }) => {
        const layout = await createCluster(page, { includeNewText: false })
        const before = await snapshot(page, layout.elements)

        await selectGroup(page, layout)
        await page.click(
            `#floating-toolbar [data-section="fill"] [title="${FILL_COLOR}"]`
        )
        await page.waitForTimeout(SETTLE_MS)
        await deselectGroup(page, layout)

        const after = await snapshot(page, layout.elements)
        assertOnlyChanged({
            elements: layout.elements,
            before,
            after,
            changedKeys: ['pathFill'],
            shouldChange: () => true, // rect/diamond/circle all accept fill
            expected: FILL_COLOR,
        })
    })

    test('stroke colour: only path stroke changes; text untouched', async ({
        page,
    }) => {
        const layout = await createCluster(page, { includeNewText: false })
        const before = await snapshot(page, layout.elements)

        await selectGroup(page, layout)
        await page.click(
            `#floating-toolbar [data-section="stroke"] [title="${STROKE_COLOR}"]`
        )
        await page.waitForTimeout(SETTLE_MS)
        await deselectGroup(page, layout)

        const after = await snapshot(page, layout.elements)
        assertOnlyChanged({
            elements: layout.elements,
            before,
            after,
            changedKeys: ['pathStroke'],
            shouldChange: () => true,
            expected: STROKE_COLOR,
        })
    })

    test('stroke width: only path stroke-width changes; text untouched', async ({
        page,
    }) => {
        const layout = await createCluster(page, { includeNewText: false })
        const before = await snapshot(page, layout.elements)

        await selectGroup(page, layout)
        // 4th Stroke Width swatch = value 6 (STROKE_WIDTHS in elementProperties).
        await page.click(
            '#floating-toolbar #stroke-width-section button:nth-of-type(4)'
        )
        await page.waitForTimeout(SETTLE_MS)
        await deselectGroup(page, layout)

        const after = await snapshot(page, layout.elements)
        assertOnlyChanged({
            elements: layout.elements,
            before,
            after,
            changedKeys: ['pathStrokeWidth'],
            shouldChange: () => true,
        })
    })

    test('stroke type: dash pattern reaches the live scene; nothing else changes', async ({
        page,
    }) => {
        const layout = await createCluster(page, { includeNewText: false })
        const before = await snapshot(page, layout.elements)

        await selectGroup(page, layout)
        // 2nd Stroke Type swatch = 'dashed'.
        await page.click(
            '#floating-toolbar #stroke-type-section button:nth-of-type(2)'
        )
        await page.waitForTimeout(SETTLE_MS)
        await deselectGroup(page, layout)

        const after = await snapshot(page, layout.elements)
        // Fresh solid shapes have no stroke-dasharray attribute (null);
        // applying 'dashed' must give every shape a non-empty dasharray.
        assertOnlyChanged({
            elements: layout.elements,
            before,
            after,
            changedKeys: ['pathDash'],
            shouldChange: () => true,
        })
    })

    test('text colour: only text fill changes (rect/diamond-with-text + newText)', async ({
        page,
    }) => {
        const layout = await createCluster(page, { includeNewText: true })
        const before = await snapshot(page, layout.elements)

        await selectGroup(page, layout)
        await page.click(
            `#floating-toolbar [data-section="textColor"] [title="${TEXT_COLOR}"]`
        )
        await page.waitForTimeout(SETTLE_MS)
        await deselectGroup(page, layout)

        const after = await snapshot(page, layout.elements)
        assertOnlyChanged({
            elements: layout.elements,
            before,
            after,
            changedKeys: ['textFill'],
            shouldChange: (el) => el.hasText,
            expected: TEXT_COLOR,
        })
    })

    test('text size: only text font-size changes (rect/diamond-with-text + newText)', async ({
        page,
    }) => {
        const layout = await createCluster(page, { includeNewText: true })
        const before = await snapshot(page, layout.elements)

        await selectGroup(page, layout)
        // Text Size row exposes S/M/L/XL by label; XL = 72 on desktop.
        await page
            .locator('#floating-toolbar')
            .getByRole('button', { name: 'XL', exact: true })
            .click()
        await page.waitForTimeout(SETTLE_MS)
        await deselectGroup(page, layout)

        const after = await snapshot(page, layout.elements)
        assertOnlyChanged({
            elements: layout.elements,
            before,
            after,
            changedKeys: ['textSize'],
            shouldChange: (el) => el.hasText,
        })
    })

    test('font family: only text font-family changes (rect/diamond-with-text + newText)', async ({
        page,
    }) => {
        const layout = await createCluster(page, { includeNewText: true })
        const before = await snapshot(page, layout.elements)

        await selectGroup(page, layout)
        // Font row renders one "Aa" button per family, styled with the family;
        // pick Geist (default is Caveat) via its inline font-family style.
        await page.click('#floating-toolbar button[style*="Geist"]')
        await page.waitForTimeout(SETTLE_MS)
        await deselectGroup(page, layout)

        const after = await snapshot(page, layout.elements)
        assertOnlyChanged({
            elements: layout.elements,
            before,
            after,
            changedKeys: ['textFamily'],
            shouldChange: (el) => el.hasText,
        })
    })
})
