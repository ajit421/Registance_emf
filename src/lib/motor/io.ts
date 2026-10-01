/* Import / export of inputs: JSON, CSV, TXT report (with inputs trailer) and shareable links. */
import type { MotorResult } from './compute'
import { reportText } from './report'
import { FIELDS, SCHEMA, defaults, inRange, isSpecSolve, isWinding, values, type MotorParams, type Winding } from './schema'

const DEF = defaults()

const toNumber = (v: unknown) =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN

/** Keep only in-range numbers on known keys; everything else falls back to defaults. */
export function sanitize(obj: unknown): MotorParams {
  const out: MotorParams = { ...DEF }
  if (obj && typeof obj === 'object') {
    const src: Record<string, unknown> = { ...obj }
    // exports from before the single end-winding thickness input
    if (!('ew_band' in src) && 'dOR' in src) src.ew_band = src.dOR
    Object.keys(src).forEach(k => {
      const f = FIELDS[k]
      if (!f) return
      const v = f.int ? Math.round(toNumber(src[k])) : toNumber(src[k])
      if (inRange(f, v)) out[k] = v
    })
    if (isSpecSolve(src.spec_solve)) out.spec_solve = src.spec_solve
  }
  return out
}

/** Winding configuration stored in an import; files from before the choice existed are distributed. */
export function readWinding(obj: unknown): Winding {
  const w = obj && typeof obj === 'object' ? (obj as Record<string, unknown>).winding : undefined
  return isWinding(w) ? w : 'distributed'
}

/** Everything the user entered, as saved in JSON / TXT exports and links. */
export const inputsObject = (p: MotorParams, winding: Winding | null) => ({ winding, ...p })

export const same = (a: number, b: number) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b))

export const changedKeys = (p: MotorParams) =>
  Object.keys(FIELDS).filter(k => !same(values(p)[k], values(DEF)[k]))

/* shareable-link payload: #p=<urlencoded base64 of urlencoded JSON> (compatible with the original app) */
export const encodeLink = (obj: object) => encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(obj))))
export const decodeLink = (s: string): unknown => JSON.parse(decodeURIComponent(atob(decodeURIComponent(s))))

export function shareDiff(p: MotorParams, winding: Winding | null): Record<string, unknown> {
  const diff: Record<string, unknown> = {}
  if (winding) diff.winding = winding
  changedKeys(p).forEach(k => { diff[k] = p[k] })
  if (p.spec_solve !== DEF.spec_solve) diff.spec_solve = p.spec_solve
  return diff
}

const WINDING_LABEL = 'Winding configuration'

export function toCSV(p: MotorParams, winding: Winding | null, R: MotorResult): string {
  const { S, A, ed, emf, el, mag } = R
  const rows: (string | number)[][] = [['section', 'quantity', 'value', 'unit']]
  rows.push(['input S', 'Calculate', p.spec_solve, ''])
  rows.push(['input S', WINDING_LABEL, winding ?? '', ''])
  SCHEMA.forEach(g => g.fields.forEach(f => rows.push([`input ${g.id}`, f.label, p[f.key], f.unit])))
  const out: [string, string, number, string][] = [
    ['S', 'Poles', S.poles, ''], ['S', 'Slots per phase', ed.sides, ''],
    ['A', 'Outer radius OR', A.OR, 'mm'], ['A', 'Inner radius IR', A.IR, 'mm'],
    ['A', 'Trace width at IR', A.trace_width_radial_atIR, 'mm'], ['A', 'Average radial trace width', A.trace_width_radial_avg, 'mm'],
    ['A', 'Top end-winding thickness', A.top_ew_thickness, 'mm'], ['A', 'Bottom end-winding thickness', A.bottom_ew_thickness, 'mm'],
    ['A', 'Total radial resistance', A.R_radial_total, 'Ohm'], ['A', 'Total end-winding resistance', A.R_endwinding_total, 'Ohm'],
    ['A', 'Total turns', A.total_turns, ''], ['A', 'Phase resistance R_stack_total', A.R_stack_total, 'Ohm'],
    ['B', 'Frequency', ed.f, 'Hz'], ['B', 'Width part', ed.width_part, ''], ['B', 'Numerator', ed.numer, ''], ['B', 'Eddy loss', ed.P, 'W'],
    ['C', 'Flux per pole', emf.phi, 'Wb'], ['C', 'Back-EMF', emf.Ef, 'V'], ['C', 'Torque', emf.T, 'Nm'],
    ['C', 'Current peak', emf.Ipk, 'A'], ['C', 'Current rms', emf.Irms, 'A'], ['C', 'Copper loss', emf.Pcu, 'W'],
    ['C', 'Total loss', emf.Ploss, 'W'], ['C', 'Efficiency motor', emf.eta, ''], ['C', 'Voltage drop', emf.Vdrop, 'V'],
    ['C', 'Overall efficiency with ESC', emf.etaAll, ''], ['C', 'Terminal voltage', emf.Vterm, 'V'],
    ['A', 'Min trace width at IR', A.min_trace_IR, 'mm'],
    ['M', 'Pole pitch length', mag.pole_pitch, 'mm'], ['M', 'Space between two magnets', mag.space, 'mm'],
    ['D', 'Peak current', el.Ipk, 'A'], ['D', 'Turns per phase', el.N, ''], ['D', 'Do', el.Do, 'mm'], ['D', 'Din', el.Din, 'mm'],
    ['D', 'Average flux density', el.Bavg, 'T'], ['D', 'Required torque', el.T, 'Nm'],
    ['D', 'kd', el.kd, ''], ['D', 'Present Ac', el.Ac_present, 'A/m'], ['D', 'Required Ac', el.Ac_required, 'A/m'],
    ['D', 'Present / required', el.ratio, ''],
  ]
  if (A.cw) out.push(
    ['A', 'Slots per pole Nsp', A.cw.Nsp, ''], ['A', 'Coils per phase', A.mult, ''], ['A', 'Winding factor Kw', A.cw.kw, ''],
    ['A', 'Trace pitch', A.cw.pitch_deg, 'deg'], ['A', 'Turns per coil', A.cw.turns_per_coil, ''],
    ['A', 'Parallel branches', A.cw.branches, ''], ['A', 'Stack factor', A.cw.layer_factor, ''],
    ['A', 'One coil, full layer stack', A.R_coil_single_layer, 'Ohm'],
  )
  out.forEach(r => rows.push([`result ${r[0]}`, r[1], r[2], r[3]]))
  return rows.map(r => r.map(v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n')
}

/** Report text + a comment trailer holding every input, so the .txt can be imported back. */
const TXT_TAG = '% inputs (for import):'
export const reportExport = (inputs: object, R: MotorResult) => `${reportText(R)}\n\n${TXT_TAG} ${JSON.stringify(inputs)}\n`

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',' || ch === ';') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.map(r => r.map(c => c.trim()))
}

