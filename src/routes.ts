export default {
    index: '/',
    base: '/base/:id',
    // A map base. Same view as `base`, with the base type pinned to the map and
    // the type switcher hidden — a recipient of a shared map can't flip it to a
    // whiteboard and find an empty canvas (geo objects are hidden there).
    // `/base/:id` on a map-typed base redirects here, so each base has one
    // canonical URL.
    map: '/map/:id',
    // Legacy path kept only so links shared before the board → base rename keep
    // resolving. Redirects to `base` — see LegacyBaseRedirect in App.tsx.
    legacyBoard: '/board/:id',
    marketing: '/home',
    about: '/about',
    support: '/support',
    privacy: '/privacy',
}
