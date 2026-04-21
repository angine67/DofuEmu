import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import { useSettings } from '@/App'
import { Plus, X, Settings, Minus, Square, Copy } from 'lucide-react'
import { WindowButton } from '@/components/WindowButton'
import { useGameTabStore, GameTab } from '@/stores/gameTabStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTeamStore } from '@/stores/teamStore'
import { useHotkeys } from '@/hooks/use-hotkeys'
import { initAutoGroup, broadcastLeaderPosition, destroyAutoGroup, sendPartyInvite, autoAcceptPartyInvite } from '@/mods/auto-group'
import { initNotificationFocus } from '@/mods/notification-focus'
import { colors } from '@/theme'
import { DofusWindow, HTMLIFrameElementWithDofus } from '@/types/dofus-window'
import { captureCharacterIcon } from '@/utils/capture-icon'
import type { HotkeyAction } from '@dofemu/shared'
import logoImg from '@/assets/logo.png'
import loadingBgImg from '@/assets/game-loading-bg.jpg'

const TITLEBAR_HEIGHT = 32
const MAX_POLL_ATTEMPTS = 50
const POLL_INTERVAL = 200
const RESIZE_DELAYS = [100, 250, 500, 1000, 2000]
const PARTY_INVITE_DELAY = 3000

declare global {
  interface Window {
    $gameWindows: DofusWindow[]
    $game_id: string
    $current_id: string
    $appSchemeLinkCalled: (payload: string) => void
  }
}

const loadingBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  background: '#07080c'
}

function GameLoadingBackdrop({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={loadingBackdropStyle}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${loadingBgImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          transform: 'scale(1.05)',
          filter: 'saturate(1.02)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(7,8,12,0.18) 0%, rgba(7,8,12,0.6) 42%, rgba(7,8,12,0.92) 100%)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(7,8,12,0.88) 0%, rgba(7,8,12,0.36) 44%, rgba(7,8,12,0.82) 100%)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '8%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'min(420px, 78vw)',
          padding: '24px 24px 22px',
          borderRadius: 22,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(180deg, rgba(8,10,16,0.74) 0%, rgba(8,10,16,0.86) 100%)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <img src={logoImg} alt="" style={{ width: 44, height: 44, filter: 'drop-shadow(0 0 18px rgba(201,162,77,0.4))' }} />
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(201,162,77,0.92)', fontWeight: 700 }}>
              DofEmu
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Preparing the client</div>
          </div>
        </div>

        <div style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.64)', marginBottom: 18 }}>
          {subtitle}
        </div>

        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: '42%',
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, rgba(201,162,77,0.62) 0%, rgba(232,199,106,0.98) 100%)',
              boxShadow: '0 0 24px rgba(201,162,77,0.28)',
              animation: 'dofemu-pulse 2s ease-in-out infinite',
              transformOrigin: 'left center'
            }}
          />
        </div>
      </div>
    </div>
  )
}


