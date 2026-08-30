import type { FunctionComponent, SVGProps } from 'react'
import CircleIcon from '../wireframeAssets/circle.svg?react'
import RectangleIcon from '../wireframeAssets/rectangle.svg?react'
import DiamondIcon from '../wireframeAssets/diamond.svg?react'
import LineIcon from '../wireframeAssets/line.svg?react'
import CurvedLineIcon from '../wireframeAssets/curvedLine.svg?react'
import ShapesIcon from '../wireframeAssets/shapes.svg?react'
import TextIcon from '../wireframeAssets/text.svg?react'
import PencilIcon from '../wireframeAssets/pencil.svg?react'
import PointerIcon from '../wireframeAssets/cursor.svg?react'
import EraserIcon from '../wireframeAssets/eraser.svg?react'

import RightArrowIcon from '../assets/right_arrow.svg?react'
import PanIcon from '../assets/pan.svg?react'

import PinIcon from '../wireframeAssets/pin.svg?react'
import PolygonIcon from '../wireframeAssets/polygon.svg?react'
import PolylineIcon from '../wireframeAssets/polyline.svg?react'

type SvgComponent = FunctionComponent<SVGProps<SVGSVGElement>>

export const color_blue = '#0052CC'
export const color_teal = '#008DA6'
export const color_green = '#006644'
export const color_red = '#BF2600'
export const color_slate = '#091E42'

export const properties = {
    colorBg: 'color_bg',
    colorText: 'color_text',
    colorIcon: 'color_icon',
    fontSize: 'font_size',
    fontWeight: 'font_weight',
    alignment: 'alignment',
    borderColor: 'border_color',
    borderWidth: 'border_width',
    borderStyle: 'border_style',
    underline: 'underline',
    opacity: 'opacity',
} as const

export const allColorShades: string[] = [
    '#FFFFFF',
    '#000000',
    '#DE350B',
    '#FF5630',
    '#FF7452',
    '#FF8F73',
    '#FFBDAD',
    '#FFEBE6',

    '#FF991F',
    '#FFAB00',
    '#FFC400',
    '#FFE380',
    '#FFF0B3',
    '#FFFAE6',

    '#00875A',
    '#36B37E',
    '#57D9A3',
    '#79F2C0',
    '#ABF5D1',
    '#E3FCEF',

    '#00A3BF',
    '#00B8D9',
    '#00C7E6',
    '#79E2F2',
    '#B3F5FF',
    '#E6FCFF',

    '#0052CC',
    '#0065FF',
    '#2684FF',
    '#4C9AFF',
    '#B3D4FF',
    '#DEEBFF',

    '#5243AA',
    '#6554C0',
    '#8777D9',
    '#998DD9',
    '#C0B6F2',
    '#EAE6FF',

    // Brown — 6 shades, light → dark.
    '#EAD9C5',
    '#D2B089',
    '#B5824E',
    '#8C5A2B',
    '#5E3A1A',
    '#3D2410',

    '#172B4D',
    '#253858',
    '#42526E',
    '#5E6C84',
    '#7A869A',
    '#97A0AF',

    '#BF2600',
    '#FF8B00',
    '#006644',
    '#008DA6',
    '#0747A6',
    '#403294',
]

// Fully transparent fill ("none"). Browsers accept rgba() in SVG
// presentation attributes, so Two.js renders this as no paint.
export const TRANSPARENT_FILL = 'rgba(0,0,0,0.0)'

export const essentialShades: string[] = [
    '#FFFFFF',
    '#000000',
    '#FF5630',
    '#FFAB00',
    '#36B37E',
    '#0065FF',
]

// Fill picker only — transparent ("no fill") and white kept, followed by light
// pastel shades suited to fills (vs. the saturated stroke/text essentialShades).
export const fillEssentialShades: string[] = [
    TRANSPARENT_FILL,
    '#FFFFFF',
    '#FFBDAD',
    '#FFF0B3',
    '#ABF5D1',
    '#B3D4FF',
]

// Point fills only — deliberately the saturated stroke row, not the pastel
// `fillEssentialShades` above.
//
// A pastel is right for a shape fill: it sits behind text and must not compete
// with it. A point is the opposite — a ~10px dot that has to be findable against
// CARTO Positron's pale greys and beiges, where a pastel disappears. That makes
// a point's fill behave like ink, so it takes ink's palette. Transparent goes
// too: black is far more use on a light basemap than an invisible pin.
//
// Aliased rather than inlined so the two can diverge in one edit, and so the
// call site says which row it means.
export const pointFillEssentialShades: string[] = essentialShades

export interface DrawerElement {
    elementName: string
    elementDisplayName: string
    elementIcon: SvgComponent
}

export interface PrimaryElement {
    elementName: string
    elementDisplayName: string
    elementIcon: SvgComponent
    hasDrawer: boolean
    noAction: boolean
    drawerData: DrawerElement[]
}

export interface PrimarySection {
    sectionName: string
    elements: PrimaryElement[]
}

