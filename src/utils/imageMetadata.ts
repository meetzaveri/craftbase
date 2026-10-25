// Strip photo metadata (EXIF, GPS, XMP, IPTC, comments) from an image file's
// bytes without re-encoding, so pixels and file size stay as they were. Used
// by prepareImageFile for files that skip the downscale (canvas re-encodes
// already drop all metadata).
//
// Each parser keeps only what rendering needs: image data, color profiles,
// and GIF looping. Anything it doesn't recognise as needed is dropped, and
// bytes after the end-of-image marker (where some phones append extra images
// such as depth maps, with their own EXIF) are cut off.
//
// EXIF Orientation is read before the EXIF block is dropped. A caller must
// re-encode when it is not 1, or the photo renders sideways without the tag.

export interface StrippedImage {
    bytes: Uint8Array
    /** EXIF Orientation (1-8), or 1 when absent. */
    orientation: number
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
    String.fromCharCode(...bytes.subarray(start, start + length))

const be16 = (b: Uint8Array, i: number): number =>
    ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0)

const be32 = (b: Uint8Array, i: number): number =>
    (((b[i] ?? 0) << 24) |
        ((b[i + 1] ?? 0) << 16) |
        ((b[i + 2] ?? 0) << 8) |
        (b[i + 3] ?? 0)) >>>
    0

const le32 = (b: Uint8Array, i: number): number =>
    ((b[i] ?? 0) |
        ((b[i + 1] ?? 0) << 8) |
        ((b[i + 2] ?? 0) << 16) |
        ((b[i + 3] ?? 0) << 24)) >>>
    0

function concat(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((n, p) => n + p.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const p of parts) {
        out.set(p, offset)
        offset += p.length
    }
    return out
}

/** Orientation tag from a TIFF-structured EXIF payload, or 1. */
export function readTiffOrientation(tiff: Uint8Array): number {
    if (tiff.length < 8) return 1
    const order = ascii(tiff, 0, 2)
    if (order !== 'II' && order !== 'MM') return 1
    const little = order === 'II'
    const u16 = (i: number): number =>
        little ? (tiff[i] ?? 0) | ((tiff[i + 1] ?? 0) << 8) : be16(tiff, i)
    const u32 = (i: number): number => (little ? le32(tiff, i) : be32(tiff, i))
    const ifd = u32(4)
    if (ifd + 2 > tiff.length) return 1
    const count = u16(ifd)
    for (let n = 0; n < count; n++) {
        const entry = ifd + 2 + n * 12
        if (entry + 12 > tiff.length) break
        if (u16(entry) === 0x0112) {
            const value = u16(entry + 8)
            return value >= 1 && value <= 8 ? value : 1
        }
    }
    return 1
}

const EXIF_HEADER = 'Exif\0\0'

function exifPayloadOrientation(payload: Uint8Array): number {
    const tiff =
        ascii(payload, 0, 6) === EXIF_HEADER ? payload.subarray(6) : payload
    return readTiffOrientation(tiff)
}

// ── JPEG ────────────────────────────────────────────────────────────────────

function stripJpeg(b: Uint8Array): StrippedImage | null {
    if (b[0] !== 0xff || b[1] !== 0xd8) return null
    const parts: Uint8Array[] = [b.subarray(0, 2)]
    let orientation = 1
    let i = 2
    while (i < b.length) {
        if (b[i] !== 0xff) return null
        // Fill bytes: any number of 0xFF may precede a marker.
        while (b[i + 1] === 0xff) i++
        const marker = b[i + 1] ?? -1
        if (marker === 0xd9) {
            // EOI. Drop anything after it.
            parts.push(b.subarray(i, i + 2))
            return { bytes: concat(parts), orientation }
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            parts.push(b.subarray(i, i + 2))
            i += 2
            continue
        }
        const length = be16(b, i + 2)
        if (length < 2 || i + 2 + length > b.length) return null
        const end = i + 2 + length
        const data = b.subarray(i + 4, end)

        if (marker === 0xda) {
            // Start of scan: keep the header plus the entropy-coded data up
            // to the next real marker (FF00 is a stuffed byte, FFD0-D7 are
            // restart markers inside the scan).
            let j = end
            while (j < b.length) {
                if (b[j] === 0xff) {
                    const next = b[j + 1] ?? -1
                    if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7)) break
                }
                j++
            }
            if (j >= b.length) return null
            parts.push(b.subarray(i, j))
            i = j
            continue
        }

        const isApp = marker >= 0xe0 && marker <= 0xef
        if (marker === 0xe1 && ascii(data, 0, 6) === EXIF_HEADER) {
            orientation = exifPayloadOrientation(data)
        }
        const keep =
            !isApp && marker !== 0xfe
                ? true // DQT, DHT, SOFn, DRI and other image data
                : marker === 0xe0 || // JFIF
                  marker === 0xee || // Adobe color transform
                  (marker === 0xe2 && ascii(data, 0, 12) === 'ICC_PROFILE\0')
        if (keep) parts.push(b.subarray(i, end))
        i = end
    }
    return null
}

