/* Input schema for the PCB axial-flux motor calculator.
 * Every user input is declared once here; the sidebar, the advanced settings sheet,
 * import/export and validation are all generated from it.
 * Values that follow from other inputs (poles, slots per phase, conductor length, …)
 * are not inputs: see derive.ts.
 * All lengths are in mm (converted to metres inside the formulas), copper thickness in µm.
 */
import type { MotorResult } from './compute'
import { num } from '@/lib/format'

export type SectionId = 'S' | 'G' | 'W' | 'C' | 'M' | 'B' | 'X'
export type SpecSolve = 'T' | 'P' | 'rpm'
export type Winding = 'distributed' | 'concentrated'

export interface FieldDef {
  key: string
  label: string
  unit: string
  def: number
  step: number
  min?: number
  max?: number
  int?: boolean
  sci?: boolean
  /** live note shown under the input */
  hint?: (r: MotorResult) => string
}

/** Read-only value shown among a section's inputs. */
export interface ComputedDef {
  key: string
  label: string
  unit: string
  get: (r: MotorResult) => number
  d: number
}

export interface SectionDef {
  id: SectionId
  title: string
  fields: FieldDef[]
  computed?: ComputedDef[]
  /** only shown in the advanced settings sheet */
  advanced?: boolean
}

const DEG = Math.PI / 180

export const SCHEMA: SectionDef[] = [
  {
    id: 'S', title: 'Motor specification',
    fields: [
      { key: 'spec_P', label: 'Output power', unit: 'W', def: 22.5, step: 0.5, min: 0 },
      { key: 'spec_rpm', label: 'Speed', unit: 'rpm', def: 350, step: 10, min: 0 },
      { key: 'spec_T', label: 'Torque', unit: 'N·m', def: 22.5 / (2 * Math.PI * 350 / 60), step: 0.01, min: 0 },
      { key: 'spec_slots', label: 'Slots', unit: '', def: 90, step: 3, int: true, min: 1 },
    ],
    computed: [
      { key: 'poles', label: 'Poles (slots / 3)', unit: '', get: r => r.S.poles, d: 2 },
    ],
  },
  {
    id: 'G', title: 'Physical dimensions',
    fields: [
      { key: 'ORS', label: 'Radial winding Rout', unit: 'mm', def: 70, step: 0.5, min: 0 },
      { key: 'IRS', label: 'Radial winding Rin', unit: 'mm', def: 50, step: 0.5, min: 0 },
      { key: 'ew_band', label: 'End winding thickness', unit: 'mm', def: 5, step: 0.1, min: 0 },
    ],
  },
  {
    id: 'W', title: 'Turns & copper',
    fields: [
      { key: 'turns', label: 'Turns per slot / layer', unit: '', def: 5, step: 1, int: true, min: 1, max: 500 },
      {
        key: 'gap_radial', label: 'Trace gap, radial side', unit: 'mm', def: 0.3, step: 0.05, min: 0,
        // the gap is set at IR and is angular, so it widens with radius
        hint: r => `Average gap ${num(r.A.gap_deg * DEG * r.A.r_mean_turns, 3)} mm · average trace width ${num(r.A.trace_width_radial_avg, 3)} mm`,
      },
      { key: 'gap_end', label: 'Trace gap, end side', unit: 'mm', def: 0.2, step: 0.05, min: 0 },
      { key: 'series_stacks', label: 'Series layer stacks', unit: '', def: 5, step: 1, int: true, min: 1 },
      {
        key: 'total_layer_stacks', label: 'Parallel layer stacks', unit: '', def: 1, step: 1, int: true, min: 1,
        hint: r => `Total layers = ${r.A.series_stacks} series × ${r.A.layer_stack} per stack × ${r.A.total_layer_stacks} parallel = ${totalLayers(r)}`,
      },
      { key: 'min_trace_IR', label: 'Min trace width at inner radius', unit: 'mm', def: 0.2, step: 0.01, min: 0 },
      { key: 'copper_thickness', label: 'Copper thickness', unit: 'µm', def: 140, step: 5, min: 0 },
      { key: 'rho', label: 'Copper resistivity ρ', unit: 'Ω·m', def: 1.72e-8, step: 1e-10, sci: true, min: 0 },
      { key: 'via_resistance', label: 'Via resistance', unit: 'Ω', def: 0.3, step: 0.01, min: 0 },
    ],
  },
  {
    id: 'C', title: 'EMF & performance',
    fields: [
      { key: 'emf_Bgap', label: 'Air-gap flux density', unit: 'T', def: 0.4, step: 0.01 },
      { key: 'emf_Kw', label: 'Winding factor Kw', unit: '', def: 1, step: 0.01 },
      { key: 'emf_etaESC', label: 'ESC efficiency', unit: '', def: 0.95, step: 0.01 },
    ],
  },
  {
    id: 'M', title: 'Magnet dimensions',
    fields: [
      { key: 'mag_len', label: 'Magnet length', unit: 'mm', def: 20, step: 0.5, min: 0 },
      { key: 'mag_width', label: 'Magnet width', unit: 'mm', def: 10, step: 0.1, min: 0 },
    ],
  },
  {
    id: 'B', title: 'Eddy current loss',
    fields: [
      { key: 'ed_Bphi', label: 'Tangential flux density Bφ', unit: 'T', def: 0.24, step: 0.01 },
    ],
  },
  {
    id: 'X', title: 'Advanced', advanced: true,
    fields: [
      { key: 'ewMult', label: 'End-winding span (× coil angle)', unit: '×', def: 3, step: 0.5 },
      { key: 'layer_stack', label: 'Layers per stack (in parallel)', unit: '', def: 3, step: 1, int: true, min: 1 },
      { key: 'layers', label: 'Layers', unit: '', def: 1, step: 1, int: true, min: 1 },
      { key: 'parInsetIn', label: 'Parallel zone start (Rin + …)', unit: 'mm', def: 1, step: 0.5 },
      { key: 'parInsetOut', label: 'Parallel zone end (Rout − …)', unit: 'mm', def: 1, step: 0.5 },
      { key: 'segments_radial', label: 'Segments per radial sub-section', unit: '', def: 1, step: 1, int: true, min: 1, max: 200 },
      { key: 'el_m', label: 'Phases', unit: '', def: 3, step: 1, int: true, min: 1 },
    ],
  },
]

