import fs from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import path from 'path'
import { get } from '../constants'
import { DOFUS_ORIGIN, DOFUS_ITUNES } from '@dofemu/shared'
import { logger } from '../logger'

const MAX_RETRIES = 3
const RETRY_DELAY = 1000
const USER_AGENT = 'DofEmu Updater'

interface Manifest {
  files: Record<string, { filename: string; version: string }>
}

type DiffManifest = Record<string, 1 | 0 | -1>
type RegexPatch = [string, string]
type RegexPatches = Record<string, RegexPatch[]>

interface ItunesLookup {
  resultCount: number
  results: { version: string }[]
}

interface GameVersion {
  buildVersion: string
  appVersion: string
}

export type ProgressCallback = (message: string, percent: number) => void

async function fetchRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (res.ok) return res
      if (i < retries && res.status >= 500) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY * (i + 1)))
        continue
      }
      throw new Error(`HTTP ${res.status} for ${url}`)
    } catch (err) {
      if (i >= retries) throw err
      await new Promise((r) => setTimeout(r, RETRY_DELAY * (i + 1)))
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchRetry(url)
  return res.json() as Promise<T>
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchRetry(url)
  return res.text()
}

async function fetchToFile(url: string, filePath: string): Promise<void> {
  const res = await fetchRetry(url)
  if (!res.body) throw new Error(`No body for ${url}`)
  const ws = fs.createWriteStream(filePath)
  await pipeline(Readable.fromWeb(res.body as any), ws)
}

export class GameUpdater {
  private readonly _onProgress: ProgressCallback

  constructor(onProgress: ProgressCallback) {
    this._onProgress = onProgress
  }

  async run(): Promise<GameVersion> {
    const gamePath = get.GAME_PATH()
    fs.mkdirSync(gamePath, { recursive: true })
    fs.mkdirSync(path.join(gamePath, 'build'), { recursive: true })

    this._onProgress('Copying base files...', 5)
    this._copyBaseFiles()

    this._onProgress('Downloading manifests...', 10)
    const [, remoteAsset, assetDiff] = await this._retrieveManifests(get.LOCAL_ASSET_MAP_PATH(), DOFUS_ORIGIN + 'assetMap.json')
    const [, remoteDofus, dofusDiff] = await this._retrieveManifests(get.LOCAL_DOFUS_MANIFEST_PATH(), DOFUS_ORIGIN + 'manifest.json')

    this._onProgress('Downloading assets...', 15)
    await this._downloadAssetFiles(assetDiff, remoteAsset)

    this._onProgress('Downloading game files...', 50)
    const dofusFiles = await this._downloadGameFiles(dofusDiff, remoteDofus)

    this._onProgress('Finding versions...', 65)
    const versions = await this._findVersions(dofusFiles)

    this._onProgress('Applying patches...', 75)
    this._applyRegex(dofusFiles)

    this._onProgress('Writing files...', 85)
    this._writeFiles(dofusFiles)

    this._onProgress('Cleaning up...', 90)
    this._removeOld(dofusDiff, remoteDofus)

    this._onProgress('Saving manifests...', 95)
    await Promise.all([
      fs.promises.writeFile(get.LOCAL_ASSET_MAP_PATH(), JSON.stringify(remoteAsset)),
      fs.promises.writeFile(get.LOCAL_DOFUS_MANIFEST_PATH(), JSON.stringify(remoteDofus)),
      fs.promises.writeFile(get.LOCAL_VERSIONS_PATH(), JSON.stringify(versions))
    ])

    this._onProgress('Done', 100)
    return versions
  }

