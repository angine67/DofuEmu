import { build, createServer } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import electron from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

async function run() {
  const server = await createServer({
    configFile: path.join(root, 'packages/renderer/vite.config.ts')
  })
  await server.listen()
  const address = server.httpServer.address()
  const host = typeof address === 'string' ? address : `127.0.0.1`
  const port = typeof address === 'string' ? 5173 : address.port

  process.env.VITE_DEV_SERVER_HOST = host
  process.env.VITE_DEV_SERVER_PORT = String(port)

  console.log(`Renderer dev server: http://${host}:${port}`)

  await build({
    configFile: path.join(root, 'packages/preload/vite.config.ts'),
    build: { watch: {} }
  })

  await build({
    configFile: path.join(root, 'packages/main/vite.config.ts'),
    build: { watch: {} },
    plugins: [
      {
        name: 'electron-restart',
        writeBundle() {
          if (electronProcess) {
            electronProcess.kill()
            electronProcess = null
          }
          startElectron()
        }
      }
    ]
  })
}

let electronProcess = null

function startElectron() {
  electronProcess = spawn(String(electron), [path.join(root, 'dist/main/index.cjs')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_HOST: process.env.VITE_DEV_SERVER_HOST,
      VITE_DEV_SERVER_PORT: process.env.VITE_DEV_SERVER_PORT
    }
  })

  electronProcess.on('close', (code) => {
    if (code !== null) {
      process.exit(code)
    }
  })
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
