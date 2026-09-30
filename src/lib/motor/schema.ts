/* Input schema for the PCB axial-flux motor calculator.
 * Every input is declared once here; the sidebar, import/export, validation and
 * the parameter sweep are all generated from it.
 * All lengths are in mm (converted to metres inside the formulas), copper thickness in µm.
 */
import type { MotorResult } from './compute'

export type SectionId = 'S' | 'A' | 'B' | 'C' | 'M' | 'D'
export type SpecSolve = 'T' | 'P' | 'rpm'

export interface FieldDef {
  key: string
  label: string
  unit: string
  def: number
  step: number
  min?: number
  int?: boolean
  sci?: boolean
}

export interface LinkDef {
  key: string
  label: string
  unit: string
  src: string
  get: (r: MotorResult) => number
  d: number
}

export interface SectionDef {
  id: SectionId
  title: string
  fields: FieldDef[]
  links?: LinkDef[]
}

export const SCHEMA: SectionDef[] = [
  {
    id: 'S', title: 'Motor specification',
    fields: [
      { key: 'spec_P', label: 'Output power', unit: 'W', def: 22.5, step: 0.5, min: 0 },
      { key: 'spec_rpm', label: 'Speed', unit: 'rpm', def: 350, step: 10, min: 0 },
      { key: 'spec_T', label: 'Torque', unit: 'N·m', def: 22.5 / (2 * Math.PI * 350 / 60), step: 0.01, min: 0 },
      { key: 'spec_slots', label: 'Slots', unit: '', def: 90, step: 1, int: true, min: 1 },
      { key: 'spec_poles', label: 'Poles', unit: '', def: 30, step: 2, int: true, min: 1 },
    ],
  },
  {
    id: 'A', title: 'Winding geometry & resistance',
    links: [
      { key: 'slots', label: 'Slots', unit: '', src: 'Spec · slots', get: r => r.A.slots, d: 0 },
    ],
    fields: [
      { key: 'ORS', label: 'Outer radius slab (ORS)', unit: 'mm', def: 70, step: 0.5 },
      { key: 'dOR', label: 'Top end-winding band (OR − ORS)', unit: 'mm', def: 5, step: 0.1 },
      { key: 'IRS', label: 'Inner radius slab (IRS)', unit: 'mm', def: 50, step: 0.5 },
      { key: 'dIR', label: 'Bottom end-winding band (IRS − IR)', unit: 'mm', def: 5, step: 0.1 },
      { key: 'ewMult', label: 'End-winding span (× coil angle)', unit: '×', def: 3, step: 0.5 },
      { key: 'turns', label: 'Turns per coil', unit: '', def: 5, step: 1, int: true, min: 1 },
      { key: 'gap_radial', label: 'Gap between radial traces (at IR)', unit: 'mm', def: 0.3, step: 0.05 },
      { key: 'min_trace_IR', label: 'Min trace width at IR', unit: 'mm', def: 0.2, step: 0.01, min: 0 },
      { key: 'gap_end', label: 'Gap between end-winding traces', unit: 'mm', def: 0.2, step: 0.05 },
      { key: 'copper_thickness', label: 'Copper thickness', unit: 'µm', def: 140, step: 5 },
      { key: 'rho', label: 'Copper resistivity ρ', unit: 'Ω·m', def: 1.72e-8, step: 1e-10, sci: true },
      { key: 'layers', label: 'Layers', unit: '', def: 1, step: 1, int: true, min: 1 },
      { key: 'layer_stack', label: 'Layers in parallel (layer stack)', unit: '', def: 3, step: 1, int: true, min: 1 },
      { key: 'total_layer_stacks', label: 'Total layer stacks', unit: '', def: 1, step: 1, int: true, min: 1 },
      { key: 'slots_per_phase', label: 'Slots per phase', unit: '', def: 15, step: 1, int: true, min: 1 },
      { key: 'series_stacks', label: 'Series stacks', unit: '', def: 5, step: 1, int: true, min: 1 },
      { key: 'segments_radial', label: 'Segments per radial sub-section', unit: '', def: 1, step: 1, int: true, min: 1 },
      { key: 'via_resistance', label: 'Via resistance', unit: 'Ω', def: 0.3, step: 0.01 },
      { key: 'parInsetIn', label: 'Parallel zone start (IRS + …)', unit: 'mm', def: 1, step: 0.5 },
      { key: 'parInsetOut', label: 'Parallel zone end (ORS − …)', unit: 'mm', def: 1, step: 0.5 },
    ],
  },
  {
    id: 'B', title: 'Eddy current loss',
    links: [
      { key: 'ed_tw', label: 'Conductor width', unit: 'mm', src: 'A · average radial trace width', get: r => r.ed.tw, d: 4 },
      { key: 'ed_th', label: 'Conductor thickness', unit: 'mm', src: 'A · copper thickness', get: r => r.ed.th, d: 3 },
      { key: 'ed_Nc', label: 'Turns per coil', unit: '', src: 'A · total turns', get: r => r.ed.Nc, d: 0 },
      { key: 'ed_sides', label: 'Coil sides', unit: '', src: 'A · slots per phase', get: r => r.ed.sides, d: 0 },
      { key: 'ed_rho', label: 'Resistivity ρ', unit: 'Ω·m', src: 'A · copper resistivity', get: r => r.ed.rho, d: 3 },
      { key: 'ed_Bz', label: 'Axial flux density Bz', unit: 'T', src: 'C · air-gap flux density', get: r => r.ed.Bz, d: 3 },
      { key: 'ed_rpm', label: 'Speed', unit: 'rpm', src: 'Spec · speed', get: r => r.ed.rpm, d: 2 },
      { key: 'ed_poles', label: 'Poles', unit: '', src: 'Spec · poles', get: r => r.ed.poles, d: 0 },
    ],
    fields: [
      { key: 'ed_len', label: 'Length of one conductor', unit: 'mm', def: 20, step: 0.5 },
      { key: 'ed_Bphi', label: 'Tangential flux density Bφ', unit: 'T', def: 0.24, step: 0.01 },
      { key: 'ed_paths', label: 'Parallel paths', unit: '', def: 3, step: 1 },
    ],
  },
  {
    id: 'C', title: 'EMF & performance',
    links: [
      { key: 'emf_Nph', label: 'Turns per phase', unit: '', src: 'A · total turns', get: r => r.emf.Nph, d: 0 },
      { key: 'emf_P', label: 'Output power', unit: 'W', src: 'Spec · power', get: r => r.emf.P, d: 3 },
      { key: 'emf_rpm', label: 'Speed', unit: 'rpm', src: 'Spec · speed', get: r => r.emf.rpm, d: 2 },
      { key: 'emf_poles', label: 'Poles (reference only)', unit: '', src: 'Spec · poles', get: r => r.emf.poles, d: 0 },
      { key: 'emf_Ro', label: 'Outer radius Ro', unit: 'mm', src: 'A · ORS', get: r => r.emf.Ro, d: 2 },
      { key: 'emf_Ri', label: 'Inner radius Ri', unit: 'mm', src: 'A · IRS', get: r => r.emf.Ri, d: 2 },
    ],
    fields: [
      { key: 'emf_Bgap', label: 'Air-gap flux density', unit: 'T', def: 0.4, step: 0.01 },
      { key: 'emf_pp', label: 'Pole pairs', unit: '', def: 9, step: 1, min: 1 },
      { key: 'emf_Kw', label: 'Winding factor Kw', unit: '', def: 1, step: 0.01 },
      { key: 'emf_etaESC', label: 'ESC efficiency', unit: '', def: 0.95, step: 0.01 },
    ],
  },
  {
    id: 'M', title: 'Magnet dimensions',
    links: [
      { key: 'mag_Rin', label: 'Inner radius Rin', unit: 'mm', src: 'A · IRS', get: r => r.mag.Rin, d: 2 },
      { key: 'mag_Rout', label: 'Outer radius Rout', unit: 'mm', src: 'A · ORS', get: r => r.mag.Rout, d: 2 },
      { key: 'mag_poles', label: 'Poles', unit: '', src: 'Spec · poles', get: r => r.mag.poles, d: 0 },
    ],
    fields: [
      { key: 'mag_len', label: 'Magnet length (default ORS − IRS)', unit: 'mm', def: 20, step: 0.5, min: 0 },
      { key: 'mag_width', label: 'Magnet width', unit: 'mm', def: 10, step: 0.1, min: 0 },
    ],
  },
  {
    id: 'D', title: 'Electric loading',
    links: [
      { key: 'el_Ipk', label: 'Peak current', unit: 'A', src: 'C · current (peak)', get: r => r.el.Ipk, d: 4 },
      { key: 'el_N', label: 'Turns per phase', unit: '', src: 'A · total turns', get: r => r.el.N, d: 0 },
      { key: 'el_Ro', label: 'Outer radius Ro', unit: 'mm', src: 'A · ORS', get: r => r.el.Ro, d: 2 },
      { key: 'el_Ri', label: 'Inner radius Ri', unit: 'mm', src: 'A · IRS', get: r => r.el.Ri, d: 2 },
      { key: 'el_Do', label: 'Outer diameter Do', unit: 'mm', src: '2 × ORS', get: r => r.el.Do, d: 2 },
      { key: 'el_Din', label: 'Inner diameter Din', unit: 'mm', src: '2 × IRS', get: r => r.el.Din, d: 2 },
      { key: 'el_Bavg', label: 'Average flux density', unit: 'T', src: 'C · air-gap flux density', get: r => r.el.Bavg, d: 3 },
      { key: 'el_T', label: 'Required torque', unit: 'N·m', src: 'Spec · torque', get: r => r.el.T, d: 4 },
    ],
    fields: [
      { key: 'el_m', label: 'Phases', unit: '', def: 3, step: 1, int: true, min: 1 },
    ],
  },
]

