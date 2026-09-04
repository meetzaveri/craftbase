# Responsive Design Guidelines

## Two tools, distinct purposes

Craftbase has two mechanisms for responsiveness. Use each only for what it's designed for.

---

## 1. Tailwind CSS responsive prefixes

**Use for everything that is purely a style change.**

The project defines custom breakpoints in `tailwind.config.js`:

| Prefix | Min-width |
|---|---|
| `tablet:` | 640px |
| `tablet-landscape:` | 768px |
| `laptop:` | 1024px |
| `desktop:` | 1280px |
| `big-desktop:` | 1536px |

Write mobile-first: base classes apply to mobile, prefix classes override at larger sizes.

```jsx
// Spacing, sizing, typography, layout direction — all CSS concerns
<div className="px-4 tablet-landscape:px-6 py-8 tablet-landscape:py-12">
<h1 className="text-xl tablet-landscape:text-2xl font-bold">
<div className="grid grid-cols-1 tablet-landscape:grid-cols-2 gap-3">
<div className="flex flex-col tablet-landscape:flex-row items-start tablet-landscape:items-center">
```

**Valid Tailwind spacing values in this project** — spacing scale starts at `1` (0.25rem).
`mb-0.5`, `gap-0.5` etc. are NOT valid — use `mb-1`, `gap-1` as the smallest increment.

---

## 2. `useMediaQueryUtils` hook

**Use only when the HTML structure itself must differ between breakpoints** — not just styles.

Located at `src/constants/exportHooks.js`:

```js
import { useMediaQueryUtils } from 'constants/exportHooks'

const { isMobile, isTablet, isLaptop, isDesktop } = useMediaQueryUtils()
```

Breakpoints (from `react-responsive`):

| Variable | Range |
|---|---|
| `isMobile` | ≤ 767px |
| `isTablet` | 768px – 1023px |
| `isLaptop` | 1024px – 1279px |
| `isDesktop` | 1280px – 1535px |

### When to use the hook

**1. Completely removing an element**
```jsx
// DefaultsDropdown hidden on mobile — element absent, not just hidden
const { isMobile } = useMediaQueryUtils()
if (isMobile) return null
```

**2. Element renders in a different DOM position across breakpoints**
```jsx
// Label moves from beside icon (mobile) to above email (desktop)
// Can't achieve this with CSS alone without duplicating the node
{isMobile && <div className="...">Get in touch directly</div>}
// ... (different parent)
{!isMobile && <div className="...">Get in touch directly</div>}
```

**3. Different text content (not just size)**
```jsx
// "Back" vs "Back to board" — different string, not a style tweak
{isMobile ? 'Back' : 'Back to board'}
```

**4. Fundamentally different layout requiring JS-driven positioning**
```jsx
// ShapesToolbar shifts from centered-horizontal to left-anchored-vertical
// The transform and anchor point change can't be expressed in Tailwind alone
style={isMobile
    ? { top: '56px', left: '10px', zIndex: 10 }
    : { transform: 'translateX(-50%)', zIndex: 10 }
}
```

### When NOT to use the hook

Do not reach for the hook to change padding, font size, color, flex direction, grid columns, margin, or any other property that Tailwind can express with a responsive prefix. Using the hook for these adds unnecessary JS re-renders for what is a pure CSS concern.

```jsx
// ❌ Wrong — Tailwind handles this
const { isMobile } = useMediaQueryUtils()
<div className={isMobile ? 'px-4' : 'px-6'}>

// ✅ Correct
<div className="px-4 tablet-landscape:px-6">
```

---

## Decision rule

> **"Does the HTML change, or just the CSS?"**
>
> - Only CSS changes → Tailwind prefix
> - HTML structure changes (element removed, repositioned in DOM, different content) → `useMediaQueryUtils` hook
