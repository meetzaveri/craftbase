import Two from 'two.js'
import {
    findShapeTextLayer,
    getShapeTextNodes,
    renderShapeTextLayer,
    shapeTextStyleFromMeta,
    syncTextHitRect,
} from '../utils/canvasUtils'
import { reflowTextForShape, minShapeWidthForText } from '../utils/shapeTextFit'
import {
    lineHeightFor,
    measureTextWidth,
    type FontSpec,
} from '../utils/textLayout'
import { DEFAULT_TEXT_FONT_FAMILY } from '../constants/misc'
import { getConnectorsEnabled } from '../utils/featureFlags'
import { isPortShape } from '../utils/shapePorts'
import { markSelectionChrome } from '../utils/svgExportShared'

// Two.js scene shapes carry codebase-specific bookkeeping (elementData,
// _renderer, etc.) outside the published types. Stay loose here; Stage 12
// can tighten once newCanvas converges in Stage 9.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GroupLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZuiLike = any

interface ShapeAdapter {
    getLocalSize: (shape: ShapeLike) => { width: number; height: number }
    applySize: (shape: ShapeLike, width: number, height: number) => void
    resizable: boolean
    minWidth: number
    minHeight: number
    // 'dimension' (default) → corner drag changes width/height. 'font' → corner
    // drag scales the font size of a standalone text block (no w/h change). The
    // box still tracks the rendered block via getLocalSize.
    resizeMode?: 'dimension' | 'font'
}

// Font spec for a single standalone text line node.
function textNodeFontSpec(node: ShapeLike): FontSpec {
    return {
        family: node?.family || DEFAULT_TEXT_FONT_FAMILY,
        size: node?.size || 36,
        weight: node?.weight,
    }
}

// Surface-unit size of a standalone text block: widest measured line × the
// stacked line height. measureTextWidth returns surface units (same space as a
// shape's width), so this feeds the selection box directly — no screen↔surface
// conversion needed.
function textBlockLocalSize(group: ShapeLike): {
    width: number
    height: number
} {
    const nodes = getShapeTextNodes(group)
    if (!nodes.length) return { width: 60, height: 36 }
    const size = nodes[0]?.size || 36
    let maxW = 0
    nodes.forEach((nd) => {
        maxW = Math.max(
            maxW,
            measureTextWidth(nd?.value || '', textNodeFontSpec(nd))
        )
    })
    return {
        width: Math.max(maxW, 20),
        height: Math.max(nodes.length * lineHeightFor(size), size),
    }
}

const DEFAULT_ADAPTER: ShapeAdapter = {
    getLocalSize: (shape) => ({
        width: shape.width,
        height: shape.height,
    }),
    applySize: (shape, width, height) => {
        shape.width = width
        shape.height = height
    },
    resizable: true,
    minWidth: 20,
    minHeight: 20,
}

const TEXT_ADAPTER: ShapeAdapter = {
    // currentShape is line 1 (group.children[0]); walk up to the group to size
    // the whole multiline block.
    getLocalSize: (shape) => textBlockLocalSize(shape?.parent ?? shape),
    applySize: () => {}, // sizing happens via font scaling, not w/h
    resizable: true,
    resizeMode: 'font',
    minWidth: 20,
    minHeight: 20,
}

const SHAPE_ADAPTERS: Record<string, ShapeAdapter> = {
    rectangle: DEFAULT_ADAPTER,
    circle: DEFAULT_ADAPTER,
    diamond: DEFAULT_ADAPTER,
    newText: TEXT_ADAPTER,
}

// Handle dot diameter in *screen* px, stepped across 3 zoom ranges so the dots
// stay stable instead of rescaling continuously with zoom.
function handleScreenPx(scale: number): number {
    if (scale < 0.5) return 8
    if (scale < 2) return 11
    return 14
}
const HANDLE_HIT_SLOP_MOUSE = 3
const HANDLE_HIT_SLOP_TOUCH = 8
const MIN_SCALE_DIMENSION = 20
// Surface-unit padding between the shape edge and the selection box border.
// Exported so connector anchoring matches where the box (and thus ports) sit.
export const SELECTION_PADDING = 5
// Screen-px gap between the selection box border and the connection ports.
// Exported so connector anchoring (newCanvas) can pin tails to the same spot.
export const PORT_GAP = 10
// Screen-px radius within which a dragging connector head "snaps" a nearby
// port into its radar and lights its glow. Exported so newCanvas can run the
// same proximity test the glow is keyed off.
export const PORT_RADAR_RADIUS = 26

// --- Port "radar" glow (amber pulsing ring shown over a landable port) ---
// Base radius (screen px) of the glow; the glow group counter-scales to zoom.
const GLOW_BASE_RADIUS = 9
// One expand-and-fade ping every this many ms.
const GLOW_PERIOD_MS = 1100
// Amber palette for the glow.
const GLOW_RING_COLOR = '#E0A22B'
const GLOW_CORE_COLOR = '#F2C150'

// Selection box + resize-handle stroke. Follows the active theme's `ink` so it
// stays high-contrast against the canvas in BOTH themes: near-black on the light
// parchment, light-warm on the dark canvas. Read live from the `--color-ink` CSS
// variable (RGB channels, set in App.css + flipped by `.dark`) because this is a
// Two.js scene color, not a CSS class — it can't inherit the token otherwise.
// The muted `accent.dark` gold used previously blended into the bg.
const getSelectionStroke = (): string => {
    if (typeof document === 'undefined') return '#1A1612'
    const channels = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-ink')
        .trim()
    return channels ? `rgb(${channels})` : '#1A1612'
}

interface ToolbarState {
    element: Record<string, ShapeLike>
    group: { id: string; data: GroupLike }
    shape: { type: string | undefined; id: string; data: ShapeLike }
    text: { data: ShapeLike }
    icon: { data: Record<string, unknown> }
}

function buildToolbarState(group: GroupLike, shape: ShapeLike): ToolbarState {
    const componentType = group?.elementData?.componentType
    // First line node of the (possibly multiline) text layer.
    const textChild = getShapeTextNodes(group)[0]
    return {
        element: {
            [shape.id]: shape,
            [group.id]: group,
        },
        group: {
            id: group.id,
            data: group,
        },
        shape: {
            type: componentType,
            id: shape.id,
            data: shape,
        },
        text: { data: textChild || {} },
        icon: { data: {} },
    }
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx
    const dy = ay - by
    return dx * dx + dy * dy
}

