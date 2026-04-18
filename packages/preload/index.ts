import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { IPCEvents, GameContext, NativeNotificationPayload } from '@dofemu/shared'

const dofemuApi = {
  fetchGameContext: async (): Promise<GameContext> => {
    const data = await ipcRenderer.invoke(IPCEvents.GET_GAME_CONTEXT)
    return JSON.parse(data)
  },

  appReadyToShow: () => {
    ipcRenderer.send(IPCEvents.APP_READY_TO_SHOW)
  },

  openExternal: (url: string) => {
    ipcRenderer.send(IPCEvents.OPEN_EXTERNAL, url)
  },

  setAudioMute: (value: boolean) => {
    ipcRenderer.send(IPCEvents.SET_AUDIO_MUTE, value)
  },

  setSoundOnFocus: (value: boolean) => {
    ipcRenderer.send(IPCEvents.SET_SOUND_ON_FOCUS, value)
  },

  minimize: () => {
    ipcRenderer.send(IPCEvents.WINDOW_MINIMIZE)
  },

  maximize: () => {
    ipcRenderer.send(IPCEvents.WINDOW_MAXIMIZE)
  },

  close: () => {
    ipcRenderer.send(IPCEvents.WINDOW_CLOSE)
  },

  getSettings: async (): Promise<string> => {
    return ipcRenderer.invoke(IPCEvents.GET_SETTINGS)
  },

  setSettings: (settings: string) => {
    ipcRenderer.send(IPCEvents.SET_SETTINGS, settings)
  },

  checkGameInstalled: async (): Promise<boolean> => {
    return ipcRenderer.invoke(IPCEvents.CHECK_GAME_INSTALLED)
  },

  downloadGame: async (): Promise<void> => {
    await ipcRenderer.invoke(IPCEvents.DOWNLOAD_GAME)
  },

  launchGameWindow: () => {
    ipcRenderer.send(IPCEvents.OPEN_GAME_WINDOW)
  },

  onAuthCallback: (cb: (url: string) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, url: string) => cb(url)
    ipcRenderer.on(IPCEvents.AUTH_CALLBACK, listener)
    return () => { ipcRenderer.removeListener(IPCEvents.AUTH_CALLBACK, listener) }
  },

  onSelectTab: (cb: (index: number) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, index: number) => cb(index)
    ipcRenderer.on(IPCEvents.SELECT_TAB, listener)
    return () => { ipcRenderer.removeListener(IPCEvents.SELECT_TAB, listener) }
  },

  onDownloadProgress: (cb: (message: string, percent: number) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, message: string, percent: number) => cb(message, percent)
    ipcRenderer.on(IPCEvents.DOWNLOAD_PROGRESS, listener)
    return () => { ipcRenderer.removeListener(IPCEvents.DOWNLOAD_PROGRESS, listener) }
  },

  saveCharacterImage: (name: string, imageData: string) => {
    ipcRenderer.send(IPCEvents.SAVE_CHARACTER_IMAGE, name, imageData)
  },

  showNativeNotification: (payload: NativeNotificationPayload) => {
    ipcRenderer.send(IPCEvents.SHOW_NATIVE_NOTIFICATION, payload)
  },

  onNativeNotificationClick: (cb: (tabId?: string) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, tabId?: string) => cb(tabId)
    ipcRenderer.on(IPCEvents.NATIVE_NOTIFICATION_CLICK, listener)
    return () => { ipcRenderer.removeListener(IPCEvents.NATIVE_NOTIFICATION_CLICK, listener) }
  },

  storeGet: async (key: string): Promise<string | null> => {
    return ipcRenderer.invoke(IPCEvents.STORE_GET, key)
  },

  storeSet: (key: string, value: string) => {
    ipcRenderer.send(IPCEvents.STORE_SET, key, value)
  },

  storeDelete: (key: string) => {
    ipcRenderer.send(IPCEvents.STORE_DELETE, key)
  },

  logger: {
    info: (...args: unknown[]) => console.log('[renderer]', ...args),
    warn: (...args: unknown[]) => console.warn('[renderer]', ...args),
    error: (...args: unknown[]) => console.error('[renderer]', ...args),
    debug: (...args: unknown[]) => console.debug('[renderer]', ...args)
  }
}

contextBridge.exposeInMainWorld('dofemu', dofemuApi)