/** Design limits checked on the overview. Space between two magnets [mm]. */
export const LIMITS = { magSpaceMin: 0.5, magSpaceMax: 1.2 }

export const totalLayers = (r: MotorResult) => r.A.series_stacks * r.A.layer_stack * r.A.total_layer_stacks

/** Flat inputs object: every schema field key maps to a number, plus which spec value is solved. */
export interface MotorParams {
  spec_solve: SpecSolve
  [key: string]: number | SpecSolve
}
/** Numeric view of the params for formula code. */
export const values = (p: MotorParams) => p as unknown as Record<string, number>

export const FIELDS: Record<string, FieldDef & { group: SectionId }> = {}
SCHEMA.forEach(g => g.fields.forEach(f => { FIELDS[f.key] = { ...f, group: g.id } }))

export const SPEC_KEYS: Record<SpecSolve, string> = { P: 'spec_P', rpm: 'spec_rpm', T: 'spec_T' }
export const SPEC_OF_KEY: Record<string, SpecSolve> = { spec_P: 'P', spec_rpm: 'rpm', spec_T: 'T' }
export const isSpecSolve = (v: unknown): v is SpecSolve => v === 'T' || v === 'P' || v === 'rpm'
export const isWinding = (v: unknown): v is Winding => v === 'distributed' || v === 'concentrated'

/** True when v is acceptable for field f (finite and within its limits). */
export const inRange = (f: FieldDef, v: number) =>
  Number.isFinite(v) && (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max)

export function defaults(): MotorParams {
  const d: MotorParams = { spec_solve: 'T' }
  SCHEMA.forEach(g => g.fields.forEach(f => { d[f.key] = f.def }))
  return d
}
