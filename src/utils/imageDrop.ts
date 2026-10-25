// Validate and normalize an image file dropped onto the canvas before it is
// stored. Large photos are downscaled so a handful of camera images doesn't
// fill the IndexedDB quota or make the SVG renderer decode 50 MP bitmaps.

import { stripImageMetadata } from './imageMetadata'

export const ACCEPTED_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
])

// Raw upper bound on what we'll even try to decode.
export const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024
// Long-edge cap for the stored bitmap.
const MAX_IMAGE_EDGE_PX = 2048
const REENCODE_QUALITY = 0.85

export interface PreparedImage {
    blob: Blob
    mimeType: string
    naturalWidth: number
    naturalHeight: number
}

export type ImageRejectReason = 'type' | 'size' | 'decode'

export class ImageRejectedError extends Error {
    reason: ImageRejectReason
    constructor(reason: ImageRejectReason) {
        super(`Image rejected: ${reason}`)
        this.reason = reason
    }
}

export function isAcceptedImageFile(file: File): boolean {
    return ACCEPTED_IMAGE_TYPES.has(file.type)
}

/**
 * Open the native file picker for images. Resolves with the chosen files, or
 * an empty array when the user cancels.
 */
export function openImageFilePicker(): Promise<File[]> {
    return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = Array.from(ACCEPTED_IMAGE_TYPES).join(',')
        input.multiple = true
        input.onchange = (): void => resolve(Array.from(input.files ?? []))
        input.addEventListener('cancel', () => resolve([]))
        input.click()
    })
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality?: number
): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Decode, downscale (long edge ≤ 2048 px) and re-encode a dropped file.
 * Files already within the cap keep their pixels but lose their metadata
 * (GIFs always do, so animation survives). Oversized PNGs stay PNG so
 * transparency survives; other oversized formats re-encode to WebP. Either
 * way, no EXIF/GPS/XMP reaches storage. Throws ImageRejectedError on
 * bad type/size/decode. `onDecoded` gets the final pixel size as soon as the
 * file is decoded, ahead of the slower re-encode, so callers can size a
 * loading placeholder.
 */
export async function prepareImageFile(
    file: File,
    onDecoded?: (width: number, height: number) => void
): Promise<PreparedImage> {
    if (!isAcceptedImageFile(file)) throw new ImageRejectedError('type')
    if (file.size > MAX_IMAGE_FILE_BYTES) throw new ImageRejectedError('size')

    let bitmap: ImageBitmap
    try {
        // Explicit so the bitmap (and any re-encode below) is upright for
        // photos that rely on the EXIF Orientation tag.
        bitmap = await createImageBitmap(file, {
            imageOrientation: 'from-image',
        })
    } catch {
        throw new ImageRejectedError('decode')
    }

    const { width, height } = bitmap
    const longEdge = Math.max(width, height)
    const oversized = file.type !== 'image/gif' && longEdge > MAX_IMAGE_EDGE_PX

    // Within the cap: keep the original pixels and drop only the metadata
    // (location, camera, timestamps). A rotated photo or a file we can't
    // parse falls through to the re-encode, which bakes in the rotation and
    // carries no metadata.
    if (!oversized) {
        const stripped = stripImageMetadata(
            new Uint8Array(await file.arrayBuffer()),
            file.type
        )
        if (stripped && stripped.orientation === 1) {
            bitmap.close()
            onDecoded?.(width, height)
            return {
                blob: new Blob([stripped.bytes as Uint8Array<ArrayBuffer>], {
                    type: file.type,
                }),
                mimeType: file.type,
                naturalWidth: width,
                naturalHeight: height,
            }
        }
    }

    const ratio = oversized ? MAX_IMAGE_EDGE_PX / longEdge : 1
    const targetW = Math.round(width * ratio)
    const targetH = Math.round(height * ratio)
    onDecoded?.(targetW, targetH)
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        bitmap.close()
        throw new ImageRejectedError('decode')
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close()

    const keepPng = file.type === 'image/png'
    const outType = keepPng ? 'image/png' : 'image/webp'
    const encoded = await canvasToBlob(
        canvas,
        outType,
        keepPng ? undefined : REENCODE_QUALITY
    )
    // Safari < 16 can't encode WebP and silently returns PNG; fall back to
    // JPEG there so photos don't balloon.
    let blob = encoded
    if (!keepPng && (!blob || blob.type !== 'image/webp')) {
        blob = await canvasToBlob(canvas, 'image/jpeg', REENCODE_QUALITY)
    }
    if (!blob) throw new ImageRejectedError('decode')

    // Safari's canvas encoder writes its own EXIF (dimensions, color space).
    // Strip it too, so nothing stored carries metadata in any browser.
    const reencoded = stripImageMetadata(
        new Uint8Array(await blob.arrayBuffer()),
        blob.type
    )
    if (reencoded) {
        blob = new Blob([reencoded.bytes as Uint8Array<ArrayBuffer>], {
            type: blob.type,
        })
    }

    return {
        blob,
        mimeType: blob.type,
        naturalWidth: targetW,
        naturalHeight: targetH,
    }
}

// Fit the image's natural size inside a box so a 4000 px photo doesn't land
// covering the whole viewport. Expressed in screen px; callers divide by the
// camera scale to get surface units.
export const IMAGE_DROP_MAX_SCREEN_PX = 480

export function fitImageSize(
    naturalWidth: number,
    naturalHeight: number,
    maxEdge: number
): { width: number; height: number } {
    const longEdge = Math.max(naturalWidth, naturalHeight, 1)
    const k = Math.min(1, maxEdge / longEdge)
    return {
        width: Math.max(20, Math.round(naturalWidth * k)),
        height: Math.max(20, Math.round(naturalHeight * k)),
    }
}
