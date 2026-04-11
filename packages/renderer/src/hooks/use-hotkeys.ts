import { useEffect, useRef } from 'react'
import type { HotkeyAction } from '@dofemu/shared'

type HotkeyHandler = (action: HotkeyAction) => void

interface HotkeyConfig {
  hotkeys: Record<HotkeyAction, string>
  onAction: HotkeyHandler
  enabled?: boolean
}

function normalizeKeyCombo(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')

  let key = event.key
  if (key === ' ') key = 'Space'
  else if (key === 'Tab') key = 'Tab'
  else if (key === '+') key = '+'
  else if (key === '-') key = '-'
  else if (key === '=') key = '='
  else if (key.length === 1) key = key.toUpperCase()

  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
    parts.push(key)
  }

  return parts.join('+')
}

function parseCombo(combo: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } {
  const parts = combo.split('+').map((p) => p.trim())
  let ctrl = false
  let shift = false
  let alt = false
  let key = ''

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'cmd' || lower === 'cmdorctrl') {
      ctrl = true
    } else if (lower === 'shift') {
      shift = true
    } else if (lower === 'alt') {
      alt = true
    } else {
      key = part.toUpperCase()
    }
  }

  return { ctrl, shift, alt, key }
}

function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parsed = parseCombo(combo)
  const hasCtrl = event.ctrlKey || event.metaKey
  if (parsed.ctrl !== hasCtrl) return false
  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false

  let eventKey = event.key
  if (eventKey === ' ') eventKey = 'SPACE'
  else if (eventKey.length === 1) eventKey = eventKey.toUpperCase()
  else eventKey = eventKey.toUpperCase()

  return eventKey === parsed.key.toUpperCase()
}

export function useHotkeys(config: HotkeyConfig) {
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    if (config.enabled === false) return

    const handler = (event: KeyboardEvent) => {
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return

      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const { hotkeys, onAction } = configRef.current
      const entries = Object.entries(hotkeys) as [HotkeyAction, string][]

      for (const [action, combo] of entries) {
        if (!combo) continue
        if (matchesCombo(event, combo)) {
          event.preventDefault()
          event.stopPropagation()
          onAction(action)
          return
        }
      }
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [config.enabled])
}

export function recordKeyCombo(event: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null
  return normalizeKeyCombo(event)
}

