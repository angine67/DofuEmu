import { build, createServer } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import fs from 'fs'
import electron from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const mainEntry = path.join(root, 'dist/main/index.cjs')
const electronBin = typeof electron === 'string' ? electron : String(electron)

let electronProcess = null
let spawnTimer = null
let starting = false
const extraWatchers = []

function copyDir(srcRel, destRel) {
  const src = path.join(root, srcRel)
  const dest = path.join(root, destRel)
  fs.mkdirSync(dest, { recursive: true })

  for (const file of fs.readdirSync(src)) {
    const srcFile = path.join(src, file)
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, path.join(dest, file))
    }
  }
}

function copyGameBase() {
  copyDir('packages/main/game-base', 'dist/game-base')
  copyDir('packages/main/scripts', 'dist/scripts')
}

function watchExtraDir(relPath) {
  const dir = path.join(root, relPath)
  const watcher = fs.watch(dir, () => {
    copyGameBase()
    scheduleStart()
  })
  extraWatchers.push(watcher)
}

async function killElectron() {
  if (!electronProcess) return
  const proc = electronProcess
  electronProcess = null
  proc.removeAllListeners()
  if (proc.exitCode !== null) return
  await new Promise((resolve) => {
    proc.once('exit', resolve)
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGKILL')
        setTimeout(resolve, 100)
      }
    }, 1500)
  })
}

async function startElectron() {
  if (starting) return
  starting = true
  try {
    await killElectron()

    if (!fs.existsSync(mainEntry)) {
      console.warn(`[watch] main entry missing at ${mainEntry}, skipping spawn`)
      return
    }

    const proc = spawn(electronBin, [root], {
      stdio: 'inherit',
      cwd: root,
      env: process.env
    })
    electronProcess = proc

    proc.on('exit', (code, signal) => {
      if (electronProcess !== proc) return
      electronProcess = null
      if (signal === 'SIGTERM' || signal === 'SIGKILL') return
      if (code !== null && code !== 0) process.exit(code)
    })
  } finally {
    starting = false
  }
}

function scheduleStart() {
  if (spawnTimer) clearTimeout(spawnTimer)
  spawnTimer = setTimeout(() => {
    spawnTimer = null
    startElectron().catch((err) => {
      console.error('[watch] failed to start electron:', err)
    })
  }, 200)
}

process.on('SIGINT', async () => {
  for (const watcher of extraWatchers) watcher.close()
  await killElectron()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  for (const watcher of extraWatchers) watcher.close()
  await killElectron()
  process.exit(0)
})

async function run() {
  const server = await createServer({
    configFile: path.join(root, 'packages/renderer/vite.config.ts')
  })
  await server.listen()
  const address = server.httpServer.address()
  const host = typeof address === 'string' ? address : '127.0.0.1'
  const port = typeof address === 'string' ? 5173 : address.port

  process.env.VITE_DEV_SERVER_HOST = host
  process.env.VITE_DEV_SERVER_PORT = String(port)

  console.log(`Renderer dev server: http://${host}:${port}`)

  copyGameBase()
  watchExtraDir('packages/main/game-base')
  watchExtraDir('packages/main/scripts')

  await build({
    configFile: path.join(root, 'packages/preload/vite.config.ts'),
    build: { watch: {} },
    plugins: [
      {
        name: 'preload-reload',
        writeBundle() {
          server.ws.send({ type: 'full-reload' })
        }
      }
    ]
  })

  await build({
    configFile: path.join(root, 'packages/main/vite.config.ts'),
    build: { watch: {} },
    plugins: [
      {
        name: 'electron-restart',
        writeBundle() {
          scheduleStart()
        }
      }
    ]
  })
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
