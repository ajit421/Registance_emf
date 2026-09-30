import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

const media = () => window.matchMedia('(prefers-color-scheme: dark)')
export const resolveDark = (t: Theme) => (t === 'system' ? media().matches : t === 'dark')
const apply = (t: Theme) => document.documentElement.classList.toggle('dark', resolveDark(t))

interface ThemeState { theme: Theme; setTheme: (t: Theme) => void }

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({ theme: 'system', setTheme: t => { apply(t); set({ theme: t }) } }),
    { name: 'pcbmotor.theme.v2', onRehydrateStorage: () => s => apply(s?.theme ?? 'system') },
  ),
)

media().addEventListener('change', () => apply(useThemeStore.getState().theme))
