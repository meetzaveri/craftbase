// Publish the craftbase npm package from your machine.
//
//   yarn publish:npm                 publish VERSION to npm
//   yarn publish:npm --dry-run       do everything except the upload
//   yarn publish:npm --tag next      publish under a dist-tag (prereleases
//                                    default to `next`, releases to `latest`)
//   yarn publish:npm --allow-branch  publish from a branch other than main
//   yarn publish:npm --otp 123456    pass a 2FA code up front
//
// Before uploading it checks: clean git tree, on main, logged in to npm, and
// that this version isn't on npm yet. Then it typechecks, builds dist-lib/,
// runs the leak/consistency check, and runs `npm publish ./dist-lib`.
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const valueOf = (flag) => {
    const i = args.indexOf(flag)
    return i === -1 ? undefined : args[i + 1]
}

const dryRun = has('--dry-run')
const allowBranch = has('--allow-branch')
const otp = valueOf('--otp')

const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
const die = (msg) => {
    console.error(`\n✖ ${msg}\n`)
    process.exit(1)
}
const step = (msg) => console.log(`\n▸ ${msg}`)

const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim()
const isPrerelease = version.includes('-')
const tag = valueOf('--tag') ?? (isPrerelease ? 'next' : 'latest')

console.log(
    `craftbase@${version} → npm (tag: ${tag})${dryRun ? '  [dry run]' : ''}`
)

step('Checking git')
if (sh('git status --porcelain')) {
    die('Working tree has uncommitted changes. Commit or stash them first.')
}
const branch = sh('git rev-parse --abbrev-ref HEAD')
if (branch !== 'main' && !allowBranch) {
    die(`On branch "${branch}". Publish from main, or pass --allow-branch.`)
}

step('Checking npm login')
let npmUser = ''
try {
    npmUser = sh('npm whoami')
    console.log(`  logged in as ${npmUser}`)
} catch {
    if (!dryRun) die('Not logged in to npm. Run `npm login` and try again.')
    console.log('  not logged in (ok for --dry-run)')
}

step(`Checking that ${version} is not published yet`)
const view = spawnSync('npm', ['view', `craftbase@${version}`, 'version'], {
    cwd: ROOT,
    encoding: 'utf8',
})
if (view.status === 0 && view.stdout.trim() === version) {
    die(`craftbase@${version} is already on npm. Bump VERSION first.`)
}
console.log('  not published yet')

step('Typechecking')
run('yarn -s typecheck')

step('Building dist-lib/')
run('node scripts/build-package.mjs')

step('Checking the package')
run('node scripts/check-package.mjs')

step('Package contents')
run('npm pack ./dist-lib --dry-run')

step(dryRun ? 'Dry-run publish' : 'Publishing')
const publishArgs = [
    'publish',
    './dist-lib',
    '--access',
    'public',
    '--tag',
    tag,
]
if (dryRun) publishArgs.push('--dry-run')
if (otp) publishArgs.push('--otp', otp)
// stdio inherit: npm prompts for a 2FA code / web login itself if it needs one.
const pub = spawnSync('npm', publishArgs, { cwd: ROOT, stdio: 'inherit' })
if (pub.status !== 0) die('npm publish failed (see output above).')

if (dryRun) {
    console.log('\n✔ Dry run finished. Nothing was uploaded.\n')
} else {
    console.log(`\n✔ Published craftbase@${version} (tag: ${tag}).`)
    console.log(`  https://www.npmjs.com/package/craftbase/v/${version}`)
    console.log(
        `  Tag the release if you haven't: git tag v${version} && git push origin v${version}\n`
    )
}
