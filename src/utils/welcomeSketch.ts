// First-visit welcome sketch.
//
// Seeded into the local componentStore when a fresh visitor lands on `/` with
// no draft and no prior dismissal. Elements are flagged `metadata.isWelcome`
// so they can be filtered out of draft saves + share-time persistence and
// cleanly removed the moment the user creates their first real element.
//
// Coordinates are computed against the current viewport: the canvas's surface
// origin is anchored at ~(0,0) of the screen at default zoom, so positioning
// elements at negative surface coords would push them off the top-left. We
// take viewport dimensions at build time and place the sketch around the
// visible center, with one anchor near the bottom-left zoom controls.

import { generateUUID } from './misc'
import { pollUntilElement } from './canvasUtils'
import { themeDefaultInk } from './themeColorFlip'
import { DEFAULT_TEXT_FONT_FAMILY } from '../constants/misc'
import type { ComponentRecord, ComponentStore } from '../types/board'

const SKETCH_OPACITY = 0.45
const SKETCH_FONT = DEFAULT_TEXT_FONT_FAMILY

interface WelcomeMetadata {
    [key: string]: unknown
    isWelcome: true
    opacity: number
    // Marks the one element that types itself in first; the rest of the sketch
    // is held back until it finishes. See playWelcomeSketchEntrance.
    welcomeRole?: 'headline'
    // Standalone-text fields (read by NewText factory)
    content?: string
    fontSize?: number
    textFontFamily?: string
    // Rect-with-text fields (read by canvasUtils.applyShapeText)
    hasText?: boolean
    textContent?: string
    textFontSize?: number
    textFill?: string
}

function welcomeMetadata(
    extra: Partial<Omit<WelcomeMetadata, 'isWelcome' | 'opacity'>> = {}
): WelcomeMetadata {
    return { isWelcome: true, opacity: SKETCH_OPACITY, ...extra }
}

function makeText(
    boardId: string,
    x: number,
    y: number,
    content: string,
    fontSize: number,
    fill: string = 'transparent'
): ComponentRecord {
    return {
        id: generateUUID(),
        componentType: 'newText',
        x,
        y,
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0,
        width: 220,
        height: 40,
        fill,
        stroke: null,
        linewidth: null,
        strokeType: null,
        radius: null,
        iconStroke: null,
        textColor: themeDefaultInk(),
        boardId,
        boardName: null,
        metadata: welcomeMetadata({
            content,
            fontSize,
            textFontFamily: SKETCH_FONT,
        }),
        children: null,
        isDummy: null,
        updatedBy: null,
        createdAt: null,
    }
}

/**
 * A standalone-text element tagged as the sketch's headline — the one piece
 * that types itself in (character-by-character) before the rest of the sketch
 * is revealed. See playWelcomeSketchEntrance.
 */
function makeHeadline(
    boardId: string,
    x: number,
    y: number,
    content: string,
    fontSize: number
): ComponentRecord {
    const rec = makeText(boardId, x, y, content, fontSize)
    ;(rec.metadata as WelcomeMetadata).welcomeRole = 'headline'
    return rec
}

function makeRect(
    boardId: string,
    x: number,
    y: number,
    width: number,
    height: number
): ComponentRecord {
    return {
        id: generateUUID(),
        componentType: 'rectangle',
        x,
        y,
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0,
        width,
        height,
        fill: '#ffffff',
        stroke: themeDefaultInk(),
        linewidth: 2,
        strokeType: 'solid',
        radius: null,
        iconStroke: null,
        textColor: themeDefaultInk(),
        boardId,
        boardName: null,
        metadata: welcomeMetadata(),
        children: null,
        isDummy: null,
        updatedBy: null,
        createdAt: null,
    }
}

/**
 * A `rectangle` carrying inline text via metadata — read by canvasUtils
 * `applyShapeText` (gated on `hasText`). This is how the existing
 * rect-with-text element (the `RECT_WITH_TEXT` set in elementProperties.tsx)
 * is shaped — one component, not a rect + separate text overlay.
 */
