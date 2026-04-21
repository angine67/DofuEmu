import { create } from 'zustand'
import type {
  AppSettings,
  Language,
  ProxySettings,
  GameSettings,
  HotkeyAction,
  DEFAULT_HOTKEYS
} from '@dofemu/shared'

interface HotkeyMap extends Record<HotkeyAction, string> {}

interface SettingsState {
  language: Language
  window: AppSettings['window']
  hotkeys: HotkeyMap
  proxy: ProxySettings
  game: GameSettings
  version: string
  isLoading: boolean
  isHydrated: boolean

  loadSettings: () => Promise<void>
  setLanguage: (lang: Language) => void
  setWindowSettings: (settings: Partial<AppSettings['window']>) => void
  setHotkey: (action: HotkeyAction, combo: string) => void
  resetHotkeys: () => void
  setProxySettings: (settings: Partial<ProxySettings>) => void
  setGameSettings: (settings: Partial<GameSettings>) => void
  setResolution: (width: number, height: number) => void
  toggleAudioMute: () => void
  toggleSoundOnFocus: () => void
  toggleAutoGroup: () => void
  toggleAutoInvite: () => void
  toggleNotifications: () => void
}

const defaultHotkeys: HotkeyMap = {
  'switch-tab-1': 'Ctrl+1',
  'switch-tab-2': 'Ctrl+2',
  'switch-tab-3': 'Ctrl+3',
  'switch-tab-4': 'Ctrl+4',
  'switch-tab-5': 'Ctrl+5',
  'new-tab': 'Ctrl+T',
  'close-tab': 'Ctrl+W',
  'toggle-mute': 'Ctrl+M',
  'toggle-notifications': 'Ctrl+Shift+N',
  'next-tab': 'Ctrl+Tab',
  'prev-tab': 'Ctrl+Shift+Tab',
  'zoom-in': 'Ctrl+=',
  'zoom-out': 'Ctrl+-'
}

const defaultState = {
  language: 'en' as Language,
  window: {
    audioMuted: false,
    soundOnFocus: true,
    resolution: { width: 1280, height: 720 }
  },
  hotkeys: { ...defaultHotkeys },
  proxy: {
    enabled: false,
    host: '',
    port: 8080,
    username: '',
    password: '',
    protocol: 'http' as const
  },
  game: {
    autoGroupEnabled: false,
    autoInviteEnabled: true,
    notificationsEnabled: true
  },
  version: '0.1.0'
}

function persist(state: SettingsState) {
  try {
    const payload = JSON.stringify({
      language: state.language,
      window: state.window,
      hotkeys: state.hotkeys,
      proxy: state.proxy,
      game: state.game,
      version: state.version
    })
    window.dofemu.setSettings(payload)
  } catch {}
}

export const useSettingsStore = create<SettingsState>()((set, get) => {
  const mutate = (updater: (s: SettingsState) => Partial<SettingsState>) => {
    set((state) => {
      const patch = updater(state)
      const merged = { ...state, ...patch } as SettingsState
      persist(merged)
      return patch
    })
  }

  return {
    ...defaultState,
    isLoading: false,
    isHydrated: false,

    loadSettings: async () => {
      try {
        const raw = await window.dofemu.getSettings()
        const parsed = JSON.parse(raw)
        set({
          language: parsed.language ?? defaultState.language,
          window: { ...defaultState.window, ...parsed.window },
          hotkeys: { ...defaultHotkeys, ...parsed.hotkeys },
          proxy: { ...defaultState.proxy, ...parsed.proxy },
          game: { ...defaultState.game, ...parsed.game },
          version: parsed.version ?? defaultState.version,
          isHydrated: true
        })
      } catch {
        set({ isHydrated: true })
      }
    },

    setLanguage: (lang) => mutate(() => ({ language: lang })),

    setWindowSettings: (settings) =>
      mutate((s) => ({ window: { ...s.window, ...settings } })),

    setHotkey: (action, combo) =>
      mutate((s) => ({ hotkeys: { ...s.hotkeys, [action]: combo } })),

    resetHotkeys: () => mutate(() => ({ hotkeys: { ...defaultHotkeys } })),

    setProxySettings: (settings) =>
      mutate((s) => ({ proxy: { ...s.proxy, ...settings } })),

    setGameSettings: (settings) =>
      mutate((s) => ({ game: { ...s.game, ...settings } })),

    setResolution: (width, height) =>
      mutate((s) => ({
        window: { ...s.window, resolution: { width, height } }
      })),

    toggleAudioMute: () => {
      const newVal = !get().window.audioMuted
      mutate((s) => ({ window: { ...s.window, audioMuted: newVal } }))
      window.dofemu.setAudioMute(newVal)
    },

    toggleSoundOnFocus: () => {
      const newVal = !get().window.soundOnFocus
      mutate((s) => ({ window: { ...s.window, soundOnFocus: newVal } }))
      window.dofemu.setSoundOnFocus(newVal)
    },

    toggleAutoGroup: () =>
      mutate((s) => ({
        game: { ...s.game, autoGroupEnabled: !s.game.autoGroupEnabled }
      })),

    toggleAutoInvite: () =>
      mutate((s) => ({
        game: { ...s.game, autoInviteEnabled: !s.game.autoInviteEnabled }
      })),

    toggleNotifications: () =>
      mutate((s) => ({
        game: { ...s.game, notificationsEnabled: !s.game.notificationsEnabled }
      }))
  }
})
