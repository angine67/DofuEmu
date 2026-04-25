import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, RotateCw } from 'lucide-react'
import { colors } from '@/theme'
import logoImg from '@/assets/logo.png'
import type { AppUpdateStatus } from '@dofemu/shared'

type Status = 'checking' | 'app-downloading' | 'app-ready' | 'downloading' | 'done' | 'error'

const STEPS = [
  { title: 'Copying base files' },
  { title: 'Downloading manifests' },
  { title: 'Downloading assets' },
  { title: 'Downloading game files' },
  { title: 'Finding versions' },
  { title: 'Applying patches' },
  { title: 'Writing files' },
  { title: 'Cleaning up' },
  { title: 'Saving manifests' },
  { title: 'Done' }
] as const

const shellStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 14,
  background: colors.bg
}

function stepFromMessage(msg: string): number {
  const lower = msg.toLowerCase()
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (lower.includes(STEPS[i].title.toLowerCase())) return i
  }
  return 0
}

function formatMode(installed: boolean): string {
  return installed ? 'Update' : 'Install'
}

function getHeadline(status: Status, installed: boolean): string {
  if (status === 'checking') return 'Checking updates'
  if (status === 'app-downloading') return 'Updating DofEmu'
  if (status === 'app-ready') return 'App update ready'
  if (status === 'done') return installed ? 'Update complete' : 'Install complete'
  if (status === 'error') return installed ? 'Update failed' : 'Install failed'
  return installed ? 'Updating game' : 'Installing game'
}

function getSummary(status: Status, installed: boolean): string {
  if (status === 'checking') return 'Checking the desktop app first, then game files.'
  if (status === 'app-downloading') return 'Downloading the latest published release artifact.'
  if (status === 'app-ready') return 'Restart DofEmu to install the downloaded app update.'
  if (status === 'done') return 'Launching the game.'
  if (status === 'error') return installed ? 'The existing install can still be opened.' : 'Retry the install.'
  return installed ? 'Applying only the required file updates.' : 'Downloading and patching the game files.'
}

function shouldRunGameUpdate(status: AppUpdateStatus): boolean {
  return status.phase === 'disabled' || status.phase === 'not-available' || status.phase === 'error' || status.phase === 'idle'
}

function isActiveAppUpdate(status: AppUpdateStatus): boolean {
  return status.phase === 'checking' || status.phase === 'available' || status.phase === 'downloading' || status.phase === 'downloaded'
}

