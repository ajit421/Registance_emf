import { describe, expect, it } from 'vitest'
import { designErrors } from './checks'
import { compute } from './compute'
import { derive, deriveConcentrated, evaluate } from './derive'
import { inputsObject, parseImport, readWinding, reportExport, sanitize, shareDiff, encodeLink, toCSV } from './io'
import { reportText } from './report'
import { defaults, followDefaults, type MotorParams } from './schema'
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

/* Concentrated winding: values from a line-by-line translation of the Octave reference script
 * (every layer in series, end-winding radial legs with their own gap). */
describe('concentrated winding', () => {
  const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(b)))
  // the inputs of the Octave script
  const run = (over: Partial<Record<string, number>>) => evaluate({
    ...defaults(), spec_slots: 12, spec_poles: 10, ORS: 70, IRS: 50, ew_band: 5, turns: 5, gap_radial: 0.2, gap_end: 0.2,
    cw_gap_radial_ew: 0.9, cw_via_space: 1, cw_slot_space: 0.5,
    copper_thickness: 210, rho: 1.92e-8, cw_total_layers: 1, cw_via_resistance: 0, ...over,
  } as MotorParams, 'concentrated')

  it('12 slots / 10 poles, one layer (the Octave script inputs)', () => {
    const { A, warnings } = run({})
    expect(warnings).toEqual([])
    expect(A.cw).toMatchObject({ Nsp: 1.2, total_layers: 1, turns_per_coil: 5 })
    close(A.cw!.radial_angle_deg, 13.5)
    close(A.ew_angle_deg, 29)
    close(A.cw!.w_IRS, 2.1961944901923447)
    close(A.cw!.w_ORS, 3.1386722862692826)
    close(A.trace_width_radial_avg, 2.6674333882308137)
    close(A.top_ew_thickness, 0.8)
    ;[2.6964820107789, 2.6729200658769767, 2.6493581209750534, 2.6257961760731297, 2.6022342311712063]
      .forEach((v, i) => close(A.cw!.perTurnEw[i].top_leg_w, v))
    ;[1.5183847656827276, 1.5419467105846512, 1.5655086554865747, 1.589070600388498, 1.6126325452904215]
      .forEach((v, i) => close(A.cw!.perTurnEw[i].bottom_leg_w, v))
    ;[0.004654317903608238, 0.004531050589981563, 0.004406619619188269, 0.004280993665842602, 0.004154140270015256]
      .forEach((v, i) => close(A.perTurn[i].R_top, v))
    close(A.cw!.R_half_slot, 0.0034275859270552138)
    close(A.R_radial_coil, 0.0068551718541104275)
    close(A.R_top_coil, 0.02202712204863593)
    close(A.R_bottom_coil, 0.015479754511612296)
    close(A.R_radial_total, 0.02742068741644171)
    close(A.R_top_total, 0.08810848819454371)
    close(A.R_bottom_total, 0.061919018046449184)
    close(A.R_stack_total, 0.1774481936574346)
    expect(A.total_turns).toBe(20)
    close(A.cw!.kw, 0.9330127018922195)
  })

  it('36 slots / 30 poles, 4 layers in series, with via resistance', () => {
    const { A, warnings } = run({
      spec_slots: 36, spec_poles: 30, ORS: 80, IRS: 55, ew_band: 4, turns: 4, gap_radial: 0.15, gap_end: 0.15,
      cw_gap_radial_ew: 0.3, cw_via_space: 0.6, cw_slot_space: 0.3, copper_thickness: 105, rho: 1.72e-8,
      cw_total_layers: 4, cw_via_resistance: 0.01,
    })
    expect(warnings).toEqual([])
    close(A.cw!.w_IRS, 0.8714293658118033)
    close(A.R_radial_coil, 0.029918190446746224)
    close(A.R_top_coil, 0.013037195158392502)
    close(A.R_bottom_coil, 0.011169145704215839)
    close(A.R_radial_total, 1.4360731414438188)
    close(A.R_stack_total, 2.5979775028490195 + 0.01)
    expect(A.total_turns).toBe(192)
  })

  it('splits the slot pitch into via space, radial traces and slot space', () => {
    const { A } = run({})
    close(A.cw!.via_space_deg + A.cw!.radial_angle_deg + A.cw!.slot_space_deg, A.theta_coil_deg / 2)
    close(A.ew_angle_deg, A.theta_coil_deg - 2 * A.cw!.slot_space_deg)
    // turns traces + (turns − 1) gaps fill the radial trace angle at every radius
    const fill = (r: number, w: number) => A.turns * w + (A.turns - 1) * 0.2 - A.cw!.radial_angle_deg * Math.PI / 180 * r
    close(fill(A.IRS, A.cw!.w_IRS), 0)
    close(fill(A.ORS, A.cw!.w_ORS), 0)
  })

  it('warns when the traces do not fit', () => {
    expect(run({ cw_via_space: 10, cw_slot_space: 6 }).warnings.join(' ')).toMatch(/Radial trace angle ≤ 0/)
    expect(run({ gap_radial: 3 }).warnings.join(' ')).toMatch(/Radial trace width at IRS ≤ 0/)
    expect(run({ cw_gap_radial_ew: 3 }).warnings.join(' ')).toMatch(/End-winding radial leg width ≤ 0/)
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
    // every layer is in series and already counted in the turns per phase
    expect(d.ed_paths).toBe(1)
    const R = run({ cw_total_layers: 3 })
    expect(R.emf.R).toBe(R.A.R_stack_total)
    expect(R.emf.Nph).toBe(60)
    expect(R.ed.tw).toBe(R.A.trace_width_radial_avg)
    expect(R.ed.f).toBeCloseTo(350 * 10 / 120, 12)
  })

  it('scales the phase resistance with the number of layers in series', () => {
    close(run({ cw_total_layers: 6 }).A.R_stack_total, 6 * run({}).A.R_stack_total)
  })

  it('warns when the slots do not divide evenly', () => {
    expect(run({ spec_slots: 13 }).warnings.join(' ')).toMatch(/not divisible by 3/)
  })
})