interface SelectionControllerOptions {
    two: TwoLike
    zui: ZuiLike
    domElement: HTMLElement
    onSelect?: (state: ToolbarState) => void
    onDeselect?: () => void
    commit?: (
        id: string,
        patch: {
            width: number
            height: number
            x: number
            y: number
            // Font resize on text also carries updated metadata (fontSize +
            // multiline content).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            metadata?: Record<string, any>
        }
    ) => void
    recordHistory?: () => void
    onDelete?: (group: GroupLike) => void
    // Fired live while the selection is scaled/rotated so the host can drag
    // connectors bound to the shape's ports along with the transform.
    onTransform?: (group: GroupLike) => void
}

interface HitResult {
    mode: 'scale' | 'rotate'
    corner: CornerHandle
}

interface CornerHandle {
    name: string
    point: { x: number; y: number }
}

interface ScaleInteraction {
    mode: 'scale'
    corner: CornerHandle
    startSurface: { x: number; y: number }
    initialWidth: number
    initialHeight: number
    initialPosition: { x: number; y: number }
    initialRotation: number
    // Font size at gesture start — only used for 'font' resizeMode (text).
    initialFontSize?: number
}

interface RotateInteraction {
    mode: 'rotate'
    corner: CornerHandle
    startSurface: { x: number; y: number }
    initialRotation: number
    center: { x: number; y: number }
}

type Interaction = ScaleInteraction | RotateInteraction

export default class SelectionController {
    two: TwoLike
    zui: ZuiLike
    domElement: HTMLElement
    callbacks: Required<
        Pick<
            SelectionControllerOptions,
            | 'onSelect'
            | 'onDeselect'
            | 'commit'
            | 'recordHistory'
            | 'onDelete'
            | 'onTransform'
        >
    >

    rotationEnabled = false

    targets: Set<GroupLike> = new Set()
    currentGroup: GroupLike = null
    currentShape: ShapeLike = null
    currentAdapter: ShapeAdapter | null = null
    currentTextChild: ShapeLike = null
    currentTextLayer: ShapeLike = null

    interaction: Interaction | null = null

    ui!: ShapeLike
    box!: ShapeLike
    endpoints!: ShapeLike
    portHandles!: ShapeLike
    portPoints!: ShapeLike[]

    // Connection ports sit at each edge midpoint, floated outside the selection
    // box. Hovering a port reveals this outward-pointing arrow — the affordance
    // for "open a path to connect". Ports are NOT resize handles.
    portArrow!: ShapeLike

    // Radar glow shown over the nearest landable port while a connector is being
    // drawn. Lives at scene level (not inside `ui`) so it survives `detach()`,
    // which fires when a connector pulls out of the source shape.
    portGlow!: ShapeLike
    private _glowRing!: ShapeLike
    private _glowCore!: ShapeLike
    private _glowRaf: number | null = null
    private _glowStart = 0

    // Dashed amber skeleton drawn around the shape whose port is the current
    // radar target — signals "the connector will attach to THIS shape". Shown
    // and hidden together with `portGlow`. A group holding one outline variant
    // per port shape (rectangle/ellipse/diamond); `_showNearbyPortShape` shows
    // the variant matching the candidate's componentType so the skeleton traces
    // the shape's real silhouette, not just its bounding box.
    nearbyPortExpectedShape!: ShapeLike
    private _skeletonRect!: ShapeLike
    private _skeletonEllipse!: ShapeLike
    private _skeletonDiamond!: ShapeLike

    private _halfW = 0
    private _halfH = 0
    private _hoveredPort: string | null = null

    private _onUpdate: (() => void) | null = null
    private _onClearSelector: (() => void) | null = null
    private _onKeyDown: ((e: KeyboardEvent) => void) | null = null
    private _onMove: ((ev: MouseEvent) => void) | null = null
    private _onUp: ((ev: MouseEvent) => void) | null = null
    private _onHover: ((ev: MouseEvent) => void) | null = null

    constructor({
        two,
        zui,
        domElement,
        onSelect,
        onDeselect,
        commit,
        recordHistory,
        onDelete,
        onTransform,
    }: SelectionControllerOptions) {
        this.two = two
        this.zui = zui
        this.domElement = domElement
        this.callbacks = {
            onSelect: onSelect ?? ((): void => {}),
            onDeselect: onDeselect ?? ((): void => {}),
            commit: commit ?? ((): void => {}),
            recordHistory: recordHistory ?? ((): void => {}),
            onDelete: onDelete ?? ((): void => {}),
            onTransform: onTransform ?? ((): void => {}),
        }

        this._buildUi()
        this._bindExternal()
    }

    private _buildUi(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ui = new (Two as any).Group()
        ui.visible = false

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const box = new (Two as any).Rectangle(0, 0, 0, 0)
        box.noFill()
        const selectionStroke = getSelectionStroke()
        box.stroke = selectionStroke
        box.linewidth = 1.5

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const endpoints = new (Two as any).Points(box.vertices)
        endpoints.size = 10
        endpoints.fill = '#FFFCF5'
        endpoints.stroke = selectionStroke
        endpoints.linewidth = 1.5

        this.portPoints = [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Vector(0, 0), // n
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Vector(0, 0), // e
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Vector(0, 0), // s
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (Two as any).Vector(0, 0), // w
        ]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const portHandles = new (Two as any).Points(this.portPoints)
        portHandles.size = 10
        portHandles.fill = '#8C7E6A'
        // portHandles.stroke = '#C4901A'
        portHandles.linewidth = 0
        portHandles.visible = false

        const portArrow = this._buildPortArrow()

        ui.add(box, endpoints, portHandles, portArrow)
        this.two.add(ui)

        // Glow + target skeleton live at scene level (not in `ui`) so they can
        // highlight any shape's port — including while the source shape's
        // selection is detached mid-draw. The skeleton is added before the glow
        // so the glow dot renders on top of the outline.
        const nearbyPortExpectedShape = this._buildNearbyPortShape()
        this.two.add(nearbyPortExpectedShape)
        const portGlow = this._buildPortGlow()
        this.two.add(portGlow)

        this.ui = ui
        this.box = box
        this.endpoints = endpoints
        this.portHandles = portHandles
        this.portArrow = portArrow
        this.portGlow = portGlow
        this.nearbyPortExpectedShape = nearbyPortExpectedShape
    }

