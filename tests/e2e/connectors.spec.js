import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    drawShape,
    clickPointerTool,
    dragSelectArea,
    getDraftComponents,
    triggerUndoKeyboard,
    triggerRedoKeyboard,
} from './helpers/index.js'

// useLocalDraftPersistence flushes componentStore → localStorage with a 500ms
// debounce; round up so we always read the post-debounce snapshot.
const DRAFT_DEBOUNCE_MS = 700

// All shapes in this suite are drawn as 120x120 boxes. A port floats outside
// the shape's edge midpoint by SELECTION_PADDING (5) + PORT_GAP (10) — see
// src/canvas/selectionController.ts — so at zoom 1 a port sits 75px from the
// shape center.
const SIZE = 120
const PORT_OFFSET = SIZE / 2 + 15

// Default layout: source shape on the left, dock target on the right. Their
// facing ports (source east / target west) are 150px apart — far beyond the
// 26px radar snap radius, so nothing docks unless the test drags there.
const LEFT = { cx: 400, cy: 300 }
const RIGHT = { cx: 700, cy: 300 }

function shapeCoords({ cx, cy }) {
    return {
        startX: cx - SIZE / 2,
        startY: cy - SIZE / 2,
        endX: cx + SIZE / 2,
        endY: cy + SIZE / 2,
    }
}

async function dragMouse(page, from, to, steps = 15) {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps })
    await page.mouse.up()
}

// Ports only render for a SELECTED shape — click it in pointer mode first.
async function selectShapeAt(page, x, y) {
    await clickPointerTool(page)
    await page.mouse.click(x, y)
    await page.waitForTimeout(300)
}

// Select the shape centered at `source`, then pull a connector out of its
// east port and drop the head at `to`.
async function pullConnectorFromEastPort(page, source, to) {
    await selectShapeAt(page, source.cx, source.cy)
    await dragMouse(
        page,
        { x: source.cx + PORT_OFFSET, y: source.cy },
        to
    )
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
}

function arrowsIn(draft) {
    return Object.values(draft ?? {}).filter(
        (c) => c.componentType === 'arrowLine'
    )
}

function byType(draft, componentType) {
    return Object.values(draft ?? {}).find(
        (c) => c.componentType === componentType
    )
}

