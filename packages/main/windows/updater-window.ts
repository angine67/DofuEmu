import { BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import { join } from 'path'
import { IPCEvents } from '@dofemu/shared'
import { logger } from '../logger'

interface UpdaterWindowOptions {
  url: string
}

export class UpdaterWindow extends EventEmitter {
  private readonly _win: BrowserWindow

  constructor(opts: UpdaterWindowOptions) {
    super()

    this._win = new BrowserWindow({
      show: false,
      width: 700,
      height: 190,
      minWidth: 700,
      minHeight: 190,
      maxWidth: 700,
      maxHeight: 190,
      title: 'DofEmu Updater',
      autoHideMenuBar: true,
      backgroundColor: '#111218',
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      icon: join(__dirname, '../../resources/icon.png'),
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        backgroundThrottling: false,
        sandbox: false
      }
    })

    this._win.on('closed', () => this.emit('closed'))
    this._win.loadURL(opts.url)
    logger.info(`Loading updater URL: ${opts.url}`)
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

  close() {
    this._win.close()
  }

  sendProgress(message: string, percent: number) {
    this._win.webContents.send(IPCEvents.DOWNLOAD_PROGRESS, message, percent)
  }
}
