# Craftbase Font Guide

## Font Stack

| Font             | Role                                                          | Import                    |
| ---------------- | ------------------------------------------------------------- | ------------------------- |
| **Geist**        | UI chrome, all app interface text                             | Google Fonts / Vercel CDN |
| **Geist Mono**   | Numeric values, coordinates, hex codes                        | Google Fonts / Vercel CDN |
| **Fraunces**     | Branding, headings, display text                              | Google Fonts              |
| **Caveat Brush** | Canvas text — the **default** for anything drawn on the board | Google Fonts              |
| **Caveat**       | Canvas text — alternate, user-selectable                      | Google Fonts              |

> **Canvas ≠ app chrome.** The app UI defaults to Geist; the _canvas_ defaults to
> Caveat Brush. Don't collapse the two — see §5.

---

## Import (Google Fonts)

This is the live link in `index.html` — keep it in sync when adding a family:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
    href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=Caveat+Brush&display=swap"
    rel="stylesheet"
/>
```

> **Caveat Brush ships regular (400) only** — it has no bold cut. Asking for
> bold canvas text gets browser-synthesized fake bold, not a real weight.

---

## CSS Variables (Design Tokens)

Defined in `src/App.css`:

```css
:root {
    --font-ui: 'Geist', system-ui, sans-serif;
    --font-mono: 'Geist Mono', monospace;
    --font-display: 'Fraunces', Georgia, serif;
    --font-sketch: 'Caveat Brush', cursive;
    --font-caveat-brush: 'Caveat Brush', cursive;
}
```

`--font-sketch` (the _role_) and `--font-caveat-brush` (the _family_) currently
resolve to the same stack. Keep both named — the role token is what moves if the
canvas default ever changes again.

### Tailwind Config (`tailwind.config.js`)

```js
fontFamily: {
    ui:      ['Geist', 'system-ui', 'sans-serif'],
    mono:    ['Geist Mono', 'monospace'],
    display: ['Fraunces', 'Georgia', 'serif'],
    sketch:  ['Caveat Brush', 'cursive'],
},
```

### The canvas default lives in TypeScript, not CSS

Canvas text is rendered by Two.js (`twoText.family = …`), so it reads a JS
constant rather than a CSS variable:

```ts
// src/constants/misc.ts — single source of truth
export const DEFAULT_TEXT_FONT_FAMILY = 'Caveat Brush'
```

Every canvas-text fallback is written `family || DEFAULT_TEXT_FONT_FAMILY`, and
`useElementDefaults` seeds `defaultTextFontFamily` from it. **Changing the canvas
default means changing this constant** — then keeping `--font-sketch`, the
Tailwind `sketch` token, and the `index.html` link in step with it.

---

## Usage by Area

### 1. App Chrome (Toolbar, Sidebar, Menus, Labels)

**Font:** Geist  
**When:** Everything inside the app shell — toolbar buttons, panel labels, dropdowns, tooltips, input fields, settings.

```css
/* CSS */
.toolbar,
.sidebar,
.menu,
label,
input,
button {
    font-family: var(--font-ui);
    font-weight: 400; /* or 500 for emphasis */
}
```

```jsx
{
    /* Tailwind */
}
;<div className="font-ui text-sm font-medium">Stroke Width</div>
```

> **Rule:** Never use Fraunces, Geist Mono, Caveat, or Caveat Brush anywhere inside the toolbar or sidebar. Geist only.

---

### 2. Numeric Values, Coordinates & Data (Properties Panel, Status Bar)

**Font:** Geist Mono  
**When:** Any piece of data that is a number, coordinate, hex color, dimension, or percentage — specifically in the right properties panel and the zoom/status bar.

```css
/* CSS */
.prop-value,
.coord-display,
.hex-value,
.zoom-level {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
}
```

```jsx
{/* Tailwind */}
<span className="font-mono text-xs text-ink-mid">340</span>       {/* coordinate */}
<span className="font-mono text-xs text-ink-mid">#C4B89A</span>   {/* hex color  */}
<span className="font-mono text-xs text-ink-mid">100%</span>      {/* zoom level */}
```

> **Why Geist Mono here?** Monospace fonts align numbers into consistent columns, making coordinates and values scannable at a glance. It also visually separates "data" from "UI label" without needing extra styling — the font does the work.

> **Rule:** Geist Mono is for data display only — never for labels, headings, or body copy.

---

### 3. Branding & Marketing (Logo wordmark, Landing page hero, Taglines)

**Font:** Fraunces  
**When:** The Craftbase wordmark, hero headlines on the landing page, onboarding screens, marketing copy.

```css
/* CSS */
.logo,
.hero-headline,
.tagline {
    font-family: var(--font-display);
    font-weight: 600;
    font-style: normal;
}
```

```jsx
{
    /* Tailwind */
}
;<h1 className="font-display text-5xl font-semibold tracking-tight">
    Craftbase
