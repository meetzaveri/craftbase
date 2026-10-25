# Image elements (local mode only)

`componentType: 'image'`. Two entry points share one insert path in `src/hooks/useImageDrop.ts`:

- **Drag and drop** from the OS file manager. Placed at the drop point.
- **Toolbar Image tool** (`elementName: 'image'` in `src/utils/constants.ts`). A one-shot action, not a draw mode: `primary.tsx` `addElement` opens the file picker (`openImageFilePicker`), then `requestImageInsert` fires the `insertImageFiles` window event. The canvas places the files at the viewport center. The active tool doesn't change, and the tool is hidden on shared boards.

## Storage

- **Bytes live in IndexedDB**, not the record. DB `craftbase-assets`, store `images`, keyed by SHA-256 of the blob (`src/utils/imageAssetStore.ts`). Repeat drops and pastes share one entry.
- **Stored as `ArrayBuffer` + `type`, never a `Blob`.** Safari private windows reject Blob values in IndexedDB ("Error preparing Blob/File data to be stored in object store"). Reads still accept the legacy `blob` field.
- **The record holds a reference.** `metadata = { assetId, url, mimeType, naturalWidth, naturalHeight, opacity }`. That is about 150 bytes in the localStorage draft.
- **Why not base64 in metadata.** The draft cap is 3 MB UTF-8 (`MAX_DRAFT_UTF8_BYTES`). base64 adds 33%, and `writeDraft` re-serializes the whole store on every edit. One phone photo would fill the board.
- **Pruning.** Unreferenced assets are deleted only on draft load (`useLocalDraftPersistence`). Never prune on delete: undo must be able to restore the image.

## Rendering

- `src/factory/image.ts` makes a frame rect (`children[0]`). It is the hit, selection and resize target, and goes transparent once the bitmap loads.
- `src/utils/imageNode.ts` inserts a native SVG `<image>` at the front of the group's `<g>` and syncs it to the frame size on every Two.js `update`. `Two.Image` was avoided because it paints a pattern fill that drifts on resize.
- Source resolution is `metadata.url ?? objectURL(assetId)`. A missing asset shows the dashed placeholder.
- Group-select copies are built from the factory, so they get their own `<image>`. It auto-disposes when the copy leaves the scene. The element component owns and disposes its own node (`ownsImageNode: true`).

## Photo metadata

- **Stripped before storage, every format.** `src/utils/imageMetadata.ts` (`stripImageMetadata`) removes EXIF/GPS, XMP, IPTC, comments and text chunks at the byte level, without re-encoding. JPEG keeps only image data, JFIF, Adobe and ICC; PNG drops `eXIf`/`tEXt`/`zTXt`/`iTXt`/`tIME`; WebP drops `EXIF`/`XMP ` and clears their VP8X flags; GIF drops comments and app blocks except `NETSCAPE2.0`/`ANIMEXTS1.0` (looping). Bytes after end-of-image are cut (phones append depth maps with their own EXIF).
- **Orientation.** The EXIF Orientation tag is read before stripping. A rotated photo (tag not 1) or an unparseable file goes through the canvas re-encode instead, which bakes in the rotation.
- **Re-encoded output is stripped too.** Safari's canvas encoder writes its own EXIF into JPEG and PNG.
- Images stored before this change keep their metadata.
- Tests: `tests/e2e/image-metadata.spec.js`. WebKit's canvas can't encode WebP, so that fixture is skipped there.

## Loading placeholder

- **Why.** A phone photo spends ~0.6 s (laptop) to a few seconds (phone) in decode, downscale and WebP re-encode before a record exists. Without feedback the drop looks ignored.
- **What.** `src/utils/imagePendingNode.ts` appends a plain SVG `<g data-cb-image-pending>` to the scene's `<g>` at the drop point. It is not a Two.js shape or a store record, so it follows pan/zoom but never touches the draft, history or z-order.
- **Sequence.** Spinner at once. `prepareImageFile`'s `onDecoded` reports the final size right after decode, and the dashed frame appears at that size. The image element's `<image>` fires `load`, `attachImageNode` calls `onSettled`, `image.tsx` dispatches `IMAGE_SETTLED_EVENT` with the record id, and `useImageDrop` removes the loader. The frame turns transparent only on `load`, so there is no blank flash.
- **Failure.** A rejected file removes its loader and shows the notice. A 15 s timeout removes any loader whose element never reports back.
- The first `dragover` prefetches the image element chunk.

## Eraser

- **Shift + erase keeps images.** `componentIdAtPoint` in `newCanvas.tsx` normally hit-tests only the topmost element. With Shift held it walks the full `elementsFromPoint` stack and takes the topmost non-image component, so strokes are erased whether they're above or below an image.
- Image groups carry `data-component-type="image"` (set in `image.tsx`), so this check is a DOM attribute read, not a scene scan.

## Local-mode-only rules

- `persistBoard` filters image rows out. The local draft keeps them.
- The shared-board load skips `image` rows.
- `addToLocalComponentStore` refuses images when `isPersistedRef.current` is true. That catches import-merge and paste on shared boards.
- The share modal warns when images are present (`shareLinkPopup.tsx`).
- A drop on a shared board is accepted at `dragover` and refused in `drop` with a notice, so the user sees why.

## Exports

- **JSON** (`formatVersion: '1.1'`) inlines `assets: { assetId: dataUrl }`. Import restores them into IndexedDB before applying the store.
- **SVG/PNG** exporters clone the live DOM. `inlineImageHrefs` swaps each `blob:` href for a data URL.

## Future: shared boards

Upload the blob to a bucket, write the public URL into `metadata.url` (or a typed column), and stop filtering images in `persistBoard` and the load path. The renderer already prefers `url`.
