// One-time rename of browser-storage keys from before every key started with
// `craftbase_` (see constants/misc.ts). Runs on app startup only; the npm
// embed never wrote the old names.
//
// For each old → new pair: if the old key exists, copy its value to the new
// key (unless the new key is already set), then delete the old key. Old keys
// that were only ever transient (cleared on every board mount) are copied the
// same way; it's harmless and keeps the rule simple.
import {
    ARROW_DRAW_MODE_KEY,
    DISPLACEMENT_X_KEY,
    DISPLACEMENT_Y_KEY,
    ELEMENT_DEFAULTS_KEY,
    ERASER_SIZE_KEY,
    GEO_DRAW_MODE_KEY,
    GEO_DRAW_PROPS_KEY,
    GEO_DRAW_TYPE_KEY,
    GEO_POINT_PLACE_MODE_KEY,
    LAST_ADDED_ELEMENT_ID_KEY,
    LAST_OPEN_BOARD_KEY,
    PAN_MODE_KEY,
    PENCIL_MODE_KEY,
    PENDING_SHAPE_PROPS_KEY,
    PENDING_SHAPE_TYPE_KEY,
    RUBBER_MODE_KEY,
    TABS_OPEN_KEY_PREFIX,
    TEXT_DRAW_MODE_KEY,
    THEME_KEY,
    USER_ID_KEY,
} from '../constants/misc'

export const LEGACY_KEY_RENAMES: ReadonlyArray<readonly [string, string]> = [
    // Real user data / preferences.
    ['userId', USER_ID_KEY],
    ['cb-theme', THEME_KEY],
    ['craftbase:elementDefaults', ELEMENT_DEFAULTS_KEY],
    ['lastOpenBoard', LAST_OPEN_BOARD_KEY],
    ['eraserSize', ERASER_SIZE_KEY],
    // Transient tool state.
    ['rubberMode', RUBBER_MODE_KEY],
    ['arrowDrawMode', ARROW_DRAW_MODE_KEY],
    ['textDrawMode', TEXT_DRAW_MODE_KEY],
    ['pendingShapeType', PENDING_SHAPE_TYPE_KEY],
    ['pendingShapeProps', PENDING_SHAPE_PROPS_KEY],
    ['lastAddedElementId', LAST_ADDED_ELEMENT_ID_KEY],
    ['pencilMode', PENCIL_MODE_KEY],
    ['panMode', PAN_MODE_KEY],
    ['geoDrawMode', GEO_DRAW_MODE_KEY],
    ['geoDrawType', GEO_DRAW_TYPE_KEY],
    ['geoDrawProps', GEO_DRAW_PROPS_KEY],
    ['geoPointPlaceMode', GEO_POINT_PLACE_MODE_KEY],
    ['displacement_x', DISPLACEMENT_X_KEY],
    ['displacement_y', DISPLACEMENT_Y_KEY],
]

// Old names with no successor: just removed.
const LEGACY_KEYS_TO_DROP = ['__craftbase_fit_probe__']

const LEGACY_TABS_OPEN_PREFIX = 'tabs_open_'

function moveKey(ls: Storage, from: string, to: string): void {
    const value = ls.getItem(from)
    if (value === null) return
    if (ls.getItem(to) === null) ls.setItem(to, value)
    ls.removeItem(from)
}

export function migrateLegacyStorageKeys(): void {
    let ls: Storage
    try {
        ls = window.localStorage
    } catch {
        return
    }
    try {
        for (const [from, to] of LEGACY_KEY_RENAMES) moveKey(ls, from, to)
        for (const key of LEGACY_KEYS_TO_DROP) ls.removeItem(key)

        const tabCounters: string[] = []
        for (let i = 0; i < ls.length; i++) {
            const k = ls.key(i)
            if (k?.startsWith(LEGACY_TABS_OPEN_PREFIX)) tabCounters.push(k)
        }
        for (const k of tabCounters) {
            moveKey(
                ls,
                k,
                TABS_OPEN_KEY_PREFIX + k.slice(LEGACY_TABS_OPEN_PREFIX.length)
            )
        }
    } catch {
        // Quota or access errors: leave the old keys; the app still works,
        // it just won't see the old values.
    }
}
