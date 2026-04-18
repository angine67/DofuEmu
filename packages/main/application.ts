import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron'
import { Hono, type Context } from 'hono'
import { serve } from '@hono/node-server'
import crypto from 'crypto'
import { Server } from 'http'
import { AddressInfo } from 'net'
import { join } from 'path'
import fs from 'fs'
import ElectronStore from 'electron-store'
import { IPCEvents, GameContext, NativeNotificationPayload } from '@dofemu/shared'
import { get } from './constants'
import { GameWindow } from './windows/game-window'
import { UpdaterWindow } from './windows/updater-window'
import { GameUpdater } from './updater'
import { logger } from './logger'
import { platform } from 'os'

const MIME_TYPES: Record<string, string> = {
  html: 'text/html',
  js: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  webp: 'image/webp'
}

function createStaticHandler(basePath: string, urlPrefix: string) {
  return async (c: Context) => {
    const reqPath = c.req.path.slice(urlPrefix.length)
    const filePath = join(basePath, decodeURIComponent(reqPath))

    if (!filePath.startsWith(basePath)) {
      return c.text('Forbidden', 403)
    }

    try {
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) return c.text('Not Found', 404)
    } catch {
      return c.text('Not Found', 404)
    }

    const content = fs.readFileSync(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''

    return new Response(content, {
      headers: {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

type StoreSchema = Record<string, unknown>

export class Application {
  private static _instance: Application | null = null
  private _gameWindow: GameWindow | null = null
  private _updaterWindow: UpdaterWindow | null = null
  private readonly _server: Server
  private readonly _hash: string
  private _buildVersion = ''
  private _appVersion = ''
  private _store: ElectronStore<StoreSchema>
  private _startupComplete = false

  static async init() {
    if (Application._instance) throw new Error('Application already initialized')

    const hash = crypto.createHash('sha256').update(app.getName() + app.getVersion()).digest('hex')

    const honoApp = new Hono()

    honoApp.use('*', async (c, next) => {
      await next()
      c.res.headers.set('Access-Control-Allow-Origin', '*')
    })

    honoApp.get('/game/*', createStaticHandler(get.GAME_PATH(), '/game/'))
    honoApp.get('/character-images/*', createStaticHandler(get.CHARACTER_IMAGES_PATH(), '/character-images/'))
    honoApp.get('/renderer/*', createStaticHandler(join(__dirname, '../renderer/'), '/renderer/'))

    const server: Server = await new Promise((resolve) => {
      const s = serve({
        fetch: honoApp.fetch,
        port: 0,
        hostname: '127.0.0.1'
      }) as Server

      s.on('listening', () => {
        const addr = s.address() as AddressInfo
        logger.info(`Local server on port ${addr.port}`)
        resolve(s)
      })
    })

    Application._instance = new Application(server, hash)
  }

  static get instance(): Application {
    return Application._instance!
  }

  private constructor(server: Server, hash: string) {
    this._server = server
    this._hash = hash
    this._store = new ElectronStore<StoreSchema>({ name: 'dofemu-data' })
  }

  get gameWindow(): GameWindow | null {
    return this._gameWindow
  }

  get serverPort(): number {
    return (this._server.address() as AddressInfo).port
  }

  get localBase(): string {
    return `http://127.0.0.1:${this.serverPort}`
  }

  run() {
    this._loadVersions()
    this._setupIPCHandlers()
    this.ensureWindow()
  }

  private _loadVersions() {
    try {
      if (fs.existsSync(get.LOCAL_VERSIONS_PATH())) {
        const data = JSON.parse(fs.readFileSync(get.LOCAL_VERSIONS_PATH(), 'utf-8'))
        if (data.buildVersion) this._buildVersion = data.buildVersion
        if (data.appVersion) this._appVersion = data.appVersion
        logger.info(`Loaded versions: build=${this._buildVersion} app=${this._appVersion}`)
      }
    } catch (err) {
      logger.warn('Failed to load versions.json', err)
    }
  }

  ensureWindow() {
    if (this._updaterWindow) {
      if (this._updaterWindow.isMinimized()) this._updaterWindow.restore()
      this._updaterWindow.focus()
      return
    }

    if (this._gameWindow) {
      if (this._gameWindow.isMinimized()) this._gameWindow.restore()
      this._gameWindow.focus()
      return
    }

    if (this._startupComplete) this._createGameWindow()
    else this._createUpdaterWindow()
  }

  setBuildVersion(v: string) { this._buildVersion = v }
  setAppVersion(v: string) { this._appVersion = v }

  processAuthCallback(url: string) {
    logger.info(`Auth callback: ${url.length} chars`)
    this._gameWindow?.processAuthCallback(url)
  }

  private _createGameWindow() {
    this._gameWindow = new GameWindow({ url: this._getRendererUrl('/game'), index: 0 })

    this._gameWindow.on('closed', () => {
      this._gameWindow = null
      if (!this._updaterWindow) app.quit()
    })
  }

  private _createUpdaterWindow() {
    this._updaterWindow = new UpdaterWindow({ url: this._getRendererUrl('/updater') })

    this._updaterWindow.on('closed', () => {
      this._updaterWindow = null
      if (!this._gameWindow) app.quit()
    })
  }

  private _getRendererUrl(route: '/game' | '/updater') {
    const devServer = process.env['VITE_DEV_SERVER_HOST'] && process.env['VITE_DEV_SERVER_PORT']
    return devServer
      ? `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}#${route}`
      : `${this.localBase}/renderer/index.html#${route}`
  }

  private _openGameWindow() {
    this._startupComplete = true

    if (!this._gameWindow) {
      this._createGameWindow()
    } else {
      this._gameWindow.focus()
    }

    if (this._updaterWindow) {
      const updaterWindow = this._updaterWindow
      this._updaterWindow = null
      updaterWindow.close()
    }
  }

  private _setupIPCHandlers() {
    ipcMain.handle(IPCEvents.GET_GAME_CONTEXT, (event) => {
      const context: GameContext = {
        gameSrc: `${this.localBase}/game/index.html?delayed=true`,
        characterImagesSrc: `${this.localBase}/character-images/`,
        windowId: event.sender.id,
        hash: this._hash,
        platform: platform(),
        buildVersion: this._buildVersion,
        appVersion: this._appVersion
      }
      return JSON.stringify(context)
    })

    ipcMain.handle(IPCEvents.GET_SETTINGS, () => {
      return JSON.stringify(this._store.get('settings', {}))
    })

    ipcMain.on(IPCEvents.SET_SETTINGS, (_event, settings: string) => {
      try {
        this._store.set('settings', JSON.parse(settings))
      } catch {}
    })

    ipcMain.handle(IPCEvents.STORE_GET, (_event, key: string) => {
      const val = this._store.get(key)
      return val !== undefined ? JSON.stringify(val) : null
    })

    ipcMain.on(IPCEvents.STORE_SET, (_event, key: string, value: string) => {
      try {
        this._store.set(key, JSON.parse(value))
      } catch {}
    })

    ipcMain.on(IPCEvents.STORE_DELETE, (_event, key: string) => {
      this._store.delete(key)
    })

    ipcMain.on(IPCEvents.OPEN_EXTERNAL, (_event, url: string) => {
      if (url.startsWith('https://') || url.startsWith('http://')) {
        shell.openExternal(url)
      }
    })

    ipcMain.on(IPCEvents.SET_AUDIO_MUTE, (_event, value: boolean) => {
      this._gameWindow?.setAudioMute(value)
    })

    ipcMain.on(IPCEvents.SET_SOUND_ON_FOCUS, (_event, value: boolean) => {
      this._gameWindow?.setSoundOnFocus(value)
    })

    ipcMain.on(IPCEvents.WINDOW_MINIMIZE, (event) => {
      BrowserWindow.fromWebContents(event.sender)?.minimize()
    })

    ipcMain.on(IPCEvents.WINDOW_MAXIMIZE, (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        win.isMaximized() ? win.unmaximize() : win.maximize()
      }
    })

    ipcMain.on(IPCEvents.WINDOW_CLOSE, (event) => {
      BrowserWindow.fromWebContents(event.sender)?.close()
    })

    ipcMain.on(IPCEvents.APP_READY_TO_SHOW, (event) => {
      BrowserWindow.fromWebContents(event.sender)?.show()
    })

    ipcMain.on(IPCEvents.SAVE_CHARACTER_IMAGE, (_event, name: string, imageData: string) => {
      const charImagesPath = get.CHARACTER_IMAGES_PATH()
      fs.mkdirSync(charImagesPath, { recursive: true })
      const base64 = imageData.replace(/^data:image\/png;base64,/, '')
      const filePath = join(charImagesPath, `${name}.png`)
      fs.writeFile(filePath, base64, 'base64', (err) => {
        if (err) logger.error('Failed to save character image', err)
        else logger.info(`Saved character image: ${name}.png`)
      })
    })

    ipcMain.on(IPCEvents.SHOW_NATIVE_NOTIFICATION, (event, payload: NativeNotificationPayload) => {
      if (!Notification.isSupported() || !payload?.title) return

      const win = BrowserWindow.fromWebContents(event.sender)
      const notification = new Notification({
        title: payload.title.slice(0, 120),
        body: payload.body?.slice(0, 260)
      })

      notification.on('click', () => {
        if (win) {
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
          win.webContents.send(IPCEvents.NATIVE_NOTIFICATION_CLICK, payload.tabId)
        }
      })

      notification.show()
    })

    ipcMain.handle(IPCEvents.CHECK_GAME_INSTALLED, () => {
      return ['index.html', join('build', 'script.js')].every((file) => fs.existsSync(join(get.GAME_PATH(), file)))
    })

    ipcMain.handle(IPCEvents.DOWNLOAD_GAME, async (event) => {
      const sender = event.sender
      const updater = new GameUpdater((message, percent) => {
        sender.send(IPCEvents.DOWNLOAD_PROGRESS, message, percent)
      })
      try {
        const versions = await updater.run()
        this._buildVersion = versions.buildVersion
        this._appVersion = versions.appVersion
        logger.info(`Game downloaded: build=${versions.buildVersion} app=${versions.appVersion}`)
        this._gameWindow?.processGame()
      } catch (err) {
        logger.error('Game download failed', err)
        throw err
      }
    })

    ipcMain.on(IPCEvents.OPEN_GAME_WINDOW, () => {
      this._openGameWindow()
    })
  }
}