function GameIframe({ tab, gameSrc, isVisible }: { tab: GameTab; gameSrc: string; isVisible: boolean }) {
  const iframeRef = useRef<HTMLIFrameElementWithDofus>(null)
  const cleanupRef = useRef<Array<() => void>>([])
  const { setTabReady, setTabLoading, setTabCharacter } = useGameTabStore()

  const cleanupGameListeners = () => {
    for (const cleanup of cleanupRef.current) cleanup()
    cleanupRef.current = []
  }

  useEffect(() => cleanupGameListeners, [])

  const handleLoad = () => {
    if (!iframeRef.current) return
    cleanupGameListeners()

    const gameWindow = iframeRef.current.contentWindow
    setTabReady(tab.id, false)
    setTabLoading(tab.id, true)

    gameWindow.openDatabase = undefined
    gameWindow.initDofus(() => {
      window.dofemu.logger.info('initDofus done for tab', tab.id)

      if (!window.parent.$gameWindows) {
        window.parent.$gameWindows = []
      }
      gameWindow.$game_id = tab.id
      window.parent.$current_id = tab.id
      window.parent.$gameWindows.push(gameWindow)

      setTabReady(tab.id, true)
      setTabLoading(tab.id, false)

      const kickResize = () => {
        try {
          gameWindow.dispatchEvent(new Event('resize'))
          gameWindow.gui?._resizeUi?.()
        } catch {}
      }

      kickResize()
      RESIZE_DELAYS.forEach((ms) => setTimeout(kickResize, ms))

      const observer = new ResizeObserver(kickResize)
      if (iframeRef.current) observer.observe(iframeRef.current)
      cleanupRef.current.push(() => observer.disconnect())

      const gw = gameWindow as any

      const attachGameListeners = () => {
        if (!gw.gui?.playerData || !gw.dofus?.connectionManager) return false

        gw.gui.playerData.on('characterSelectedSuccess', () => {
          const name = gw.gui.playerData.characterBaseInformations?.name
          if (name) {
            setTabCharacter(tab.id, name)

            const teamState = useTeamStore.getState()
            const matchedChar = teamState.getCharacterByName(name)
            if (matchedChar) {
              teamState.linkCharacterToTab(matchedChar.id, tab.id)


              const settings = useSettingsStore.getState()
              if (settings.game.autoGroupEnabled && settings.game.autoInviteEnabled && teamState.activeTeamId) {
                const team = teamState.getTeam(teamState.activeTeamId)
                if (team && team.memberIds.includes(matchedChar.id)) {
                  const leader = teamState.getCharacter(team.leaderId)

                  if (matchedChar.id !== team.leaderId && leader) {

                    autoAcceptPartyInvite(gw, leader.name)


                    const leaderTabId = teamState.getTabForCharacter(team.leaderId)
                    if (leaderTabId) {
                      const leaderGw = window.$gameWindows?.find((gw) => gw.$game_id === leaderTabId)
                      if (leaderGw) {
                        setTimeout(() => sendPartyInvite(leaderGw, name), PARTY_INVITE_DELAY)
                      }
                    }
                  }
                }
              }
            }
          }

          const look = gw.gui.playerData.characterBaseInformations?.entityLook
          if (!gw.CharacterDisplay || !look) return

          const charDisplay = new gw.CharacterDisplay({ scale: 'fitin' })
          charDisplay.setLook(look, {
            riderOnly: true, direction: 4, animation: 'AnimArtwork',
            boneType: 'timeline/', skinType: 'timeline/'
          })
          charDisplay.rootElement.style.cssText = 'position:absolute;left:-9999px;width:128px;height:128px;'
          gw.document.body.appendChild(charDisplay.rootElement)

          captureCharacterIcon(charDisplay, gw.document, (dataUrl) => {
            const charName = gw.gui.playerData.characterBaseInformations?.name
            if (charName) window.dofemu.saveCharacterImage(charName, dataUrl)
            window.top?.postMessage({ type: 'dofemu:char-icon', tabId: tab.id, dataUrl }, '*')
          })
        })

        cleanupRef.current.push(initNotificationFocus(gameWindow, tab.id, {
          shouldNotify: () => useSettingsStore.getState().game.notificationsEnabled,
          isActiveTab: (tabId) => useGameTabStore.getState().activeTabId === tabId,
          focusTab: (tabId) => useGameTabStore.getState().setActiveTab(tabId)
        }))

        return true
      }

      if (!attachGameListeners()) {
        let attempts = 0
        const poll = setInterval(() => {
          if (attachGameListeners() || ++attempts > MAX_POLL_ATTEMPTS) clearInterval(poll)
        }, POLL_INTERVAL)
      }
    })
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: isVisible ? 'block' : 'none'
      }}
    >
      <iframe
        ref={iframeRef}
        onLoad={handleLoad}
        src={gameSrc + '?id=' + tab.id}
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'block'
        }}
      />
      {!tab.isReady && (
        <GameLoadingBackdrop
          title="Loading game assets"
          subtitle={`Opening ${tab.characterName || tab.name}. The game screen will appear as soon as the client finishes booting.`}
        />
      )}
    </div>
  )
}