    // A dashed amber outline (no fill) that wraps the radar-target shape.
    // Holds one prebuilt variant per port shape type; positioned/sized
    // per-frame by `_showNearbyPortShape` to match the candidate shape's
    // bounds; counter-scaled so the stroke stays crisp.
    private _buildNearbyPortShape(): ShapeLike {
        const applyDashStyle = (outline: ShapeLike): void => {
            outline.noFill()
            outline.stroke = GLOW_RING_COLOR
            outline.linewidth = 1.5
            outline.dashes = [6, 4]
            outline.visible = false
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rect = new (Two as any).Rectangle(0, 0, 0, 0)
        applyDashStyle(rect)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ellipse = new (Two as any).Ellipse(0, 0, 0, 0)
        applyDashStyle(ellipse)

        // 4-anchor closed path re-pointed per-frame to the candidate diamond's
        // tips (bbox edge midpoints) — the plain silhouette, no rounding.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Anchor = (Two as any).Anchor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const diamond = new (Two as any).Path(
            [
                new Anchor(0, 0),
                new Anchor(0, 0),
                new Anchor(0, 0),
                new Anchor(0, 0),
            ],
            true,
            false
        )
        applyDashStyle(diamond)

        this._skeletonRect = rect
        this._skeletonEllipse = ellipse
        this._skeletonDiamond = diamond

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = new (Two as any).Group()
        g.add(rect, ellipse, diamond)
        g.visible = false
        return g
    }

    // An amber "radar ping": a steady translucent core plus an expanding ring
    // that the animation loop grows and fades. Built in glow-local space and
    // counter-scaled to the zoom so it stays a constant screen size.
    private _buildPortGlow(): ShapeLike {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Circle = (Two as any).Circle

        const core = new Circle(0, 0, GLOW_BASE_RADIUS)
        core.fill = GLOW_CORE_COLOR
        core.opacity = 0.3
        core.noStroke()

        const ring = new Circle(0, 0, GLOW_BASE_RADIUS)
        ring.noFill()
        ring.stroke = GLOW_RING_COLOR
        ring.linewidth = 2

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = new (Two as any).Group()
        g.add(core, ring)
        g.visible = false

        this._glowCore = core
        this._glowRing = ring
        return g
    }

    // A small outward-pointing arrow icon (shaft + chevron head) drawn in
    // box-local space, growing along +x from the origin. It lives as a child of
    // `ui`, so it inherits the selection's translation/rotation; per-sync we set
    // `scale = 1/zoom` so it stays a constant screen size. Positioned/rotated by
    // `_positionPortArrow` to sit just outside whichever edge is hovered.
    private _buildPortArrow(): ShapeLike {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Anchor = (Two as any).Anchor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shaft = new (Two as any).Path(
            [new Anchor(0, 0), new Anchor(16, 0)],
            false,
            false
        )
        shaft.noFill()
        shaft.stroke = '#C4901A'
        shaft.linewidth = 1.5
        shaft.cap = 'round'
        shaft.join = 'round'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const head = new (Two as any).Path(
            [new Anchor(12, -4), new Anchor(16, 0), new Anchor(12, 4)],
            false,
            false
        )
        head.noFill()
        head.stroke = '#C4901A'
        head.linewidth = 1.5
        head.cap = 'round'
        head.join = 'round'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = new (Two as any).Group()
        g.add(shaft, head)
        g.visible = false
        return g
    }

    private _bindExternal(): void {
        this._onUpdate = (): void => this.syncToTarget()
        this.two.bind('update', this._onUpdate)

        this._onClearSelector = (): void => this.detach()
        window.addEventListener('clearSelector', this._onClearSelector, false)

        this._onKeyDown = (e: KeyboardEvent): void => {
            if (!this.currentGroup) return
            const tag = document.activeElement?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            if (e.keyCode === 8 || e.keyCode === 46) {
                this.callbacks.onDelete(this.currentGroup)
                this.detach()
            }
        }
        window.addEventListener('keydown', this._onKeyDown, false)
    }

    destroy(): void {
        if (this._onUpdate) this.two.unbind('update', this._onUpdate)
        if (this._onClearSelector) {
            window.removeEventListener(
                'clearSelector',
                this._onClearSelector,
                false
            )
        }
        if (this._onKeyDown) {
            window.removeEventListener('keydown', this._onKeyDown, false)
        }
        this._detachPointerStream()
        this._stopGlowAnim()
        this.two.remove(this.ui)
        if (this.portGlow) this.two.remove(this.portGlow)
        if (this.nearbyPortExpectedShape) {
            this.two.remove(this.nearbyPortExpectedShape)
        }
    }

    canHandle(group: GroupLike): boolean {
        const type = group?.elementData?.componentType
        return !!SHAPE_ADAPTERS[type]
    }

    private _bringToFront(): void {
        const scene = this.two.scene
        const idx = scene.children.indexOf(this.ui)
        if (idx === -1) {
            this.two.add(this.ui)
            return
        }
        if (idx !== scene.children.length - 1) {
            scene.children.splice(idx, 1)
            scene.children.push(this.ui)
        }
    }

    /**
     * Public re-assert of the selection overlay to the top of the scene.
     * Called by the z-order reconcile after it re-sorts element groups, so the
     * selection box never gets buried beneath a just-reordered element. No-op
     * when nothing is selected.
     */
    bringSelectionToFront(): void {
        if (!this.currentGroup) return
        this._bringToFront()
    }

    attach(group: GroupLike, shape?: ShapeLike): boolean {
        const type = group?.elementData?.componentType
        const adapter = SHAPE_ADAPTERS[type]
        if (!adapter) return false

        if (this.currentGroup && this.currentGroup !== group) {
            this.targets.clear()
        }

        this.currentGroup = group
        this.currentShape = shape || group.children[0]
        this.currentAdapter = adapter
        this.currentTextLayer = findShapeTextLayer(group)
        this.currentTextChild = getShapeTextNodes(group)[0] || null
        this.targets.add(group)

        this._bringToFront()
        this.ui.visible = true
        // Per-shape `.dragger-picker { cursor: pointer }` (common.css) sits on
        // the SVG node directly under the cursor and beats the root's inline
        // cursor. This class lets CSS show `move` over the selected shape body.
        this.domElement.classList.add('shape-selected')
        this.syncToTarget()
        this.two.update()
        // Tag the overlay so exports strip it. The `ui` lives at scene level
        // (not in any element group), so it only reaches the full-scene PNG
        // export — harmless to tag for the per-selection SVG export too.
        markSelectionChrome(this.ui)

        this._attachHoverListener()
        this.callbacks.onSelect(
            buildToolbarState(this.currentGroup, this.currentShape)
        )
        return true
    }

    detach(): void {
        if (!this.currentGroup) return
        this._detachPointerStream()
        this._detachHoverListener()
        this.targets.clear()
        this.currentGroup = null
        this.currentShape = null
        this.currentAdapter = null
        this.currentTextChild = null
        this.currentTextLayer = null
        this._hoveredPort = null
        if (this.portArrow) this.portArrow.visible = false
        this.ui.visible = false
        this.domElement.classList.remove('shape-selected')
        this.domElement.style.cursor = ''
        this.two.update()
        this.callbacks.onDeselect()
    }

