// Fails the build on physical (direction-dependent) CSS in src/.
// The rule this enforces is CONVENTIONS.md §19; the reason it is a script and
// not a lint rule is that oxlint cannot see inside a className string.
//
// This is a tripwire, not a proof: it reads text, so a class assembled at
// runtime slips through. Grep by hand when you touch layout.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const ROOT = 'src'
const EXTENSIONS = new Set(['.ts', '.tsx', '.css'])

const PATTERNS = [
  // Tailwind physical spacing / borders / radii, e.g. `pl-8`, `-mr-1`.
  /(?<![\w-])-?(?:pl|pr|ml|mr|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br)-/g,
  // The same utilities with no scale suffix, e.g. `border-l`.
  /(?<![\w-])(?:border-[lr]|rounded-[lr])(?![\w-])/g,
  // Physical inset utilities, e.g. `right-4`.
  /(?<![\w-])-?(?:left|right)-/g,
  // Physical text alignment, both Tailwind and raw CSS.
  /(?<![\w-])text-(?:left|right)(?![\w-])/g,
  /text-align:\s*(?:left|right)/g,
  // Raw CSS physical box properties.
  /(?:margin|padding|border|inset)-(?:left|right)\b/g,
]

/**
 * The one sanctioned physical idiom: centring a fixed overlay with
 * `left-[50%]` plus `translate-x-[-50%]` is symmetric, so it is
 * direction-neutral by construction. A logical `start-[50%]` would be WRONG —
 * `start` flips with direction, `translate-x` does not. Skips the whole line,
 * which is acceptable because the idiom only ever appears inside a fixed
 * overlay's className. See Story 06 task 6a.
 */
const CENTERING = /left-(?:1\/2|\[50%\]).*translate-x-(?:\[-50%\]|1\/2|-1\/2)/

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (EXTENSIONS.has(extname(path))) yield path
  }
}

let failures = 0
for (const path of walk(ROOT)) {
  const lines = readFileSync(path, 'utf8').split('\n')
  lines.forEach((line, index) => {
    if (CENTERING.test(line)) return
    for (const pattern of PATTERNS) {
      for (const match of line.matchAll(pattern)) {
        process.stdout.write(`${path}:${index + 1}  ${match[0]}\n`)
        failures += 1
      }
    }
  })
}

if (failures > 0) {
  process.stdout.write(
    `\n${failures} physical direction ${failures === 1 ? 'utility' : 'utilities'} found. ` +
      'Use the logical equivalent — see CONVENTIONS.md §18.\n',
  )
  process.exit(1)
}
process.stdout.write('check:rtl — no physical direction utilities in src/.\n')