export function GameScreen() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, canAddTab, reorderTabs } = useGameTabStore()
  const { hotkeys, game, loadSettings, isHydrated } = useSettingsStore()
  const { activeTeamId, teams, characterTabMap } = useTeamStore()
  const { setSettingsOpen } = useSettings()
  const [gameSrc, setGameSrc] = useState('')
  const [isMaximized, setIsMaximized] = useState(false)
  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) loadSettings()
  }, [isHydrated, loadSettings])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'dofemu:char-icon') {
        useGameTabStore.getState().setTabIcon(e.data.tabId, e.data.dataUrl)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])


  useEffect(() => {
    const teamState = useTeamStore.getState()
    const tabIds = new Set(tabs.map((t) => t.id))
    for (const [, tid] of Object.entries(teamState.characterTabMap)) {
      if (!tabIds.has(tid)) teamState.unlinkTab(tid)
    }
  }, [tabs])

  useEffect(() => {
    const unsub = window.dofemu.onAuthCallback((url) => {
      const iframes = document.querySelectorAll('iframe')
      for (const iframe of iframes) {
        try {
          const win = (iframe as HTMLIFrameElement).contentWindow as any
          if (win?.$appSchemeLinkCalled) {
            win.$appSchemeLinkCalled(url)
            return
          }
        } catch {}
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    return window.dofemu.onNativeNotificationClick((tabId) => {
      if (tabId) useGameTabStore.getState().setActiveTab(tabId)
    })
  }, [])

  useEffect(() => {
    window.dofemu.fetchGameContext().then((ctx) => {
      window.buildVersion = ctx.buildVersion
      window.appVersion = ctx.appVersion
      window.appInfo = { version: ctx.appVersion }
      ;(window as typeof window & { platform?: string }).platform = ctx.platform
      setGameSrc(ctx.gameSrc)
    })
  }, [])

  const handleHotkeyAction = useCallback(
    (action: HotkeyAction) => {
      const tabStore = useGameTabStore.getState()
      const currentTabs = tabStore.tabs
      const currentActiveId = tabStore.activeTabId

      switch (action) {
        case 'switch-tab-1':
        case 'switch-tab-2':
        case 'switch-tab-3':
        case 'switch-tab-4':
        case 'switch-tab-5': {
          const index = parseInt(action.replace('switch-tab-', ''), 10) - 1
          if (currentTabs[index]) tabStore.setActiveTab(currentTabs[index].id)
          break
        }
        case 'new-tab':
          if (tabStore.canAddTab()) tabStore.addTab()
          break
        case 'close-tab':
          if (currentActiveId) tabStore.removeTab(currentActiveId)
          break
        case 'toggle-mute':
          useSettingsStore.getState().toggleAudioMute()
          break
        case 'toggle-notifications':
          useSettingsStore.getState().toggleNotifications()
          break
        case 'next-tab': {
          const currentIdx = currentTabs.findIndex((t) => t.id === currentActiveId)
          const nextIdx = (currentIdx + 1) % currentTabs.length
          tabStore.setActiveTab(currentTabs[nextIdx].id)
          break
        }
        case 'prev-tab': {
          const currentIdx = currentTabs.findIndex((t) => t.id === currentActiveId)
          const prevIdx = (currentIdx - 1 + currentTabs.length) % currentTabs.length
          tabStore.setActiveTab(currentTabs[prevIdx].id)
          break
        }
        case 'zoom-in':
          document.body.style.zoom = `${(parseFloat(document.body.style.zoom || '1') + 0.1)}`
          break
        case 'zoom-out':
          document.body.style.zoom = `${Math.max(0.5, parseFloat(document.body.style.zoom || '1') - 0.1)}`
          break
      }
    },
    []
  )

  useHotkeys({
    hotkeys,
    onAction: handleHotkeyAction,
    enabled: true
  })


  useEffect(() => {
    if (!game.autoGroupEnabled || !activeTeamId) {
      destroyAutoGroup()
      return
    }

    const team = teams.find((t) => t.id === activeTeamId)
    if (!team || !team.leaderId) return

    const leaderTabId = characterTabMap[team.leaderId] ?? null
    if (!leaderTabId) return

    const followerTabIds = team.memberIds
      .filter((id) => id !== team.leaderId)
      .map((id) => characterTabMap[id])
      .filter((tabId): tabId is string => !!tabId)

    const gameWindows = window.$gameWindows
    if (!gameWindows || gameWindows.length === 0) return

    const cleanups: Array<() => void> = []
    for (const gw of gameWindows) {
      const cleanup = initAutoGroup(gw, gw.$game_id, {
        enabled: true,
        leaderTabId,
        leaderMapId: null,
        leaderPosition: null,
        followerTabIds
      }, {
        onLeaderMapChange: (mapId, position) => {
          broadcastLeaderPosition(mapId, position)
        },
        onFollowerMoved: () => {}
      })
      cleanups.push(cleanup)
    }

    return () => {
      for (const fn of cleanups) fn()
    }
  }, [game.autoGroupEnabled, activeTeamId, teams, tabs, characterTabMap])

  if (!gameSrc) {
    return (
      <div style={{ position: 'relative', flex: 1 }}>
        <GameLoadingBackdrop
          title="Starting DofEmu"
          subtitle="Loading the local game context and preparing the client shell."
        />
      </div>
    )
  }

  const handleDrop = (targetTabId: string) => {
    if (dragTabId && dragTabId !== targetTabId) {
      const oldIndex = tabs.findIndex((t) => t.id === dragTabId)
      const newIndex = tabs.findIndex((t) => t.id === targetTabId)
      const newOrder = tabs.map((t) => t.id)
      newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, dragTabId)
      reorderTabs(newOrder)
    }
    setDragTabId(null)
    setDragOverTabId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: TITLEBAR_HEIGHT,
          paddingLeft: 4,
          background: colors.titlebar,
          borderBottom: `1px solid ${colors.brandBorder}`,
          flexShrink: 0,
          overflow: 'hidden',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflow: 'auto', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              draggable
              onClick={() => setActiveTab(tab.id)}
              onDragStart={(e) => {
                setDragTabId(tab.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverTabId(tab.id)
              }}
              onDragEnter={(e) => { e.preventDefault(); setDragOverTabId(tab.id) }}
              onDragLeave={() => { if (dragOverTabId === tab.id) setDragOverTabId(null) }}
              onDrop={(e) => { e.preventDefault(); handleDrop(tab.id) }}
              onDragEnd={() => { setDragTabId(null); setDragOverTabId(null) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                height: '100%',
                fontSize: 11,
                fontFamily: 'monospace',
                border: 'none',
                borderRight: `1px solid ${colors.borderSubtle}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: tab.id === activeTabId ? colors.surfaceActive : 'transparent',
                color: tab.id === activeTabId ? colors.text : colors.textDim,
                opacity: dragTabId === tab.id ? 0.5 : 1,
                borderLeft: dragOverTabId === tab.id && dragTabId !== tab.id ? `2px solid ${colors.accent}` : undefined,
                transition: 'opacity 0.15s',
              }}
            >
              {tab.characterIcon && (
                <img src={tab.characterIcon} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tab.characterName || tab.name}
              </span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); removeTab(tab.id) }}
                  style={{ opacity: 0.4, cursor: 'pointer', lineHeight: 1 }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1' }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.4' }}
                >
                  <X size={10} />
                </span>
              )}
            </button>
          ))}
          {canAddTab() && (
            <button
              onClick={() => addTab()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: '100%', background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer' }}
            >
              <Plus size={13} />
            </button>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', height: '100%', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: '100%', background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}
          >
            <Settings size={12} />
          </button>
          <WindowButton onClick={() => window.dofemu.minimize()}><Minus size={12} /></WindowButton>
          <WindowButton onClick={() => { window.dofemu.maximize(); setIsMaximized(!isMaximized) }}>
            {isMaximized ? <Copy size={10} /> : <Square size={10} />}
          </WindowButton>
          <WindowButton onClick={() => window.dofemu.close()} hoverBg={colors.dangerClose}><X size={14} /></WindowButton>
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {tabs.map((tab) => (
          <GameIframe
            key={tab.id}
            tab={tab}
            gameSrc={gameSrc}
            isVisible={tab.id === activeTabId}
          />
        ))}
      </div>
    </div>
  )
}
