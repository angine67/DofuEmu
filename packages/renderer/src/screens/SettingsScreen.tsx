import { useState, useEffect, useCallback } from 'react'
import { Globe, Keyboard, Users, Info } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTeamStore } from '@/stores/teamStore'
import { recordKeyCombo } from '@/hooks/use-hotkeys'
import { HOTKEY_ACTIONS, HOTKEY_ACTION_LABELS, RESOLUTIONS, LANGUAGES } from '@dofemu/shared'
import { colors } from '@/theme'
import type { HotkeyAction, Language } from '@dofemu/shared'

const ghostBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: colors.textFaint,
  fontSize: 10, cursor: 'pointer',
}

function hoverColor(e: React.MouseEvent, color: string) {
  (e.currentTarget as HTMLElement).style.color = color
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: checked ? colors.accent : colors.toggleOff,
        position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: 8, background: colors.white,
        transition: 'left 0.15s', boxShadow: colors.shadow,
      }} />
    </button>
  )
}

function Select({ value, onChange, options, width }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; width?: number }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: 'none', background: `${colors.input} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E") no-repeat right 10px center`,
        border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.textLight,
        fontSize: 12, padding: '6px 28px 6px 10px', outline: 'none', width: width || 'auto', minWidth: 140,
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function TextInput({ value, onChange, placeholder, type }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type || 'text'} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: colors.input, border: `1px solid ${colors.border}`, borderRadius: 6,
        color: colors.textLight, fontSize: 12, padding: '6px 10px', outline: 'none', width: '100%',
      }}
    />
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', minHeight: 36 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.3 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: colors.textDesc, marginTop: 1, lineHeight: 1.2 }}>{desc}</div>}
      </div>
      <div style={{ marginLeft: 16, flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.accent, padding: '10px 0 3px', opacity: 0.7 }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}

