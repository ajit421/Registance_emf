/* Global inputs store (Zustand), persisted to localStorage. Results are derived, never stored. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { resolveSpec } from '@/lib/motor/compute'
import { decodeLink, readWinding, same, sanitize } from '@/lib/motor/io'
import { FIELDS, SCHEMA, SPEC_KEYS, SPEC_OF_KEY, defaults, followDefaults, isWinding, values, type MotorParams, type SectionId, type SpecSolve, type Winding } from '@/lib/motor/schema'

/** Store the solved spec value so switching the solved quantity keeps a consistent set. */
function normalize(p: MotorParams): MotorParams {
  const S = resolveSpec(p)
  const v = S[S.solve]
  const key = SPEC_KEYS[S.solve]
  return Number.isFinite(v) && !same(values(p)[key], v) ? { ...p, [key]: v } : p
}

interface MotorState {
  params: MotorParams
  /** null until the user picks one */
  winding: Winding | null
  /** last spec value the user typed, so editing the solved one keeps the other given value */
  lastSpec: string | null
  setField: (key: string, v: number) => void
  setSolve: (s: SpecSolve) => void
  setWinding: (w: Winding) => void
  resetSection: (id: SectionId) => void
  /** replace every input; the winding choice is kept unless one is given */
  replaceAll: (p: MotorParams, winding?: Winding | null) => void
}

export const useMotorStore = create<MotorState>()(
  persist(
    (set, get) => ({
      params: defaults(),
      winding: null,
      lastSpec: null,

      /* typed into the sidebar */
      setField(key, raw) {
        const f = FIELDS[key]
        if (!f) return
        const { params, lastSpec } = get()
        const v = f.int ? Math.round(raw) : raw
        let next: MotorParams = { ...params, [key]: v }
        // typing into the calculated spec value makes it given and solves for another one
        const me = SPEC_OF_KEY[key]
        if (me && params.spec_solve === me) {
          const keep = lastSpec && SPEC_OF_KEY[lastSpec] !== me ? SPEC_OF_KEY[lastSpec] : me === 'rpm' ? 'P' : 'rpm'
          next.spec_solve = (['P', 'rpm', 'T'] as const).find(x => x !== me && x !== keep)!
        }
        // magnet length follows Rout − Rin unless the user has set it to something else
        const pv = values(params)
        if ((key === 'ORS' || key === 'IRS') && same(pv.mag_len, pv.ORS - pv.IRS)) {
          const nv = values(next)
          next = { ...next, mag_len: nv.ORS - nv.IRS }
        }
        set({ params: normalize(next), lastSpec: me ? key : lastSpec })
      },

      setSolve(s) { set({ params: normalize({ ...get().params, spec_solve: s }), lastSpec: null }) },

      // inputs still at their default follow the new winding's defaults
      setWinding(winding) {
        const { params, winding: prev } = get()
        if (winding === prev) return
        set({ winding, params: normalize(followDefaults(params, prev, winding)) })
      },

      resetSection(id) {
        const g = SCHEMA.find(x => x.id === id)
        if (!g) return
        const def = defaults(get().winding)
        const next: MotorParams = { ...get().params }
        g.fields.forEach(f => { next[f.key] = def[f.key] })
        if (id === 'S') next.spec_solve = def.spec_solve
        if (id === 'M') next.mag_len = values(next).ORS - values(next).IRS
        set({ params: normalize(next), lastSpec: null })
      },

      replaceAll(p, winding) {
        const w = winding !== undefined ? winding : get().winding
        set({ params: normalize(sanitize(p, w)), lastSpec: null, winding: w })
      },
    }),
    {
      name: 'pcbmotor.params.v2',
      version: 1,
      // v0: concentrated designs saved before that winding had its own defaults still hold the distributed ones
      migrate: (persisted, version) => {
        const p = persisted as { params?: unknown; winding?: unknown } | undefined
        if (version < 1 && p?.winding === 'concentrated' && p.params)
          return { ...p, params: followDefaults(sanitize(p.params), 'distributed', 'concentrated') }
        return p
      },
      partialize: s => ({ params: s.params, winding: s.winding }),
      merge: (persisted, current) => {
        const p = persisted as { params?: unknown; winding?: unknown } | undefined
        // inputs saved before the winding choice existed were distributed designs
        const winding = isWinding(p?.winding) ? p.winding : p?.params ? 'distributed' : null
        return { ...current, params: normalize(sanitize(p?.params, winding)), winding }
      },
      onRehydrateStorage: () => state => {
        // a shareable link (#p=…) wins over stored inputs, then is removed from the address bar
        const m = location.hash.match(/p=([^&]+)/)
        if (!m || !state) return
        try {
          const obj = decodeLink(m[1])
          const w = readWinding(obj)
          state.replaceAll(sanitize(obj, w), w)
        } catch { /* ignore damaged link */ }
        history.replaceState(null, '', location.pathname + location.search)
      },
    },
  ),
)
