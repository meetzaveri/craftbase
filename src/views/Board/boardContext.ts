import { createContext, useContext } from 'react'
import type { BoardContextValue } from '../../types/board'

// BoardContext lives in its own leaf module — deliberately separate from the
// large, frequently-edited board.tsx. React context identity must be stable
// across the whole app, but board.tsx (and everything it statically imports)
// gets re-evaluated on every HMR update, which would mint a NEW context object
// each time. Element components are lazy-loaded (React.lazy + import.meta.glob
// in newCanvas) through a separate module graph, so after a board.tsx hot-update
// they'd keep reading the OLD context while the Provider supplies the NEW one —
// surfacing as "useBoardContext must be called inside <Board />" even though the
// component is rendered under the Provider. Keeping the context here (no
// changing deps → never hot-updated) guarantees a single shared identity.
export const BoardContext = createContext<BoardContextValue | undefined>(
    undefined
)

export const useBoardContext = (): BoardContextValue => {
    const ctx = useContext(BoardContext)
    if (!ctx) {
        throw new Error('useBoardContext must be called inside <Board />')
    }
    return ctx
}
