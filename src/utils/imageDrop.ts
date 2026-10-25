// Validate and normalize an image file dropped onto the canvas before it is
// stored. Large photos are downscaled so a handful of camera images doesn't
// fill the IndexedDB quota or make the SVG renderer decode 50 MP bitmaps.

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
 * Files already within the cap pass through untouched (GIFs always do, so
 * animation survives). Oversized PNGs stay PNG so transparency survives;
 * other oversized formats re-encode to WebP. Throws ImageRejectedError on
 * bad type/size/decode.
 */
export async function prepareImageFile(file: File): Promise<PreparedImage> {
    if (!isAcceptedImageFile(file)) throw new ImageRejectedError('type')
    if (file.size > MAX_IMAGE_FILE_BYTES) throw new ImageRejectedError('size')

    let bitmap: ImageBitmap
    try {
        bitmap = await createImageBitmap(file)
    } catch {
        throw new ImageRejectedError('decode')
    }

    const { width, height } = bitmap
    const longEdge = Math.max(width, height)

    if (file.type === 'image/gif' || longEdge <= MAX_IMAGE_EDGE_PX) {
        bitmap.close()
        return {
            blob: file,
            mimeType: file.type,
            naturalWidth: width,
            naturalHeight: height,
        }
    }

    const ratio = MAX_IMAGE_EDGE_PX / longEdge
    const targetW = Math.round(width * ratio)
    const targetH = Math.round(height * ratio)
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
