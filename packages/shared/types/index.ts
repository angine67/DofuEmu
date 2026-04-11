export interface GameContext {
  gameSrc: string
  characterImagesSrc: string
  windowId: number
  hash: string
  platform: string
  buildVersion: string
  appVersion: string
}

export interface WindowSettings {
  audioMuted: boolean
  soundOnFocus: boolean
  resolution: Resolution
}

export interface Resolution {
  width: number
  height: number
}

export interface ProxySettings {
  enabled: boolean
  host: string
  port: number
  username: string
  password: string
  protocol: 'http' | 'https' | 'socks5'
}

export interface GameSettings {
  autoGroupEnabled: boolean
  autoInviteEnabled: boolean
  notificationsEnabled: boolean
}

export interface AppSettings {
  language: Language
  window: WindowSettings
  proxy: ProxySettings
  game: GameSettings
  version: string
}

export type HotkeyAction =
  | 'switch-tab-1'
  | 'switch-tab-2'
  | 'switch-tab-3'
  | 'switch-tab-4'
  | 'switch-tab-5'
  | 'new-tab'
  | 'close-tab'
  | 'toggle-mute'
  | 'next-tab'
  | 'prev-tab'
  | 'zoom-in'
  | 'zoom-out'

export interface Character {
  id: string
  name: string
  server: string
  accountId: string
  class?: string
  level?: number
}

export interface Team {
  id: string
  name: string
  leaderId: string
  memberIds: string[]
}

export interface AutoGroupState {
  enabled: boolean
  leaderTabId: string | null
  leaderMapId: number | null
  leaderPosition: { x: number; y: number } | null
  followerTabIds: string[]
}

export const HOTKEY_ACTIONS: HotkeyAction[] = [
  'switch-tab-1',
  'switch-tab-2',
  'switch-tab-3',
  'switch-tab-4',
  'switch-tab-5',
  'new-tab',
  'close-tab',
  'toggle-mute',
  'next-tab',
  'prev-tab',
  'zoom-in',
  'zoom-out'
]

export const HOTKEY_ACTION_LABELS: Record<HotkeyAction, string> = {
  'switch-tab-1': 'Switch to Tab 1',
  'switch-tab-2': 'Switch to Tab 2',
  'switch-tab-3': 'Switch to Tab 3',
  'switch-tab-4': 'Switch to Tab 4',
  'switch-tab-5': 'Switch to Tab 5',
  'new-tab': 'New Tab',
  'close-tab': 'Close Tab',
  'toggle-mute': 'Toggle Mute',
  'next-tab': 'Next Tab',
  'prev-tab': 'Previous Tab',
  'zoom-in': 'Zoom In',
  'zoom-out': 'Zoom Out'
}

export const DEFAULT_HOTKEYS: Record<HotkeyAction, string> = {
  'switch-tab-1': 'Ctrl+1',
  'switch-tab-2': 'Ctrl+2',
  'switch-tab-3': 'Ctrl+3',
  'switch-tab-4': 'Ctrl+4',
  'switch-tab-5': 'Ctrl+5',
  'new-tab': 'Ctrl+T',
  'close-tab': 'Ctrl+W',
  'toggle-mute': 'Ctrl+M',
  'next-tab': 'Ctrl+Tab',
  'prev-tab': 'Ctrl+Shift+Tab',
  'zoom-in': 'Ctrl+=',
  'zoom-out': 'Ctrl+-'
}

export const RESOLUTIONS = [
  '800x600',
  '960x600',
  '1280x720',
  '1024x768',
  '1366x768',
  '1440x900',
  '1600x900',
  '1280x1024',
  '1920x1080',
  '2560x1440'
] as const

export const LANGUAGES = [
  { name: 'English', value: 'en' },
  { name: 'Fran\u00e7ais', value: 'fr' },
  { name: 'Espa\u00f1ol', value: 'es' }
] as const

export type Language = (typeof LANGUAGES)[number]['value']

export enum IPCEvents {
  GET_GAME_CONTEXT = 'get_game_context',
  APP_READY_TO_SHOW = 'app_ready_to_show',
  SET_SETTINGS = 'set_settings',
  GET_SETTINGS = 'get_settings',
  OPEN_EXTERNAL = 'open_external',
  AUTH_CALLBACK = 'auth_callback',
  SELECT_TAB = 'select_tab',
  SET_AUDIO_MUTE = 'set_audio_mute',
  SET_SOUND_ON_FOCUS = 'set_sound_on_focus',
  WINDOW_MINIMIZE = 'window_minimize',
  WINDOW_MAXIMIZE = 'window_maximize',
  WINDOW_CLOSE = 'window_close',
  DOWNLOAD_PROGRESS = 'download_progress',
  CHECK_GAME_INSTALLED = 'check_game_installed',
  DOWNLOAD_GAME = 'download_game',
  SAVE_CHARACTER_IMAGE = 'save_character_image',
  STORE_GET = 'store_get',
  STORE_SET = 'store_set',
  STORE_DELETE = 'store_delete'
}
