// Anchor ids for chrome that other chrome positions itself against, shared in
// their own module so the follower can measure the leader without importing the
// leader's component (which would drag its whole icon graph into the follower's
// chunk).
export const SHAPES_TOOLBAR_ID = 'cb-shapes-toolbar'

// The hamburger button's outer box, top-left. The base switcher sits directly
// to its right.
export const MENU_BUTTON_ID = 'cb-menu-button'
