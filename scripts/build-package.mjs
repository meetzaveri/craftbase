// Build the publishable `craftbase` npm package into dist-lib/.
//
//   node scripts/build-package.mjs        (yarn build:lib)
//
// 1. vite library build  → dist-lib/index.js, chunks/, style.css
// 2. tsc declarations    → dist-lib/types/ (pruned to the public graph)
// 3. publish manifest    → dist-lib/package.json (version from VERSION)
// 4. README.npm.md       → dist-lib/README.md
//
// The repo's own package.json describes the app and stays `private: true`, so
// publishing is only ever possible from dist-lib/.
import { execSync } from 'node:child_process'
import {
    copyFileSync,
    existsSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'dist-lib')
const TYPES = join(OUT, 'types')

const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' })

const appPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim()
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`VERSION "${version}" is not a valid semver version`)
}

console.log(`\n[build-package] craftbase@${version}\n`)
rmSync(OUT, { recursive: true, force: true })

// 1. Bundle. --mode production keeps import.meta.env.DEV false.
run('npx vite build -c vite.lib.config.mts --mode production')

// 2. Declarations, then keep only what lib.d.ts actually reaches.
run('npx tsc -p tsconfig.lib.json')

const RELATIVE_SPEC = /(from\s+|import\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g
const SIDE_EFFECT_IMPORT = /^import\s+['"][^'"]+['"];?\s*$/gm

function resolveDts(fromFile, spec) {
    const base = resolve(dirname(fromFile), spec.replace(/\.js$/, ''))
    for (const candidate of [`${base}.d.ts`, join(base, 'index.d.ts')]) {
        if (existsSync(candidate)) return candidate
    }
    return null
}

const reachable = new Set()
const queue = [join(TYPES, 'lib.d.ts')]
while (queue.length) {
    const file = queue.pop()
    if (reachable.has(file)) continue
    reachable.add(file)
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(RELATIVE_SPEC)) {
        const target = resolveDts(file, m[3])
        if (target) queue.push(target)
    }
}

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name)
        return statSync(p).isDirectory() ? walk(p) : [p]
    })
}

for (const file of walk(TYPES)) {
    if (!reachable.has(file)) rmSync(file)
}
for (const file of reachable) {
    // Drop side-effect imports (the CSS import in lib.ts) and add explicit
    // `.js` extensions so node16/nodenext consumers resolve the files too.
    const src = readFileSync(file, 'utf8')
        .replace(SIDE_EFFECT_IMPORT, '')
        .replace(RELATIVE_SPEC, (all, kw, q, spec) => {
            const target = resolveDts(file, spec)
            if (!target) return all
            let rel = relative(dirname(file), target).replace(/\.d\.ts$/, '.js')
            if (!rel.startsWith('.')) rel = `./${rel}`
            return `${kw}${q}${rel}${q}`
        })
    writeFileSync(file, src)
}
// Remove now-empty directories.
function pruneEmpty(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) pruneEmpty(p)
    }
    if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true })
}
pruneEmpty(TYPES)
writeFileSync(join(OUT, 'index.d.ts'), "export * from './types/lib.js'\n")

// 3. Publish manifest, written from scratch: only what consumers need.
// Verified on React 18.3 and 19.3 (embed checks in both, incl. StrictMode).
const reactRange = '^18.2.0 || ^19.0.0'
const manifest = {
    name: 'craftbase',
    version,
    description:
        'Embeddable whiteboard canvas for React: shapes, connectors, text, freehand drawing, pan and zoom.',
    keywords: ['whiteboard', 'canvas', 'react', 'drawing', 'diagram', 'two.js'],
    type: 'module',
    main: './index.js',
    module: './index.js',
    types: './index.d.ts',
    exports: {
        '.': {
            types: './index.d.ts',
            import: './index.js',
            default: './index.js',
        },
        './style.css': './style.css',
        './package.json': './package.json',
    },
    sideEffects: ['*.css'],
    files: [
        'index.js',
        'index.js.map',
        'index.d.ts',
        'style.css',
        'chunks',
        'types',
        'LICENSE',
    ],
    peerDependencies: {
        react: reactRange,
        'react-dom': reactRange,
    },
    homepage: 'https://craftbase.org/embeddable-whiteboard',
    repository: {
        type: 'git',
        url: 'git+https://github.com/meetzaveri/craftbase.git',
    },
    bugs: { url: 'https://github.com/meetzaveri/craftbase/issues' },
}
if (appPkg.license) manifest.license = appPkg.license
else console.warn('[build-package] warning: no "license" in package.json')

writeFileSync(
    join(OUT, 'package.json'),
    JSON.stringify(manifest, null, 4) + '\n'
)

// 4. Docs.
copyFileSync(join(ROOT, 'README.npm.md'), join(OUT, 'README.md'))
if (existsSync(join(ROOT, 'LICENSE'))) {
    copyFileSync(join(ROOT, 'LICENSE'), join(OUT, 'LICENSE'))
}

console.log(`\n[build-package] done → ${relative(ROOT, OUT)}/`)
