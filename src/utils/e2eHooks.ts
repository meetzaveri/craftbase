// Whether this build exposes the `window.__cb*` debug handles.
//
// Those handles (`__cbTwo`, `__cbZui`, `__cbRenderOrigin`, `__cbMap`) are
// references to internal objects parked on `window` so something outside the
// app can read them: the console, a perf harness, or Playwright. Playwright
// runs in Node and reaches the page only through `page.evaluate`, which
// executes in the page's GLOBAL scope — a `two` living in a closure inside
// newCanvas is unreachable from there, so the assignment is the only bridge.
//
// The canvas specs need it because a canvas app carries no DOM saying "the
// camera is at scale 0.5". Reading it off the SVG is not an option either:
// canvas/renderOrigin.ts deliberately SPLITS the camera across two <g>
// transforms to dodge float32 cancellation at map coordinates, so the rendered
// matrix is no longer the camera. `__cbTwo.scene.scale` is the real state.
//
// This used to be a bare `import.meta.env.DEV`, which is a compile-time
// constant: true under `yarn start`, false in a build, with the whole block
// dead-code-eliminated out of the bundle. CI runs against a Netlify deploy
// preview, which IS a build, so 41 tests dereferenced `undefined.scene`.
//
// `VITE_E2E_HOOKS` widens the gate without shipping the handles to production:
// netlify.toml sets it for the deploy-preview context only. Set it locally to
// make `vite build && vite preview` a valid e2e target, which is the check
// that would have caught the drift before merge.
export const E2E_HOOKS =
    import.meta.env.DEV || import.meta.env.VITE_E2E_HOOKS === 'true'