function makeRectWithText(
    boardId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    textFontSize: number = 26
): ComponentRecord {
    return {
        id: generateUUID(),
        componentType: 'rectangle',
        x,
        y,
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0,
        width,
        height,
        fill: 'transparent',
        stroke: themeDefaultInk(),
        linewidth: 2,
        strokeType: 'solid',
        radius: null,
        iconStroke: null,
        textColor: themeDefaultInk(),
        boardId,
        boardName: null,
        metadata: welcomeMetadata({
            hasText: true,
            textContent: text,
            textFontFamily: SKETCH_FONT,
            textFontSize,
            textFill: themeDefaultInk(),
        }),
        children: null,
        isDummy: null,
        updatedBy: null,
        createdAt: null,
    }
}

/** Valid strokeType values understood by `strokeTypeToDashes`. */
type StrokeType = 'solid' | 'dashed' | 'dotted'

function makeArrow(
    boardId: string,
    x: number,
    y: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    strokeType: StrokeType = 'solid',
    fill: string = 'transparent'
): ComponentRecord {
    return {
        id: generateUUID(),
        componentType: 'arrowLine',
        x,
        y,
        x1,
        x2,
        y1,
        y2,
        width: 0,
        height: 0,
        fill,
        stroke: themeDefaultInk(),
        linewidth: 2,
        strokeType,
        radius: null,
        iconStroke: null,
        textColor: null,
        boardId,
        boardName: null,
        metadata: welcomeMetadata(),
        children: null,
        isDummy: null,
        updatedBy: null,
        createdAt: null,
    }
}

export interface WelcomeSketchViewport {
    width: number
    height: number
    /**
     * When true, lay out for the mobile UI (shapes toolbar bottom-left, no
     * zoom controls, no left-side property panel). Default false renders the
     * laptop/desktop/tablet layout — those three share the same surrounding
     * UI (toolbar top-center, zoom bottom-left, panel left) and so share the
     * same sketch layout.
     */
    isMobile?: boolean
}

/**
 * Mobile layout: shapes toolbar lives at the bottom-left (see
 * `shapesToolbar.tsx`), there are no zoom controls, and viewport width is
 * tight (~360-420px). The sketch stacks vertically, scales fonts down, and
 * points "Pick a shape" arrow down-left at the bottom toolbar.
 */
function buildMobileWelcomeSketch(
    boardId: string,
    width: number,
    height: number
): ComponentStore {
    const cx = Math.round(width / 2)

    const elements: ComponentRecord[] = [
        // Subhead — two compact lines in the upper-left, sitting well inside
        // the corner. Both lines type themselves in (top line first), then the
        // rest of the sketch follows.
        makeHeadline(boardId, 72, 132, 'A minimal "infinite" whiteboard.', 22),
        makeHeadline(boardId, 72, 164, 'Start drawing →', 20),

        // Rect-with-text centered. "Tap me" since drag-on-touch is two-finger.
        makeRectWithText(boardId, cx, 220, 150, 80, 'Tap me', 22),

        // Standalone label below the rect.
        makeText(boardId, cx - 110, 290, 'Double-tap anywhere to add text', 18),

        // Arrow pointing straight DOWN to the bottom shapes toolbar.
        // Group origin centered horizontally; arrowhead lands just above the
        // toolbar row.
        makeArrow(boardId, cx, height - 250, 0, 0, 0, 170, 'dashed'),
        makeText(
            boardId,
            cx - 60,
            height - 280,
            '↓ Pick a shape OR draw with pencil',
            18
        ),
    ]

    return Object.fromEntries(elements.map((el) => [el.id, el]))
}

/**
 * Large-screen layout (tablet / laptop / desktop): shapes toolbar top-center,
 * zoom controls bottom-left. The tablet end (~768px) is the tightest case for
 * this layout but still has enough horizontal room since the rect sits left of
 * center and the arrow + label sit right of center.
 */
