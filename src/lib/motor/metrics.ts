/* Results that can be plotted in the parameter sweep. */
import { compute, type MotorResult } from './compute'
import { FIELDS, type MotorParams } from './schema'
import { override } from './override'

export interface Metric { label: string; get: (r: MotorResult) => number; unit: string; best?: 'max' | 'min' }

export const METRICS: Record<string, Metric> = {
  eta: { label: 'Motor efficiency (%)', get: r => r.emf.eta * 100, unit: '%', best: 'max' },
  etaAll: { label: 'Overall efficiency with ESC (%)', get: r => r.emf.etaAll * 100, unit: '%', best: 'max' },
  Ploss: { label: 'Total loss (W)', get: r => r.emf.Ploss, unit: 'W', best: 'min' },
  Pcu: { label: 'Copper loss (W)', get: r => r.emf.Pcu, unit: 'W', best: 'min' },
  Peddy: { label: 'Eddy loss (W)', get: r => r.emf.Peddy, unit: 'W', best: 'min' },
  R: { label: 'Phase resistance (Ω)', get: r => r.A.R_stack_total, unit: 'Ω', best: 'min' },
  Ef: { label: 'Back-EMF (V)', get: r => r.emf.Ef, unit: 'V' },
  Vterm: { label: 'Terminal voltage (V)', get: r => r.emf.Vterm, unit: 'V' },
  Irms: { label: 'Phase current rms (A)', get: r => r.emf.Irms, unit: 'A' },
  T: { label: 'Torque (N·m)', get: r => r.emf.T, unit: 'N·m' },
  ratio: { label: 'Electric loading ratio (×)', get: r => r.el.ratio, unit: '×', best: 'max' },
  trace: { label: 'Trace width at IR (mm)', get: r => r.A.trace_width_radial_atIR, unit: 'mm' },
}

export interface SweepResult { pts: { x: number; y: number }[]; good: { x: number; y: number }[]; best: { x: number; y: number } | null }

/** Vary one input over [from, to] in n steps and evaluate one metric; null if the range is invalid. */
export function runSweep(params: MotorParams, key: string, metric: string, from: number, to: number, n: number): SweepResult | null {
  const f = FIELDS[key], m = METRICS[metric]
  if (!f || !m || !Number.isFinite(from) || !Number.isFinite(to) || from === to) return null
  const [a, b] = from < to ? [from, to] : [to, from]
  const steps = Math.min(400, Math.max(3, Math.round(n) || 41))
  let xs = Array.from({ length: steps }, (_, i) => a + (b - a) * i / (steps - 1))
  if (f.int) xs = [...new Set(xs.map(Math.round))]
  const pts = xs.map(x => ({ x, y: m.get(compute(override(params, key, x))) }))
  const good = pts.filter(p => Number.isFinite(p.y))
  const best = m.best && good.length
    ? good.reduce((p, q) => (m.best === 'max' ? (q.y > p.y ? q : p) : (q.y < p.y ? q : p)))
    : null
  return { pts, good, best }
}