export function SetupScreen() {
  const [status, setStatus] = useState<Status>('checking')
  const [percent, setPercent] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [hasExistingInstall, setHasExistingInstall] = useState(false)
  const [appUpdate, setAppUpdate] = useState<AppUpdateStatus | null>(null)
  const didStartRef = useRef(false)
  const gameUpdateStartedRef = useRef(false)
  const installedRef = useRef(false)
  const launchTimeoutRef = useRef<number | null>(null)

  const scheduleLaunch = () => {
    if (launchTimeoutRef.current !== null) return
    launchTimeoutRef.current = window.setTimeout(() => {
      window.dofemu.launchGameWindow()
    }, 800)
  }

  const runUpdate = async (installed: boolean) => {
    if (gameUpdateStartedRef.current) return
    gameUpdateStartedRef.current = true
    setHasExistingInstall(installed)
    setStatus('downloading')
    setError('')
    setPercent(0)
    setCurrentStep(0)
    setMessage(installed ? 'Checking for updates...' : 'Preparing initial download...')

    try {
      await window.dofemu.downloadGame()
      setStatus('done')
      scheduleLaunch()
    } catch (err: unknown) {
      if (installed) {
        window.dofemu.logger.warn('Game update failed, launching existing install', err)
        window.dofemu.launchGameWindow()
        return
      }

      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const handleAppUpdateStatus = (update: AppUpdateStatus, installed: boolean) => {
    setAppUpdate(update)

    if (update.phase === 'checking' || update.phase === 'available') {
      setStatus('checking')
      setMessage(update.message ?? 'Checking for app update...')
      setPercent(0)
      return
    }

    if (update.phase === 'downloading') {
      setStatus('app-downloading')
      setMessage(update.message ?? 'Downloading app update...')
      setPercent(update.percent ?? 0)
      return
    }

    if (update.phase === 'downloaded') {
      setStatus('app-ready')
      setMessage(update.message ?? 'App update ready.')
      setPercent(100)
      return
    }

    if (shouldRunGameUpdate(update)) {
      if (update.phase === 'error') {
        window.dofemu.logger.warn('App update failed, continuing with game update', update.error)
      }
      void runUpdate(installed)
    }
  }

  useEffect(() => {
    if (didStartRef.current) return
    didStartRef.current = true

    window.dofemu.checkGameInstalled().then(async (installed) => {
      installedRef.current = installed
      setHasExistingInstall(installed)

      const current = await window.dofemu.getAppUpdateStatus()
      handleAppUpdateStatus(current, installed)
      if (isActiveAppUpdate(current)) return

      const checked = await window.dofemu.checkAppUpdate()
      handleAppUpdateStatus(checked, installed)
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    })
  }, [])

  useEffect(() => {
    const unsubAppUpdate = window.dofemu.onAppUpdateStatus((update) => {
      handleAppUpdateStatus(update, installedRef.current)
    })
    const unsub = window.dofemu.onDownloadProgress((msg, pct) => {
      setMessage(msg)
      setPercent(pct)
      setCurrentStep(stepFromMessage(msg))
      if (pct >= 100) {
        setStatus('done')
        scheduleLaunch()
      }
    })
    return () => {
      unsubAppUpdate()
      unsub()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (launchTimeoutRef.current !== null) {
        window.clearTimeout(launchTimeoutRef.current)
      }
    }
  }, [])

  const startDownload = async () => {
    gameUpdateStartedRef.current = false
    await runUpdate(hasExistingInstall)
  }

  const installAppUpdate = () => {
    window.dofemu.installAppUpdate()
  }

  const safePercent = Math.max(0, Math.min(100, status === 'done' || status === 'app-ready' ? 100 : percent))
  const headline = getHeadline(status, hasExistingInstall)
  const summary = getSummary(status, hasExistingInstall)
  const primaryMessage = message || (status === 'checking' ? 'Waiting for updater...' : 'Preparing updater...')

  return (
    <div style={shellStyle}>
      <div
        style={{
          width: '100%',
          border: `1px solid ${colors.brandBorderFaint}`,
          borderRadius: 10,
          background: colors.bg,
          boxShadow: colors.modalShadow,
          padding: 14
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <img src={logoImg} alt="" style={{ width: 18, height: 18 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>DofEmu</div>
            <div style={{ fontSize: 11, color: colors.textMuted }}>{formatMode(hasExistingInstall)} window</div>
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
          {headline}
        </div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10 }}>
          {summary}
        </div>

        <div
          style={{
            border: `1px solid ${status === 'error' ? 'rgba(255,68,68,0.25)' : colors.border}`,
            borderRadius: 8,
            background: status === 'error' ? 'rgba(244,68,68,0.05)' : colors.surface,
            padding: 12,
            marginBottom: status === 'error' ? 10 : 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {status === 'done' ? (
              <CheckCircle2 size={16} color={colors.accentText} />
            ) : status === 'app-ready' ? (
              <CheckCircle2 size={16} color={colors.accentText} />
            ) : status === 'error' ? (
              <AlertTriangle size={16} color={colors.danger} />
            ) : (
              <LoaderCircle size={16} color={colors.accentText} style={{ animation: 'dofemu-spin 1.2s linear infinite' }} />
            )}
            <div style={{ fontSize: 12, color: status === 'error' ? colors.danger : colors.textSecondary }}>
              {status === 'error' ? error : primaryMessage}
            </div>
          </div>

          <div
            style={{
              height: 8,
              borderRadius: 999,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.06)'
            }}
          >
            <div
              style={{
                width: `${safePercent}%`,
                height: '100%',
                borderRadius: 999,
                background: `linear-gradient(90deg, ${colors.brandMuted}, ${colors.accent})`,
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, fontSize: 11, color: colors.textMuted }}>
            <span>{status.startsWith('app-') ? `DofEmu ${appUpdate?.version ?? 'update'}` : STEPS[Math.min(currentStep, STEPS.length - 1)]?.title}</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{safePercent.toFixed(0)}%</span>
          </div>
        </div>

        {status === 'app-ready' && (
          <button
            onClick={installAppUpdate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 8,
              border: `1px solid ${colors.accentBorder}`,
              background: 'rgba(201,162,77,0.14)',
              color: colors.accentText,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCw size={14} />
            <span>Restart and Update</span>
          </button>
        )}

        {status === 'error' && (
          <button
            onClick={startDownload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderRadius: 8,
              border: `1px solid ${colors.accentBorder}`,
              background: 'rgba(201,162,77,0.10)',
              color: colors.accentText,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            <span>{hasExistingInstall ? 'Retry Update' : 'Retry Download'}</span>
          </button>
        )}
      </div>
    </div>
  )
}