function buildLargeWelcomeSketch(
    boardId: string,
    width: number,
    height: number
): ComponentStore {
    const cx = Math.round(width / 2)
    const cy = Math.round(height / 2)

    const elements: ComponentRecord[] = [
        // Subhead — two-line sketch text in the upper-left region, sitting well
        // inside the corner and clear of the top-center shapes toolbar. Both
        // lines type themselves in (top line first), then the rest follows.
        makeHeadline(boardId, 150, 175, 'A minimal "infinite" whiteboard.', 32),
        makeHeadline(boardId, 150, 215, 'Start drawing →', 28),

        // Rect-with-text: the rectangle carries its "Drag me" label via
        // metadata (hasText + textContent), matching the existing
        // RECT_WITH_TEXT element kind. One component, not a rect + overlay.
        makeRectWithText(boardId, cx - 200, cy + 20, 180, 100, 'Drag me', 26),

        // Arrow pointing UP toward the top shapes toolbar + label below it.
        // Anchored at screen center so it sits above the centered label below;
        // arrowhead lands near the toolbar row (~y=80 in screen space).
        makeArrow(boardId, cx, cy - 110, 0, 0, 0, -(cy - 180), 'dashed'),
        // Label horizontally centered on screen. Text is left-aligned, so its
        // origin sits ~half the rendered width left of center. Vertical position
        // is unchanged.
        makeText(
            boardId,
            cx - 150,
            cy - 80,
            '↑ Pick a shape OR draw with pencil',
            24
        ),

        // Standalone label — no arrow. Double-click is a canvas-wide action.
        makeText(
            boardId,
            cx + 60,
            cy + 100,
            'Double-click anywhere to add text',
            24
        ),

        // Arrow toward the bottom-left zoom controls + label above it.
        // Zoom controls sit at roughly (80, H-40); arrowhead lands just above.
        makeArrow(boardId, 240, height - 180, 0, 0, -150, 110, 'dashed'),
        makeText(
            boardId,
            250,
            height - 210,
            '↙ Zoom in / out with button OR "Cmd/Ctrl" + "Scroll" ',
            22
        ),
    ]

    return Object.fromEntries(elements.map((el) => [el.id, el]))
}

export function buildWelcomeSketch(
    boardId: string,
    viewport: WelcomeSketchViewport
): ComponentStore {
    const { width, height, isMobile } = viewport
    if (isMobile) {
        return buildMobileWelcomeSketch(boardId, width, height)
    }
    return buildLargeWelcomeSketch(boardId, width, height)
}

/**
 * True when a component is part of the welcome sketch (and should be filtered
 * out of draft saves, share-time persistence, and history).
 */
export function isWelcomeComponent(comp: ComponentRecord | undefined): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(comp?.metadata as any)?.isWelcome
}

// ── Soft-land entrance / lift-off exit ──
// The welcome sketch animates in and out by mutating each Two.js node directly
// (`.translation.y`, `.opacity`) and calling `two.update()` per frame. We go
// node-direct (not CSS, not store-driven) because the canvas runs manual
// updates with no continuous play loop, and element components freeze their
// props at mount — store values won't re-flow on their own.
//
// Entrance: each element starts a few px above its resting Y and transparent,
// then eases down + fades to its resting opacity, cascading in source order.
// Exit: each element fades to 0 while drifting up a touch ("lifts off"), then
// the caller sweeps it from the store.

/** px each element starts above its resting Y before it "lands". */
const ENTRANCE_DROP = 26
/** ms for a single element to travel from primed → resting. */
const ENTRANCE_DURATION = 540
/** ms offset between successive elements (the cascade). */
const ENTRANCE_STAGGER = 85

/** px each element drifts upward as it fades out. */
const EXIT_LIFT = 16
/** ms for a single element to fade from resting → gone. */
const EXIT_DURATION = 360
/** ms offset between successive elements on the way out. */
const EXIT_STAGGER = 30

