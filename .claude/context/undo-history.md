# Undo / History System

## Overview

Board mutations are tracked in two parallel stacks: `historyLog` (powers Ctrl/Cmd+Z undo) and `bucketLog` (powers Ctrl/Cmd+Shift+Z redo). Every function that modifies component state **must** call `recordToHistoryLog` before touching the store or DB.

All history state lives in `src/hooks/useComponentHistory.js`. The hook is called in `src/views/Board/board.js` and its returned values (`recordToHistoryLog`, `undoLastAction`, `redoLastAction`, `clearHistory`, `bucketLog`, etc.) are spread into `BoardContext`.

`applyPropertyToTwoJSGroup` is a module-level helper in `useComponentHistory.js` (not exported — used internally by both undo and redo to mutate Two.js shape properties when reversing/replaying an `UPDATE_BULK` action).

## State

```js
const [historyLog, setHistoryLog] = useState([])
const historyLogRef = useRef([])   // always kept in sync with historyLog state
const [bucketLog, setBucketLog] = useState([])
const bucketLogRef = useRef([])    // redo stack
```

The `*Ref` copies are the authoritative versions used inside callbacks to avoid stale closure issues.

## Recording an action

```js
recordToHistoryLog(entry)
```

Appends `{ ...entry, timestamp: Date.now() }` to the stack. Called at the top of each mutating function, **before** any store or DB change. Also clears `bucketLog` — a fresh user action invalidates the redo branch (standard editor behavior).

### Entry shapes by action type

| action | extra fields | recorded by |
|---|---|---|
| `ADD` | `id`, `componentInfo` | `addToLocalComponentStore` |
| `DELETE` | `id`, `prevState` (full component snapshot) | `deleteComponentFromLocalStore` |
| `UPDATE_BULK` | `id`, `prevProps` (only changed keys), `bulkObj` | `updateComponentBulkPropertiesInLocalStore` |
| `UPDATE_VERTICES` | `id`, `prevX`, `prevY` | `updateComponentVerticesInLocalStore` |

## Reversing an action — `undoLastAction()`

**This is the canonical rollback function. Always use it instead of manually manipulating store/Two.js state.**

It pops the last entry, then reverses it completely:

| action | what it does |
|---|---|
| `ADD` | Removes Two.js shape from scene, deletes from component store, calls `deleteComponent` mutation if persisted |
| `DELETE` | Re-inserts into component store, calls `insertComponent` mutation if persisted |
| `UPDATE_VERTICES` | Restores previous `x`/`y` in store and Two.js translation, calls `updateComponentInfo` |
| `UPDATE_BULK` | Restores previous property values in store and Two.js shape, calls `updateComponentInfo` |

Store is always updated **before** Two.js visuals to keep `stateRefForComponentStore` correct even if rendering fails. Canvas is flushed with `requestAnimationFrame(() => two?.update())`.

Before reverting, `undoLastAction` also captures the **post-action ("next") state** so the entry can be re-applied later by redo:

| action | extra fields captured for redo |
|---|---|
| `UPDATE_VERTICES` | `nextX`, `nextY` (current `x`/`y` from store) |
| `UPDATE_BULK` | `nextProps` (current values for each key in `prevProps`) |
| `ADD` / `DELETE` / `BATCH` | none — original entry already has everything redo needs |

The enriched entry is pushed onto `bucketLog`.

## Replaying an action — `redoLastAction()`

Pops from `bucketLog`, re-applies the action (mirror of undo), then pushes the original-shape entry back onto `historyLog` directly (bypassing `recordToHistoryLog` so `bucketLog` is **not** cleared during a redo). Disabled in the UI when `bucketLog.length === 0`. Only ever holds entries that came from `undoLastAction`.

| action | what it does |
|---|---|
| `ADD` | Re-inserts using `componentInfo` (mirror of `DELETE` undo) |
| `DELETE` | Removes from store/scene (mirror of `ADD` undo) |
| `UPDATE_VERTICES` | Applies `nextX`/`nextY` |
| `UPDATE_BULK` | Applies `nextProps` (and respects `bulkObj`/`syncDefaults`) |
| `BATCH` | Iterates `entries` forward; `ADD`→insert, `DELETE`→remove |

Both `undoLastAction` and `redoLastAction` dispatch through the same per-action helpers (`applyRemove`, `applyInsert`, `applyVertices`, `applyBulkProps`, `applyBatch`) — only the source of the props differs (`prev*` vs `next*`).

## Rule: use `undoLastAction()` for any rollback

If an async operation (e.g. a GQL mutation) fails and the local state needs to be reverted, call `undoLastAction()` — do not manually delete from the store or remove from the Two.js scene. This ensures:
- `historyLog` stays consistent (no orphan entries)
- Two.js scene, React state, and the ref stay in sync
- Server-side compensating mutations (e.g. `deleteComponent` after a failed `insertComponent`) are fired correctly

Example — permission error on insert:
```js
insertComponent({ variables: { object: componentInfo } }).catch((error) => {
    const isPermissionError = error.graphQLErrors?.some(
        (e) => e.extensions?.code === 'permission-error'
    )
    if (isPermissionError) {
        undoLastAction()   // reverses the ADD cleanly
        setShowPermissionErrorModal(true)
    }
})
```