/** Design limits checked on the overview tab. Space between two magnets [mm]. */
export const LIMITS = { magSpaceMin: 0.5, magSpaceMax: 1.2 }

/** Flat inputs object: every schema field key maps to a number, plus which spec value is solved. */
export interface MotorParams {
  spec_solve: SpecSolve
  [key: string]: number | SpecSolve
}
/** Numeric view of the params for formula code. */
export const values = (p: MotorParams) => p as unknown as Record<string, number>

export const FIELDS: Record<string, FieldDef & { group: SectionId }> = {}
SCHEMA.forEach(g => g.fields.forEach(f => { FIELDS[f.key] = { ...f, group: g.id } }))

export const LINKS: LinkDef[] = SCHEMA.flatMap(g => g.links ?? [])

export const SPEC_KEYS: Record<SpecSolve, string> = { P: 'spec_P', rpm: 'spec_rpm', T: 'spec_T' }
export const SPEC_OF_KEY: Record<string, SpecSolve> = { spec_P: 'P', spec_rpm: 'rpm', spec_T: 'T' }
export const isSpecSolve = (v: unknown): v is SpecSolve => v === 'T' || v === 'P' || v === 'rpm'

export function defaults(): MotorParams {
  const d: MotorParams = { spec_solve: 'T' }
  SCHEMA.forEach(g => g.fields.forEach(f => { d[f.key] = f.def }))
  return d
}
