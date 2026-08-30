// Internal barrel.
//
// This was once the published surface for craftmaps. That consumer is gone and
// nothing outside this repo imports it, so adding to or narrowing this file
// carries no compatibility promise — see "Craftbase is a standalone product,
// not a library" in CLAUDE.md. It survives as one convenient import point for
// the app's own top-level pieces.

export { default as Base } from './views/Base'
// Context comes from the dedicated stable module (not base.tsx) so its identity
// survives HMR — see baseContext.ts for the rationale.
export { BaseContext, useBaseContext } from './views/Base/baseContext'

export { useDrawingModes } from './hooks/useDrawingModes'
export { useElementDefaults } from './hooks/useElementDefaults'
export { useMobileToolbarPanels } from './hooks/useMobileToolbarPanels'
export { useLocalDraftPersistence } from './hooks/useLocalDraftPersistence'
export { useComponentHistory } from './hooks/useComponentHistory'
export { useCanvasClipboard } from './hooks/useCanvasClipboard'
export { useActiveBaseType } from './hooks/useActiveBaseType'

export { INSERT_USER_ONE } from './schema/mutations'
export { generateRandomUsernames } from './utils/misc'

// Base types — the swappable substrate a base is drawn on (board / map, with
// image to come). `<Base defaultBaseType="map" />` opens on the map.
export type {
    BaseType,
    BaseTypeConfig,
    BaseTypeProvider,
    MapAnchor,
} from './baseTypes/types'

export type {
    BaseProps,
    BaseContextValue,
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
} from './types/base'
