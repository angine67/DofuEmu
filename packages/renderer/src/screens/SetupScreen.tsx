import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Status = 'checking' | 'downloading' | 'done' | 'error'

const STEPS = [
  'Copying base files',
  'Downloading manifests',
  'Downloading assets',
  'Downloading game files',
  'Finding versions',
  'Applying patches',
  'Writing files',
  'Cleaning up',
  'Saving manifests',
  'Done'
]

function stepFromMessage(msg: string): number {
  const lower = msg.toLowerCase()
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (lower.includes(STEPS[i].toLowerCase())) return i
  }
  return 0
}

export function SetupScreen() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [percent, setPercent] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    window.dofemu.checkGameInstalled().then((installed) => {
      if (installed) {
        navigate('/game', { replace: true })
      } else {
        setStatus('downloading')
        window.dofemu.downloadGame().then(() => {
          setStatus('done')
          setTimeout(() => navigate('/game', { replace: true }), 800)
        }).catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err))
          setStatus('error')
        })
      }
    })
  }, [navigate])

  useEffect(() => {
    const unsub = window.dofemu.onDownloadProgress((msg, pct) => {
      setMessage(msg)
      setPercent(pct)
      setCurrentStep(stepFromMessage(msg))
      if (pct >= 100) {
        setStatus('done')
        setTimeout(() => navigate('/game', { replace: true }), 800)
      }
    })
    return unsub
  }, [navigate])

  const startDownload = async () => {
    setStatus('downloading')
    setError('')
    setPercent(0)
    setCurrentStep(0)
    try {
      await window.dofemu.downloadGame()
      setStatus('done')
      setTimeout(() => navigate('/game', { replace: true }), 800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md px-10">
        <div className="mb-8 text-center">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">DofEmu</h1>
          <p className="mt-1 text-[11px] text-muted-foreground/60">Dofus Touch Desktop</p>
        </div>

        {status === 'checking' && (
          <div className="text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
            <p className="mt-3 text-[11px] text-muted-foreground">Checking installation...</p>
          </div>
        )}

        {(status === 'downloading' || status === 'done') && (
          <div className="space-y-6">
            <div className="space-y-3">
              {STEPS.map((step, i) => {
                const isDone = currentStep > i || status === 'done'
                const isActive = currentStep === i && status !== 'done'
                return (
                  <div
                    key={step}
                    className="flex items-center gap-3"
                    style={{ opacity: isDone ? 0.4 : isActive ? 1 : 0.15, transition: 'opacity 0.3s' }}
                  >
                    <div
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
                      style={{
                        background: isDone ? 'hsl(var(--primary))' : isActive ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted-foreground) / 0.1)',
                        color: isDone ? 'hsl(var(--primary-foreground))' : isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)',
                        border: isActive ? '1.5px solid hsl(var(--primary) / 0.5)' : '1.5px solid transparent',
                        transition: 'all 0.3s'
                      }}
                    >
                      {isDone ? '\u2713' : i + 1}
                    </div>
                    <span className="text-[11px] text-foreground">{step}</span>
                    {isActive && (
                      <div className="ml-auto h-3 w-3 animate-spin rounded-full border border-muted-foreground/20 border-t-primary" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="space-y-1.5">
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${status === 'done' ? 100 : percent}%`,
                    transition: 'width 0.5s ease-out'
                  }}
                />
              </div>
              <div className="flex justify-between font-mono text-[9px] text-muted-foreground/50">
                <span>{message}</span>
                <span>{(status === 'done' ? 100 : percent).toFixed(0)}%</span>
              </div>
            </div>

            {status === 'done' && (
              <p className="text-center text-[11px] text-primary">Launching game...</p>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-destructive/30 bg-destructive/[0.05] p-4">
              <p className="text-[11px] text-destructive">{error}</p>
            </div>
            <button
              onClick={startDownload}
              className="rounded-md border border-primary/40 bg-primary/10 px-6 py-2 text-[12px] text-primary transition-colors hover:bg-primary/20"
            >
              Retry Download
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