/** ms beat before each headline line starts "writing". */
const TYPE_START_DELAY = 220
/** characters "written" per second. */
const TYPE_CPS = 26
/** floor so a short line still reads as written, not flashed. */
const TYPE_MIN_DURATION = 700
/** ms beat after the last headline line finishes before the rest reveals. */
const POST_TYPE_HOLD = 180

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
}

function clamp01(t: number): number {
    return Math.min(1, Math.max(0, t))
}

// A standalone-text element's writeable node is its group's first child
// carrying a string `.value` (the Two.Text holding line 1).
/* eslint-disable @typescript-eslint/no-explicit-any */
function findTextNode(group: any): any {
    return group?.children?.find?.((c: any) => typeof c?.value === 'string')
}

// Blank a headline line so it doesn't flash its full text before its turn to be
// written. Opacity is left at rest — an empty string simply shows nothing.
function blankTextNode(two: any, group: any): void {
    const textNode = findTextNode(group)
    if (textNode) {
        textNode.value = ''
        two.update()
    }
}

// Reveal a standalone-text node character-by-character, mimicking the example's
// path `ending` draw — but Two.Text has no `ending`, so we grow its `.value`
// substring instead (the writeable equivalent for type). `full` is passed in
// (not read off the node) because the node is blanked ahead of its turn.
function typewriteNode(
    two: any,
    group: any,
    full: string,
    onDone: () => void
): void {
    const textNode = findTextNode(group)
    const total = full.length
    if (!textNode || total === 0) {
        onDone()
        return
    }
    const duration = Math.max(TYPE_MIN_DURATION, (total / TYPE_CPS) * 1000)

    textNode.value = ''
    two.update()

    const start = performance.now() + TYPE_START_DELAY
    const step = (now: number): void => {
        const t = clamp01((now - start) / duration)
        const next = full.slice(0, Math.round(total * t))
        if (next !== textNode.value) {
            textNode.value = next
            two.update()
        }
        if (t < 1) requestAnimationFrame(step)
        else onDone()
    }
    requestAnimationFrame(step)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface NodeTween {
    fromY: number
    toY: number
    fromOpacity: number
    toOpacity: number
    duration: number
    delay?: number
    onDone?: () => void
}

// Per-node generation token. Each new tween bumps the node's token; an
// in-flight tween whose token no longer matches bails on its next frame. This
// is what lets an exit cleanly supersede a still-running entrance on the same
// element without the two loops fighting over `.opacity`.
const ANIM_TOKEN = '__welcomeAnimToken'
let animSeq = 0

/* eslint-disable @typescript-eslint/no-explicit-any */
function tweenNode(two: any, el: any, tween: NodeTween): void {
    const { fromY, toY, fromOpacity, toOpacity, duration, delay = 0 } = tween
    const token = ++animSeq
    el[ANIM_TOKEN] = token
    const start = performance.now() + delay

    // Prime to the start state immediately so there's no first-frame flash of
    // the renderer's resting values.
    el.translation.y = fromY
    el.opacity = fromOpacity
    two.update()

    const step = (now: number): void => {
        if (el[ANIM_TOKEN] !== token) return // superseded by a newer tween
        const t = Math.min(1, Math.max(0, (now - start) / duration))
        const e = easeOutCubic(t)
        el.translation.y = fromY + (toY - fromY) * e
        el.opacity = fromOpacity + (toOpacity - fromOpacity) * e
        two.update()
        if (t < 1) requestAnimationFrame(step)
        else tween.onDone?.()
    }
    requestAnimationFrame(step)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Animate the welcome sketch in, in two beats:
 *   1. Each headline-tagged line types itself in, character-by-character, one
 *      after another in source order.
 *   2. Once the last line finishes, every other element soft-lands in a
 *      staggered cascade.
 *
 * The rest of the sketch is held hidden (opacity 0) until beat 1 completes, so
 * the headlines write onto an otherwise empty canvas. Safe to call once right
 * after the sketch is seeded — each element is polled for until its Two.js node
 * mounts, so timing against React's async render is handled internally. With no
 * tagged headline, every element simply soft-lands together.
 */
export function playWelcomeSketchEntrance(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    two: any,
    store: ComponentStore
): void {
    if (!two) return
    const ids = Object.keys(store).filter((id) => isWelcomeComponent(store[id]))
    if (ids.length === 0) return

    const headlineIds = ids.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (id) => (store[id]?.metadata as any)?.welcomeRole === 'headline'
    )
    const restIds = ids.filter((id) => !headlineIds.includes(id))

    // Landers for the rest run only after the headlines are written. Elements
    // may mount before or after that moment, so each fires now or is queued.
    let headlinesDone = headlineIds.length === 0
    const queued: Array<() => void> = []
    const runOrQueue = (land: () => void): void => {
        if (headlinesDone) land()
        else queued.push(land)
    }

    restIds.forEach((id, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pollUntilElement(two, id, (el: any) => {
            const restY: number = el.translation.y
            const restOpacity: number = el.opacity ?? 1
            // Hold hidden until it's this element's turn to land.
            el.opacity = 0
            two.update()
            runOrQueue(() =>
                tweenNode(two, el, {
                    fromY: restY - ENTRANCE_DROP,
                    toY: restY,
                    fromOpacity: 0,
                    toOpacity: restOpacity,
                    duration: ENTRANCE_DURATION,
                    delay: index * ENTRANCE_STAGGER,
                })
            )
        })
    })

    // Blank every headline line up front so none flash their full text while an
    // earlier line is still being written.
    headlineIds.forEach((id) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pollUntilElement(two, id, (group: any) => blankTextNode(two, group))
    })

    // Type the headline lines one after another, then release the rest.
    const typeLine = (i: number): void => {
        if (i >= headlineIds.length) {
            setTimeout(() => {
                headlinesDone = true
                queued.splice(0).forEach((land) => land())
            }, POST_TYPE_HOLD)
            return
        }
        const id = headlineIds[i] as string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const full = String((store[id]?.metadata as any)?.content ?? '')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pollUntilElement(two, id, (group: any) => {
            typewriteNode(two, group, full, () => typeLine(i + 1))
        })
    }
    typeLine(0)
}