    resync(): void {
        if (this.currentGroup) {
            this.syncToTarget()
            this.two.update()
        }
    }

    /**
     * Re-apply the theme-resolved stroke to the selection box + handles. Called
     * when the theme toggles so an active selection re-colors live (the stroke
     * is otherwise only computed at _buildUi time). No-op safe when detached.
     */
    applyThemeStroke(): void {
        const stroke = getSelectionStroke()
        if (this.box) this.box.stroke = stroke
        if (this.endpoints) this.endpoints.stroke = stroke
        this.two.update()
    }

    // For CSS-transform move-drags: hand back the selection-chrome SVG node and
    // its base position so the caller can translate the box in lockstep with the
    // element (via a CSS transform) without a full-scene re-render. Returns null
    // when nothing is selected or the chrome isn't mounted yet. `group` guards
    // that the chrome actually belongs to the element being dragged.
    getChromeDragHandle(
        group: GroupLike
    ): { node: SVGGraphicsElement; baseX: number; baseY: number } | null {
        if (!this.currentGroup || this.currentGroup !== group) return null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = (this.ui as any)?._renderer?.elem as
            | SVGGraphicsElement
            | undefined
        if (!node) return null
        return { node, baseX: this.ui.position.x, baseY: this.ui.position.y }
    }

    syncToTarget(): void {
        if (!this.currentGroup || !this.currentShape || !this.currentAdapter)
            return

        const scale = this.zui.scale || 1
        this.box.linewidth = 1.5 / scale
        // Two.Points render with sizeAttenuation=false, so `size` is already a
        // screen-px value (the renderer divides out the scene scale). Set it
        // directly — no /scale — else the dots inflate when zoomed out.
        const handleSize = handleScreenPx(scale)
        this.endpoints.size = handleSize
        this.portHandles.size = handleSize

        const { width, height } = this.currentAdapter.getLocalSize(
            this.currentShape
        )
        const pad = SELECTION_PADDING
        this.box.width = width + pad * 2
        this.box.height = height + pad * 2

        // Standalone text is anchored left/middle at the group origin (the text
        // extends RIGHT from translation.x and is vertically centered on
        // translation.y). The box is centered on `ui`, so shift `ui` right by
        // half the block width to wrap the text instead of sitting left of it.
        // Shapes are centered on their origin, so no offset.
        const anchorOffsetX =
            this.currentAdapter?.resizeMode === 'font' ? width / 2 : 0
        this.ui.position.set(
            this.currentGroup.translation.x + anchorOffsetX,
            this.currentGroup.translation.y
        )
        this.ui.rotation = this.currentGroup.rotation || 0

        const isPortShapeSelected = isPortShape(
            this.currentGroup?.elementData?.componentType
        )
        // Ports only render when the connectors feature flag is on (live).
        const portsOn = isPortShapeSelected && getConnectorsEnabled()
        this.portHandles.visible = portsOn
        if (portsOn) {
            const hw = (width + pad * 2) / 2
            const hh = (height + pad * 2) / 2
            this._halfW = hw
            this._halfH = hh
            // Float the connection ports outside the selection box.
            const portOff = PORT_GAP / scale
            this.portPoints[0]!.set(0, -hh - portOff)
            this.portPoints[1]!.set(hw + portOff, 0)
            this.portPoints[2]!.set(0, hh + portOff)
            this.portPoints[3]!.set(-hw - portOff, 0)
            // Keep a visible port arrow glued to the (possibly resized/zoomed)
            // edge.
            if (this._hoveredPort && this.portArrow.visible) {
                this._positionPortArrow(this._hoveredPort)
            }
        }
    }

    // Place + orient the port arrow just outside `edge` and counter-scale it to
    // a constant screen size.
    private _positionPortArrow(edge: string): void {
        if (!this.portArrow) return
        const scale = this.zui.scale || 1
        // Sit beyond the port (port gap + port radius + a small margin).
        const gap = (PORT_GAP + handleScreenPx(scale) / 2 + 6) / scale
        const hw = this._halfW
        const hh = this._halfH
        let x = 0
        let y = 0
        let rot = 0
        switch (edge) {
            case 'e-resize':
                x = hw + gap
                rot = 0
                break
            case 's-resize':
                y = hh + gap
                rot = Math.PI / 2
                break
            case 'w-resize':
                x = -hw - gap
                rot = Math.PI
                break
            case 'n-resize':
                y = -hh - gap
                rot = -Math.PI / 2
                break
            default:
                return
        }
        this.portArrow.position.set(x, y)
        this.portArrow.rotation = rot
        this.portArrow.scale = 1 / scale
    }

    // Toggle the hover arrow for `edge` (or hide it when null). Only repaints on
    // an actual change so it's cheap to call from the mousemove hover stream.
    private _setHoveredPort(edge: string | null): void {
        if (this._hoveredPort === edge) return
        this._hoveredPort = edge
        if (edge) {
            this._positionPortArrow(edge)
            this.portArrow.visible = true
        } else {
            this.portArrow.visible = false
        }
        this.two.update()
    }

    // ---------- Port radar glow ----------

    // Light (or move) the radar glow over a landable port at `surface` (its
    // floated anchor, in surface coords). Idempotent per position; starts the
    // pulse loop the first time it becomes visible. Pass `targetGroup` (the
    // shape that owns the port) to also draw the dashed skeleton around it. Call
    // `hidePortGlow` once the head leaves every port's range.
    showPortGlow(
        surface: { x: number; y: number },
        targetGroup?: ShapeLike
    ): void {
        if (!this.portGlow || !getConnectorsEnabled()) return
        const scale = this.zui.scale || 1
        this.portGlow.position.set(surface.x, surface.y)
        this.portGlow.scale = 1 / scale
        if (targetGroup) this._showNearbyPortShape(targetGroup)
        this._bringToSceneFront(this.nearbyPortExpectedShape)
        this._bringToSceneFront(this.portGlow)
        if (!this.portGlow.visible) {
            this.portGlow.visible = true
            this._glowStart =
                typeof performance !== 'undefined' ? performance.now() : 0
            // Prime a full-opacity frame so the glow appears instantly — the
            // previous ping may have stopped mid-fade, leaving the ring at ~0
            // opacity, which would otherwise render blank for one frame.
            this._glowRing.radius = GLOW_BASE_RADIUS
            this._glowRing.opacity = 1
            this._glowCore.opacity = 0.3
        }
        // Always ensure the pulse loop is alive. This is robust to a prior run
        // that stopped while `visible` stayed latched, or a swallowed render
        // error that left `_glowRaf` dangling — otherwise the glow would light
        // exactly once and never animate again.
        if (this._glowRaf === null) this._startGlowAnim()
    }

