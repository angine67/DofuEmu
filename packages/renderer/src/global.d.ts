/// <reference types="vite/client" />
import type { GameContext } from '@dofemu/shared'
import type { NativeNotificationPayload } from '@dofemu/shared'
import type { AppUpdateStatus } from '@dofemu/shared'

interface DofemuAPI {
  fetchGameContext(): Promise<GameContext>
  appReadyToShow(): void
  openExternal(url: string): void
  setAudioMute(value: boolean): void
  minimize(): void
  maximize(): void
  close(): void
  getSettings(): Promise<string>
  setSettings(settings: string): void
  checkGameInstalled(): Promise<boolean>
  downloadGame(): Promise<void>
  launchGameWindow(): void
  onAuthCallback(cb: (url: string) => void): () => void
  onSelectTab(cb: (index: number) => void): () => void
  onDownloadProgress(cb: (message: string, percent: number) => void): () => void
  saveCharacterImage(name: string, imageData: string): void
  getAppUpdateStatus(): Promise<AppUpdateStatus>
  checkAppUpdate(): Promise<AppUpdateStatus>
  installAppUpdate(): void
  onAppUpdateStatus(cb: (status: AppUpdateStatus) => void): () => void
  showNativeNotification(payload: NativeNotificationPayload): void
  onNativeNotificationClick(cb: (tabId?: string) => void): () => void
  setSoundOnFocus(value: boolean): void
  storeGet(key: string): Promise<string | null>
  storeSet(key: string, value: string): void
  storeDelete(key: string): void
  logger: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
    debug(...args: unknown[]): void
  }
}

declare global {
  interface Window {
    dofemu: DofemuAPI
    buildVersion: string
    appVersion: string
    appInfo: { version: string }
  }
}