test.describe('Connectors (flag on)', () => {
    test.beforeEach(async ({ page }) => {
        // The flag is read lazily from localStorage and cached, so setting it
        // before the first load is all the Settings toggle would do.
        await page.addInitScript(() => {
            localStorage.setItem('craftbase_connectors_enabled', 'true')
        })
        await setupLocalBoard(page)
    })

    for (const source of ['circle', 'diamond']) {
        test(`pull-out from a ${source} port creates a tail-bound arrow with a free head`, async ({
            page,
        }) => {
            await drawShape(page, source, shapeCoords(LEFT))
            await pullConnectorFromEastPort(page, LEFT, { x: 560, y: 180 })

            const draft = await getDraftComponents(page)
            const shape = byType(draft, source)
            const arrow = byType(draft, 'arrowLine')
            expect(arrow).toBeTruthy()
            expect(arrow.tailShapeId).toBe(shape.id)
            expect(arrow.tailEdge).toBe('e-resize')
            expect(arrow.tailPortIndex).toBe(0)
            expect(arrow.headShapeId).toBeNull()
            expect(arrow.headEdge).toBeNull()
        })
    }

    for (const [source, target] of [
        ['circle', 'diamond'],
        ['diamond', 'rectangle'],
        ['rectangle', 'circle'],
    ]) {
        test(`connector docks ${source} → ${target}`, async ({ page }) => {
            await drawShape(page, source, shapeCoords(LEFT))
            await drawShape(page, target, shapeCoords(RIGHT))
            // Drop the head on the target's west port — the radar magnet
            // snaps it within 26px.
            await pullConnectorFromEastPort(page, LEFT, {
                x: RIGHT.cx - PORT_OFFSET,
                y: RIGHT.cy,
            })

            const draft = await getDraftComponents(page)
            const arrow = byType(draft, 'arrowLine')
            expect(arrow).toBeTruthy()
            expect(arrow.tailShapeId).toBe(byType(draft, source).id)
            expect(arrow.tailEdge).toBe('e-resize')
            expect(arrow.headShapeId).toBe(byType(draft, target).id)
            expect(arrow.headEdge).toBe('w-resize')
        })
    }

    test('undo removes the connector, redo restores it with bindings intact', async ({
        page,
    }) => {
        await drawShape(page, 'circle', shapeCoords(LEFT))
        await drawShape(page, 'diamond', shapeCoords(RIGHT))
        await pullConnectorFromEastPort(page, LEFT, {
            x: RIGHT.cx - PORT_OFFSET,
            y: RIGHT.cy,
        })

        let draft = await getDraftComponents(page)
        const circleId = byType(draft, 'circle').id
        const diamondId = byType(draft, 'diamond').id
        expect(arrowsIn(draft)).toHaveLength(1)

        // Creation is two history entries: the ADD (tail already bound) and
        // the head-binding commit. Two undos fully remove the connector.
        await triggerUndoKeyboard(page)
        await triggerUndoKeyboard(page)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        draft = await getDraftComponents(page)
        expect(arrowsIn(draft)).toHaveLength(0)

        await triggerRedoKeyboard(page)
        await triggerRedoKeyboard(page)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        draft = await getDraftComponents(page)
        const arrow = arrowsIn(draft)[0]
        expect(arrow).toBeTruthy()
        expect(arrow.tailShapeId).toBe(circleId)
        expect(arrow.tailEdge).toBe('e-resize')
        expect(arrow.headShapeId).toBe(diamondId)
        expect(arrow.headEdge).toBe('w-resize')
    })

    test('dragging a docked endpoint off the port detaches it; undo re-docks, redo detaches', async ({
        page,
    }) => {
        await drawShape(page, 'circle', shapeCoords(LEFT))
        await drawShape(page, 'diamond', shapeCoords(RIGHT))
        await pullConnectorFromEastPort(page, LEFT, {
            x: RIGHT.cx - PORT_OFFSET,
            y: RIGHT.cy,
        })

        let draft = await getDraftComponents(page)
        const diamondId = byType(draft, 'diamond').id
        const circleId = byType(draft, 'circle').id

        // The freshly drawn arrow is auto-selected with its endpoint handles
        // visible; grab the head (glued on the diamond's west port) and drop
        // it in free space, past every port's radar radius.
        await dragMouse(
            page,
            { x: RIGHT.cx - PORT_OFFSET, y: RIGHT.cy },
            { x: RIGHT.cx - PORT_OFFSET, y: 140 }
        )
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        draft = await getDraftComponents(page)
        let arrow = arrowsIn(draft)[0]
        expect(arrow.headShapeId).toBeNull()
        expect(arrow.headEdge).toBeNull()
        expect(arrow.tailShapeId).toBe(circleId)

        // Detach folds vertices + binding into ONE history entry.
        await triggerUndoKeyboard(page)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        draft = await getDraftComponents(page)
        arrow = arrowsIn(draft)[0]
        expect(arrow.headShapeId).toBe(diamondId)
        expect(arrow.headEdge).toBe('w-resize')

        await triggerRedoKeyboard(page)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        draft = await getDraftComponents(page)
        arrow = arrowsIn(draft)[0]
        expect(arrow.headShapeId).toBeNull()
    })

    test('moving a bound shape drags the docked endpoint with it', async ({
        page,
    }) => {
        await drawShape(page, 'circle', shapeCoords(LEFT))
        await drawShape(page, 'diamond', shapeCoords(RIGHT))
        await pullConnectorFromEastPort(page, LEFT, {
            x: RIGHT.cx - PORT_OFFSET,
            y: RIGHT.cy,
        })

        // Move the diamond by (+60, +90).
        await selectShapeAt(page, RIGHT.cx, RIGHT.cy)
        await dragMouse(
            page,
            { x: RIGHT.cx, y: RIGHT.cy },
            { x: RIGHT.cx + 60, y: RIGHT.cy + 90 }
        )
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        const draft = await getDraftComponents(page)
        const diamond = byType(draft, 'diamond')
        const arrow = arrowsIn(draft)[0]
        expect(arrow.headShapeId).toBe(diamond.id)
        // The head's world position (arrow origin + head vertex) must sit on
        // the diamond's CURRENT west port. Store coords are parseInt'd along
        // the way, so allow a couple px of truncation slack.
        const headWorldX = arrow.x + arrow.x2
        const headWorldY = arrow.y + arrow.y2
        expect(
            Math.abs(headWorldX - (diamond.x - PORT_OFFSET))
        ).toBeLessThanOrEqual(2)
        expect(Math.abs(headWorldY - diamond.y)).toBeLessThanOrEqual(2)
    })

    test('two connectors from the same port take distinct fan slots', async ({
        page,
    }) => {
        await drawShape(page, 'circle', shapeCoords(LEFT))
        await pullConnectorFromEastPort(page, LEFT, { x: 560, y: 220 })
        await pullConnectorFromEastPort(page, LEFT, { x: 560, y: 380 })

        const draft = await getDraftComponents(page)
        const arrows = arrowsIn(draft)
        expect(arrows).toHaveLength(2)
        const circleId = byType(draft, 'circle').id
        arrows.forEach((a) => {
            expect(a.tailShapeId).toBe(circleId)
            expect(a.tailEdge).toBe('e-resize')
        })
        expect(
            arrows.map((a) => a.tailPortIndex).sort()
        ).toEqual([0, 1])
    })

    test('deleting a bound shape detaches its arrows; one undo restores shape AND bindings', async ({
        page,
    }) => {
        await drawShape(page, 'circle', shapeCoords(LEFT))
        await drawShape(page, 'diamond', shapeCoords(RIGHT))
        await pullConnectorFromEastPort(page, LEFT, {
            x: RIGHT.cx - PORT_OFFSET,
            y: RIGHT.cy,
        })

        let draft = await getDraftComponents(page)
        const circleId = byType(draft, 'circle').id
        const diamondId = byType(draft, 'diamond').id
        const arrowId = arrowsIn(draft)[0].id

        await selectShapeAt(page, LEFT.cx, LEFT.cy)
        await page.keyboard.press('Backspace')
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        draft = await getDraftComponents(page)
        expect(draft[circleId]).toBeFalsy()
        let arrow = draft[arrowId]
        expect(arrow).toBeTruthy()
        expect(arrow.tailShapeId).toBeNull()
        expect(arrow.tailEdge).toBeNull()
        expect(arrow.headShapeId).toBe(diamondId)

        // The detach rides the same BATCH as the shape DELETE.
        await triggerUndoKeyboard(page)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        draft = await getDraftComponents(page)
        expect(draft[circleId]).toBeTruthy()
        arrow = draft[arrowId]
        expect(arrow.tailShapeId).toBe(circleId)
        expect(arrow.tailEdge).toBe('e-resize')

        await triggerRedoKeyboard(page)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        draft = await getDraftComponents(page)
        expect(draft[circleId]).toBeFalsy()
        expect(draft[arrowId]?.tailShapeId).toBeNull()
    })

    test('group move re-glues a connector left outside the marquee', async ({
        page,
    }) => {
        // Connector from the circle's NORTH port pointing up: its stored
        // origin (the tail anchor) sits above the shapes, so a marquee drawn
        // around just the shapes will NOT include it.
        await drawShape(page, 'circle', {
            startX: 340,
            startY: 300,
            endX: 460,
            endY: 420,
        })
        await drawShape(page, 'diamond', {
            startX: 640,
            startY: 300,
            endX: 760,
            endY: 420,
        })
        await selectShapeAt(page, 400, 360)
        await dragMouse(page, { x: 400, y: 360 - PORT_OFFSET }, { x: 400, y: 150 })
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        let draft = await getDraftComponents(page)
        const circleId = byType(draft, 'circle').id

        // Marquee catches only the two shapes, then move the group +100,+100.
        await clickPointerTool(page)
        await page.mouse.click(150, 550)
        await page.waitForTimeout(200)
        await dragSelectArea(page, {
            startX: 290,
            startY: 292,
            endX: 850,
            endY: 500,
        })
        await page.waitForTimeout(300)
        await dragMouse(page, { x: 400, y: 360 }, { x: 500, y: 460 }, 10)
        await page.waitForTimeout(200)
        await page.mouse.click(150, 600)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        draft = await getDraftComponents(page)
        const circle = draft[circleId]
        expect(circle.x).toBe(500)
        expect(circle.y).toBe(460)
        const arrow = arrowsIn(draft)[0]
        expect(arrow.tailShapeId).toBe(circleId)
        // The tail must have re-glued onto the moved circle's north port.
        const tailWorldX = arrow.x + arrow.x1
        const tailWorldY = arrow.y + arrow.y1
        expect(Math.abs(tailWorldX - circle.x)).toBeLessThanOrEqual(2)
        expect(
            Math.abs(tailWorldY - (circle.y - PORT_OFFSET))
        ).toBeLessThanOrEqual(2)
    })

    test('pasting a copied group keeps its connector attached to the pasted clones', async ({
        page,
    }) => {
        await drawShape(page, 'circle', shapeCoords(LEFT))
        await drawShape(page, 'diamond', shapeCoords(RIGHT))
        await pullConnectorFromEastPort(page, LEFT, {
            x: RIGHT.cx - PORT_OFFSET,
            y: RIGHT.cy,
        })

        let draft = await getDraftComponents(page)
        const originalIds = new Set(Object.keys(draft))

        await clickPointerTool(page)
        await page.mouse.click(150, 550)
        await page.waitForTimeout(200)
        await dragSelectArea(page, {
            startX: 260,
            startY: 160,
            endX: 850,
            endY: 450,
        })
        await page.waitForTimeout(300)
        await page.keyboard.press('Meta+c')
        await page.mouse.move(500, 560)
        await page.waitForTimeout(100)
        await page.keyboard.press('Meta+v')
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        draft = await getDraftComponents(page)
        const pasted = Object.values(draft).filter(
            (c) => !originalIds.has(c.id)
        )
        expect(pasted).toHaveLength(3)
        const pastedCircle = pasted.find((c) => c.componentType === 'circle')
        const pastedDiamond = pasted.find((c) => c.componentType === 'diamond')
        const pastedArrow = pasted.find(
            (c) => c.componentType === 'arrowLine'
        )
        expect(pastedArrow).toBeTruthy()
        // Bindings are REMAPPED to the pasted counterparts, not the originals.
        expect(pastedArrow.tailShapeId).toBe(pastedCircle.id)
        expect(pastedArrow.tailEdge).toBe('e-resize')
        expect(pastedArrow.headShapeId).toBe(pastedDiamond.id)
        expect(pastedArrow.headEdge).toBe('w-resize')
    })

    test('pasting a copied single connector stays attached to the original shapes', async ({
        page,
    }) => {
        await drawShape(page, 'circle', shapeCoords(LEFT))
        await drawShape(page, 'diamond', shapeCoords(RIGHT))
        await pullConnectorFromEastPort(page, LEFT, {
            x: RIGHT.cx - PORT_OFFSET,
            y: RIGHT.cy,
        })

        let draft = await getDraftComponents(page)
        const circleId = byType(draft, 'circle').id
        const diamondId = byType(draft, 'diamond').id
        const originalArrowId = arrowsIn(draft)[0].id

        // Click-select the arrow on its midpoint, copy, paste elsewhere.
        await clickPointerTool(page)
        await page.mouse.click(
            (LEFT.cx + RIGHT.cx) / 2,
            LEFT.cy
        )
        await page.waitForTimeout(300)
        await page.keyboard.press('Meta+c')
        await page.mouse.move(550, 560)
        await page.waitForTimeout(100)
        await page.keyboard.press('Meta+v')
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        draft = await getDraftComponents(page)
        const arrows = arrowsIn(draft)
        expect(arrows).toHaveLength(2)
        const copy = arrows.find((a) => a.id !== originalArrowId)
        expect(copy.tailShapeId).toBe(circleId)
        expect(copy.headShapeId).toBe(diamondId)
        // Both connectors dock at the same two ports — the fan gives them
        // distinct slots instead of stacking them.
        expect(
            arrows.map((a) => a.tailPortIndex).sort()
        ).toEqual([0, 1])
    })
})

test.describe('Connectors (flag off)', () => {
    test('port pull-out gesture creates nothing when the flag is disabled', async ({
        page,
    }) => {
        await setupLocalBoard(page)
        await drawShape(page, 'circle', shapeCoords(LEFT))
        await selectShapeAt(page, LEFT.cx, LEFT.cy)

        // The same gesture that pulls a connector when the flag is on: with
        // it off there is no port there, so this is just an empty-canvas drag.
        await dragMouse(
            page,
            { x: LEFT.cx + PORT_OFFSET, y: LEFT.cy },
            { x: RIGHT.cx - PORT_OFFSET, y: RIGHT.cy }
        )
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)

        const draft = await getDraftComponents(page)
        expect(arrowsIn(draft)).toHaveLength(0)
    })
})
