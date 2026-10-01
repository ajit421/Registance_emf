import { describe, expect, it } from 'vitest'
import { compute } from './compute'
import { derive, deriveConcentrated, evaluate } from './derive'
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

/* Concentrated winding: values from an independent reference translation of the model
 * (the same steps as the Octave cross-check script). */
describe('concentrated winding', () => {
  const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(b)))
  const run = (over: Partial<Record<string, number>>) => evaluate({
    ...defaults(), spec_slots: 12, spec_poles: 10, ORS: 70, IRS: 50, ew_band: 5, turns: 5, gap_radial: 0.3, gap_end: 0.2,
    copper_thickness: 210, rho: 1.92e-8, cw_total_layers: 18, cw_series_group: 3, cw_via_resistance: 0, ...over,
  } as MotorParams, 'concentrated')

  it('12 slots / 10 poles, 18 layers in series groups of 3', () => {
    const { A, warnings } = run({})
    expect(warnings).toEqual([])
    expect(A.cw).toMatchObject({ Nsp: 1.2, branches: 6, layer_factor: 0.5, pitch_deg: 3, turns_per_coil: 15 })
    close(A.net_trace_angle_deg, 2.618028136579451)
    ;[0.0009937149185407163, 0.000923116700615819, 0.0008530786655155458, 0.000783551747020405, 0.0007144888283286306]
      .forEach((v, i) => close(A.perTurn[i].R_parallel, v))
    close(A.R_radial_coil, 0.004267950860021116)
    close(A.R_top_coil, 0.005490307161273591)
    close(A.R_bottom_coil, 0.003485671848982961)
    close(A.R_coil_single_layer, 0.01324392987027767)
    close(A.R_stack_total, 0.05297571948111068)
    close(A.trace_width_radial_avg, 2.7415926535897928)
    expect(A.total_turns).toBe(60)
    close(A.cw!.kw, 0.9330127018922195)
  })

  it('36 slots / 30 poles, 12 layers in groups of 4, with via resistance', () => {
    const { A } = run({ spec_slots: 36, spec_poles: 30, cw_total_layers: 12, cw_series_group: 4, turns: 4, cw_via_resistance: 0.01 })
    close(A.R_radial_coil, 0.027460758013662448)
    close(A.R_top_coil, 0.002973882738890219)
    close(A.R_bottom_coil, 0.0018892931904762923)
    close(A.R_stack_total, 0.3978872073163475)
    expect(A.total_turns).toBe(192)
  })

  it('fits each coil inside one slot pitch, legs two trace pitches apart per turn', () => {
    const { A } = run({})
    const outerEdge = A.perTurn[0].ew_angle_deg / 2 + A.net_trace_angle_deg / 2
    close(outerEdge + A.gap_deg / 2, A.theta_coil_deg / 2)
    close(A.perTurn[0].ew_angle_deg - A.perTurn[1].ew_angle_deg, 2 * A.per_turn_angle_deg)
  })

  it('calculates the winding factor from the slot / pole combination', () => {
    close(run({}).emf.Kw, 0.9330127018922195)
    close(run({ spec_poles: 8 }).emf.Kw, 0.8660254037844386)
    expect(run({ spec_poles: 12 }).warnings.join(' ')).toMatch(/cannot form a balanced/)
  })

  it('feeds the shared EMF, eddy and loading steps', () => {
    const d = deriveConcentrated({ ...defaults(), spec_slots: 12, spec_poles: 10 })
    expect(d.emf_pp).toBe(5)
    expect(d.slots_per_phase).toBe(4)
    expect(d.ed_paths).toBe(6)
    const R = run({})
    expect(R.emf.R).toBe(R.A.R_stack_total)
    expect(R.emf.Nph).toBe(60)
    expect(R.ed.f).toBeCloseTo(350 * 10 / 120, 12)
  })

  it('warns when the layers or slots do not divide evenly', () => {
    expect(run({ cw_total_layers: 10 }).warnings.join(' ')).toMatch(/not evenly divisible/)
    expect(run({ spec_slots: 13 }).warnings.join(' ')).toMatch(/not divisible by 3/)
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