    hidePortGlow(): void {
        const wasVisible = this.portGlow?.visible
        const hadShape = this.nearbyPortExpectedShape?.visible
        if (!wasVisible && !hadShape) return
        if (this.portGlow) this.portGlow.visible = false
        if (this.nearbyPortExpectedShape) {
            this.nearbyPortExpectedShape.visible = false
        }
        this._stopGlowAnim()
        this.two.update()
    }

    // Wrap the radar-target shape with the dashed skeleton, matching its
    // centre, size (+ selection padding), rotation and silhouette (rectangle,
    // ellipse or diamond). Counter-scales the stroke/dashes so they stay crisp
    // at any zoom.
    private _showNearbyPortShape(group: ShapeLike): void {
        const skeleton = this.nearbyPortExpectedShape
        if (!skeleton) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shape = (group as any)?.children?.[0]
        const w = shape?.width ?? group?.elementData?.width ?? 0
        const h = shape?.height ?? group?.elementData?.height ?? 0
        if (!w || !h) {
            skeleton.visible = false
            return
        }
        const scale = this.zui.scale || 1
        const pad = SELECTION_PADDING
        const outerW = w + pad * 2
        const outerH = h + pad * 2

        const componentType = group?.elementData?.componentType
        let outline = this._skeletonRect
        if (componentType === 'circle') {
            outline = this._skeletonEllipse
        } else if (componentType === 'diamond') {
            outline = this._skeletonDiamond
        }

        if (outline === this._skeletonDiamond) {
            const hw = outerW / 2
            const hh = outerH / 2
            outline.vertices[0].set(0, -hh)
            outline.vertices[1].set(hw, 0)
            outline.vertices[2].set(0, hh)
            outline.vertices[3].set(-hw, 0)
        } else {
            outline.width = outerW
            outline.height = outerH
        }
        outline.linewidth = 1.5 / scale
        outline.dashes = [6 / scale, 4 / scale]

        this._skeletonRect.visible = outline === this._skeletonRect
        this._skeletonEllipse.visible = outline === this._skeletonEllipse
        this._skeletonDiamond.visible = outline === this._skeletonDiamond

        skeleton.translation.set(group.translation.x, group.translation.y)
        skeleton.rotation = group.rotation || 0
        skeleton.visible = true
    }

    // rAF loop so the ping keeps animating even when the cursor holds still over
    // a port. Self-cancels when the glow is hidden. `_glowRaf` is cleared at the
    // TOP of each tick so that even if `two.update()` throws (the documented
    // scene.subtractions hazard), the loop can be restarted by the next
    // `showPortGlow` instead of being wedged forever.
    private _startGlowAnim(): void {
        const tick = (): void => {
            this._glowRaf = null
            if (!this.portGlow || !this.portGlow.visible) return
            const now =
                typeof performance !== 'undefined' ? performance.now() : 0
            const cycles = (now - this._glowStart) / GLOW_PERIOD_MS
            const t = cycles - Math.floor(cycles) // 0..1, loops each period
            // Expanding ring that fades as it grows — the "ping".
            this._glowRing.radius = GLOW_BASE_RADIUS * (1 + t * 1.4)
            this._glowRing.opacity = 1 - t
            // Core breathes gently so the port stays alive between pings.
            this._glowCore.opacity =
                0.24 + 0.12 * (0.5 + 0.5 * Math.sin(cycles * Math.PI * 2))
            try {
                this.two.update()
            } catch {
                // A transient renderer hiccup must not kill the pulse loop.
            }
            this._glowRaf = requestAnimationFrame(tick)
        }
        this._glowRaf = requestAnimationFrame(tick)
    }

    private _stopGlowAnim(): void {
        if (this._glowRaf !== null) {
            cancelAnimationFrame(this._glowRaf)
            this._glowRaf = null
        }
    }

    // Push a scene-level overlay element to the top of the draw order so it
    // isn't buried by shapes/connectors. Re-adds it if it somehow left the
    // scene. Shared by the glow and the nearby-port skeleton.
    private _bringToSceneFront(el: ShapeLike): void {
        if (!el) return
        const scene = this.two.scene
        const idx = scene.children.indexOf(el)
        if (idx === -1) {
            this.two.add(el)
            return
        }
        if (idx !== scene.children.length - 1) {
            scene.children.splice(idx, 1)
            scene.children.push(el)
        }
    }

    // ---------- Hit testing ----------

    hitTest(clientX: number, clientY: number): HitResult | null {
        if (!this.currentGroup || !this.ui.visible) return null
        if (this.currentAdapter && !this.currentAdapter.resizable) return null

        const surface = this.zui.clientToSurface(clientX, clientY)
        const scale = this.zui.scale || 1
        // Grab radius is tied to the visible dot (half its diameter) plus a few
        // px of slop, so resize only fires on the dot — not in a bloated zone
        // around it. Constant in screen px at any zoom.
        const hitRadiusPx = handleScreenPx(scale) / 2 + this._hitSlopPx()
        const hitLimit = hitRadiusPx / scale

        // Corners win over edges so the corner-resize/rotate zone isn't shadowed
        // by the full-edge hit band at the box ends.
        const corner = this._atCorner(surface, hitLimit)
        if (corner) {
            const isOnInnerRing = this._withinCornerRadius(
                surface,
                corner,
                hitLimit
            )
            const mode =
                isOnInnerRing && this.rotationEnabled ? 'rotate' : 'scale'
            return { mode, corner }
        }

        const isRect =
            this.currentGroup?.elementData?.componentType === 'rectangle'
        if (isRect) {
            // Resize lives on the edge band only. Ports are connection points,
            // not resize handles, so they're intentionally excluded here.
            const edge = this._atEdge(surface, hitLimit)
            if (edge) return { mode: 'scale', corner: edge }
        }

        return null
    }

    // Public port hit test for the canvas: did this client point land on a
    // connection port? Returns the hovered edge plus the port's anchor in
    // surface coords (where a pulled-out connector's tail should pin). Null when
    // nothing is selected or the cursor isn't over a port.
    hitTestPort(
        clientX: number,
        clientY: number
    ): { edge: string; surface: { x: number; y: number } } | null {
        if (!this.currentGroup || !this.ui.visible) return null
        const surface = this.zui.clientToSurface(clientX, clientY)
        const edge = this._hoveredPortEdge(surface)
        if (!edge) return null
        const edgeToIndex: Record<string, number> = {
            'n-resize': 0,
            'e-resize': 1,
            's-resize': 2,
            'w-resize': 3,
        }
        const idx = edgeToIndex[edge]
        if (idx === undefined) return null
        const anchor = this._vertexToSurface(this.portPoints[idx]!)
        return { edge, surface: { x: anchor.x, y: anchor.y } }
    }

