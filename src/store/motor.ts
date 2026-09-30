/* Global inputs store (Zustand), persisted to localStorage. Results are derived, never stored. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { resolveSpec } from '@/lib/motor/compute'
import { override } from '@/lib/motor/override'
import { decodeLink, same, sanitize } from '@/lib/motor/io'
import { FIELDS, SCHEMA, SPEC_KEYS, SPEC_OF_KEY, defaults, values, type MotorParams, type SectionId, type SpecSolve } from '@/lib/motor/schema'

const DEF = defaults()

/** Store the solved spec value so switching the solved quantity keeps a consistent set. */
function normalize(p: MotorParams): MotorParams {
  const S = resolveSpec(p)
  const v = S[S.solve]
  const key = SPEC_KEYS[S.solve]
  return Number.isFinite(v) && !same(values(p)[key], v) ? { ...p, [key]: v } : p
}


interface MotorState {
  params: MotorParams
  /** last spec value the user typed, so editing the solved one keeps the other given value */
  lastSpec: string | null
  setField: (key: string, v: number) => void
  applyValue: (key: string, v: number) => void
  setSolve: (s: SpecSolve) => void
  resetSection: (id: SectionId) => void
  replaceAll: (p: MotorParams) => void
}

export const useMotorStore = create<MotorState>()(
  persist(
    (set, get) => ({
      params: DEF,
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
        // magnet length follows ORS − IRS unless the user has set it to something else
        const pv = values(params)
        if ((key === 'ORS' || key === 'IRS') && same(pv.mag_len, pv.ORS - pv.IRS)) {
          const nv = values(next)
          next = { ...next, mag_len: nv.ORS - nv.IRS }
        }
        set({ params: normalize(next), lastSpec: me ? key : lastSpec })
      },

      /* value applied from a chart / sweep */
      applyValue(key, raw) {
        const f = FIELDS[key]
        if (!f) return
        const v = f.int ? Math.round(raw) : +Number(raw).toPrecision(6)
        set({ params: normalize(override(get().params, key, v)) })
      },

      setSolve(s) { set({ params: normalize({ ...get().params, spec_solve: s }), lastSpec: null }) },

      resetSection(id) {
        const g = SCHEMA.find(x => x.id === id)
        if (!g) return
        const next: MotorParams = { ...get().params }
        g.fields.forEach(f => { next[f.key] = DEF[f.key] })
        if (id === 'S') next.spec_solve = DEF.spec_solve
        if (id === 'M') next.mag_len = values(next).ORS - values(next).IRS
        set({ params: normalize(next), lastSpec: null })
      },

      replaceAll(p) { set({ params: normalize(sanitize(p)), lastSpec: null }) },
    }),
    {
      name: 'pcbmotor.params.v2',
      partialize: s => ({ params: s.params }),
      merge: (persisted, current) => ({ ...current, params: sanitize((persisted as { params?: unknown })?.params) }),
      onRehydrateStorage: () => state => {
        // a shareable link (#p=…) wins over stored inputs, then is removed from the address bar
        const m = location.hash.match(/p=([^&]+)/)
        if (!m || !state) return
        try { state.replaceAll(sanitize(decodeLink(m[1]))) } catch { /* ignore damaged link */ }
        history.replaceState(null, '', location.pathname + location.search)
      },
    },
  ),
)
