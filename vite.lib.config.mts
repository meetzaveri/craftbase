// Library build for the `craftbase` npm package. Run through
// `yarn build:lib` (scripts/build-package.mjs), which also writes the
// publish manifest. The app build (vite.config.mjs) is untouched.
//
// Output (dist-lib/):
//   index.js    ESM entry (+ lazily loaded chunks)
//   style.css   all craftbase CSS, scoped under `.cb-embed`
//   (types are emitted separately by tsc -p tsconfig.lib.json)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import svgr from 'vite-plugin-svgr'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import prefixSelector from 'postcss-prefix-selector'

const ROOT = '.cb-embed'

// Scope every selector under the embed root (see src/embed/embed.css).
function scopeSelector(
    prefix: string,
    selector: string,
    prefixedSelector: string
): string {
    if (selector.startsWith(ROOT)) return selector
    // Page-level selectors become the root itself.
    if (/^(:root|html|body|:host)\b/.test(selector)) {
        return selector.replace(/^(html\s+body|:root|html|body|:host)/, prefix)
    }
    // Theme class: `theme="dark"` puts `dark` on the root element.
    // (Not Tailwind's `.dark\:utility` classes — those stay descendants.)
    if (/^\.dark(?![\w\\-])/.test(selector)) {
        return selector.replace(/^\.dark/, `${prefix}.dark`)
    }
    return prefixedSelector
}

// Externalize React only; everything else (two.js, Apollo, framer-motion, ...)
// is bundled so consumers install nothing extra and can't hit version clashes.
const EXTERNAL = [/^react($|\/)/, /^react-dom($|\/)/]

export default defineConfig({
    plugins: [svgr(), react(), tsconfigPaths()],
    // No `.env` value may reach the published bundle. The only env reads on
    // the Board path are optional; force them to undefined.
    define: {
        'import.meta.env.VITE_GRAPHQL_ERROR_POLICY': 'undefined',
        'import.meta.env.VITE_GRAPHQL_ENDPOINT': 'undefined',
        'import.meta.env.VITE_WS_GRAPHQL_ENDPOINT': 'undefined',
        'import.meta.env.VITE_HASURA_ADMIN_SECRET': 'undefined',
        'import.meta.env.VITE_SENTRY_DSN': 'undefined',
    },
    envPrefix: '__CRAFTBASE_LIB_NO_ENV__',
    css: {
        postcss: {
            plugins: [
                tailwindcss(),
                prefixSelector({ prefix: ROOT, transform: scopeSelector }),
                autoprefixer(),
            ],
        },
    },
    build: {
        outDir: 'dist-lib',
        emptyOutDir: true,
        sourcemap: true,
        cssCodeSplit: false,
        lib: {
            entry: 'src/lib.ts',
            formats: ['es'],
            fileName: () => 'index.js',
            cssFileName: 'style',
        },
        rollupOptions: {
            external: EXTERNAL,
            output: {
                entryFileNames: 'index.js',
                chunkFileNames: 'chunks/[name]-[hash].js',
            },
        },
    },
})
