import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Character, Team } from '@dofemu/shared'
import { electronStorage } from './electronStorage'

interface TeamState {
  characters: Character[]
  teams: Team[]
  activeTeamId: string | undefined
  characterTabMap: Record<string, string>

  addCharacter: (character: Omit<Character, 'id'>) => void
  removeCharacter: (id: string) => void
  createTeam: (name: string) => void
  deleteTeam: (id: string) => void
  duplicateTeam: (teamId: string) => void
  renameTeam: (teamId: string, name: string) => void
  addToTeam: (teamId: string, characterId: string) => void
  removeFromTeam: (teamId: string, characterId: string) => void
  setLeader: (teamId: string, characterId: string) => void
  setActiveTeam: (teamId: string | undefined) => void
  linkCharacterToTab: (characterId: string, tabId: string) => void
  unlinkTab: (tabId: string) => void
  getTeam: (teamId: string) => Team | undefined
  getCharacter: (characterId: string) => Character | undefined
  getCharacterByName: (name: string) => Character | undefined
  getTeamMembers: (teamId: string) => Character[]
  getLeader: (teamId: string) => Character | undefined
  getTabForCharacter: (characterId: string) => string | undefined
  getCharacterForTab: (tabId: string) => Character | undefined
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      characters: [],
      teams: [],
      activeTeamId: undefined,
      characterTabMap: {},

      addCharacter: (character) => {
        const newCharacter: Character = {
          ...character,
          id: crypto.randomUUID()
        }
        set((state) => ({
          characters: [...state.characters, newCharacter]
        }))
      },

      removeCharacter: (id) => {
        set((state) => {
          const { [id]: _, ...restMap } = state.characterTabMap
          return {
            characters: state.characters.filter((c) => c.id !== id),
            teams: state.teams.map((team) => ({
              ...team,
              memberIds: team.memberIds.filter((mid) => mid !== id),
              leaderId: team.leaderId === id ? (team.memberIds.find((mid) => mid !== id) ?? '') : team.leaderId
            })),
            characterTabMap: restMap
          }
        })
      },

      createTeam: (name) => {
        const newTeam: Team = {
          id: crypto.randomUUID(),
          name,
          leaderId: '',
          memberIds: []
        }
        set((state) => ({
          teams: [...state.teams, newTeam]
        }))
      },

      deleteTeam: (id) => {
        set((state) => ({
          teams: state.teams.filter((t) => t.id !== id),
          activeTeamId: state.activeTeamId === id ? undefined : state.activeTeamId
        }))
      },

      duplicateTeam: (teamId) => {
        const team = get().teams.find((t) => t.id === teamId)
        if (!team) return
        const newTeam: Team = {
          id: crypto.randomUUID(),
          name: `${team.name} (Copy)`,
          leaderId: team.leaderId,
          memberIds: [...team.memberIds]
        }
        set((state) => ({ teams: [...state.teams, newTeam] }))
      },

      renameTeam: (teamId, name) => {
        set((state) => ({
          teams: state.teams.map((t) =>
            t.id === teamId ? { ...t, name } : t
          )
        }))
      },

      addToTeam: (teamId, characterId) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team
            if (team.memberIds.includes(characterId)) return team
            const memberIds = [...team.memberIds, characterId]
            const leaderId = team.leaderId || characterId
            return { ...team, memberIds, leaderId }
          })
        }))
      },

      removeFromTeam: (teamId, characterId) => {
        set((state) => ({
          teams: state.teams.map((team) => {
            if (team.id !== teamId) return team
            const memberIds = team.memberIds.filter((id) => id !== characterId)
            const leaderId = team.leaderId === characterId
              ? (memberIds[0] ?? '')
              : team.leaderId
            return { ...team, memberIds, leaderId }
          })
        }))
      },

      setLeader: (teamId, characterId) => {
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === teamId ? { ...team, leaderId: characterId } : team
          )
        }))
      },

      setActiveTeam: (teamId) => {
        set({ activeTeamId: teamId })
      },

      linkCharacterToTab: (characterId, tabId) => {
        set((state) => {

          const cleaned: Record<string, string> = {}
          for (const [cid, tid] of Object.entries(state.characterTabMap)) {
            if (tid !== tabId) cleaned[cid] = tid
          }
          cleaned[characterId] = tabId
          return { characterTabMap: cleaned }
        })
      },

      unlinkTab: (tabId) => {
        set((state) => {
          const cleaned: Record<string, string> = {}
          for (const [cid, tid] of Object.entries(state.characterTabMap)) {
            if (tid !== tabId) cleaned[cid] = tid
          }
          return { characterTabMap: cleaned }
        })
      },

      getTeam: (teamId) => {
        return get().teams.find((t) => t.id === teamId)
      },

      getCharacter: (characterId) => {
        return get().characters.find((c) => c.id === characterId)
      },

      getCharacterByName: (name) => {
        const lower = name.toLowerCase()
        return get().characters.find((c) => c.name.toLowerCase() === lower)
      },

      getTeamMembers: (teamId) => {
        const { teams, characters } = get()
        const team = teams.find((t) => t.id === teamId)
        if (!team) return []
        return team.memberIds
          .map((id) => characters.find((c) => c.id === id))
          .filter((c): c is Character => c !== undefined)
      },

      getLeader: (teamId) => {
        const { teams, characters } = get()
        const team = teams.find((t) => t.id === teamId)
        if (!team || !team.leaderId) return undefined
        return characters.find((c) => c.id === team.leaderId)
      },

      getTabForCharacter: (characterId) => {
        return get().characterTabMap[characterId]
      },

      getCharacterForTab: (tabId) => {
        const { characterTabMap, characters } = get()
        const charId = Object.entries(characterTabMap).find(([, tid]) => tid === tabId)?.[0]
        if (!charId) return undefined
        return characters.find((c) => c.id === charId)
      }
    }),
    {
      name: 'dofemu-teams',
      storage: createJSONStorage(() => electronStorage),
      partialize: (state) => ({
        characters: state.characters,
        teams: state.teams,
        activeTeamId: state.activeTeamId
      })
    }
  )
)
