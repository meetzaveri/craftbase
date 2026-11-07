import {
    ARROW_DRAW_MODE_KEY,
    TEXT_DRAW_MODE_KEY,
    PENDING_SHAPE_TYPE_KEY,
    PENDING_SHAPE_PROPS_KEY,
    LAST_ADDED_ELEMENT_ID_KEY,
    RUBBER_MODE_KEY,
    PENCIL_MODE_KEY,
    PAN_MODE_KEY,
} from '../constants/misc'
import { cbStorage } from './storage'

export function getArrowDrawMode(): string | null {
    return cbStorage.getItem(ARROW_DRAW_MODE_KEY)
}

export function getTextDrawMode(): string | null {
    return cbStorage.getItem(TEXT_DRAW_MODE_KEY)
}

export function getPendingShapeType(): string | null {
    return cbStorage.getItem(PENDING_SHAPE_TYPE_KEY)
}

export function getPendingShapeProps(): string | null {
    return cbStorage.getItem(PENDING_SHAPE_PROPS_KEY)
}

export function getLastAddedElementId(): string | null {
    return cbStorage.getItem(LAST_ADDED_ELEMENT_ID_KEY)
}

export function clearAllDrawModes(): void {
    cbStorage.removeItem(ARROW_DRAW_MODE_KEY)
    cbStorage.removeItem(TEXT_DRAW_MODE_KEY)
    cbStorage.removeItem(PENDING_SHAPE_TYPE_KEY)
    cbStorage.removeItem(PENDING_SHAPE_PROPS_KEY)
    cbStorage.removeItem(LAST_ADDED_ELEMENT_ID_KEY)
    cbStorage.removeItem(RUBBER_MODE_KEY)
    cbStorage.removeItem(PENCIL_MODE_KEY)
    cbStorage.removeItem(PAN_MODE_KEY)
}

export function isPanMode(): boolean {
    return cbStorage.getItem(PAN_MODE_KEY) === 'true'
}

// Returns true when the user is in normal select/pan mode (no draw tool active).
export function isSelectPanMode(isPencilMode: boolean): boolean {
    return (
        !isPencilMode &&
        getArrowDrawMode() !== 'true' &&
        getTextDrawMode() !== 'true' &&
        getPendingShapeType() === null &&
        cbStorage.getItem(RUBBER_MODE_KEY) !== 'true'
    )
}
