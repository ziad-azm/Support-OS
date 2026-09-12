#!/usr/bin/env node
/**
 * PostToolUse hook (Write|Edit|NotebookEdit): auto-formats the single file
 * Claude just touched, so AI-made changes are always pre-formatted before
 * the .githooks/pre-commit gate runs `ruff format --check` / `prettier
 * --check`. Formats only the touched file, not the whole tree.
 *
 * Fails silently (exit 0) whenever the formatter isn't set up (no venv, no
 * node_modules) or the file is outside backend/ or frontend/ — a missing
 * dev environment must never block a tool call.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const IS_WIN = process.platform === 'win32'

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function relPath(filePath) {
  const rel = path.relative(ROOT, filePath).split(path.sep).join('/')
  return rel.startsWith('..') ? null : rel
}

function run(cmd, args) {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' })
  } catch (e) {
    if (process.env.FORMAT_HOOK_DEBUG) console.error('DEBUG run failed:', cmd, args, e.message)
  }
}

function main() {
  const DEBUG = !!process.env.FORMAT_HOOK_DEBUG
  const dbg = (...a) => DEBUG && console.error('DEBUG', ...a)

  let data
  try {
    data = JSON.parse(readStdin())
  } catch (e) {
    dbg('JSON parse failed', e.message)
    return
  }

  const toolInput = data.tool_input || {}
  const filePath = toolInput.file_path || toolInput.notebook_path
  dbg('filePath', filePath)
  if (!filePath) return

  const rel = relPath(filePath)
  dbg('rel', rel)
  if (!rel) return

  if (rel.startsWith('backend/') && rel.endsWith('.py')) {
    const ruff = path.join(ROOT, 'backend', '.venv', IS_WIN ? 'Scripts/ruff.exe' : 'bin/ruff')
    dbg('ruff path', ruff, 'exists', fs.existsSync(ruff))
    if (fs.existsSync(ruff)) run(ruff, ['format', filePath])
    return
  }

  if (rel.startsWith('frontend/') && /\.(ts|tsx|js|jsx|json|css|md)$/.test(rel)) {
    // Invoke prettier's real .cjs entrypoint directly (via `node`) instead
    // of the node_modules/.bin/prettier.cmd shim — execFileSync can't spawn
    // a .cmd on Windows without shell: true, which is both noisy
    // (DEP0190) and unnecessary once we bypass the shim.
    const prettierCli = path.join(ROOT, 'frontend', 'node_modules', 'prettier', 'bin', 'prettier.cjs')
    dbg('prettier cli', prettierCli, 'exists', fs.existsSync(prettierCli))
    if (fs.existsSync(prettierCli)) {
      run(process.execPath, [prettierCli, '--write', filePath])
    }
  } else {
    dbg('no branch matched for rel', rel)
  }
}

main()