/**
 * Gently fade + lift the given welcome elements out of the scene, then invoke
 * `onComplete` once the last one finishes so the caller can sweep them from the
 * store. Supersedes any in-flight entrance on the same nodes. If nothing is
 * mounted, `onComplete` still fires (next tick) so the store sweep never stalls.
 *
 * Returns the total animation duration (ms) for callers that want to schedule
 * their own fallback.
 */
export function playWelcomeSketchExit(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    two: any,
    ids: string[],
    onComplete?: () => void
): number {
    const totalDuration =
        EXIT_DURATION + Math.max(0, ids.length - 1) * EXIT_STAGGER

    if (!two || ids.length === 0) {
        if (onComplete) requestAnimationFrame(onComplete)
        return totalDuration
    }

    let pending = 0
    let done = false
    const finishOnce = (): void => {
        if (done) return
        done = true
        onComplete?.()
    }

    ids.forEach((id, index) => {
        const el = two.scene.children.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (child: any) => child?.elementData?.id === id
        )
        if (!el) return
        pending++
        tweenNode(two, el, {
            fromY: el.translation.y,
            toY: el.translation.y - EXIT_LIFT,
            fromOpacity: el.opacity ?? 1,
            toOpacity: 0,
            duration: EXIT_DURATION,
            delay: index * EXIT_STAGGER,
            onDone: () => {
                pending--
                if (pending === 0) finishOnce()
            },
        })
    })

    // Nothing was actually mounted — don't strand the caller's sweep.
    if (pending === 0) requestAnimationFrame(finishOnce)
    return totalDuration
}
