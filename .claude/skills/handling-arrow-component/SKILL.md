## Adding arrow to the board

Currently the arrow functionality (when selected from sidebar) works as

- arrowLine gets x=-9999, y=-9999 — places the element off-screen so the user doesn't see a stray default arrow before they draw
- Sets localStorage.arrowDrawMode = 'true' — signals the canvas to handle the next mousedown as a draw operation
- Overrides cursor to 'crosshair' — visual feedback that draw mode is active
- Skips "Click anywhere" banner — that UX prompt no longer applies for arrowLine

SCENARIO_ARROW_DRAW in newCanvas component:

    SCENARIO_ARROW_DRAW with three phases:
    ┌───────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │ Event │ What happens │
    ├───────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ mousedown │ Finds the pending arrow, sets group position to cursor (surface coords), resets both line vertices to 0,0, removes localStorage flags, starts listening for mousemove/mouseup │
    ├───────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ mousemove │ Converts cursor to surface coords relative to group origin, calls updateX2Y2Vertices to stretch the arrowhead to follow the cursor │
    ├───────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
    │ mouseup │ Reads final vertices, calls updateToGlobalState to persist x,y,x1,y1,x2,y2 to the store and DB, resets cursor to auto │
    └───────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
    The pre-mousedown mousemove guard (arrowDrawMode !== 'true') prevents the stale element at -9999 from being moved to follow the cursor before the user clicks.

## ArrowLine Selection & Resize — How It Works

1. Structure: Each arrow is a Two.js group with 3 children: [0]  
   line (the arrow path), [1] pointCircle1Group (tail handle), [2]  
   pointCircle2Group (head handle). The group has CSS class  
   dragger-picker; the circle groups have dragger-picker
   is-line-circle.
2. Circles hidden by default: Both point circle groups start with
   opacity = 0. They are shown on selection and hidden otherwise.
3. Selecting the arrow body: Clicking the arrow line triggers
   mousedown in newCanvas.js. The event path traversal finds
   g.dragger-picker (not is-line-circle), assigns it as shape, and
   sets children[1].opacity = 1 and children[2].opacity = 1 to reveal
   the handles.
4. Selecting a circle handle: Clicking a handle finds
   g.is-line-circle in the path. The code reads data-parent-id,
   data-line-id, and data-direction attributes to resolve shape,
   shape.lineData, shape.siblingCircle, and shape.direction.
5. Dragging a handle: In mousemove, when shape.lineData exists,
   direction === 'left' moves line.vertices[0] (tail), direction ===
   'right' moves line.vertices[1] (head). updateX1Y1Vertices /
   updateX2Y2Vertices recalculate arrowhead geometry and reposition
   the circle handles.
6. Hiding circles on release: In mouseup, when
   shape.elementData.isLineCircle === true and movement occurred,
   both circles are set back to opacity = 0 and the new x1/y1/x2/y2
   are persisted via updateToGlobalState.
7. Clearing circles on new click: At the start of every mousedown
   default case, all arrow circles across the scene are reset to
   opacity = 0 before processing the new selection.

## Extra notes

1. Key files list — immediately knowing to look at
   src/newCanvas.js (canvas event hub), src/factory/arrowLine.js
   (Two.js construction), src/components/elements/arrowLine.js (React

- interact setup), src/utils/updateVertices.js (vertex
  recalculation) before reading anything else

2. The "interact click handler" note — that arrowLine.js has an
   interact click handler as a secondary mechanism to show circles,
   but newCanvas.js mousedown is the authoritative place for
   selection logic. This ambiguity was the core confusion in this
   session.
3. The children index contract — explicitly stating that
   group.children[0] = line, [1] = pointCircle1Group, [2] =
   pointCircle2Group is relied on directly by newCanvas.js. Any
   factory change that reorders children would break selection.
4. elementData shape — what fields are always present on
   group.elementData (specifically componentType, id, x, y, x1, y1,
   x2, y2) since mousedown logic branches on these.
