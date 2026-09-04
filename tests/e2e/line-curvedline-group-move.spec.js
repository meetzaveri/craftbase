import { test, expect } from './helpers/test.js'
import {
    setupLocalBoard,
    getCanvasBox,
    drawArrow,
    drawPencilStroke,
    drawLine,
    drawCurvedLine,
    clickPointerTool,
    dragSelectArea,
    getDraftComponents,
} from './helpers/index.js'

// The board loads at camera scale 1 with no pan, so 1 viewport px == 1 surface
// unit: moving the group by exactly 50px must shift every member's stored
// coordinate by exactly 50. commitGroupMove writes each child's new x/y (and,
// for the absolute-metadata family — pencil/curvedLine — its shifted vertex
// array) into the store on release/blur.
const MOVE = 50
const DRAFT_DEBOUNCE_MS = 700

// The "reference coordinate" the user asked us to verify per element:
//  - pencil / curvedLine store geometry as an absolute vertex array → first
//    vertex = metadata[0].
//  - line / arrowLine store position as x/y (translation) → x/y.
function referencePoint(record) {
    if (Array.isArray(record?.metadata) && record.metadata.length > 0) {
        return { x: record.metadata[0].x, y: record.metadata[0].y }
    }
    return { x: record.x, y: record.y }
}

// Draw one of each of the four element types packed into a compact cluster
// around (cx, cy). Returns nothing — the caller reads the draft to snapshot.
async function drawCluster(page, cx, cy) {
    await drawLine(page, {
        startX: cx - 120,
        startY: cy - 70,
        endX: cx,
        endY: cy - 70,
    })
    await drawArrow(page, {
        startX: cx - 120,
        startY: cy - 20,
        endX: cx,
        endY: cy - 20,
    })
    await drawPencilStroke(page, {
        startX: cx - 120,
        startY: cy + 30,
        endX: cx,
        endY: cy + 55,
    })
    await drawCurvedLine(page, [
        { x: cx - 120, y: cy + 95 },
        { x: cx - 60, y: cy + 75 },
        { x: cx, y: cy + 105 },
    ])
}

// Snapshot each element's reference point, keyed by componentType.
function snapshotByType(draft) {
    const out = {}
    for (const record of Object.values(draft)) {
        if (record.componentType === 'groupobject') continue
        out[record.componentType] = referencePoint(record)
    }
    return out
}

// Marquee-select the cluster into a group, grab it by a point known to sit on
// a member (the line's midpoint), drag by (dx, dy), release, then blur so
// commitGroupMove syncs + persists the originals.
async function groupAndMove(page, cx, cy, dx, dy) {
    await clickPointerTool(page)
    const groupHandle = await dragSelectArea(page, {
        startX: cx - 160,
        startY: cy - 110,
        endX: cx + 60,
        endY: cy + 140,
    })
    expect(groupHandle).not.toBeNull()

    // Grab the group on the line member (cx-60, cy-70) — a point guaranteed to
    // hit a hittable stroke inside the group, so the drag moves the whole group.
    const grabX = cx - 60
    const grabY = cy - 70
    await page.mouse.move(grabX, grabY)
    await page.mouse.down()
    await page.mouse.move(grabX + dx, grabY + dy, { steps: 10 })
    await page.mouse.up()

    // Blur (click empty canvas) → onBlurHandler commits the move and reveals the
    // now-synced originals.
    await page.mouse.click(cx + 380, cy)
    await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
}

const TYPES = ['line', 'arrowLine', 'pencil', 'curvedLine']

test.describe('Line/CurvedLine group move — members displace by exactly 50', () => {
    test.beforeEach(async ({ page }) => {
        await setupLocalBoard(page)
    })

    test('moving the group +50 on the x-axis shifts every member x by 50', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.45
        const cy = box.y + box.height * 0.45

        await drawCluster(page, cx, cy)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const before = snapshotByType(await getDraftComponents(page))
        for (const t of TYPES) expect(before[t], `${t} drawn`).toBeTruthy()

        await groupAndMove(page, cx, cy, MOVE, 0)

        const after = snapshotByType(await getDraftComponents(page))
        for (const t of TYPES) {
            expect(after[t].x - before[t].x, `${t}: x displaced by 50`).toBe(
                MOVE
            )
            expect(after[t].y - before[t].y, `${t}: y unchanged`).toBe(0)
        }
    })

    test('moving the group +50 on the y-axis shifts every member y by 50', async ({
        page,
    }) => {
        const box = await getCanvasBox(page)
        const cx = box.x + box.width * 0.45
        const cy = box.y + box.height * 0.4

        await drawCluster(page, cx, cy)
        await page.waitForTimeout(DRAFT_DEBOUNCE_MS)
        const before = snapshotByType(await getDraftComponents(page))
        for (const t of TYPES) expect(before[t], `${t} drawn`).toBeTruthy()

        await groupAndMove(page, cx, cy, 0, MOVE)

        const after = snapshotByType(await getDraftComponents(page))
        for (const t of TYPES) {
            expect(after[t].y - before[t].y, `${t}: y displaced by 50`).toBe(
                MOVE
            )
            expect(after[t].x - before[t].x, `${t}: x unchanged`).toBe(0)
        }
    })
})
