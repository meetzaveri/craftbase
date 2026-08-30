// Per-base base-type persistence.
//
// Mirrors the viewport-key pattern (`craftbase_viewport_<baseId>`): one key per
// base, a `savedAt` stamp, and the shared TTL sweep in base.tsx. Two rules this
// module exists to enforce:
//
//   1. Absent or unreadable entry → DEFAULT_BASE_TYPE. A base created before
//      base types existed has no key, so it opens on the board base, exactly as
//      it always did.
//   2. No write on read. Only an explicit user switch calls
//      `writeBaseTypeConfig`, which keeps untouched bases byte-identical in
//      localStorage.

import { BASE_TYPE_KEY_PREFIX, VIEWPORT_TTL_MS } from '../constants/misc'
import { isBaseType } from './registry'
import { DEFAULT_BASE_TYPE } from './types'
import type { BaseTypeConfig, MapAnchor } from './types'

interface StoredBaseTypeConfig extends BaseTypeConfig {
    savedAt: number
}

function keyFor(baseId: string): string {
    return `${BASE_TYPE_KEY_PREFIX}${baseId}`
}

function isMapAnchor(value: unknown): value is MapAnchor {
    if (!value || typeof value !== 'object') return false
    const anchor = value as Partial<MapAnchor>
    return (
        Array.isArray(anchor.lngLat) &&
        anchor.lngLat.length === 2 &&
        anchor.lngLat.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
        typeof anchor.zoom === 'number' &&
        Number.isFinite(anchor.zoom)
    )
}

/**
 * Read a base's persisted type. Returns the default config for anything
 * missing, expired, malformed or hand-edited — never throws, because a bad
 * entry here must not be able to stop a base from opening.
 */
export function readBaseTypeConfig(baseId: string): BaseTypeConfig {
    const fallback: BaseTypeConfig = { type: DEFAULT_BASE_TYPE, mapAnchor: null }
    if (!baseId) return fallback

    try {
        const raw = localStorage.getItem(keyFor(baseId))
        if (!raw) return fallback

        const parsed = JSON.parse(raw) as Partial<StoredBaseTypeConfig>
        if (
            !parsed.savedAt ||
            Date.now() - parsed.savedAt > VIEWPORT_TTL_MS ||
            !isBaseType(parsed.type)
        ) {
            localStorage.removeItem(keyFor(baseId))
            return fallback
        }

        return {
            type: parsed.type,
            mapAnchor: isMapAnchor(parsed.mapAnchor) ? parsed.mapAnchor : null,
        }
    } catch {
        // Corrupt entry — drop it and open on the default base.
        try {
            localStorage.removeItem(keyFor(baseId))
        } catch {
            // localStorage unavailable (private mode); nothing to clean up.
        }
        return fallback
    }
}

/**
 * Persist a base's type. Call only from an explicit user action — see rule 2
 * above. A quota failure is swallowed: losing the base preference is a far
 * better outcome than blocking the switch the user just asked for.
 */
export function writeBaseTypeConfig(baseId: string, config: BaseTypeConfig): void {
    if (!baseId) return
    try {
        const payload: StoredBaseTypeConfig = {
            type: config.type,
            mapAnchor: config.mapAnchor ?? null,
            savedAt: Date.now(),
        }
        localStorage.setItem(keyFor(baseId), JSON.stringify(payload))
    } catch {
        // Quota / private mode — the switch still applies for this session.
    }
}
