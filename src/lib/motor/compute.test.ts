import { describe, expect, it } from 'vitest'
import { compute } from './compute'
import { derive, evaluate } from './derive'
import { inputsObject, parseImport, readWinding, reportExport, sanitize, shareDiff, encodeLink, toCSV } from './io'
import { reportText } from './report'
import { defaults, type MotorParams } from './schema'
import reference from './__fixtures__/reference-results.json'

/** The original default design, which had pole pairs 9 as a separate input. */
const legacyDefaults = () => ({ ...derive(defaults()), emf_pp: 9 })

describe('derived inputs (distributed winding)', () => {
  const d = derive({ ...defaults(), spec_slots: 72, ORS: 80, IRS: 55, ew_band: 4, layer_stack: 2, total_layer_stacks: 3 })

  it('fills poles, pole pairs and slots per phase from the slot count', () => {
    expect(d.spec_poles).toBe(24)
    expect(d.emf_pp).toBe(12)
    expect(d.slots_per_phase).toBe(12)
  })

  it('uses one end-winding thickness for both bands, Rout − Rin as conductor length', () => {
    expect(d.dOR).toBe(4)
    expect(d.dIR).toBe(4)
    expect(d.ed_len).toBe(25)
    expect(d.ed_paths).toBe(6)
  })

  it('reproduces the original defaults apart from pole pairs', () => {
    const old = compute(legacyDefaults()), now = evaluate(defaults())
    expect(now.emf.pp).toBe(15)
    // pole pairs cancel out of Ef (φ ∝ 1/pp, Ef ∝ pp·φ), so only φ itself changes
    expect(now.emf.Ef).toBeCloseTo(old.emf.Ef, 10)
    expect(now.emf.eta).toBeCloseTo(old.emf.eta, 12)
    expect(now.emf.phi).toBeCloseTo(old.emf.phi * 9 / 15, 15)
  })
})

describe('compute — default design', () => {
  const r = compute(legacyDefaults())

  it('has no warnings', () => expect(r.warnings).toEqual([]))

  it('matches the reference numbers', () => {
    expect(r.A.R_stack_total).toBeCloseTo(4.562834313787641, 12)
    expect(r.A.total_turns).toBe(375)
    expect(r.ed.f).toBe(87.5)
    expect(r.ed.P).toBeCloseTo(0.48146413771182817, 12)
    expect(r.emf.Ef).toBeCloseTo(20.726217709087155, 10)
    expect(r.emf.Pcu).toBeCloseTo(3.585911288832546, 10)
    expect(r.emf.eta).toBeCloseTo(0.8469033782508859, 12)
    expect(r.el.ratio).toBeCloseTo(1.8173009070474513, 10)
    expect(r.mag.space).toBeCloseTo(0.47197551196597765, 12)
    expect(r.mag.spaceOk).toBe(false)
  })

  it('solves the spec triangle', () => {
    const d = defaults()
    const P = evaluate({ ...d, spec_solve: 'P' }).S
    expect(P.P).toBeCloseTo(22.5, 10)
    const rpm = evaluate({ ...d, spec_solve: 'rpm' }).S
    expect(rpm.rpm).toBeCloseTo(350, 10)
  })
})

/* Regression against recorded outputs of the original engine (see __fixtures__/reference-results.json). */
describe('reference results', () => {
  // NaN / ±Infinity are stored as strings because JSON cannot hold them
  const dec = (v: unknown) => (v === 'NaN' ? NaN : v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v)
  type Sec = Record<string, unknown>
  const cases = reference.cases as unknown as { params: MotorParams; result: Record<string, Sec> & { warnings: string[] } }[]

  const close = (a: unknown, b: unknown, where: string) => {
    if (typeof a === 'number' && typeof b === 'number') {
      if (Number.isNaN(a) || Number.isNaN(b)) return expect(Number.isNaN(a), where).toBe(Number.isNaN(b))
      if (!Number.isFinite(a) || !Number.isFinite(b)) return expect(a, where).toBe(b)
      return expect(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${where}: ${a} vs ${b}`).toBe(true)
    }
    expect(a, where).toEqual(b)
  }

  it(`reproduces all ${cases.length} recorded designs`, () => {
    cases.forEach(({ params, result }, i) => {
      const r = compute(params) as unknown as Record<string, Sec> & { warnings: string[] }
      expect(r.warnings, `#${i} warnings`).toEqual(result.warnings)
      for (const sec of ['S', 'A', 'ed', 'emf', 'mag', 'el'])
        for (const k of Object.keys(result[sec])) close(r[sec][k], dec(result[sec][k]), `#${i} ${sec}.${k}`)
    })
  })

  it('produces the same text report', () => {
    expect(reportText(compute(legacyDefaults()))).toBe(reference.defaultsReport)
  })
})

describe('import / export', () => {
  const p: MotorParams = { ...defaults(), turns: 7, ORS: 72.5, spec_solve: 'P' }
  const R = evaluate(p)

  it('sanitize drops unknown keys, non-numbers and out-of-range values', () => {
    const s = sanitize({ turns: '6', bogus: 1, ORS: 'abc', IRS: null, spec_slots: 0, spec_solve: 'nope' })
    expect(s.turns).toBe(6)
    expect(s.ORS).toBe(70)
    expect(s.IRS).toBe(50)
    expect(s.spec_slots).toBe(90)
    expect('bogus' in s).toBe(false)
    expect(s.spec_solve).toBe('T')
  })

  it('reads the end-winding thickness from older exports', () => {
    expect(sanitize({ dOR: 3.5, dIR: 5 }).ew_band).toBe(3.5)
  })

  it('round-trips JSON, TXT, CSV and links, including the winding choice', () => {
    for (const text of [
      JSON.stringify(inputsObject(p, 'concentrated')),
      reportExport(inputsObject(p, 'concentrated'), R),
      toCSV(p, 'concentrated', R),
      `https://example.com/#p=${encodeLink(shareDiff(p, 'concentrated'))}`,
    ]) {
      const { obj } = parseImport(text)
      const back = sanitize(obj)
      expect(back.turns).toBe(7)
      expect(back.ORS).toBe(72.5)
      expect(back.spec_solve).toBe('P')
      expect(readWinding(obj)).toBe('concentrated')
    }
  })

  it('treats imports without a winding choice as distributed', () => {
    expect(readWinding(parseImport(JSON.stringify({ turns: 4 })).obj)).toBe('distributed')
  })

  it('rejects unknown formats', () => {
    expect(() => parseImport('hello')).toThrow(/not recognised/)
  })
})
