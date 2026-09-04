### Viewport in craftbase

In this context, viewport means the current "camera position" over the infinite canvas — specifically three numbers that describe where you're looking and how close you're
zoomed in.

---

The three values

tx / ty — translation (pan)

Two.js renders everything inside two.scene, which is an SVG <g> element. When you scroll the canvas, ZUI calls zui.translateSurface(dx, dy), which shifts that <g> element's
transform="translate(x, y)" attribute. So two.scene.translation.x/y is literally the pixel offset of the entire scene relative to the browser window's top-left corner.

scale — zoom level

When you pinch or Shift+scroll, ZUI calls zui.zoomBy(...), which updates two.scene.scale. This maps to the SVG transform="scale(n)" on the scene group. A scale of 1.0 is 100%
zoom, 2.0 is 2× zoomed in, 0.5 is zoomed out to half.

---

Why zoomSet + translateSurface instead of writing the properties directly

ZUI maintains its own internal zScale variable that tracks the logarithmic zoom position. If you write two.scene.scale = 2 directly, ZUI's internal counter stays at its default
— so the next time you scroll, it calculates zoom delta from the wrong baseline and the scene jumps. zui.zoomSet(scale, 0, 0) updates both the scene and ZUI's internal state
atomically, keeping them in sync.

---

What gets persisted

`VIEWPORT_KEY_PREFIX` is stored as `craftbase_viewport_` in misc.js

```
craftbase_viewport_<boardId> → { tx: -340, ty: 120, scale: 1.8 }
```

That means: the scene is shifted 340px left and 120px down from origin, and zoomed in to 1.8×. On restore, those three numbers are fed back through ZUI's API to reconstruct the
exact same SVG transform.
