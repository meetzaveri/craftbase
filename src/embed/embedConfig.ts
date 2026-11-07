// Feature gates that differ between the standalone craftbase app and the
// embedded <Craftbase> npm component. Board reads these from context
// (`features` on BoardContextValue). One object, one gate per concern — keep
// new embed-vs-app differences here rather than sprinkling `isEmbedded` checks.

export interface BoardFeatures {
    /** True when rendered by the npm <Craftbase> component. */
    embedded: boolean
    /** Share button (persists the board to the backend). */
    share: boolean
    /** Light/dark switcher in the top-right cluster (writes <html> class). */
    themeSwitcher: boolean
    /** 'all' = full menu drawer; 'clearOnly' = only the Clear canvas item. */
    menuItems: 'all' | 'clearOnly'
    /** Image elements (tool, drag-and-drop, IndexedDB assets). */
    images: boolean
    /** Any backend traffic (user bootstrap, background board, component types). */
    network: boolean
}

export const FULL_APP_FEATURES: BoardFeatures = {
    embedded: false,
    share: true,
    themeSwitcher: true,
    menuItems: 'all',
    images: true,
    network: true,
}

export const EMBED_FEATURES: BoardFeatures = {
    embedded: true,
    share: false,
    themeSwitcher: false,
    menuItems: 'clearOnly',
    images: false,
    network: false,
}
