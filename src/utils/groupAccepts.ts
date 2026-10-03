// Which element types accept each group-editable property. Shared by
// applyGroupProperty (writes) and groupInspect (reads the toolbar's current
// values) so the two can't drift apart.

export type GroupPropertyKey =
    | 'fill'
    | 'stroke'
    | 'linewidth'
    | 'strokeType'
    | 'opacity'
    | 'textColor'
    | 'textSize'
    | 'textFontFamily'

// Line-like types style their line path, not the whole Two.js group: the
// group also holds endpoint circles that must keep their own look.
export const LINE_LIKE_GROUP_TYPES = new Set([
    'arrowLine',
    'line',
    'curvedLine',
])

const SHAPES = ['rectangle', 'circle', 'diamond']
const SHAPES_WITH_TEXT = [
    'newText',
    'geoText',
    'rectangle',
    'diamond',
    'circle',
]

export const GROUP_PROPERTY_ACCEPTS: Record<GroupPropertyKey, Set<string>> = {
    // Standalone text (newText/geoText) has no background-fill concept. Its
    // color is `textColor`, so a group fill leaves text untouched.
    fill: new Set(SHAPES),
    stroke: new Set([...SHAPES, ...LINE_LIKE_GROUP_TYPES, 'pencil']),
    linewidth: new Set([...SHAPES, ...LINE_LIKE_GROUP_TYPES, 'pencil']),
    strokeType: new Set([
        ...SHAPES,
        ...LINE_LIKE_GROUP_TYPES,
        'divider',
        'pencil',
    ]),
    // Opacity persists in the top-level `opacity` column for every type
    // (pencil's metadata is its vertex array, so it can't live there).
    opacity: new Set([
        ...SHAPES,
        ...LINE_LIKE_GROUP_TYPES,
        'newText',
        'geoText',
        'pencil',
    ]),
    // rectangle, diamond and circle all carry text the same way (see
    // applyShapeText), so a group text edit must reach every one of them.
    textColor: new Set(SHAPES_WITH_TEXT),
    textSize: new Set(SHAPES_WITH_TEXT),
    textFontFamily: new Set(SHAPES_WITH_TEXT),
}
