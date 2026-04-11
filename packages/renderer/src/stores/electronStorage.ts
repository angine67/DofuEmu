import type { StateStorage } from 'zustand/middleware'

export const electronStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return window.dofemu.storeGet(name)
  },
  setItem: (name: string, value: string): void => {
    window.dofemu.storeSet(name, value)
  },
  removeItem: (name: string): void => {
    window.dofemu.storeDelete(name)
  },
}
