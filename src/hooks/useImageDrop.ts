import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { IMAGE_COMPONENT } from '../constants/misc'
import { generateUUID } from '../utils/misc'
import { putImageAsset } from '../utils/imageAssetStore'
import {
    fitImageSize,
    IMAGE_DROP_MAX_SCREEN_PX,
    ImageRejectedError,
    isAcceptedImageFile,
    prepareImageFile,
} from '../utils/imageDrop'
import type { ImageMetadata } from '../utils/imageNode'
import type { ComponentRecord } from '../types/board'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwoLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZuiInstanceLike = any

// Surface-unit offset between consecutive images of a multi-file drop.
const MULTI_DROP_OFFSET = 24

// Window event the toolbar's Image tool fires with the picked files. The
// canvas places them at the viewport center.
export const INSERT_IMAGE_FILES_EVENT = 'insertImageFiles'

export interface InsertImageFilesDetail {
    files: File[]
}

/** Ask the canvas to insert these image files at the viewport center. */
export function requestImageInsert(files: File[]): void {
    window.dispatchEvent(
        new CustomEvent<InsertImageFilesDetail>(INSERT_IMAGE_FILES_EVENT, {
            detail: { files },
        })
    )
}

export interface ImageDropOptions {
    twoJSInstance: TwoLike | null
    zuiInstanceRef: MutableRefObject<ZuiInstanceLike | null>
    boardId: string
    /** Images are local-mode only; drops are refused on shared boards. */
    isPersisted: boolean
    addToLocalComponentStore: (
        id: string,
        componentType: string,
        record: ComponentRecord,
        skipHistory?: boolean
    ) => void
    showCanvasNotice: (message: string) => void
}

const REJECT_MESSAGES: Record<ImageRejectedError['reason'], string> = {
    type: 'Only PNG, JPEG, WebP and GIF images are supported.',
    size: 'That image is too large (max 20 MB).',
    decode: "That image couldn't be read.",
}

function hasFiles(e: DragEvent): boolean {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

/**
 * Insert image files onto the canvas: dragged onto `#main-two-root` (placed at
 * the drop point) or picked via the toolbar's Image tool (placed at the
 * viewport center, see requestImageInsert). Each file is downscaled, stored
 * in IndexedDB, and added as an `image` element. Listeners bind once and read the latest options
 * through a ref (the stale-closure rule from CLAUDE.md).
 */
export function useImageDrop(options: ImageDropOptions): void {
    const optionsRef = useRef(options)
    optionsRef.current = options

    useEffect(() => {
        const root = document.getElementById('main-two-root')
        if (!root) return

        // Accept the drag even on shared boards: a 'none' dropEffect would
        // suppress the drop event, and the user would get a dead cursor with
        // no explanation. onDrop refuses it there with a notice instead.
        const onDragOver = (e: DragEvent): void => {
            if (!hasFiles(e)) return
            e.preventDefault()
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
        }

        const addImageAt = async (
            file: File,
            surfaceX: number,
            surfaceY: number
        ): Promise<void> => {
            const { boardId, addToLocalComponentStore, twoJSInstance } =
                optionsRef.current
            const prepared = await prepareImageFile(file)
            const assetId = await putImageAsset(prepared.blob)
            const scale = twoJSInstance?.scene?.scale || 1
            const { width, height } = fitImageSize(
                prepared.naturalWidth,
                prepared.naturalHeight,
                IMAGE_DROP_MAX_SCREEN_PX / scale
            )
            const metadata: ImageMetadata = {
                assetId,
                url: null,
                mimeType: prepared.mimeType,
                naturalWidth: prepared.naturalWidth,
                naturalHeight: prepared.naturalHeight,
                opacity: 1,
            }
            const id = generateUUID()
            const record = {
                id,
                componentType: IMAGE_COMPONENT,
                x: Math.trunc(surfaceX),
                y: Math.trunc(surfaceY),
                width,
                height,
                fill: 'transparent',
                stroke: null,
                linewidth: null,
                strokeType: null,
                boardId,
                children: {},
                metadata,
                updatedBy: localStorage.getItem('userId'),
            } as unknown as ComponentRecord
            addToLocalComponentStore(id, IMAGE_COMPONENT, record)
        }

        // Shared by drop (at the cursor) and the toolbar picker (at the
        // viewport center).
        const insertFiles = (
            files: File[],
            clientX: number,
            clientY: number
        ): void => {
            const { isPersisted, zuiInstanceRef, showCanvasNotice } =
                optionsRef.current
            if (isPersisted) {
                showCanvasNotice(
                    "Images aren't supported on shared boards yet."
                )
                return
            }
            const zui = zuiInstanceRef.current?.zui
            if (!zui) return
            const images = files.filter(isAcceptedImageFile)
            if (images.length === 0) {
                if (files.length > 0) showCanvasNotice(REJECT_MESSAGES.type)
                return
            }
            const surface = zui.clientToSurface(clientX, clientY)
            // Sequential, so z-order positions follow drop order.
            images
                .reduce<Promise<void>>(
                    (chain, file, i) =>
                        chain.then(() =>
                            addImageAt(
                                file,
                                surface.x + i * MULTI_DROP_OFFSET,
                                surface.y + i * MULTI_DROP_OFFSET
                            ).catch((err: unknown) => {
                                showCanvasNotice(
                                    err instanceof ImageRejectedError
                                        ? REJECT_MESSAGES[err.reason]
                                        : "Couldn't save that image in this browser."
                                )
                            })
                        ),
                    Promise.resolve()
                )
                .catch(() => undefined)
        }

        const onDrop = (e: DragEvent): void => {
            if (!hasFiles(e)) return
            e.preventDefault()
            insertFiles(
                Array.from(e.dataTransfer?.files ?? []),
                e.clientX,
                e.clientY
            )
        }

        const onInsertRequest = (e: Event): void => {
            const files = (e as CustomEvent<InsertImageFilesDetail>).detail
                ?.files
            if (!files?.length) return
            const rect = root.getBoundingClientRect()
            insertFiles(
                files,
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
            )
        }

        // A file dropped on the toolbars or just outside the canvas would make
        // the browser navigate away to the image. Swallow that everywhere.
        const blockNavigation = (e: DragEvent): void => {
            if (hasFiles(e)) e.preventDefault()
        }

        root.addEventListener('dragover', onDragOver)
        root.addEventListener('drop', onDrop)
        window.addEventListener('dragover', blockNavigation)
        window.addEventListener('drop', blockNavigation)
        window.addEventListener(INSERT_IMAGE_FILES_EVENT, onInsertRequest)
        return (): void => {
            root.removeEventListener('dragover', onDragOver)
            root.removeEventListener('drop', onDrop)
            window.removeEventListener('dragover', blockNavigation)
            window.removeEventListener('drop', blockNavigation)
            window.removeEventListener(
                INSERT_IMAGE_FILES_EVENT,
                onInsertRequest
            )
        }
    }, [])
}
