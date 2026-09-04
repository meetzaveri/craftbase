Path A: Draw-to-place (rectangle / circle)

1. addElement() — src/components/sidebar/primary.js:263
   User clicks the shape icon in the sidebar. For draw-type shapes, this writes pendingShapeType and pendingShapeProps to localStorage and sets the cursor to crosshair. No
   component is created yet.

2. mousedown() — src/newCanvas.js:498
   On the next canvas click, mousedown reads pendingShapeType from localStorage and sets scenario = SCENARIO_DRAW_SHAPE. It captures the click coordinates as drawOrigin, creates a
   preview shape directly via two.makeRoundedRectangle() / two.makeEllipse() (a raw Two.js object, not a React component), and attaches mousemove/mouseup listeners.

3. mousemove() — src/newCanvas.js:1012
   As the user drags, this continuously resizes the preview shape by updating its width, height, and translation (center point), then calls two.update() to re-render it. This is
   purely visual — no React state yet.

4. mouseup() — src/newCanvas.js:1342
   On release, this:

- Calculates final width, height, and center coords from drawOrigin → drawCurrentCoords
- Generates a UUID via generateUUID()
- Assembles finalShapeData (merging drawShapeProps with computed dimensions)
- Calls addToLocalComponentStore(finalId, drawShapeType, finalShapeData) to register it in React state
- Calls pollUntilElement() to wait for the React component to appear in two.scene.children, then removes the preview shape

5. addToLocalComponentStore() — src/views/Board/board.js:385
   Adds the component data to componentStore React state via setComponentStore(). Also:

- Records to undo history via recordToHistoryLog()
- Fires insertComponent GraphQL mutation if isPersisted === true

6. handleSetComponentsToRender() — src/newCanvas.js:2131
   Canvas's useEffect watches props.componentStore. For any new component id not in prevElementsRef, it:

- Lazy-loads the element module: React.lazy(() => import('./components/elements/rectangle.js'))
- Calls ElementRenderWrapper(ElementToRender, data, ...) to produce a render function
- Pushes it onto componentsToRender state, which causes React to mount the component

7. ElementRenderWrapper — src/components/utils/elementRenderWrappers.js:4
   A HOC factory that wraps the lazy element. It watches componentStore via a useEffect to find the component's data by id and passes it as props to the real element component.

8. Rectangle (useEffect mount) — src/components/elements/rectangle.js:15
   The actual React component mounts and:

- Instantiates new RectangleFactory(two, x, y, props)
- Calls elementFactory.createElement() — this calls two.makeRoundedRectangle() and two.makeGroup() to create the permanent Two.js objects
- Attaches group.elementData = { ...props } (the metadata the canvas uses for hit-testing and drag)
- Calls two.update() to commit to the SVG DOM
- Stamps class="dragger-picker" and data-component-id on the SVG group element

9. RectangleFactory.createElement() — src/factory/rectangle.js:6
   The factory creates the Two.js primitives: two.makeRoundedRectangle(), applies fill/stroke/dash styles, wraps it in two.makeGroup() with the translation set, and returns {
   group, rectangle }.

---

Path B: Click-to-place (text, divider)

Steps 1-4 differ: addElement() immediately calls addToLocalComponentStore() and sets lastAddedElementId in localStorage. mousedown then picks up SCENARIO_JUST_ADDED_ELEMENT and
positions the already-rendered Two.js element at the click point. Steps 5–9 are the same.