    // Proximity test against the 4 floated connection ports. Gates the port
    // arrow, which must only appear over a port — not along the rest of the edge.
    private _atPort(
        point: { x: number; y: number },
        limit: number
    ): CornerHandle | null {
        const sq = limit * limit
        const ports: CornerHandle[] = [
            { name: 'n-resize', point: this.portPoints[0]! },
            { name: 'e-resize', point: this.portPoints[1]! },
            { name: 's-resize', point: this.portPoints[2]! },
            { name: 'w-resize', point: this.portPoints[3]! },
        ]
        for (const p of ports) {
            const surface = this._vertexToSurface(p.point)
            if (distSq(point.x, point.y, surface.x, surface.y) < sq) return p
        }
        return null
    }

    // Edge name (n/e/s/w-resize) whose port the surface point is hovering, or
    // null. Port shapes only; this is what the port arrow keys off of.
    private _hoveredPortEdge(point: { x: number; y: number }): string | null {
        // Single chokepoint for both hover (port arrow) and `hitTestPort`
        // (pull-out). Off when connectors are disabled.
        if (!getConnectorsEnabled()) return null
        if (!isPortShape(this.currentGroup?.elementData?.componentType)) {
            return null
        }
        const scale = this.zui.scale || 1
        const limit = (handleScreenPx(scale) / 2 + this._hitSlopPx()) / scale
        const port = this._atPort(point, limit)
        return port ? port.name : null
    }

    private _vertexToSurface(v: { x: number; y: number }): {
        x: number
        y: number
    } {
        const rot = this.ui.rotation || 0
        const cos = Math.cos(rot)
        const sin = Math.sin(rot)
        return {
            x: this.ui.position.x + v.x * cos - v.y * sin,
            y: this.ui.position.y + v.x * sin + v.y * cos,
        }
    }

    private _atCorner(
        point: { x: number; y: number },
        limit: number
    ): CornerHandle | null {
        const verts = this.box.vertices
        const sq = limit * limit
        const corners: CornerHandle[] = [
            { name: 'nw-resize', point: verts[0] },
            { name: 'ne-resize', point: verts[1] },
            { name: 'se-resize', point: verts[2] },
            { name: 'sw-resize', point: verts[3] },
        ]
        for (const c of corners) {
            const p = this._vertexToSurface(c.point)
            if (distSq(point.x, point.y, p.x, p.y) < sq) return c
        }
        return null
    }

    // Full-edge hit test: derotate the surface point into box-local space and
    // check whether it sits within `limit` of any of the 4 borders (along the
    // whole edge, not just its midpoint). Corners are handled by `_atCorner`
    // first, so the band ends overlapping corners don't matter here.
    private _atEdge(
        point: { x: number; y: number },
        limit: number
    ): CornerHandle | null {
        const rot = this.ui.rotation || 0
        const dx = point.x - this.ui.position.x
        const dy = point.y - this.ui.position.y
        const cos = Math.cos(-rot)
        const sin = Math.sin(-rot)
        const lx = dx * cos - dy * sin
        const ly = dx * sin + dy * cos
        const hw = this.box.width / 2
        const hh = this.box.height / 2
        const withinX = lx >= -hw - limit && lx <= hw + limit
        const withinY = ly >= -hh - limit && ly <= hh + limit
        if (withinX && Math.abs(ly + hh) <= limit) {
            return { name: 'n-resize', point: this.portPoints[0]! }
        }
        if (withinY && Math.abs(lx - hw) <= limit) {
            return { name: 'e-resize', point: this.portPoints[1]! }
        }
        if (withinX && Math.abs(ly - hh) <= limit) {
            return { name: 's-resize', point: this.portPoints[2]! }
        }
        if (withinY && Math.abs(lx + hw) <= limit) {
            return { name: 'w-resize', point: this.portPoints[3]! }
        }
        return null
    }

    private _withinCornerRadius(
        point: { x: number; y: number },
        corner: CornerHandle,
        limit: number
    ): boolean {
        const p = this._vertexToSurface(corner.point)
        return distSq(point.x, point.y, p.x, p.y) < limit * limit
    }

    // Touch arrives as synthetic mouse events, so the device pointer type is the
    // only signal available — coarse (finger) pointers get a more forgiving slop.
    private _hitSlopPx(): number {
        const coarse =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(pointer: coarse)')?.matches
        return coarse ? HANDLE_HIT_SLOP_TOUCH : HANDLE_HIT_SLOP_MOUSE
    }

    // Is the surface point inside the selection box body (the drag zone)? Uses
    // the same rotation convention as _vertexToSurface, derotated into box space.
    private _withinBody(point: { x: number; y: number }): boolean {
        const rot = this.ui.rotation || 0
        const dx = point.x - this.ui.position.x
        const dy = point.y - this.ui.position.y
        const cos = Math.cos(-rot)
        const sin = Math.sin(-rot)
        const lx = dx * cos - dy * sin
        const ly = dx * sin + dy * cos
        return (
            Math.abs(lx) <= this.box.width / 2 &&
            Math.abs(ly) <= this.box.height / 2
        )
    }

    // ---------- Interaction lifecycle ----------

    beginInteraction(e: MouseEvent, hit: HitResult | null): boolean {
        if (!this.currentGroup || !hit) return false
        // The arrow is a hover-only affordance; drop it once a drag begins.
        this._setHoveredPort(null)
        if (hit.mode === 'scale') return this._beginScale(e, hit.corner)
        if (hit.mode === 'rotate' && this.rotationEnabled) {
            return this._beginRotate(e, hit.corner)
        }
        return false
    }

    private _beginScale(e: MouseEvent, corner: CornerHandle): boolean {
        if (!this.currentAdapter) return false
        const surface = this.zui.clientToSurface(e.clientX, e.clientY)
        const { width, height } = this.currentAdapter.getLocalSize(
            this.currentShape
        )

        this.interaction = {
            mode: 'scale',
            corner,
            startSurface: { x: surface.x, y: surface.y },
            initialWidth: width,
            initialHeight: height,
            initialPosition: {
                x: this.currentGroup.translation.x,
                y: this.currentGroup.translation.y,
            },
            initialRotation: this.currentGroup.rotation || 0,
            initialFontSize: this.currentShape?.size ?? 36,
        }
        this._attachPointerStream()
        return true
    }

