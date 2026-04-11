import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { electronStorage } from "./electronStorage";

export interface GameTab {
  id: string;
  name: string;
  characterName?: string;
  characterIcon?: string;
  isActive: boolean;
  isLoading: boolean;
  isReady: boolean;
}

interface GameTabState {
  tabs: GameTab[];
  activeTabId: string | null;
  maxTabs: number;

  addTab: (name?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  setTabCharacter: (id: string, characterName: string) => void;
  setTabIcon: (id: string, icon: string) => void;
  setTabLoading: (id: string, loading: boolean) => void;
  setTabReady: (id: string, ready: boolean) => void;
  reorderTabs: (newOrder: string[]) => void;
  getActiveTab: () => GameTab | undefined;
  canAddTab: () => boolean;
}

const MAX_TABS = 5;
const PLACEHOLDER_NAME_START = [
  "Ily",
  "Crae",
  "Enu",
  "Feca",
  "Sadi",
  "Xelo",
  "Panda",
  "Ougi",
  "Hupa",
  "Eli",
];
const PLACEHOLDER_NAME_END = [
  "ria",
  "dor",
  "mira",
  "zel",
  "nox",
  "lia",
  "thar",
  "vyn",
  "sah",
  "wen",
];
const LEGACY_PLACEHOLDER_NAME = /^Game \d+$/i;
const createTabId = () =>
  `game-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const getPlaceholderTabName = (index: number) => {
  const base =
    PLACEHOLDER_NAME_START[index % PLACEHOLDER_NAME_START.length] +
    PLACEHOLDER_NAME_END[(index * 3 + 2) % PLACEHOLDER_NAME_END.length];
  const cycle = Math.floor(index / PLACEHOLDER_NAME_START.length);

  return cycle > 0 ? `${base}${cycle + 1}` : base;
};

const getNextPlaceholderTabName = (tabs: GameTab[]) => {
  const usedNames = new Set(
    tabs
      .filter((tab) => !tab.characterName)
      .map((tab) => tab.name.trim().toLowerCase()),
  );

  for (let index = 0; index < MAX_TABS * 3; index += 1) {
    const candidate = getPlaceholderTabName(index);
    if (!usedNames.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return getPlaceholderTabName(tabs.length);
};

const createPlaceholderTab = (name = getPlaceholderTabName(0), isActive = true): GameTab => ({
  id: createTabId(),
  name,
  isActive,
  isLoading: false,
  isReady: false,
});

export const useGameTabStore = create<GameTabState>()(
  persist(
    (set, get) => {
      const initialTab = createPlaceholderTab();

      return {
      tabs: [initialTab],
      activeTabId: initialTab.id,
      maxTabs: MAX_TABS,

      addTab: (name) => {
        const { tabs } = get();

        if (tabs.length >= MAX_TABS) {
          throw new Error(`Maximum ${MAX_TABS} tabs allowed`);
        }

        const id = createTabId();
        const newTab: GameTab = {
          id,
          name: name || getNextPlaceholderTabName(tabs),
          isActive: true,
          isLoading: false,
          isReady: false,
        };

        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: id,
        }));

        return id;
      },

      removeTab: (id) => {
        const { tabs, activeTabId } = get();

        if (tabs.length <= 1) {
          set((state) => ({
            tabs: state.tabs.map((t) =>
              t.id === id
                ? {
                    ...t,
                    name: getPlaceholderTabName(0),
                    characterName: undefined,
                    isReady: false,
                  }
                : t,
            ),
          }));
          return;
        }

        const newTabs = tabs.filter((t) => t.id !== id);
        let newActiveId = activeTabId;

        if (activeTabId === id) {
          const removedIndex = tabs.findIndex((t) => t.id === id);
          const newActiveIndex = removedIndex > 0 ? removedIndex - 1 : 0;
          newActiveId = newTabs[newActiveIndex]?.id || null;

          if (newActiveId) {
            newTabs[newActiveIndex] = {
              ...newTabs[newActiveIndex],
              isActive: true,
            };
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveId,
        });
      },

      setActiveTab: (id) => {
        set((state) => ({
          tabs: state.tabs.map((t) => ({
            ...t,
            isActive: t.id === id,
          })),
          activeTabId: id,
        }));
      },

      renameTab: (id, name) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
        }));
      },

      setTabCharacter: (id, characterName) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, characterName } : t,
          ),
        }));
      },

      setTabIcon: (id, icon) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, characterIcon: icon } : t,
          ),
        }));
      },

      setTabLoading: (id, loading) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, isLoading: loading } : t,
          ),
        }));
      },

      setTabReady: (id, ready) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, isReady: ready } : t,
          ),
        }));
      },

      reorderTabs: (newOrder) => {
        set((state) => {
          const tabMap = new Map(state.tabs.map((t) => [t.id, t]));
          return {
            tabs: newOrder.map((id) => tabMap.get(id)!).filter(Boolean),
          };
        });
      },

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId);
      },

      canAddTab: () => {
        return get().tabs.length < MAX_TABS;
      },
    };
    },
    {
      name: "dofemu-tabs",
      storage: createJSONStorage(() => electronStorage),
      partialize: (state) => ({
        ...state,
        tabs: state.tabs.map(({ characterIcon: _, ...tab }) => tab),
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<GameTabState>) || {};
        const hydratedTabs = Array.isArray(persisted.tabs)
          ? persisted.tabs
              .slice(0, MAX_TABS)
              .map((tab, index) => ({
                ...tab,
                name:
                  !tab.characterName &&
                  (!tab.name.trim() || LEGACY_PLACEHOLDER_NAME.test(tab.name))
                    ? getPlaceholderTabName(index)
                    : tab.name,
              }))
          : currentState.tabs;
        const tabs =
          hydratedTabs.length > 0
            ? hydratedTabs
            : [createPlaceholderTab(getPlaceholderTabName(0), true)];
        const fallbackActiveId = tabs.find((tab) => tab.isActive)?.id ?? tabs[0]?.id ?? null;
        const activeTabId =
          tabs.find((tab) => tab.id === persisted.activeTabId)?.id ??
          fallbackActiveId;

        return {
          ...currentState,
          ...persisted,
          maxTabs: MAX_TABS,
          activeTabId,
          tabs: tabs.map((tab) => ({
            ...tab,
            isActive: tab.id === activeTabId,
          })),
        };
      },
    },
  ),
);
