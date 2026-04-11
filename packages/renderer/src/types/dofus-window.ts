export interface DofusWindow extends Window {
  initDofus: (callback: () => void) => void
  openDatabase: unknown
  dofus: {
    connectionManager: unknown
    login: (cb: (err: unknown, state: { disconnected?: boolean }) => void) => void
    disconnect: () => void
    setCredentials: (accountId: string, token: string, forced: string) => void
    start: () => void
  }
  gui: {
    loginScreen: {
      _login: (opts: { accessKey: string; refreshKey: string; save: boolean }) => void
      displayAppropriateForm: () => void
    }
    splashScreen: { show: () => void; hide: () => void }
    backgroundScreen: unknown
    playerData: {
      setForcedAccount: (v: string) => void
      setLoginName: (v: string) => void
    }
    _resizeUi: () => void
    initializeAfterLogin: (cb: (err: unknown) => void) => void
    isConnected: () => boolean
    initialize: () => void
    windowsContainer: { rootElement: HTMLElement }
    on: (event: string, cb: (...args: unknown[]) => void) => void
    emit: (event: string, ...args: unknown[]) => void
    openSimplePopup: (text: string) => void
    getText: (key: string) => string
  }
  isoEngine: {
    mapRenderer: unknown
    actorManager: unknown
  }
  actorManager: unknown
  Config: {
    language: string
    assetsUrl: string
    dataUrl: string
    [key: string]: unknown
  }
  singletons: {
    c: Array<{ exports: { prototype: Record<string, unknown> } & Record<string, unknown> }>
  }
  $game_id: string
  $appSchemeLinkCalled: (payload: string) => void
  $_authManager: {
    requestWebAuthToken: (
      code: string,
      cb: (err: unknown, accessKey: string, refreshKey: string) => void
    ) => void
    account?: unknown
    getHaapiKeyManager?: () => HaapiKeyManager
  }
  $_haapiModule: {
    getHaapiKeyManager: () => HaapiKeyManager
    loginWithHaapiKey?: (...args: unknown[]) => void
    account?: unknown
    $_touchEmuPatched?: boolean
  }
  $_haapiAccount: {
    createToken: (params: Record<string, unknown>, cb: (err: unknown, res: unknown) => void) => void
    createTokenWithCertificate?: (cb: (err: unknown, res: unknown) => void) => void
  }
  $_haapiKeyManager: HaapiKeyManager
  $_pendingApiKeyHeader: string
}

export interface HaapiKeyManager {
  setHaapiKey: (key: string, refresh: string, opts?: { save?: boolean }) => void
  getHaapiKey: () => { key: string; refreshToken: string } | null
  setHaapiAccountId: (id: number, opts?: { save?: boolean }) => void
  getHaapiAccountId: () => number | null
  $_touchEmuApiKeyOnlyPatch?: boolean
}

export interface HTMLIFrameElementWithDofus extends HTMLIFrameElement {
  contentWindow: DofusWindow
}
