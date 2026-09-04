// Library entry. Consumers (e.g. craftmaps) import the Board view + a few
// hooks/contexts from here. The standalone craftbase app keeps using its own
// src/index.js — this file is purely the public surface.

export { default as Board } from './views/Board'
// Context comes from the dedicated stable module (not board.tsx) so its identity
// survives HMR — see boardContext.ts for the rationale.
export { BoardContext, useBoardContext } from './views/Board/boardContext'

export { useDrawingModes } from './hooks/useDrawingModes'
export { useElementDefaults } from './hooks/useElementDefaults'
export { useMobileToolbarPanels } from './hooks/useMobileToolbarPanels'
export { useLocalDraftPersistence } from './hooks/useLocalDraftPersistence'
export { useComponentHistory } from './hooks/useComponentHistory'
export { useCanvasClipboard } from './hooks/useCanvasClipboard'

// Re-exports for consumer apps that need to set up the same Apollo wiring as
// the standalone craftbase app. Keeps craftmaps from duplicating the user-
// bootstrap mutation or username generator.
export { INSERT_USER_ONE } from './schema/mutations'
export { generateRandomUsernames } from './utils/misc'

// Point categories — the built-in 7-category catalog a consumer can read to
// build its own legend/filters. The `category` lives in a point's
// metadata.category and drives its pin look.
export { POINT_CATEGORIES, DEFAULT_POINT_CATEGORY } from './constants/misc'
export type { PointCategory } from './constants/misc'

// Public type surface. Re-export from the canonical types module so consumers
// can `import type { BoardProps, BoardContextValue, ComponentRecord } from 'craftbase'`.
export type {
    BoardProps,
    BoardContextValue,
    ComponentRecord,
    ComponentStore,
    ComponentMetadata,
    CameraChangeEvent,
    PointScreenInfo,
    Cluster,
    SelectedComponent,
    SelectedGroup,
    CurrentElement,
    HistoryEntry,
    RandomUsername,
} from './types/board'
