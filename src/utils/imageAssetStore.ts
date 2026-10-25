// IndexedDB-backed blob store for local-mode image elements.
//
// Image bytes never ride the component record: the localStorage draft has a
// ~3 MB budget (see boardSizeGuard.ts) and is re-serialized on every edit, so
// even one inline photo would blow it. The record only carries `assetId` (the
// SHA-256 of the blob) in its metadata; the blob itself lives here. Content
// addressing makes repeat drops/pastes of the same image share one entry.

import { IMAGE_COMPONENT } from '../constants/misc'

const DB_NAME = 'craftbase-assets'
const DB_VERSION = 1
const STORE_NAME = 'images'

interface StoredImageAsset {
    id: string
    blob: Blob
    createdAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

// Object URLs are cached per asset so every mount of the same image (paste,
// undo-of-delete, reload of the element) reuses one URL instead of leaking.
const objectUrlCache = new Map<string, string>()

function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is unavailable'))
            return
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = (): void => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' })
            }
        }
        req.onsuccess = (): void => resolve(req.result)
        req.onerror = (): void => reject(req.error)
    })
    // A failed open must not poison every later call — retry next time.
    dbPromise.catch(() => {
        dbPromise = null
    })
    return dbPromise
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        req.onsuccess = (): void => resolve(req.result)
        req.onerror = (): void => reject(req.error)
    })
}

// Two independent 32-bit FNV-1a passes (different offset bases) plus the byte
// length. Only used where SubtleCrypto is missing; the id just has to dedupe
// identical bytes, not resist attack.
function fallbackHash(bytes: Uint8Array): string {
    let h1 = 0x811c9dc5
    let h2 = 0x01000193
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i] ?? 0
        h1 = Math.imul(h1 ^ b, 0x01000193)
        h2 = Math.imul(h2 ^ b, 0x01000193) ^ (h2 >>> 15)
    }
    const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0')
    return `fnv-${hex(h1)}${hex(h2)}-${bytes.length.toString(16)}`
}

async function hashBlob(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
    // SubtleCrypto only exists on secure origins (https / localhost). Over
    // plain http on a LAN IP (mobile testing) it's undefined.
    if (!globalThis.crypto?.subtle) return fallbackHash(new Uint8Array(buffer))
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/** True when this browser can persist image assets (false in some private modes). */
export async function isImageAssetStoreAvailable(): Promise<boolean> {
    try {
        await openDb()
        return true
    } catch {
        return false
    }
}

/**
 * Store a blob and return its content-hash id. Throws when IndexedDB is
 * unavailable or full.
 */
export async function putImageAsset(blob: Blob): Promise<string> {
    const id = await hashBlob(blob)
    const db = await openDb()
    const store = db
        .transaction(STORE_NAME, 'readwrite')
        .objectStore(STORE_NAME)
    // Same id means same bytes, so overwriting an existing entry is harmless.
    const record: StoredImageAsset = { id, blob, createdAt: Date.now() }
    await requestToPromise(store.put(record))
    return id
}

/** Raw blob for an asset, or null when it's missing / the store is unavailable. */
export async function getImageAssetBlob(id: string): Promise<Blob | null> {
    try {
        const db = await openDb()
        const store = db
            .transaction(STORE_NAME, 'readonly')
            .objectStore(STORE_NAME)
        const record = (await requestToPromise(store.get(id))) as
            StoredImageAsset | undefined
        return record?.blob ?? null
    } catch {
        return null
    }
}

/** Cached object URL for an asset, or null when the asset is gone. */
export async function getImageAssetUrl(id: string): Promise<string | null> {
    const cached = objectUrlCache.get(id)
    if (cached) return cached
    const blob = await getImageAssetBlob(id)
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    objectUrlCache.set(id, url)
    return url
}

/**
 * Delete every stored asset not in `referencedIds`. Only call this on draft
 * load, never on element delete: undo must be able to bring an image back.
 */
export async function pruneImageAssets(
    referencedIds: Set<string>
): Promise<void> {
    try {
        const db = await openDb()
        const store = db
            .transaction(STORE_NAME, 'readwrite')
            .objectStore(STORE_NAME)
        const keys = await requestToPromise(store.getAllKeys())
        keys.forEach((key) => {
            const id = String(key)
            if (referencedIds.has(id)) return
            store.delete(key)
            const url = objectUrlCache.get(id)
            if (url) {
                URL.revokeObjectURL(url)
                objectUrlCache.delete(id)
            }
        })
    } catch {
        // Best-effort housekeeping.
    }
}

/** Read a blob as a base64 data URL (JSON export, SVG/PNG export). */
export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (): void => resolve(String(reader.result))
        reader.onerror = (): void => reject(reader.error)
        reader.readAsDataURL(blob)
    })
}

/** Inverse of blobToDataUrl (JSON import). */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl)
    return res.blob()
}

/** Every asset id referenced by image elements in a store. */
export function collectImageAssetIds(
    store: Record<string, { componentType?: string; metadata?: unknown } | null>
): Set<string> {
    const ids = new Set<string>()
    Object.values(store).forEach((c) => {
        if (c?.componentType !== IMAGE_COMPONENT) return
        const assetId = (c.metadata as { assetId?: unknown } | null)?.assetId
        if (typeof assetId === 'string') ids.add(assetId)
    })
    return ids
}

/** assetId → data URL for every image a store references (JSON export). */
export async function exportImageAssets(
    ids: Set<string>
): Promise<Record<string, string>> {
    const out: Record<string, string> = {}
    for (const id of ids) {
        const blob = await getImageAssetBlob(id)
        if (blob) out[id] = await blobToDataUrl(blob)
    }
    return out
}

/**
 * Write imported data URLs back into the store (JSON import). Ids are
 * content hashes, so re-hashing on put lands each blob under the same id the
 * imported records reference. Best-effort per asset.
 */
export async function restoreImageAssets(
    assets: Record<string, string>
): Promise<void> {
    for (const dataUrl of Object.values(assets)) {
        try {
            await putImageAsset(await dataUrlToBlob(dataUrl))
        } catch {
            // A missing asset renders as the image placeholder.
        }
    }
}