export interface ImportResult { kind: string; obj: Record<string, unknown>; n: number; partial?: boolean }

function fromCSV(text: string): Omit<ImportResult, 'kind'> {
  const obj: Record<string, unknown> = {}
  let n = 0
  parseCSV(text).forEach(([sec = '', label = '', value = '']) => {
    const m = sec.match(/^input\s+(\w+)$/i)
    if (!m) return
    if (label === 'Calculate') { obj.spec_solve = value; return }
    if (label === WINDING_LABEL) { obj.winding = value; return }
    const g = SCHEMA.find(x => x.id === m[1].toUpperCase())
    const f = g?.fields.find(x => x.label === label || x.key === label)
    if (f && value !== '' && Number.isFinite(Number(value))) { obj[f.key] = Number(value); n++ }
  })
  if (!n) throw new Error('No input rows found in this CSV.')
  return { obj, n }
}

/** Report text without the inputs trailer: recover what the printout shows. */
function fromReport(text: string): Omit<ImportResult, 'kind'> {
  const obj: Record<string, unknown> = {}
  const numRe = '(-?[\\d.]+(?:e[-+]?\\d+)?)'
  const spec: [string, string, string][] = [['Output power', 'spec_P', 'P'], ['Speed', 'spec_rpm', 'rpm'], ['Torque \\(P / omega\\)', 'spec_T', 'T']]
  spec.forEach(([l, k, s]) => {
    const m = text.match(new RegExp(`^${l}\\s*:\\s*${numRe}.*$`, 'mi'))
    if (m) { obj[k] = Number(m[1]); if (/\(calculated\)/.test(m[0])) obj.spec_solve = s }
  })
  const grab = (label: string, key: string) => {
    const m = text.match(new RegExp(`^${label}\\s*:\\s*${numRe}`, 'mi'))
    if (m) obj[key] = Number(m[1])
  }
  let m = text.match(new RegExp(`^Slots / Poles\\s*:\\s*${numRe}\\s*/\\s*${numRe}`, 'mi'))
  if (m) { obj.spec_slots = Number(m[1]); obj.spec_poles = Number(m[2]) }
  grab('Outer radius Ro', 'ORS')
  grab('Inner radius Ri', 'IRS')
  m = text.match(new RegExp(`^Conductor w x t x len\\s*:\\s*${numRe}\\s*x\\s*${numRe}\\s*x\\s*${numRe}`, 'mi'))
  if (m) obj.ed_len = Number(m[3])
  m = text.match(new RegExp(`^Magnet length x width\\s*:\\s*${numRe}\\s*x\\s*${numRe}`, 'mi'))
  if (m) { obj.mag_len = Number(m[1]); obj.mag_width = Number(m[2]) }
  grab('ESC - Efficiency \\(motor\\)', 'emf_etaESC')
  const n = Object.keys(obj).filter(k => k in FIELDS).length
  if (!n) throw new Error('No inputs could be read from this report text.')
  return { obj, n, partial: true }
}

const countKnown = (obj: Record<string, unknown>) => Object.keys(obj).filter(k => k in FIELDS).length
const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {})

/** Detect the format of exported text and turn it into an inputs object. */
export function parseImport(raw: string): ImportResult {
  const text = String(raw).replace(/^﻿/, '').trim()
  if (!text) throw new Error('Nothing to import.')
  const link = text.match(/[#&?]p=([^&\s#]+)/)
  if (link) {
    let obj
    try { obj = asObj(decodeLink(link[1])) } catch { throw new Error('This link is damaged or incomplete.') }
    return { kind: 'Link', obj, n: countKnown(obj) }
  }
  if (text[0] === '{') {
    let obj
    try { obj = asObj(JSON.parse(text)) } catch { throw new Error('This is not valid JSON.') }
    return { kind: 'JSON', obj, n: countKnown(obj) }
  }
  const tag = text.lastIndexOf(TXT_TAG)
  if (tag >= 0) {
    let obj
    try { obj = asObj(JSON.parse(text.slice(tag + TXT_TAG.length).trim().split('\n')[0])) } catch { throw new Error('The inputs line at the end of this TXT file is damaged.') }
    return { kind: 'TXT', obj, n: countKnown(obj) }
  }
  if (/^"?section"?[,;]"?quantity"?/i.test(text)) return { kind: 'CSV', ...fromCSV(text) }
  if (/=+\s*MOTOR SPECIFICATION\s*=+/.test(text)) return { kind: 'TXT', ...fromReport(text) }
  throw new Error('Format not recognised. Use a JSON, CSV or TXT file exported from this app, or a shareable link.')
}
