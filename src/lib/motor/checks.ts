/* Design rules and sanity checks, returned as data so the UI decides how to render them. */
import type { MotorResult } from './compute'
import { same } from './io'
import { LIMITS } from './schema'
import { num } from '@/lib/format'

export type CheckLevel = 'ok' | 'warn' | 'bad'
export interface Check { level: CheckLevel; text: string }

/** Hard design rules shown in the overview "Design errors" card. */
export function designErrors(R: MotorResult): Check[] {
  const { A, mag, el } = R
  const lo = LIMITS.magSpaceMin, hi = LIMITS.magSpaceMax
  return [
    mag.spaceOk
      ? { level: 'ok', text: `Space between two magnets is ${num(mag.space, 3)} mm, within ${lo}–${hi} mm.` }
      : { level: 'bad', text: `Space between two magnets is ${num(mag.space, 3)} mm, ${mag.space < lo ? 'below the minimum' : 'above the maximum'} (allowed ${lo}–${hi} mm). Pole pitch ${num(mag.pole_pitch, 3)} mm − magnet width ${num(mag.width, 3)} mm.` },
    A.traceOk
      ? { level: 'ok', text: `Trace width at IR is ${num(A.trace_width_radial_atIR, 4)} mm, at or above the minimum of ${num(A.min_trace_IR, 3)} mm.` }
      : { level: 'bad', text: `Trace width at IR is ${num(A.trace_width_radial_atIR, 4)} mm, below the minimum of ${num(A.min_trace_IR, 3)} mm.` },
    el.enough
      ? { level: 'ok', text: `Electric loading is sufficient: present ${num(el.Ac_present, 0)} A/m ≥ required ${num(el.Ac_required, 0)} A/m (×${num(el.ratio, 2)}).` }
      : { level: 'bad', text: `Electric loading is not sufficient: present ${num(el.Ac_present, 0)} A/m < required ${num(el.Ac_required, 0)} A/m (×${num(el.ratio, 2)}).` },
  ]
}

/** Softer checks: engine warnings, PCB manufacturability, pole consistency. */
export function designChecks(R: MotorResult): Check[] {
  const { A, ed, emf } = R
  const out: Check[] = R.warnings.map(text => ({ level: 'bad', text }))
  const minW = Math.min(A.trace_width_radial_atIR, A.top_ew_thickness, A.bottom_ew_thickness)
  if (Number.isFinite(minW) && minW > 0) {
    out.push(minW >= 0.127
      ? { level: 'ok', text: `Narrowest copper feature is ${num(minW, 3)} mm, above the common 0.127 mm (5 mil) PCB limit.` }
      : { level: 'warn', text: `Narrowest copper feature is ${num(minW, 3)} mm, below the common 0.127 mm (5 mil) PCB limit.` })
  }
  // pole pairs in C is a separate input from the spec poles
  out.push(same(ed.poles, 2 * emf.pp)
    ? { level: 'ok', text: 'Spec poles match 2 × pole pairs in C.' }
    : { level: 'warn', text: `Pole pairs differ: spec poles ${num(ed.poles, 0)} vs 2 × pole pairs in C = ${num(2 * emf.pp, 0)}.` })
  return out
}
