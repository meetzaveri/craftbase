// One-shot localStorage migration for the board → base rename.
//
// The rename made `base` the workspace and `baseType` the substrate. Two keys
// carried the old vocabulary in their *names*, and the draft blob carried it in
// its *contents*. This module moves both, once, at boot — so a user who drew a
// canvas on the previous build opens the new one and finds their work intact.
//
// Two rules it exists to enforce:
//
//   1. **Run once.** Guarded by `craftbase_storage_version`. After it runs there
//      is no fallback branch anywhere else in the app: every read path speaks
//      only the new vocabulary. Bump STORAGE_VERSION for any future rename and
//      add a step below.
//   2. **Never block boot.** Every step is independently try/caught. A corrupt
//      or hand-edited entry must cost the user that one entry, not the app.
//
// Deliberately NOT migrated, because their names never contained the token:
// `craftbase_viewport_*`, `craftbase_mobile_viewport_*`, `craftbase_local_draft`
// (key kept, contents remapped), `craftbase_saved_colors`,
// `craftbase:elementDefaults`, `cb-theme`, and the `craftbase_*_enabled` flags.
//
// One field is out of reach here and is handled by a read-side fallback instead:
// `metadata.baseScope` lives on rows already persisted to Hasura. See
// `scopedBaseType` in geoVisibility.ts.

import {
    STORAGE_VERSION,
    STORAGE_VERSION_KEY,
    DRAFT_STORAGE_KEY,
    BACKGROUND_BASE_STORAGE_KEY,
    BASE_TYPE_KEY_PREFIX,
} from '../constants/misc'

/** Pre-rename key names, kept only here. Nothing else may reference them. */
const LEGACY_BASE_TYPE_KEY_PREFIX = 'craftbase_base_'
const LEGACY_BACKGROUND_BASE_KEY = 'craftbase_background_board_id'
const LEGACY_LAST_OPEN_KEY = 'lastOpenBoard'

/** Run `step`, swallowing any failure so one bad entry can't stop the rest. */
function safely(step: () => void): void {
    try {
        step()
    } catch {
        // A single unreadable entry is not worth failing the boot over.
    }
}

/**
 * `craftbase_base_<id>` → `craftbase_base_type_<id>`, reshaping the payload's
 * `base` field to `type` to match both `BaseTypeConfig` and the DB column.
 *
 * The legacy prefix is a strict prefix of the new one, so the scan must skip
 * keys that already carry the new shape or it would re-migrate its own output.
 */
function migrateBaseTypeKeys(): void {
    const legacy = Object.keys(localStorage).filter(
        (k) =>
            k.startsWith(LEGACY_BASE_TYPE_KEY_PREFIX) &&
            !k.startsWith(BASE_TYPE_KEY_PREFIX)
    )
    legacy.forEach((oldKey) => {
        safely(() => {
            const raw = localStorage.getItem(oldKey)
            localStorage.removeItem(oldKey)
            if (!raw) return
            const id = oldKey.slice(LEGACY_BASE_TYPE_KEY_PREFIX.length)
            if (!id) return
            const parsed = JSON.parse(raw) as Record<string, unknown>
            const { base, ...rest } = parsed
            localStorage.setItem(
                `${BASE_TYPE_KEY_PREFIX}${id}`,
                JSON.stringify({ ...rest, type: base ?? rest.type })
            )
        })
    })
}

/** `craftbase_background_board_id` → `craftbase_background_base_id`. */
function migrateBackgroundBaseKey(): void {
    const value = localStorage.getItem(LEGACY_BACKGROUND_BASE_KEY)
    localStorage.removeItem(LEGACY_BACKGROUND_BASE_KEY)
    if (value) localStorage.setItem(BACKGROUND_BASE_STORAGE_KEY, value)
}

/**
 * Remap `boardId`/`boardName` → `baseId`/`baseName` inside the draft: on the
 * envelope, and on every component record it holds. The key itself is unchanged.
 *
 * The envelope's id was write-only even before the rename (nothing read it), but
 * it is remapped anyway so a draft never carries two vocabularies at once.
 */
function migrateDraftContents(): void {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return
    const draft = JSON.parse(raw) as Record<string, unknown>

    const rename = (obj: Record<string, unknown>): Record<string, unknown> => {
        const { boardId, boardName, ...rest } = obj
        if (boardId !== undefined && rest.baseId === undefined) {
            rest.baseId = boardId
        }
        if (boardName !== undefined && rest.baseName === undefined) {
            rest.baseName = boardName
        }
        return rest
    }

    const next = rename(draft)
    const components = next.components
    if (components && typeof components === 'object') {
        next.components = Object.fromEntries(
            Object.entries(components as Record<string, unknown>).map(
                ([id, record]) => [
                    id,
                    record && typeof record === 'object'
                        ? rename(record as Record<string, unknown>)
                        : record,
                ]
            )
        )
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next))
}

/**
 * Drop keys that were written but never read.
 *
 * `tabs_open_<id>` is deliberately NOT swept: its name carries no board token,
 * and newCanvas actively reads and writes it for multi-tab detection. Deleting
 * it would just be churn the app immediately undoes.
 */
function dropDeadKeys(): void {
    localStorage.removeItem(LEGACY_LAST_OPEN_KEY)
}

/**
 * Bring localStorage up to `STORAGE_VERSION`. Idempotent, and a no-op on every
 * load after the first. Call once from the entry point, before render.
 */
export function runStorageMigration(): void {
    let stored: string | null = null
    try {
        stored = localStorage.getItem(STORAGE_VERSION_KEY)
    } catch {
        // Private mode / storage disabled — there is nothing to migrate.
        return
    }
    if (Number(stored) >= STORAGE_VERSION) return

    safely(migrateBaseTypeKeys)
    safely(migrateBackgroundBaseKey)
    safely(migrateDraftContents)
    safely(dropDeadKeys)

    safely(() =>
        localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION))
    )
}
