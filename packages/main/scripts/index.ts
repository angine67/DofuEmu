import fs from 'fs'
import { join } from 'path'

function readScript(name: string): string {
  const candidates = [
    join(__dirname, '../scripts', name),
    join(__dirname, '../../packages/main/scripts', name),
    join(__dirname, name),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8')
    } catch {}
  }
  throw new Error(`Script not found: ${name}`)
}

let _attachBody: string | null = null
function getAttachBody(): string {
  if (!_attachBody) _attachBody = readScript('helper-attach.js')
  return _attachBody
}

function assemble(wrapperFile: string): string {
  return readScript(wrapperFile).replace('/* __ATTACH_BODY__ */', getAttachBody())
}

export function getHelperSnippet(): string {
  return assemble('helper-init.js')
}

export function getRuntimeHelperSnippet(): string {
  return assemble('helper-runtime.js')
}
