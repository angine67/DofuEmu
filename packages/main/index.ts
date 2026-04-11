import { app, nativeImage } from 'electron'
import path from 'path'
import { APP_SCHEME_PROTOCOLS } from '@dofemu/shared'
import { Application } from './application'
import { logger } from './logger'

process.on('uncaughtException', (err) => {
  if (err.message?.includes('EPIPE')) return
  logger.error('Uncaught exception:', err)
})

app.setName('DofEmu')
app.setPath('userData', path.join(app.getPath('appData'), 'DofEmu'))

app.commandLine.appendSwitch('ignore-gpu-blacklist', 'true')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('max-active-webgl-contexts', '32')

if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  logger.warn('Another instance is already running — focusing it instead.')
  app.quit()
}

for (const scheme of APP_SCHEME_PROTOCOLS) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient(scheme)
  }
  logger.info(`Registered protocol: ${scheme}`)
}

function isAuthUrl(url: string): boolean {
  if (!url) return false
  return APP_SCHEME_PROTOCOLS.some((s) => url.startsWith(s + '://'))
}

function handleAuthUrl(url: string) {
  if (!isAuthUrl(url)) return
  logger.info(`Auth URL received: ${url.substring(0, 60)}...`)
  Application.instance?.processAuthCallback(url)
}

if (process.platform === 'darwin') {
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleAuthUrl(url)
  })
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine[commandLine.length - 1]
    handleAuthUrl(url)
    const win = Application.instance?.gameWindow
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

app.whenReady().then(async () => {
  logger.info('App ready')

  const iconPath = path.join(__dirname, '../../resources/icon.png')
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  await Application.init()
  Application.instance.run()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  Application.instance?.ensureWindow()
})