    private _beginRotate(e: MouseEvent, corner: CornerHandle): boolean {
        const surface = this.zui.clientToSurface(e.clientX, e.clientY)
        this.interaction = {
            mode: 'rotate',
            corner,
            startSurface: { x: surface.x, y: surface.y },
            initialRotation: this.currentGroup.rotation || 0,
            center: {
                x: this.currentGroup.translation.x,
                y: this.currentGroup.translation.y,
            },
        }
        this._attachPointerStream()
        return true
    }

    private _attachPointerStream(): void {
        this._onMove = (ev): void => this._onPointerMove(ev)
        this._onUp = (ev): void => this._onPointerUp(ev)
        this.domElement.addEventListener('mousemove', this._onMove, false)
        this.domElement.addEventListener('mouseup', this._onUp, false)
    }

    private _detachPointerStream(): void {
        if (this._onMove) {
            this.domElement.removeEventListener(
                'mousemove',
                this._onMove,
                false
            )
            this._onMove = null
        }
        if (this._onUp) {
            this.domElement.removeEventListener('mouseup', this._onUp, false)
            this._onUp = null
        }
    }

    private _attachHoverListener(): void {
        if (this._onHover) return
        this._onHover = (ev): void => {
            if (this.interaction) return
            const surface = this.zui.clientToSurface(ev.clientX, ev.clientY)
            // The arrow is keyed off the port only — not the full-edge resize
            // band — so it pulls out solely when hovering the port.
            const portEdge = this._hoveredPortEdge(surface)
            this._setHoveredPort(portEdge)
            if (portEdge) {
                // Port hover signals "open a path to connect" — not resize.
                this.domElement.style.cursor = 'crosshair'
                return
            }

            const hit = this.hitTest(ev.clientX, ev.clientY)
            if (!hit) {
                // Over the shape body → move (4-way arrow drag cue); empty
                // canvas → default.
                this.domElement.style.cursor = this._withinBody(surface)
                    ? 'move'
                    : ''
                return
            }
            if (hit.mode === 'rotate') {
                this.domElement.style.cursor = 'alias'
                return
            }
            const name = hit.corner?.name
            if (name === 'nw-resize' || name === 'se-resize') {
                this.domElement.style.cursor = 'nwse-resize'
            } else if (name === 'ne-resize' || name === 'sw-resize') {
                this.domElement.style.cursor = 'nesw-resize'
            } else if (name === 'n-resize' || name === 's-resize') {
                this.domElement.style.cursor = 'ns-resize'
            } else if (name === 'e-resize' || name === 'w-resize') {
                this.domElement.style.cursor = 'ew-resize'
            }
        }
        this.domElement.addEventListener('mousemove', this._onHover, false)
    }

    private _detachHoverListener(): void {
        if (!this._onHover) return
        this.domElement.removeEventListener('mousemove', this._onHover, false)
        this._onHover = null
    }

    private _onPointerMove(e: MouseEvent): void {
        if (!this.interaction) return
        if (this.interaction.mode === 'scale') this._scaleMove(e)
        else if (this.interaction.mode === 'rotate') this._rotateMove(e)
    }

    private _scaleMove(e: MouseEvent): void {
        if (!this.interaction || this.interaction.mode !== 'scale') return
        if (!this.currentAdapter) return
        // Standalone text resizes by font size (anchored at its center), not by
        // width/height like shapes.
        if (this.currentAdapter.resizeMode === 'font') {
            this._fontScaleMove(e)
            return
        }
        const {
            corner,
            startSurface,
            initialWidth,
            initialHeight,
            initialPosition,
            initialRotation,
        } = this.interaction
        const surface = this.zui.clientToSurface(e.clientX, e.clientY)

        let deltaX = surface.x - startSurface.x
        let deltaY = surface.y - startSurface.y

        if (initialRotation !== 0) {
            const cos = Math.cos(-initialRotation)
            const sin = Math.sin(-initialRotation)
            const rx = deltaX * cos - deltaY * sin
            const ry = deltaX * sin + deltaY * cos
            deltaX = rx
            deltaY = ry
        }

        let newWidth = initialWidth
        let newHeight = initialHeight
        switch (corner.name) {
            case 'se-resize':
                newWidth = initialWidth + deltaX
                newHeight = initialHeight + deltaY
                break
            case 'sw-resize':
                newWidth = initialWidth - deltaX
                newHeight = initialHeight + deltaY
                break
            case 'ne-resize':
                newWidth = initialWidth + deltaX
                newHeight = initialHeight - deltaY
                break
            case 'nw-resize':
                newWidth = initialWidth - deltaX
                newHeight = initialHeight - deltaY
                break
            case 'n-resize':
                newHeight = initialHeight - deltaY
                break
            case 's-resize':
                newHeight = initialHeight + deltaY
                break
            case 'e-resize':
                newWidth = initialWidth + deltaX
                break
            case 'w-resize':
                newWidth = initialWidth - deltaX
                break
            default:
                break
        }

        let scaleX = newWidth / initialWidth
        let scaleY = newHeight / initialHeight

        const isEdgeOnly = [
            'n-resize',
            's-resize',
            'e-resize',
            'w-resize',
        ].includes(corner.name)
        if (e.shiftKey && !isEdgeOnly) {
            const ratio = Math.min(Math.abs(scaleX), Math.abs(scaleY))
            scaleX = scaleX >= 0 ? ratio : -ratio
            scaleY = scaleY >= 0 ? ratio : -ratio
            newWidth = initialWidth * scaleX
            newHeight = initialHeight * scaleY
        }

        const minW = this.currentAdapter.minWidth ?? MIN_SCALE_DIMENSION
        const minH = this.currentAdapter.minHeight ?? MIN_SCALE_DIMENSION

        // Shape-with-text: width is user-driven, height auto-fits the
        // reflowed lines. The shape may be squeezed until each line holds
        // just its widest single character (1 char/line) — but no further.
        const meta = this.currentGroup?.elementData?.metadata
        const rawText =
            meta && typeof meta.textContent === 'string' ? meta.textContent : ''
        const hasShapeText =
            !!this.currentTextLayer && !!meta?.hasText && rawText.length > 0

        if (hasShapeText) {
            const kind = this.currentGroup?.elementData?.componentType
            const { style, font } = shapeTextStyleFromMeta(meta)
            const textMinW = minShapeWidthForText(kind, rawText, font)
            if (Math.abs(newWidth) < Math.max(minW, textMinW)) return

            const reflow = reflowTextForShape(
                kind,
                Math.abs(newWidth),
                rawText,
                font
            )
            // Force the height to fit the wrapped lines (auto vertical
            // adjust), preserving the drag direction's sign.
            const signH = newHeight < 0 ? -1 : 1
            newHeight =
                signH * Math.max(Math.abs(newHeight), reflow.requiredHeight)
            // Recompute scales so the anchored corner stays put for the
            // (possibly taller) shape.
            scaleX = newWidth / initialWidth
            scaleY = newHeight / initialHeight

            renderShapeTextLayer(
                this.two,
                this.currentGroup,
                reflow.lines,
                style
            )
        } else if (Math.abs(newWidth) < minW || Math.abs(newHeight) < minH) {
            return
        }

        const anchorOffsetX = (initialWidth * (scaleX - 1)) / 2
        const anchorOffsetY = (initialHeight * (scaleY - 1)) / 2

        let adjustX = 0
        let adjustY = 0
        switch (corner.name) {
            case 'nw-resize':
                adjustX = -anchorOffsetX
                adjustY = -anchorOffsetY
                break
            case 'ne-resize':
                adjustX = anchorOffsetX
                adjustY = -anchorOffsetY
                break
            case 'sw-resize':
                adjustX = -anchorOffsetX
                adjustY = anchorOffsetY
                break
            case 'se-resize':
                adjustX = anchorOffsetX
                adjustY = anchorOffsetY
                break
            case 'n-resize':
                adjustX = 0
                adjustY = -anchorOffsetY
                break
            case 's-resize':
                adjustX = 0
                adjustY = anchorOffsetY
                break
            case 'e-resize':
                adjustX = anchorOffsetX
                adjustY = 0
                break
            case 'w-resize':
                adjustX = -anchorOffsetX
                adjustY = 0
                break
            default:
                break
        }

        let nextX: number, nextY: number
        if (initialRotation !== 0) {
            const cos = Math.cos(initialRotation)
            const sin = Math.sin(initialRotation)
            nextX = initialPosition.x + (adjustX * cos - adjustY * sin)
            nextY = initialPosition.y + (adjustX * sin + adjustY * cos)
        } else {
            nextX = initialPosition.x + adjustX
            nextY = initialPosition.y + adjustY
        }

        if (e.altKey) {
            nextX = initialPosition.x
            nextY = initialPosition.y
        }

        this.currentAdapter.applySize(this.currentShape, newWidth, newHeight)
        this.currentGroup.translation.set(nextX, nextY)
        this.syncToTarget()
        this.two.update()
        this.callbacks.onTransform(this.currentGroup)
    }

