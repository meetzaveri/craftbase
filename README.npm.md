# craftbase

An embeddable whiteboard for React apps. Shapes, connectors, text, freehand
drawing, pan and zoom. No backend needed.

## Install

```sh
npm install craftbase
```

Peer dependencies: `react` and `react-dom` 18 or 19.

## Use

```tsx
import { useRef, useState } from 'react'
import { Craftbase } from 'craftbase'
import type { CraftbaseData, CraftbaseHandle } from 'craftbase'
import 'craftbase/style.css'

export function Whiteboard() {
    const [data, setData] = useState<CraftbaseData>()
    const board = useRef<CraftbaseHandle>(null)

    return (
        <div style={{ height: 600 }}>
            <Craftbase initialData={data} onChange={setData} ref={board} />
        </div>
    )
}
```

The board fills its parent element. Give the parent a size.

## Props

| Prop          | Type                            | Default   | What it does                                                             |
| ------------- | ------------------------------- | --------- | ------------------------------------------------------------------------ |
| `initialData` | `CraftbaseData`                 | none      | Document to start from. Read once at mount. Remount with `key` to reset. |
| `onChange`    | `(data: CraftbaseData) => void` | none      | Fires with the whole document after every change.                        |
| `storage`     | `'ask' \| 'local' \| 'memory'`  | `'ask'`   | Where the board is kept between page loads. See below.                   |
| `storageKey`  | `string`                        | none      | Namespaces stored keys, for several boards on one site.                  |
| `theme`       | `'light' \| 'dark'`             | `'light'` | Color theme.                                                             |
| `loadFonts`   | `boolean`                       | `true`    | Injects the Google Fonts stylesheet the board uses.                      |
| `className`   | `string`                        | none      | Extra class on the root element.                                         |
| `style`       | `CSSProperties`                 | none      | Inline style on the root element.                                        |

## Ref

```ts
board.current?.load(data) // replace the board (clears undo history)
board.current?.clear() // remove every element
board.current?.getData() // current document
```

## Storage

The parent component owns the data through `onChange`. Separately, craftbase
can keep a copy in the browser's localStorage so the board survives a refresh.

- `'ask'`: shows a small prompt. **Allow** saves to localStorage. **No thanks**
  keeps the board in memory only, so a refresh loses it. The answer is
  remembered (a single `craftbase_storage_consent` key, no board data).
- `'local'`: you already have the user's consent. Saves without asking.
- `'memory'`: never touches localStorage.

Every key craftbase stores starts with `craftbase_`, so it's easy to tell them
apart from your app's keys. With a `storageKey`, it is added at the end:
`storageKey="notes"` stores the board as `craftbase_local_draft__notes`.

Load order: `initialData`, then the saved local copy, then an empty board.

## CSS

All styles are scoped under the `.cb-embed` root element. Craftbase's reset and
theme variables don't leak into your page, and your global styles don't reach
inside the board.

## Limits

- One board per page.
- No image elements.
- No sharing or backend sync. The board is local to the browser.

## License

MIT. See `LICENSE`.