  private _copyBaseFiles() {
    const baseDir = path.join(__dirname, '../game-base')
    const gamePath = get.GAME_PATH()
    const files = ['index.html', 'fixes.js', 'fixes.css', 'regex.json']

    for (const file of files) {
      const src = path.join(baseDir, file)
      const dest = path.join(gamePath, file)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
        logger.info(`Copied ${file} to game dir`)
      } else {
        logger.warn(`Base file not found: ${src}`)
      }
    }
  }

  private async _retrieveManifests(localPath: string, remoteUrl: string): Promise<[Manifest, Manifest, DiffManifest]> {
    const local: Manifest = fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, 'utf-8')) : { files: {} }
    const remote = await fetchJson<Manifest>(remoteUrl)
    const diff: DiffManifest = {}

    if (remote?.files) {
      for (const key in remote.files) {
        if (!local?.files?.[key] || local.files[key].version !== remote.files[key].version) {
          diff[key] = 1
        } else {
          diff[key] = 0
        }
      }
    }
    if (local?.files) {
      for (const key in local.files) {
        if (!remote?.files?.[key]) diff[key] = -1
      }
    }

    return [local, remote, diff]
  }

  private async _downloadAssetFiles(diff: DiffManifest, manifest: Manifest) {
    const keys = Object.keys(diff).filter((k) => diff[k] === 1)
    let done = 0
    for (const key of keys) {
      const url = DOFUS_ORIGIN + manifest.files[key].filename
      const filePath = get.GAME_PATH() + manifest.files[key].filename
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      await fetchToFile(url, filePath)
      done++
      this._onProgress(`Downloading assets (${done}/${keys.length})`, 15 + (done / keys.length) * 35)
    }
  }

  private async _downloadGameFiles(diff: DiffManifest, manifest: Manifest): Promise<Record<string, string>> {
    const files: Record<string, string> = {}
    const keys = Object.keys(diff).filter((k) => diff[k] === 1)
    let done = 0

    for (const key of keys) {
      const url = DOFUS_ORIGIN + manifest.files[key].filename
      logger.info(`Downloading ${key} from ${url}`)
      files[key] = await fetchText(url)
      done++
      this._onProgress(`Downloading game files (${done}/${keys.length})`, 50 + (done / keys.length) * 15)
    }

    return files
  }

  private async _findVersions(dofusFiles: Record<string, string>): Promise<GameVersion> {
    const existing: GameVersion = fs.existsSync(get.LOCAL_VERSIONS_PATH())
      ? JSON.parse(fs.readFileSync(get.LOCAL_VERSIONS_PATH(), 'utf-8'))
      : { buildVersion: '', appVersion: '' }

    const script = dofusFiles['build/script.js']
    if (script) {
      const match = script.match(/window\.buildVersion\s?=\s?"(\d+\.\d+\.\d+(?:-\d+)?)"/)
      if (match) existing.buildVersion = match[1]

      try {
        const iTunes = await fetchJson<ItunesLookup>(DOFUS_ITUNES + '&t=' + Date.now())
        existing.appVersion = iTunes.results[0].version
      } catch (err) {
        logger.warn('Could not fetch iTunes version', err)
      }
    }

    logger.info(`Versions: build=${existing.buildVersion} app=${existing.appVersion}`)
    return existing
  }

  private _applyRegex(dofusFiles: Record<string, string>) {
    const regexPath = path.join(get.GAME_PATH(), 'regex.json')
    if (!fs.existsSync(regexPath)) {
      logger.warn('No regex.json found, skipping patches')
      return
    }

    const regex: RegexPatches = JSON.parse(fs.readFileSync(regexPath, 'utf-8'))

    for (const filename in regex) {
      if (dofusFiles[filename]) {
        let patched = 0
        for (const [pattern, replacement] of regex[filename]) {
          const before = dofusFiles[filename]
          dofusFiles[filename] = dofusFiles[filename].replace(new RegExp(pattern, 'g'), replacement)
          if (dofusFiles[filename] !== before) patched++
        }
        logger.info(`Applied ${patched}/${regex[filename].length} regex patches to ${filename}`)
      }
    }
  }

  private _writeFiles(files: Record<string, string>) {
    for (const filename in files) {
      const filePath = get.GAME_PATH() + filename
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, files[filename])
      logger.info(`Wrote ${filename} (${(files[filename].length / 1024).toFixed(0)}KB)`)
    }
  }

  private _removeOld(diff: DiffManifest, manifest: Manifest) {
    for (const key in diff) {
      if (diff[key] === -1 && manifest.files?.[key]) {
        const filePath = get.GAME_PATH() + manifest.files[key].filename
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          const dir = path.dirname(filePath)
          try {
            if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
          } catch {}
        }
      }
    }
  }
}
