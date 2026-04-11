import { build } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

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
  console.log('Copied game-base files to dist/')
  copyDir('packages/main/scripts', 'dist/scripts')
  console.log('Copied helper scripts to dist/')
}

async function run() {
  console.log('Building main...')
  await build({ configFile: path.join(root, 'packages/main/vite.config.ts') })

  copyGameBase()

  console.log('Building preload...')
  await build({ configFile: path.join(root, 'packages/preload/vite.config.ts') })

  console.log('Building renderer...')
  await build({ configFile: path.join(root, 'packages/renderer/vite.config.ts') })

  console.log('Build complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