function GeneralTab() {
  const { language, window: win, proxy, game, setLanguage, setResolution, toggleAudioMute, toggleSoundOnFocus, setProxySettings, toggleAutoGroup, toggleAutoInvite, toggleNotifications } = useSettingsStore()

  return (
    <>
      <Section title="Language">
        <Row label="Interface language">
          <Select value={language} onChange={(v) => setLanguage(v as Language)} options={LANGUAGES.map((l) => ({ value: l.value, label: l.name }))} />
        </Row>
      </Section>
      <Section title="Display">
        <Row label="Resolution" desc="Game rendering resolution">
          <Select value={`${win.resolution.width}x${win.resolution.height}`} onChange={(v) => { const [w, h] = v.split('x').map(Number); setResolution(w, h) }} options={RESOLUTIONS.map((r) => ({ value: r, label: r }))} />
        </Row>
      </Section>
      <Section title="Audio">
        <Row label="Mute audio"><Toggle checked={win.audioMuted} onChange={toggleAudioMute} /></Row>
        <Row label="Sound only when focused" desc="Mute when window is in background"><Toggle checked={win.soundOnFocus} onChange={toggleSoundOnFocus} /></Row>
      </Section>
      <Section title="Game">
        <Row label="Auto-group" desc="Followers auto-follow leader across maps"><Toggle checked={game.autoGroupEnabled} onChange={toggleAutoGroup} /></Row>
        {game.autoGroupEnabled && (
          <Row label="Auto-invite" desc="Automatically send and accept party invites"><Toggle checked={game.autoInviteEnabled} onChange={toggleAutoInvite} /></Row>
        )}
        <Row label="Notifications"><Toggle checked={game.notificationsEnabled} onChange={toggleNotifications} /></Row>
      </Section>
      <Section title="Proxy">
        <Row label="Enable proxy"><Toggle checked={proxy.enabled} onChange={(v) => setProxySettings({ enabled: v })} /></Row>
        {proxy.enabled && (
          <div style={{ padding: '8px 0 12px', display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 80px', gap: 6 }}>
              <Select value={proxy.protocol} onChange={(v) => setProxySettings({ protocol: v as 'http' | 'https' | 'socks5' })} options={[{ value: 'http', label: 'HTTP' }, { value: 'https', label: 'HTTPS' }, { value: 'socks5', label: 'SOCKS5' }]} />
              <TextInput value={proxy.host} onChange={(v) => setProxySettings({ host: v })} placeholder="Host" />
              <TextInput value={String(proxy.port)} onChange={(v) => setProxySettings({ port: parseInt(v) || 0 })} placeholder="Port" type="number" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <TextInput value={proxy.username} onChange={(v) => setProxySettings({ username: v })} placeholder="Username (optional)" />
              <TextInput value={proxy.password} onChange={(v) => setProxySettings({ password: v })} placeholder="Password (optional)" type="password" />
            </div>
          </div>
        )}
      </Section>
    </>
  )
}

function HotkeysTab() {
  const { hotkeys, setHotkey, resetHotkeys } = useSettingsStore()
  const [recording, setRecording] = useState<HotkeyAction | null>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!recording) return
    event.preventDefault()
    event.stopPropagation()
    const combo = recordKeyCombo(event)
    if (combo) { setHotkey(recording, combo); setRecording(null) }
  }, [recording, setHotkey])

  useEffect(() => {
    if (!recording) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recording, handleKeyDown])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0 8px' }}>
        <button
          onClick={resetHotkeys}
          style={{ background: 'none', border: 'none', color: colors.textDim, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
          onMouseEnter={(e) => hoverColor(e, colors.hoverLight)}
          onMouseLeave={(e) => hoverColor(e, colors.textDim)}
        >
          Reset to defaults
        </button>
      </div>
      {HOTKEY_ACTIONS.map((action) => (
        <div key={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${colors.borderFaint}` }}>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>{HOTKEY_ACTION_LABELS[action]}</span>
          <button
            onClick={() => setRecording(recording === action ? null : action)}
            style={{
              minWidth: 110, padding: '4px 12px', borderRadius: 5, fontSize: 11, fontFamily: 'monospace', cursor: 'pointer', textAlign: 'center',
              background: recording === action ? colors.accentFocus : colors.input,
              border: `1px solid ${recording === action ? colors.accentBorder : colors.border}`,
              color: recording === action ? colors.accentText : colors.textMuted,
            }}
          >
            {recording === action ? 'Press keys...' : hotkeys[action] || 'None'}
          </button>
        </div>
      ))}
    </>
  )
}

function TeamsTab() {
  const { characters, teams, activeTeamId, addCharacter, removeCharacter, createTeam, deleteTeam, duplicateTeam, renameTeam, addToTeam, removeFromTeam, setLeader, setActiveTeam } = useTeamStore()
  const [charName, setCharName] = useState('')
  const [charServer, setCharServer] = useState('')
  const [charAccount, setCharAccount] = useState('')
  const [teamName, setTeamName] = useState('')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  return (
    <>
      {teams.length > 0 && (
        <Section title="Active team">
          <Row label="Quick switch">
            <Select
              value={activeTeamId || ''}
              onChange={(v) => setActiveTeam(v || undefined)}
              options={[{ value: '', label: 'None' }, ...teams.map((t) => ({ value: t.id, label: `${t.name} (${t.memberIds.length})` }))]}
            />
          </Row>
        </Section>
      )}

      <Section title="Characters">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, padding: '8px 0' }}>
          <TextInput value={charName} onChange={setCharName} placeholder="Name" />
          <TextInput value={charServer} onChange={setCharServer} placeholder="Server" />
          <TextInput value={charAccount} onChange={setCharAccount} placeholder="Account" />
          <button
            onClick={() => { if (charName && charServer && charAccount) { addCharacter({ name: charName, server: charServer, accountId: charAccount }); setCharName(''); setCharServer(''); setCharAccount('') } }}
            style={{ background: colors.accent, border: 'none', borderRadius: 6, color: colors.white, fontSize: 14, width: 32, cursor: 'pointer' }}
          >+</button>
        </div>
        {characters.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderFaint}` }}>
            <div>
              <div style={{ fontSize: 13, color: colors.textSecondary }}>{c.name}</div>
              <div style={{ fontSize: 10, color: colors.textFaint }}>{c.server} / {c.accountId}</div>
            </div>
            <button onClick={() => removeCharacter(c.id)} style={{ ...ghostBtn, fontSize: 11 }} onMouseEnter={(e) => hoverColor(e, colors.danger)} onMouseLeave={(e) => hoverColor(e, colors.textFaint)}>Remove</button>
          </div>
        ))}
        {characters.length === 0 && <div style={{ color: colors.textDisabled, fontSize: 12, padding: 16, textAlign: 'center' }}>No characters added yet</div>}
      </Section>

      <Section title="Teams">
        <div style={{ display: 'flex', gap: 6, padding: '8px 0' }}>
          <div style={{ flex: 1 }}><TextInput value={teamName} onChange={setTeamName} placeholder="Team name" /></div>
          <button onClick={() => { if (teamName) { createTeam(teamName); setTeamName('') } }} style={{ background: colors.accent, border: 'none', borderRadius: 6, color: colors.white, fontSize: 12, padding: '0 14px', cursor: 'pointer' }}>Create</button>
        </div>
        {teams.map((team) => {
          const members = team.memberIds.map((id) => characters.find((c) => c.id === id)).filter(Boolean)
          const available = characters.filter((c) => !team.memberIds.includes(c.id))
          const active = activeTeamId === team.id
          const isEditing = editingTeamId === team.id
          return (
            <div key={team.id} style={{ border: `1px solid ${active ? colors.purpleBorder : colors.borderTeam}`, borderRadius: 8, padding: 10, marginBottom: 8, background: active ? colors.purpleBg : 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 4, flex: 1, marginRight: 8 }}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && editName) { renameTeam(team.id, editName); setEditingTeamId(null) } if (e.key === 'Escape') setEditingTeamId(null) }}
                      autoFocus
                      style={{ background: colors.input, border: `1px solid ${colors.border}`, borderRadius: 4, color: colors.textBright, fontSize: 12, padding: '2px 6px', flex: 1, outline: 'none' }}
                    />
                    <button onClick={() => { if (editName) { renameTeam(team.id, editName); setEditingTeamId(null) } }} style={{ background: colors.accent, border: 'none', borderRadius: 4, color: colors.white, fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}>Save</button>
                  </div>
                ) : (
                  <span
                    style={{ fontSize: 13, fontWeight: 500, color: colors.textBright, cursor: 'pointer' }}
                    onDoubleClick={() => { setEditingTeamId(team.id); setEditName(team.name) }}
                  >
                    {team.name} <span style={{ color: colors.textFaint, fontWeight: 400, fontSize: 11 }}>{members.length} members</span>
                  </span>
                )}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setActiveTeam(active ? undefined : team.id)} style={{ background: active ? colors.purple : colors.surfaceHover, border: 'none', borderRadius: 4, color: active ? colors.white : colors.textMuted, fontSize: 10, padding: '3px 10px', cursor: 'pointer' }}>{active ? 'Active' : 'Activate'}</button>
                  <button onClick={() => duplicateTeam(team.id)} style={ghostBtn} onMouseEnter={(e) => hoverColor(e, colors.hoverLight)} onMouseLeave={(e) => hoverColor(e, colors.textFaint)}>Duplicate</button>
                  <button onClick={() => deleteTeam(team.id)} style={ghostBtn} onMouseEnter={(e) => hoverColor(e, colors.danger)} onMouseLeave={(e) => hoverColor(e, colors.textFaint)}>Delete</button>
                </div>
              </div>
              {members.map((m) => m && (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 4, background: colors.surface, marginBottom: 3, fontSize: 12 }}>
                  <span style={{ color: colors.textMember }}>{team.leaderId === m.id ? '\u2B50 ' : ''}{m.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {team.leaderId !== m.id && <button onClick={() => setLeader(team.id, m.id)} style={ghostBtn}>Leader</button>}
                    <button onClick={() => removeFromTeam(team.id, m.id)} style={ghostBtn} onMouseEnter={(e) => hoverColor(e, colors.danger)} onMouseLeave={(e) => hoverColor(e, colors.textFaint)}>x</button>
                  </div>
                </div>
              ))}
              {available.length > 0 && (
                <Select value="" onChange={(v) => { if (v) addToTeam(team.id, v) }} options={[{ value: '', label: 'Add member...' }, ...available.map((c) => ({ value: c.id, label: `${c.name} (${c.server})` }))]} width={200} />
              )}
            </div>
          )
        })}
        {teams.length === 0 && <div style={{ color: colors.textDisabled, fontSize: 12, padding: 16, textAlign: 'center' }}>No teams created yet</div>}
      </Section>
    </>
  )
}

