import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    drawShape,
    addTextToRectangle,
    clickPointerTool,
    dragSelectArea,
} from './helpers/index.js'

/**
 * Regression: increasing TEXT SIZE on a group selection must not move the
 * member shapes.
 *
 * The bug (see the group text-grow path in src/utils/applyGroupProperty.ts):
 * when a shape-with-text was part of a group and its text size was bumped, the
 * shape grew to fit the larger text by widening AND by expanding symmetrically
 * around its centre. Two visible defects followed:
 *
 *   1. The box widened, so shapes laid out side by side overlapped and lost
 *      their relative horizontal spacing.
 *   2. Symmetric vertical growth pushed the TOP edge upward, so the shape
 *      visually jumped up the canvas (its on-screen y changed).
 *
 * The fix reflows the embedded text to the shape's FIXED width (never widens)
 * and grows ONLY the height, shifting the shape's centre down by half the
 * height delta so the TOP edge — what the user perceives as the shape's
 * y-position — stays anchored and the box grows strictly downward.
 *
 * This spec drives the real user flow for rectangle / diamond / circle (each
 * carrying sample MULTILINE text): snapshot every shape's rendered top-left,
 * marquee-select into a group, bump the text size from the group floating
 * toolbar, click empty canvas to blur (the originals only re-render with the
 * change once the group blurs — Escape does NOT deselect). Then assert, on the
 * re-rendered originals:
 *
 *   - the LEFT edge (x) is unchanged  → never widened / never drifted x
 *   - the TOP edge (y) is unchanged   → never pushed up; grows downward only
 *   - the shape actually grew taller  → the bump took effect (assertion is
 *     meaningful, not trivially satisfied by a no-op)
 *   - the BOTTOM edge moved down      → growth was strictly downward
 */

// Rendered geometry is exact in theory (newY - newH/2 === oldY - oldH/2), but
// allow a couple of pixels for Two.js' internal rounding and sub-pixel SVG
// layout so the test isn't flaky.
const POS_TOL = 2
const SETTLE_MS = 400

// Each shape carries hard-newline multiline text so bumping the size is
// guaranteed to need more height (every wrapped line grows taller).
const SHAPE_SPECS = [
    {
        type: 'rectangle',
        label: 'rectangle-with-text',
        text: 'Workspace\nIntegrations',
    },
    {
        type: 'diamond',
        label: 'diamond-with-text',
        text: 'Quick\nbrown fox',
    },
    {
        type: 'circle',
        label: 'circle-with-text',
        text: 'Lorem\nipsum',
    },
]

/**
 * Reads the rendered bounding box (viewport pixels) of a shape's <path>. The
 * shape leaf is the first <path> inside the element group (the embedded text
 * is <text>, the optional hit-rect comes later), so `querySelector('path')`
 * targets the container, not the label. No pan/zoom happens between snapshots,
 * so client-rect coordinates are directly comparable.
 */
async function readShapeRect(page, id) {
    return page.$eval(`[data-component-id="${id}"] path`, (p) => {
        const r = p.getBoundingClientRect()
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

/**
 * Creates rectangle/diamond/circle in a single horizontal row (mirroring the
 * side-by-side layout where the spacing bug showed), each with multiline text.
 * Returns the marquee layout + the element ids in creation order. Coordinates
 * stay clear of the top toolbar and the left Defaults panel.
 */
async function createMultilineCluster(page) {
    const box = await getCanvasBox(page)
    const bx = box.x + box.width * 0.3
    const by = box.y + box.height * 0.35
    // Wide-enough boxes so the larger text wraps to a few lines (not one glyph
    // per line); modest height growth keeps the cluster inside the viewport.
    const COL = 235
    const W = 200
    const H = 80

    const shapeBox = (cx, cy) => ({
        startX: cx,
        startY: cy,
        endX: cx + W,
        endY: cy + H,
    })

    const elements = []
    for (let i = 0; i < SHAPE_SPECS.length; i++) {
        const spec = SHAPE_SPECS[i]
        const handle = await drawShape(page, spec.type, shapeBox(bx + i * COL, by))
        await addTextToRectangle(page, handle, spec.text)
        elements.push({
            id: await handle.getAttribute('data-component-id'),
            label: spec.label,
        })
    }

    for (const e of elements) {
        expect(
            e.id,
            'every created shape must expose a data-component-id'
        ).toBeTruthy()
    }
    return { box, bx, by, COL, W, H, elements }
}

async function selectGroup(page, layout) {
    const { bx, by, COL, W, H } = layout
    await clickPointerTool(page)
    const groupHandle = await dragSelectArea(page, {
        startX: bx - 60,
        startY: by - 90,
        endX: bx + 2 * COL + W + 90,
        endY: by + H + 240,
    })
    expect(groupHandle).not.toBeNull()
    await page.waitForSelector('#floating-toolbar')
}

/**
 * Deselects by clicking empty canvas (Escape does not blur the group). The
 * shapes grow DOWNWARD, so the area below them is no longer reliably empty —
 * click ABOVE the (top-anchored) shapes instead, between the toolbar and the
 * shape tops. Waits until the groupobject overlay is gone so the originals
 * have re-rendered with the applied change.
 */
async function deselectGroup(page, layout) {
    const { box } = layout
    await page.mouse.click(box.x + box.width * 0.5, box.y + 75)
    await page.waitForFunction(
        () =>
            document.querySelectorAll('[data-label="groupobject_coord"]')
                .length === 0
    )
}

async function snapshotRects(page, elements) {
    const map = {}
    for (const e of elements) map[e.id] = await readShapeRect(page, e.id)
    return map
}

test.describe('Group text-size change keeps shapes anchored (grows downward only)', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('rectangle / diamond / circle with multiline text keep their top-left x,y after a group text-size bump', async ({
        page,
    }) => {
        const layout = await createMultilineCluster(page)
        const before = await snapshotRects(page, layout.elements)

        await selectGroup(page, layout)
        // Text Size row exposes S/M/L/XL by label. Default is M (36); bump to L
        // (48) — a clear jump that forces every shape to grow taller without
        // wrapping the wide boxes down to one glyph per line.
        await page
            .locator('#floating-toolbar')
            .getByRole('button', { name: 'L', exact: true })
            .click()
        await page.waitForTimeout(SETTLE_MS)
        await deselectGroup(page, layout)

        const after = await snapshotRects(page, layout.elements)

        for (const el of layout.elements) {
            const b = before[el.id]
            const a = after[el.id]

            // Bug #1: the box never widens and never drifts horizontally — the
            // LEFT edge is exactly where it was (relative spacing preserved).
            expect(
                Math.abs(a.left - b.left),
                `${el.label}: left edge (x) must not move`
            ).toBeLessThanOrEqual(POS_TOL)

            // Bug #2: the TOP edge — the shape's perceived y — stays anchored;
            // it must NOT jump up the canvas.
            expect(
                Math.abs(a.top - b.top),
                `${el.label}: top edge (y) must not move`
            ).toBeLessThanOrEqual(POS_TOL)

            // The bump actually took effect: the shape grew taller, so the
            // anchored-top assertion above is meaningful (not a no-op).
            expect(
                a.height,
                `${el.label}: should have grown taller after the text-size bump`
            ).toBeGreaterThan(b.height + POS_TOL)

            // Growth is strictly downward: only the bottom edge advances.
            expect(
                a.bottom,
                `${el.label}: should grow downward (bottom edge moves down)`
            ).toBeGreaterThan(b.bottom + POS_TOL)
        }
    })
})
