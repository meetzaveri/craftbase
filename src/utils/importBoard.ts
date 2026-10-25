import type { ComponentRecord, ComponentStore } from '../types/board'
import { GROUP_COMPONENT } from '../constants/misc'

export interface BoardViewport {
    scale: number
    tx: number
    ty: number
}

export interface ParsedImport {
    /** Only the records that passed validation. */
    components: ComponentStore
    /** Restored on "Open as new canvas"; null when the file carried none. */
    viewport: BoardViewport | null
    /** Total records seen in the file (valid + skipped). */
    total: number
    /** Records dropped for being malformed / unknown. */
    skipped: number
    /** Image bytes (assetId → data URL) from a 1.1+ export; {} when absent. */
    assets: Record<string, string>
}

/**
 * Open a native file picker and resolve with the chosen file's text — or null
 * if the user cancels. Accepts both the branded export (`.json`) and the raw
 * draft backup the load-side rescue produces (same `components` shape).
 */
export function openBoardFilePicker(): Promise<string | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,.craftbase,application/json'
        input.onchange = (): void => {
            const file = input.files?.[0]
            if (!file) {
                resolve(null)
                return
            }
            file.text()
                .then(resolve)
                .catch(() => resolve(null))
        }
        input.click()
    })
}

function isValidRecord(value: unknown): value is ComponentRecord {
    if (!value || typeof value !== 'object') return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = value as any
    return (
        typeof r.componentType === 'string' &&
        r.componentType.length > 0 &&
        r.componentType !== GROUP_COMPONENT &&
        Number.isFinite(r.x) &&
        Number.isFinite(r.y)
    )
}

function parseAssets(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object') return {}
    const out: Record<string, string> = {}
    Object.entries(value as Record<string, unknown>).forEach(([id, url]) => {
        if (typeof url === 'string' && url.startsWith('data:image/')) {
            out[id] = url
        }
    })
    return out
}

function isValidViewport(value: unknown): value is BoardViewport {
    if (!value || typeof value !== 'object') return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = value as any
    return (
        Number.isFinite(v.scale) &&
        Number.isFinite(v.tx) &&
        Number.isFinite(v.ty)
    )
}

/**
 * Parse + validate an imported board file. Mirrors `persistBoard`'s defensive
 * skip: records missing a `componentType` (or geometry) are dropped and
 * counted rather than failing the whole import. Throws only when the file
 * isn't valid JSON or has no `components` object at all.
 */
export function parseImportedBoard(text: string): ParsedImport {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = JSON.parse(text) as any // throws on malformed JSON
    const rawComponents = raw?.components
    if (!rawComponents || typeof rawComponents !== 'object') {
        throw new Error('File does not contain a board (no components).')
    }

    const entries = Object.entries(rawComponents as Record<string, unknown>)
    const components: ComponentStore = {}
    let skipped = 0
    for (const [id, value] of entries) {
        if (isValidRecord(value)) {
            components[id] = value
        } else {
            skipped++
        }
    }

    return {
        components,
        viewport: isValidViewport(raw?.viewport) ? raw.viewport : null,
        total: entries.length,
        skipped,
        assets: parseAssets(raw?.assets),
    }
}
