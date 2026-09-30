import { describe, expect, it } from 'vitest'
import { compute } from './compute'
import { parseImport, reportExport, sanitize, shareDiff, encodeLink, toCSV } from './io'
import { runSweep } from './metrics'
import { reportText } from './report'
import { defaults, type MotorParams } from './schema'
import reference from './__fixtures__/reference-results.json'

describe('compute — default design', () => {
  const r = compute(defaults())

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
    const P = compute({ ...d, spec_solve: 'P' }).S
    expect(P.P).toBeCloseTo(22.5, 10)
    const rpm = compute({ ...d, spec_solve: 'rpm' }).S
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
    expect(reportText(compute(defaults()))).toBe(reference.defaultsReport)
  })
})

describe('parameter sweep', () => {
  it('finds the best efficiency and keeps swept spec values as given inputs', () => {
    const res = runSweep(defaults(), 'spec_rpm', 'eta', 100, 600, 51)!
    expect(res.pts).toHaveLength(51)
    expect(res.best!.y).toBe(Math.max(...res.good.map(p => p.y)))
    // with torque solved, sweeping speed must actually change speed, not be overwritten by the solver
    expect(res.pts[0].x).toBe(100)
    expect(res.pts[0].y).not.toBeCloseTo(res.pts[50].y, 6)
  })

  it('rounds integer inputs and rejects empty ranges', () => {
    const res = runSweep(defaults(), 'turns', 'R', 2, 8, 41)!
    expect(res.pts.map(p => p.x)).toEqual([2, 3, 4, 5, 6, 7, 8])
    expect(runSweep(defaults(), 'turns', 'R', 5, 5, 10)).toBeNull()
  })
})

describe('import / export', () => {
  const p: MotorParams = { ...defaults(), turns: 7, ORS: 72.5, spec_solve: 'P' }
  const R = compute(p)

  it('sanitize drops unknown keys and non-numbers', () => {
    const s = sanitize({ turns: '6', bogus: 1, ORS: 'abc', spec_solve: 'nope' })
    expect(s.turns).toBe(6)
    expect(s.ORS).toBe(70)
    expect('bogus' in s).toBe(false)
    expect(s.spec_solve).toBe('T')
  })

  it('round-trips JSON, TXT, CSV and links', () => {
    for (const text of [
      JSON.stringify(p),
      reportExport(p, R),
      toCSV(p, R),
      `https://example.com/#p=${encodeLink(shareDiff(p))}`,
    ]) {
      const back = sanitize(parseImport(text).obj)
      expect(back.turns).toBe(7)
      expect(back.ORS).toBe(72.5)
      expect(back.spec_solve).toBe('P')
    }
  })

  it('rejects unknown formats', () => {
    expect(() => parseImport('hello')).toThrow(/not recognised/)
  })
})