    // Font-size resize for standalone text: scale the size by how far the
    // cursor moved relative to the block's center (mirrors the old per-element
    // interactjs handle). Anchored at the center, so the block never translates.
    private _fontScaleMove(e: MouseEvent): void {
        if (!this.interaction || this.interaction.mode !== 'scale') return
        const { startSurface, initialPosition, initialFontSize, initialWidth } =
            this.interaction
        // Text is anchored left/middle at the group origin, so its visual center
        // is offset right by half the block width. Anchor the scaling there
        // (mirrors the old per-element resize which keyed off the text center).
        const center = {
            x: initialPosition.x + (initialWidth ?? 0) / 2,
            y: initialPosition.y,
        }
        const surface = this.zui.clientToSurface(e.clientX, e.clientY)
        const startDist = Math.hypot(
            startSurface.x - center.x,
            startSurface.y - center.y
        )
        const curDist = Math.hypot(surface.x - center.x, surface.y - center.y)
        const factor = curDist / Math.max(startDist, 1)
        const base = initialFontSize ?? 36
        const newSize = Math.round(Math.min(Math.max(base * factor, 8), 300))
        this._applyTextFontSize(this.currentGroup, newSize)
        this.syncToTarget()
        this.two.update()
        this.callbacks.onTransform(this.currentGroup)
    }

    // Resize every line node to `size` and re-stack the block at the new line
    // height, vertically centered on the group origin. Matches newText's
    // syncMultilineLayout so the live scene and a reload render identically.
    private _applyTextFontSize(group: ShapeLike, size: number): void {
        const nodes = getShapeTextNodes(group)
        const n = nodes.length
        const lineH = lineHeightFor(size)
        nodes.forEach((nd, i) => {
            nd.size = size
            nd.leading = size
            nd.translation.set(0, (i - (n - 1) / 2) * lineH)
        })
        // Re-fit the transparent gap hit area to the resized block so the text
        // stays selectable across the whole block after a font resize.
        syncTextHitRect(this.two, group)
    }

    private _rotateMove(e: MouseEvent): void {
        if (!this.interaction || this.interaction.mode !== 'rotate') return
        const { center, startSurface, initialRotation } = this.interaction
        const surface = this.zui.clientToSurface(e.clientX, e.clientY)
        const startAngle = Math.atan2(
            startSurface.y - center.y,
            startSurface.x - center.x
        )
        const currentAngle = Math.atan2(
            surface.y - center.y,
            surface.x - center.x
        )
        this.currentGroup.rotation =
            initialRotation + (currentAngle - startAngle)
        this.syncToTarget()
        this.two.update()
        this.callbacks.onTransform(this.currentGroup)
    }

    private _onPointerUp(_e: MouseEvent): void {
        if (!this.interaction) {
            this._detachPointerStream()
            return
        }

        const componentId = this.currentGroup?.elementData?.id
        if (
            this.interaction.mode === 'scale' &&
            componentId &&
            this.currentAdapter
        ) {
            const { width, height } = this.currentAdapter.getLocalSize(
                this.currentShape
            )
            const patch: {
                width: number
                height: number
                x: number
                y: number
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                metadata?: Record<string, any>
            } = {
                width: parseInt(String(width)),
                height: parseInt(String(height)),
                x: parseInt(String(this.currentGroup.translation.x)),
                y: parseInt(String(this.currentGroup.translation.y)),
            }
            // Font resize (text): persist the new size + the multiline content
            // so a reload restores the resized block.
            if (this.currentAdapter.resizeMode === 'font') {
                const nodes = getShapeTextNodes(this.currentGroup)
                const size = this.currentShape?.size
                const meta = this.currentGroup?.elementData?.metadata || {}
                const newMeta = {
                    ...meta,
                    fontSize: size,
                    content: nodes.map((nd) => nd?.value ?? '').join('\n'),
                }
                patch.metadata = newMeta
                if (this.currentGroup.elementData) {
                    this.currentGroup.elementData.metadata = newMeta
                }
            }
            this.callbacks.commit(componentId, patch)
        }

        this.interaction = null
        this._detachPointerStream()
    }
}
