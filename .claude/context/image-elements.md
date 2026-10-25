# Image elements (local mode only)

`componentType: 'image'`. Two entry points share one insert path in `src/hooks/useImageDrop.ts`:

- **Drag and drop** from the OS file manager. Placed at the drop point.
- **Toolbar Image tool** (`elementName: 'image'` in `src/utils/constants.ts`). A one-shot action, not a draw mode: `primary.tsx` `addElement` opens the file picker (`openImageFilePicker`), then `requestImageInsert` fires the `insertImageFiles` window event. The canvas places the files at the viewport center. The active tool doesn't change, and the tool is hidden on shared boards.

## Storage

- **Bytes live in IndexedDB**, not the record. DB `craftbase-assets`, store `images`, keyed by SHA-256 of the blob (`src/utils/imageAssetStore.ts`). Repeat drops and pastes share one entry.
- **The record holds a reference.** `metadata = { assetId, url, mimeType, naturalWidth, naturalHeight, opacity }`. That is about 150 bytes in the localStorage draft.
- **Why not base64 in metadata.** The draft cap is 3 MB UTF-8 (`MAX_DRAFT_UTF8_BYTES`). base64 adds 33%, and `writeDraft` re-serializes the whole store on every edit. One phone photo would fill the board.
- **Pruning.** Unreferenced assets are deleted only on draft load (`useLocalDraftPersistence`). Never prune on delete: undo must be able to restore the image.

## Rendering

- `src/factory/image.ts` makes a frame rect (`children[0]`). It is the hit, selection and resize target, and goes transparent once the bitmap loads.
- `src/utils/imageNode.ts` inserts a native SVG `<image>` at the front of the group's `<g>` and syncs it to the frame size on every Two.js `update`. `Two.Image` was avoided because it paints a pattern fill that drifts on resize.
- Source resolution is `metadata.url ?? objectURL(assetId)`. A missing asset shows the dashed placeholder.
- Group-select copies are built from the factory, so they get their own `<image>`. It auto-disposes when the copy leaves the scene. The element component owns and disposes its own node (`ownsImageNode: true`).

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