describe('defaults per winding', () => {
  it('the concentrated defaults are a valid design that passes every design rule', () => {
    const R = evaluate(defaults('concentrated'), 'concentrated')
    expect(R.warnings).toEqual([])
    expect(designErrors(R).filter(c => c.level !== 'ok')).toEqual([])
    expect(R.S.slots).toBe(12)
    expect(R.S.poles).toBe(10)
    expect(R.A.R_stack_total).toBeGreaterThan(0)
  })

  it('switching winding moves inputs at their default and keeps edited ones', () => {
    const p = followDefaults({ ...defaults('distributed'), copper_thickness: 175 }, 'distributed', 'concentrated')
    expect(p.spec_slots).toBe(12)
    expect(p.gap_radial).toBe(0.2)
    expect(p.copper_thickness).toBe(175)
    expect(followDefaults(p, 'concentrated', 'distributed').spec_slots).toBe(90)
  })

  it('reads imports and links against the winding they were made with', () => {
    expect(sanitize({ turns: 4 }, 'concentrated').spec_slots).toBe(12)
    const p = { ...defaults('concentrated'), turns: 7 }
    expect(shareDiff(p, 'concentrated')).toEqual({ winding: 'concentrated', turns: 7 })
  })

  it('a concentrated trace with no width left gives no resistance instead of a negative one', () => {
    const R = evaluate({ ...defaults('concentrated'), spec_slots: 90, spec_poles: 30 }, 'concentrated')
    expect(R.A.cw!.w_IRS).toBeLessThan(0)
    expect(Number.isNaN(R.A.R_stack_total)).toBe(true)
    expect(Number.isNaN(R.emf.eta)).toBe(true)
    expect(Number.isNaN(R.ed.P)).toBe(true)
    expect(R.warnings.join(' ')).toMatch(/Radial trace width at IRS ≤ 0/)
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