</h1>
```

> **Tip:** Use Fraunces italic for pull quotes, empty state messages, or any moment you want warmth and personality — e.g. _"Nothing here yet. Start sketching."_

---

### 4. App Headings & Section Titles (Inside the app, not toolbar)

**Font:** Fraunces  
**When:** Page titles, modal headings, section headers inside panels or dialogs.

```css
/* CSS */
.modal-title,
.panel-heading,
.page-title {
    font-family: var(--font-display);
    font-weight: 400;
    font-size: 1.25rem;
}
```

```jsx
{
    /* Tailwind */
}
;<h2 className="font-display text-xl font-normal">Share Board</h2>
```

> **Avoid** using Fraunces at small sizes (below 14px). It loses its character and competes with Geist.

---

### 5. Canvas — Default Text Elements

**Font:** Caveat Brush  
**When:** Anything the user draws on the board — standalone text elements, text
typed inside a shape, arrow labels. Also the welcome sketch (`welcomeSketch.ts`
sets `SKETCH_FONT = DEFAULT_TEXT_FONT_FAMILY`).

Canvas text isn't styled by CSS classes — Two.js sets the family on the text node
directly, so the default flows from the constant:

```ts
import { DEFAULT_TEXT_FONT_FAMILY } from '../constants/misc'

twoText.family = textFontFamily ?? DEFAULT_TEXT_FONT_FAMILY // 'Caveat Brush'
```

> **Why handwritten by default?** The canvas is a sketching surface — a
> handwritten face signals "this is a draft, move things around" in a way a
> neutral UI font doesn't. That's a deliberate product choice, not an oversight:
> the canvas and the app chrome are meant to feel like different materials.

---

### 6. Canvas — Switching Fonts (User-selectable)

Users change the font of a selected element from the properties panel
(`elementProperties.tsx`). The picker currently offers exactly three:

| Option           | Feel                                            |
| ---------------- | ----------------------------------------------- |
| **Caveat Brush** | Default — brushy, higher-contrast handwriting   |
| **Caveat**       | Lighter, more legible handwriting               |
| **Geist**        | Neutral — for diagrams that must read as formal |

Picking a font is **universal, not per-element**: `board.tsx` calls
`setDefaultTextFontFamily(fontFamily)` on change, so every element created
afterward inherits it. Changing it also triggers
`reflowShapeTextAfterStyleChange` — families have different metrics, so shape
text must re-wrap and the shape may need to grow.

> Existing elements store their family in `metadata.textFontFamily`. Changing
> `DEFAULT_TEXT_FONT_FAMILY` is **not** retroactive — saved elements keep the
> family they were created with.

---

### 7. Empty States & Microcopy

**Font:** Fraunces italic  
**When:** Empty canvas messages, onboarding hints, "no results" states — moments where Craftbase has a voice.

```jsx
{
    /* Tailwind */
}
;<p className="font-display italic text-base text-gray-400">
    Drop your first shape to get started.
</p>
```

> This is where Craftbase's playful personality shows up most clearly. A single italic Fraunces line in an empty state does more brand work than a paragraph of Geist ever could.

---

## Quick Reference Cheatsheet

| Area                     | Font           | Weight    | Style  |
| ------------------------ | -------------- | --------- | ------ |
| Toolbar, sidebar, menus  | Geist          | 400 / 500 | Normal |
| Input fields, labels     | Geist          | 400       | Normal |
| Coordinates, dimensions  | Geist Mono     | 400       | Normal |
| Hex colors, percentages  | Geist Mono     | 400       | Normal |
| Zoom level, status bar   | Geist Mono     | 400 / 500 | Normal |
| Logo / wordmark          | Fraunces       | 600       | Normal |
| Landing page hero        | Fraunces       | 600       | Normal |
| App modal / panel titles | Fraunces       | 400       | Normal |
| Empty states, microcopy  | Fraunces       | 400       | Italic |
| Canvas text (default)    | Caveat Brush   | 400       | Normal |
| Canvas text (alternates) | Caveat / Geist | 400       | Normal |

---

## What to Avoid

- **Don't mix Fraunces and the Caveats** in the same area — they're both expressive and will clash.
- **Don't use Caveat or Caveat Brush in UI chrome** — they signal "rough draft", which is wrong for navigation and controls. Handwritten faces are canvas-only.
- **Don't use Geist for branding** — it's invisible by design, which is a liability for identity.
- **Don't hard-code `'Caveat Brush'` at a call site** — reference `DEFAULT_TEXT_FONT_FAMILY` so the default stays swappable in one place.
- **Don't ask Caveat Brush for bold** — it has no bold cut; you'll get fake bold.
- **Don't use Fraunces below 14px** — its optical sizing works best at display and heading sizes.
- **Don't use Geist Mono for labels or headings** — it's data-only; used elsewhere it feels cold and technical.
- **Don't use Geist Mono on the canvas** — canvas text should feel human, not like a terminal.