// ── PNG ─────────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

function stripPng(b: Uint8Array): StrippedImage | null {
    if (!PNG_SIGNATURE.every((v, k) => b[k] === v)) return null
    const parts: Uint8Array[] = [b.subarray(0, 8)]
    let orientation = 1
    let i = 8
    while (i + 12 <= b.length) {
        const length = be32(b, i)
        const type = ascii(b, i + 4, 4)
        const end = i + 12 + length
        if (end > b.length) return null
        if (type === 'eXIf') {
            orientation = exifPayloadOrientation(
                b.subarray(i + 8, i + 8 + length)
            )
        }
        if (!PNG_DROP.has(type)) parts.push(b.subarray(i, end))
        i = end
        if (type === 'IEND') return { bytes: concat(parts), orientation }
    }
    return null
}

// ── WebP ────────────────────────────────────────────────────────────────────

const VP8X_FLAG_EXIF = 0x08
const VP8X_FLAG_XMP = 0x04

function stripWebp(b: Uint8Array): StrippedImage | null {
    if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null
    const riffEnd = Math.min(b.length, 8 + le32(b, 4))
    const parts: Uint8Array[] = []
    let orientation = 1
    let i = 12
    while (i + 8 <= riffEnd) {
        const fourcc = ascii(b, i, 4)
        const size = le32(b, i + 4)
        const end = i + 8 + size + (size % 2)
        if (i + 8 + size > riffEnd) return null
        if (fourcc === 'EXIF') {
            orientation = exifPayloadOrientation(
                b.subarray(i + 8, i + 8 + size)
            )
        } else if (fourcc !== 'XMP ') {
            let chunk = b.subarray(i, Math.min(end, riffEnd))
            if (fourcc === 'VP8X') {
                chunk = chunk.slice()
                chunk[8] = (chunk[8] ?? 0) & ~(VP8X_FLAG_EXIF | VP8X_FLAG_XMP)
            }
            parts.push(chunk)
        }
        i = end
    }
    const body = concat(parts)
    const header = new Uint8Array(12)
    header.set(b.subarray(0, 4), 0)
    const riffSize = body.length + 4
    header[4] = riffSize & 0xff
    header[5] = (riffSize >>> 8) & 0xff
    header[6] = (riffSize >>> 16) & 0xff
    header[7] = (riffSize >>> 24) & 0xff
    header.set(b.subarray(8, 12), 8)
    return { bytes: concat([header, body]), orientation }
}

// ── GIF ─────────────────────────────────────────────────────────────────────

// Application extensions that carry playback, not metadata.
const GIF_KEEP_APPS = new Set(['NETSCAPE2.0', 'ANIMEXTS1.0'])

/** End offset of a GIF sub-block chain starting at `i`, or -1. */
function skipSubBlocks(b: Uint8Array, i: number): number {
    while (i < b.length) {
        const size = b[i] ?? 0
        if (size === 0) return i + 1
        i += size + 1
    }
    return -1
}

function stripGif(b: Uint8Array): StrippedImage | null {
    const sig = ascii(b, 0, 6)
    if (sig !== 'GIF87a' && sig !== 'GIF89a') return null
    const lsdFlags = b[10] ?? 0
    let i = 13
    if (lsdFlags & 0x80) i += 3 * (1 << ((lsdFlags & 0x07) + 1))
    const parts: Uint8Array[] = [b.subarray(0, i)]
    while (i < b.length) {
        const introducer = b[i]
        if (introducer === 0x3b) {
            parts.push(b.subarray(i, i + 1))
            return { bytes: concat(parts), orientation: 1 }
        }
        if (introducer === 0x21) {
            const label = b[i + 1]
            const end = skipSubBlocks(b, i + 2)
            if (end < 0) return null
            const isComment = label === 0xfe
            const isApp = label === 0xff
            const appId = isApp ? ascii(b, i + 3, 11) : ''
            if (!isComment && !(isApp && !GIF_KEEP_APPS.has(appId))) {
                parts.push(b.subarray(i, end))
            }
            i = end
            continue
        }
        if (introducer === 0x2c) {
            const flags = b[i + 9] ?? 0
            let j = i + 10
            if (flags & 0x80) j += 3 * (1 << ((flags & 0x07) + 1))
            const end = skipSubBlocks(b, j + 1) // +1: LZW minimum code size
            if (end < 0) return null
            parts.push(b.subarray(i, end))
            i = end
            continue
        }
        return null
    }
    return null
}

/**
 * Remove metadata from an image's bytes. Returns null when the file can't be
 * parsed; the caller should then re-encode so no metadata slips through.
 */
export function stripImageMetadata(
    bytes: Uint8Array,
    mimeType: string
): StrippedImage | null {
    try {
        switch (mimeType) {
            case 'image/jpeg':
                return stripJpeg(bytes)
            case 'image/png':
                return stripPng(bytes)
            case 'image/webp':
                return stripWebp(bytes)
            case 'image/gif':
                return stripGif(bytes)
            default:
                return null
        }
    } catch {
        return null
    }
}