function AboutTab() {
  return (
    <Section title="DofEmu">
      <Row label="Version"><span style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textMuted }}>0.1.0</span></Row>
      <Row label="Platform"><span style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textMuted }}>{navigator.platform}</span></Row>
      <Row label="Engine"><span style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textMuted }}>Electron</span></Row>
      <div style={{ padding: '16px 0 8px', fontSize: 12, color: colors.textFaint, lineHeight: 1.6 }}>Desktop client for Dofus Touch.</div>
    </Section>
  )
}

const TABS = [
  { id: 'General', icon: Globe },
  { id: 'Hotkeys', icon: Keyboard },
  { id: 'Teams', icon: Users },
  { id: 'About', icon: Info },
] as const

export function SettingsScreen() {
  const [tab, setTab] = useState('General')
  const { loadSettings, isHydrated } = useSettingsStore()
  useEffect(() => { if (!isHydrated) loadSettings() }, [isHydrated, loadSettings])

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${colors.borderSubtle}`, marginBottom: 4 }}>
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px 8px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer',
                color: active ? colors.text : colors.textFaint, fontWeight: active ? 500 : 400,
                borderBottom: active ? `2px solid ${colors.accent}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) hoverColor(e, colors.hoverMid) }}
              onMouseLeave={(e) => { if (!active) hoverColor(e, colors.textFaint) }}
            >
              <Icon size={13} />
              {t.id}
            </button>
          )
        })}
      </div>
      {tab === 'General' && <GeneralTab />}
      {tab === 'Hotkeys' && <HotkeysTab />}
      {tab === 'Teams' && <TeamsTab />}
      {tab === 'About' && <AboutTab />}
    </div>
  )
}
