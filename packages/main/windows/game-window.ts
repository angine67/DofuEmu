import { BrowserWindow, shell, BeforeSendResponse } from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { MOBILE_UA_BASE } from '@dofemu/shared'
import { get } from '../constants'
import { logger } from '../logger'
import { getHelperSnippet, getRuntimeHelperSnippet } from '../scripts'

interface GameWindowOptions {
  url: string
  index: number
}

const INITIAL_WIDTH = 1280
const INITIAL_HEIGHT = 720
const WS_LOG_TRUNCATE = 200

export class GameWindow extends EventEmitter {
  private readonly _win: BrowserWindow
  private _globalMuted = false
  private _soundOnFocus = true

  constructor(opts: GameWindowOptions) {
    super()

    this._win = new BrowserWindow({
      show: true,
      width: INITIAL_WIDTH,
      height: INITIAL_HEIGHT,
      frame: false,
      resizable: true,
      fullscreenable: true,
      title: 'DofEmu',
      icon: join(__dirname, '../../resources/icon.png'),
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        backgroundThrottling: false,
        partition: 'persist:' + opts.index,
        sandbox: false,
        webSecurity: false,
        allowRunningInsecureContent: true,
        webviewTag: true
      }
    })

    this._win.webContents.setUserAgent(
      `${MOBILE_UA_BASE} DofusTouch Client 3.10.1`
    )

    this._setupRequestInterceptors()
    this._setupEventHandlers()
    this.processGame()

    logger.info(`Loading URL: ${opts.url}`)
    this._win.loadURL(opts.url)
  }

  get id() {
    return this._win.webContents.id
  }

  focus() {
    this._win.focus()
  }

  isMinimized() {
    return this._win.isMinimized()
  }

  restore() {
    this._win.restore()
  }

  setAudioMute(value: boolean) {
    this._globalMuted = value
    this._win.webContents.setAudioMuted(value)
  }

  setSoundOnFocus(value: boolean) {
    this._soundOnFocus = value
  }

  processAuthCallback(url: string) {
    const escaped = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const js = `
      (function() {
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
          try {
            var win = iframes[i].contentWindow;
            if (win && typeof win.$appSchemeLinkCalled === 'function') {
              win.$appSchemeLinkCalled('${escaped}');
              return 'dispatched to iframe ' + i;
            }
          } catch(e) {}
        }
        if (typeof window.$appSchemeLinkCalled === 'function') {
          window.$appSchemeLinkCalled('${escaped}');
          return 'dispatched to window';
        }
        return 'no handler found';
      })()
    `
    this._win.webContents
      .executeJavaScript(js)
      .then((result: string) => logger.info('Auth callback:', result))
      .catch((err: Error) => logger.error('Auth callback inject failed', err))
  }

  processGame() {
    const buildPath = path.join(get.GAME_PATH(), 'build', 'script.js')
    if (!fs.existsSync(buildPath)) return

    let build = fs.readFileSync(buildPath, 'utf-8')
    let changed = false

    const patches: Array<{ name: string; re: RegExp; template: (m: RegExpExecArray) => string }> = [
      {
        name: '$_haapiModule',
        re: /(\w)\.getHaapiKeyManager\s*=\s*function\s*\(\)/,
        template: (m) => `window.$_haapiModule=${m[1]},${m[0]}`
      },
      {
        name: '$_authManager',
        re: /(\w)\.requestWebAuthToken\s*=\s*function/,
        template: (m) => `window.$_authManager=${m[1]},${m[0]}`
      },
      {
        name: '$_haapiAccount',
        re: /(\w)\.account\s*=\s*new\s+(\w)\((\w),\s*(\w)\)/,
        template: (m) => `${m[0]},window.$_haapiAccount=${m[1]}.account`
      }
    ]

    for (const patch of patches) {
      if (build.includes(patch.name)) continue
      const match = patch.re.exec(build)
      if (!match) continue
      build = build.replace(match[0], patch.template(match))
      changed = true
      logger.info(`Patched: ${patch.name} exposed`)
    }

    const helperStripper = /;\s*\(\(\) => \{[\s\S]*?\$_deExposeLoginAndCert_v2[\s\S]*?\}\)\(\);/g
    if (helperStripper.test(build)) {
      build = build.replace(helperStripper, '')
      changed = true
    }

    if (!build.includes('$_deExposeLoginAndCert_v2')) {
      build += getHelperSnippet()
      changed = true
      logger.info('Patched: helper snippet appended')
    }

    if (changed) {
      fs.writeFileSync(buildPath, build)
      logger.info('processGame: wrote patched script.js')
    }
  }

  private _setupRequestInterceptors() {
    this._win.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ['https://*.ankama.com/*', 'https://*.ankama-games.com/*'] },
      (details, callback) => {
        const requestHeaders = { ...(details.requestHeaders ?? {}) }
        delete requestHeaders['Referer']
        for (const key of Object.keys(requestHeaders)) {
          if (key.startsWith('Sec-')) delete requestHeaders[key]
        }
        callback({ requestHeaders } as BeforeSendResponse)
      }
    )

    this._win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url)
      }
      return { action: 'deny' }
    })

    this._win.webContents.session.webRequest.onCompleted((details) => {
      if (details.url.startsWith('http://127.0.0.1')) return
      const tag = details.statusCode >= 400 ? 'ERR' : 'OK'
      logger.info(`[HTTP ${tag}] ${details.method} ${details.statusCode} ${details.url}`)
    })

    this._win.webContents.session.webRequest.onErrorOccurred((details) => {
      if (details.url.startsWith('http://127.0.0.1')) return
      logger.error(`[HTTP FAIL] ${details.method} ${details.url} — ${details.error}`)
    })
  }

  private _setupEventHandlers() {
    this._win.webContents.on('did-finish-load', () => {
      this._injectHelperBridge()
      this._attachWebSocketLogger()
    })

    this._win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) logger.error(`[renderer] ${message}`)
      else logger.info(`[renderer] ${message}`)
    })

    this._win.on('focus', () => {
      if (!this._globalMuted) this._win.webContents.setAudioMuted(false)
    })

    this._win.on('blur', () => {
      if (this._soundOnFocus) this._win.webContents.setAudioMuted(true)
    })

    this._win.on('closed', () => this.emit('closed'))
  }

  private _attachWebSocketLogger() {
    const dbg = this._win.webContents.debugger
    try {
      dbg.attach('1.3')
    } catch {
      return
    }

    dbg.sendCommand('Network.enable').catch(() => {})

    dbg.on('message', (_event, method, params) => {
      switch (method) {
        case 'Network.webSocketCreated':
          logger.info(`[WS OPEN] ${params.url}`)
          break
        case 'Network.webSocketFrameSent':
          logger.info(`[WS SEND] ${this._truncate(params.response?.payloadData)}`)
          break
        case 'Network.webSocketFrameReceived':
          logger.info(`[WS RECV] ${this._truncate(params.response?.payloadData)}`)
          break
        case 'Network.webSocketClosed':
          logger.info(`[WS CLOSE] requestId=${params.requestId}`)
          break
        case 'Network.webSocketFrameError':
          logger.error(`[WS ERR] ${params.errorMessage}`)
          break
      }
    })
  }

  private _truncate(str: string | undefined): string {
    if (!str) return '(empty)'
    return str.length > WS_LOG_TRUNCATE ? str.substring(0, WS_LOG_TRUNCATE) + '...' : str
  }

  private _injectHelperBridge() {
    this._win.webContents.executeJavaScript(getRuntimeHelperSnippet()).catch(() => {})
  }
}
