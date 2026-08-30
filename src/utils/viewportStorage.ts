// Per-base, per-base-type viewport persistence.
//
// Each base type is its own workspace, so it keeps its own camera: panning
// around a map must not drag the whiteboard's view with it, and vice versa.
// Switching type therefore restores that type's last camera rather than
// carrying the current one across.
//
// Key shape: `craftbase_viewport_<baseId>` for the board type and
// `craftbase_viewport_<baseId>__<type>` for every other type. The board type
// deliberately keeps the *unsuffixed* key, so viewports saved before base types
// existed still restore — no migration, no reset. This is also why the rename
// left these keys alone: they never carried the word "board" to begin with.

import {
    VIEWPORT_KEY_PREFIX,
    MOBILE_VIEWPORT_KEY_PREFIX,
    VIEWPORT_TTL_MS,
} from '../constants/misc'
import { DEFAULT_BASE_TYPE } from '../baseTypes/types'
import type { BaseType } from '../baseTypes/types'

export interface StoredViewport {
    scale: number
    tx: number
    ty: number
}

interface RawViewport extends StoredViewport {
    savedAt: number
}

/**
 * Storage key for a base's camera on a given baseType. Desktop and mobile keep
 * separate cameras (they have very different usable viewports), which is why
 * the prefix differs rather than the suffix.
 */
export function viewportKeyFor(
    baseId: string,
    baseType: BaseType,
    isMobile: boolean
): string {
    const prefix = isMobile ? MOBILE_VIEWPORT_KEY_PREFIX : VIEWPORT_KEY_PREFIX
    return baseType === DEFAULT_BASE_TYPE
        ? `${prefix}${baseId}`
        : `${prefix}${baseId}__${baseType}`
}

/** Read a baseType's saved camera, or null when absent, expired or malformed. */
export function readViewport(
    baseId: string,
    baseType: BaseType,
    isMobile: boolean
): StoredViewport | null {
    if (!baseId) return null
    const key = viewportKeyFor(baseId, baseType, isMobile)
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<RawViewport>
        if (!parsed.savedAt || Date.now() - parsed.savedAt > VIEWPORT_TTL_MS) {
            localStorage.removeItem(key)
            return null
        }
        const { scale, tx, ty } = parsed
        if (
            !Number.isFinite(scale) ||
            !Number.isFinite(tx) ||
            !Number.isFinite(ty) ||
            (scale as number) <= 0
        ) {
            localStorage.removeItem(key)
            return null
        }
        return {
            scale: scale as number,
            tx: tx as number,
            ty: ty as number,
        }
    } catch {
        return null
    }
}

/** Persist a baseType's camera. Swallows quota/private-mode failures. */
export function writeViewport(
    baseId: string,
    baseType: BaseType,
    isMobile: boolean,
    viewport: StoredViewport
): void {
    if (!baseId) return
    try {
        localStorage.setItem(
            viewportKeyFor(baseId, baseType, isMobile),
            JSON.stringify({ ...viewport, savedAt: Date.now() })
        )
    } catch {
        // Losing a camera preference must never block the interaction.
    }
}

/** The camera a baseType opens on when it has nothing saved. */
export const IDENTITY_VIEWPORT: StoredViewport = { scale: 1, tx: 0, ty: 0 }