export const staticPrimaryElementData: PrimarySection[] = [
    {
        sectionName: 'Basic',
        elements: [
            {
                elementName: 'pointer',
                elementDisplayName: 'Select',
                elementIcon: PointerIcon,
                hasDrawer: false,
                noAction: true,
                drawerData: [],
            },
            {
                elementName: 'pan',
                elementDisplayName: 'Pan',
                elementIcon: PanIcon,
                hasDrawer: false,
                noAction: true,
                drawerData: [],
            },
            {
                elementName: 'shapes',
                elementDisplayName: 'Shapes',
                elementIcon: ShapesIcon,
                hasDrawer: true,
                noAction: true,
                drawerData: [
                    {
                        elementName: 'rectangle',
                        elementDisplayName: 'Rectangle / Square',
                        elementIcon: RectangleIcon,
                    },
                    {
                        elementName: 'circle',
                        elementDisplayName: 'Circle',
                        elementIcon: CircleIcon,
                    },
                    {
                        elementName: 'diamond',
                        elementDisplayName: 'Diamond',
                        elementIcon: DiamondIcon,
                    },
                ],
            },
            {
                // Lines live behind their own drawer (main icon = straight line);
                // clicking it opens a secondary drawer to pick line vs. curved
                // line. Unlike 'shapes', this drawer is NOT flattened on desktop
                // (see flattenShapesForDesktop), so it stays a drawer on both
                // desktop and mobile.
                elementName: 'lines',
                elementDisplayName: 'Lines',
                elementIcon: LineIcon,
                hasDrawer: true,
                noAction: true,
                drawerData: [
                    {
                        elementName: 'line',
                        elementDisplayName: 'Line',
                        elementIcon: LineIcon,
                    },
                    {
                        elementName: 'curvedLine',
                        elementDisplayName: 'Curved line',
                        elementIcon: CurvedLineIcon,
                    },
                ],
            },
            {
                elementName: 'arrowLine',
                elementDisplayName: 'Arrow',
                elementIcon: RightArrowIcon,
                hasDrawer: false,
                noAction: false,
                drawerData: [],
            },
            {
                elementName: 'pencil',
                elementDisplayName: 'Pencil',
                elementIcon: PencilIcon,
                hasDrawer: false,
                noAction: false,
                drawerData: [],
            },
            {
                elementName: 'text',
                elementDisplayName: 'Text',
                elementIcon: TextIcon,
                hasDrawer: false,
                noAction: false,
                drawerData: [],
            },
            {
                elementName: 'rubber',
                elementDisplayName: 'Eraser',
                elementIcon: EraserIcon,
                hasDrawer: false,
                noAction: true,
                drawerData: [],
            },
        ],
    },
]

// Geo tools (point / area+circle / route / text). Appended to the toolbar by
// the active base type's `extraTools` — see mapType.ts — after `hiddenTools`
// has stripped the board tools, which is why the circle entry below survives
// even though 'circle' is in GEO_HIDDEN_TOOLS.
export const geoElementData: PrimaryElement[] = [
    {
        elementName: 'point',
        elementDisplayName: 'Point',
        elementIcon: PinIcon,
        hasDrawer: false,
        noAction: false,
        drawerData: [],
    },
    {
        // Area + Circle share one slot. On desktop this is flattened into two
        // flat buttons (see DESKTOP_FLATTENED_DRAWERS in shapesToolbar); on
        // mobile it stays a drawer, whose trigger shows the circle icon.
        //
        // The circle child keeps elementName 'circle' — the same name the
        // whiteboard tool uses — because that is what buys the reuse:
        // addElement('circle') already lands on the drag-to-draw path. What
        // makes it a map object is objectClass: 'geo', stamped at creation in
        // primary.tsx, exactly as the pencil does.
        elementName: 'geoShapes',
        elementDisplayName: 'Shapes',
        elementIcon: CircleIcon,
        hasDrawer: true,
        noAction: true,
        drawerData: [
            {
                elementName: 'area',
                elementDisplayName: 'Area',
                elementIcon: PolygonIcon,
            },
            {
                elementName: 'circle',
                elementDisplayName: 'Circle',
                elementIcon: CircleIcon,
            },
        ],
    },
    {
        elementName: 'route',
        elementDisplayName: 'Route',
        elementIcon: PolylineIcon,
        hasDrawer: false,
        noAction: false,
        drawerData: [],
    },
    {
        // Map text (see geoText.tsx): renders like the standard Text element
        // but belongs to the map base. Replaces the Text tool in geo mode.
        elementName: 'geoText',
        elementDisplayName: 'Text',
        elementIcon: TextIcon,
        hasDrawer: false,
        noAction: false,
        drawerData: [],
    },
]

export interface TextSizeEntry {
    label: 'S' | 'M' | 'L' | 'XL'
    value: number
    mobileValue: number
}

export const TEXT_SIZES_ARRAY: TextSizeEntry[] = [
    { label: 'S', value: 24, mobileValue: 12 },
    { label: 'M', value: 36, mobileValue: 18 },
    { label: 'L', value: 60, mobileValue: 28 },
    { label: 'XL', value: 72, mobileValue: 36 },
]

export const TEXT_SIZES_OBJECT = {
    S: 24,
    M: 36,
    L: 60,
    XL: 72,
} as const

export const MOBILE_TEXT_SIZES_OBJECT = {
    S: 12,
    M: 18,
    L: 28,
    XL: 36,
} as const
