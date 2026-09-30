export const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'winding', label: 'Winding' },
  { id: 'eddy', label: 'Eddy loss' },
  { id: 'emf', label: 'EMF & efficiency' },
  { id: 'loading', label: 'Electric loading' },
  { id: 'sweep', label: 'Sweep' },
  { id: 'report', label: 'Report' },
] as const

export type TabId = (typeof TABS)[number]['id']
export const isTabId = (v: unknown): v is TabId => TABS.some(t => t.id === v)
