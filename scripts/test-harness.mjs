import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const screenshotDir = path.join(root, 'test-screenshots')
fs.mkdirSync(screenshotDir, { recursive: true })

console.log('=== Building... ===')
execSync('node scripts/build.mjs', { cwd: root, stdio: 'inherit' })

console.log('=== Launching Electron... ===')
const electronBin = path.join(root, 'node_modules/.bin/electron')
const child = spawn(electronBin, [path.join(root, 'dist/main/index.cjs')], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' }
})

let stdout = ''
let stderr = ''
child.stdout.on('data', d => { stdout += d.toString(); process.stdout.write(d) })
child.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d) })

await new Promise(r => setTimeout(r, 10000))

console.log('\n=== Taking screenshot... ===')
const ts = Date.now()
const ssPath = path.join(screenshotDir, `screen-${ts}.png`)
try {
  execSync(`screencapture -w -o ${ssPath}`, { timeout: 5000 })
} catch {
  execSync(`screencapture ${ssPath}`)
}
console.log(`Screenshot: ${ssPath}`)

console.log('\n=== Console Output ===')
console.log(stdout.slice(-3000) || '(empty)')

const errorLines = stderr.split('\n').filter(l => 
  !l.includes('Autofill') && 
  !l.includes('ssl_client') && 
  !l.includes('SECURITY_WARNING') &&
  l.trim().length > 0
)
if (errorLines.length) {
  console.log('\n=== Errors ===')
  console.log(errorLines.join('\n'))
}

child.kill('SIGTERM')
await new Promise(r => setTimeout(r, 1000))
process.exit(0)
