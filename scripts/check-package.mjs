// Guard run before every publish (locally and in CI). Fails the build when
// dist-lib/ is incomplete, mis-versioned, or could leak secrets.
//
//   node scripts/check-package.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'dist-lib')
const errors = []
const fail = (msg) => errors.push(msg)

if (!existsSync(OUT)) {
    console.error('dist-lib/ not found. Run `yarn build:lib` first.')
    process.exit(1)
}

// 1. Required files.
for (const f of [
    'package.json',
    'index.js',
    'index.d.ts',
    'style.css',
    'LICENSE',
    'README.md',
]) {
    if (!existsSync(join(OUT, f))) fail(`missing dist-lib/${f}`)
}

// 2. Version matches VERSION.
const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim()
const manifest = JSON.parse(readFileSync(join(OUT, 'package.json'), 'utf8'))
if (manifest.name !== 'craftbase') fail(`package name is "${manifest.name}"`)
if (manifest.version !== version) {
    fail(`package version ${manifest.version} != VERSION ${version}`)
}
if (manifest.private) fail('publish manifest must not be private')
if (manifest.license !== 'MIT') {
    fail(`license is "${manifest.license}", expected MIT`)
}

// 3. No secrets or backend wiring in shipped files.
// Backend wiring that must never ship. Checked in runtime files only:
// sourcemaps embed the TS source, which legitimately mentions env var names.
const bannedInRuntime = [
    'x-hasura-admin-secret',
    'VITE_HASURA',
    'VITE_GRAPHQL',
    'VITE_SENTRY',
    'localhost:8080',
]
// Secret values: checked in every file, sourcemaps included.
const banned = []
// Every non-trivial value from local .env files is banned too.
for (const envFile of [
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
]) {
    const p = join(ROOT, envFile)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (!m) continue
        const value = m[2].replace(/^['"]|['"]$/g, '')
        if (value.length >= 8) banned.push(value)
    }
}

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name)
        return statSync(p).isDirectory() ? walk(p) : [p]
    })
}

for (const file of walk(OUT)) {
    const text = readFileSync(file, 'utf8')
    const needles = file.endsWith('.map')
        ? banned
        : [...bannedInRuntime, ...banned]
    for (const needle of needles) {
        if (text.includes(needle)) {
            const shown = needle.length > 24 ? `${needle.slice(0, 6)}…` : needle
            fail(`${relative(ROOT, file)} contains banned string "${shown}"`)
        }
    }
}

// 4. Public types must not depend on anything but React.
for (const file of walk(join(OUT, 'types'))) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/from\s+['"]([^'".][^'"]*)['"]/g)) {
        if (m[1] !== 'react') {
            fail(
                `${relative(ROOT, file)} imports "${m[1]}" (public types must be self-contained)`
            )
        }
    }
}

if (errors.length) {
    console.error('\n[check-package] FAILED')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
}
console.log(`[check-package] ok: craftbase@${version}`)
