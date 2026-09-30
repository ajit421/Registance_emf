/* Plain-text results report. The layout is kept stable because TXT exports are re-imported by io.ts. */
import type { MotorResult } from './compute'
import { LIMITS } from './schema'

const f = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d) : Number.isNaN(v) ? 'NaN' : v > 0 ? 'Inf' : '-Inf')

/** Exponential with a two-digit exponent, e.g. 1.234560e-05 */
export function fmtE(v: number, d: number) {
  if (!Number.isFinite(v)) return f(v, d)
  const [m, x] = v.toExponential(d).split('e')
  const n = parseInt(x, 10)
  return `${m}e${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`
}

export function reportText(r: MotorResult): string {
  const { S, A, ed, emf, el, mag } = r
  const L: string[] = []
  r.warnings.forEach(w => L.push(`* WARNING: ${w} *`))
  const c = (k: string) => (S.solve === k ? '  (calculated)' : '')
  L.push('', '=========== MOTOR SPECIFICATION ===========')
  L.push(`Output power            : ${f(S.P, 4)} W${c('P')}`)
  L.push(`Speed                   : ${f(S.rpm, 4)} rpm${c('rpm')}`)
  L.push(`Angular speed (omega)   : ${f(S.omega, 4)} rad/s`)
  L.push(`Torque (P / omega)      : ${f(S.T, 4)} Nm${c('T')}`)
  L.push(`Slots / Poles           : ${Math.round(S.slots)} / ${Math.round(S.poles)}`)
  L.push('', '=========== WINDING / RESISTANCE (selected) ===========')
  L.push(`Average radial trace width (at r = ${f(A.r_mean_turns, 2)} mm) : ${f(A.trace_width_radial_avg, 4)} mm`)
  L.push(`Trace width at IR (r = ${f(A.IR, 2)} mm)             : ${f(A.trace_width_radial_atIR, 4)} mm`)
  L.push(`Total radial resistance                     : ${f(A.R_radial_total, 4)} Ohm`)
  L.push(`Total end-winding resistance                : ${f(A.R_endwinding_total, 4)} Ohm`)
  L.push('', '=========== EDDY CURRENT LOSS ===========')
  L.push(`Poles                   : ${Math.round(ed.poles)}`)
  L.push(`Conductor w x t x len   : ${f(ed.tw, 2)} x ${f(ed.th, 2)} x ${f(ed.len, 2)} mm`)
  L.push(`Frequency               : ${f(ed.f, 3)} Hz`)
  L.push(`Width part              : ${fmtE(ed.width_part, 6)}`)
  L.push(`Numerator               : ${f(ed.numer, 6)}`)
  L.push(`Eddy loss (final)       : ${f(ed.P, 6)} W`)
  L.push('', '=========== EMF / PERFORMANCE ===========')
  L.push(`Outer radius Ro         : ${f(emf.Ro, 2)} mm`)
  L.push(`Inner radius Ri         : ${f(emf.Ri, 2)} mm`)
  L.push(`Phase resistance (A)    : ${f(emf.R, 4)} Ohm`)
  L.push(`Flux per pole (phi)     : ${fmtE(emf.phi, 6)} Wb`)
  L.push(`Back-EMF (Ef)           : ${f(emf.Ef, 4)} V`)
  L.push(`Torque                  : ${f(emf.T, 4)} Nm`)
  L.push(`Current (peak)          : ${f(emf.Ipk, 4)} A`)
  L.push(`Current (rms)           : ${f(emf.Irms, 4)} A`)
  L.push(`Efficiency (motor)      : ${f(emf.eta, 4)}  (${f(100 * emf.eta, 2)} %)`)
  L.push(`Voltage drop            : ${f(emf.Vdrop, 4)} V`)
  L.push(`Overall (with ESC)      : ${f(emf.etaAll, 4)}  (${f(100 * emf.etaAll, 2)} %)`)
  L.push(`Terminal voltage        : ${f(emf.Vterm, 4)} V`)
  L.push('', '=========== MAGNET DIMENSIONS ===========')
  L.push(`Rin / Rout              : ${f(mag.Rin, 2)} mm / ${f(mag.Rout, 2)} mm`)
  L.push(`Magnet length x width   : ${f(mag.len, 2)} x ${f(mag.width, 2)} mm`)
  L.push(`Pole pitch length       : ${f(mag.pole_pitch, 4)} mm`)
  L.push(`Space between magnets   : ${f(mag.space, 4)} mm  ${mag.spaceOk ? '(OK)' : `(ERROR: outside ${LIMITS.magSpaceMin}-${LIMITS.magSpaceMax} mm)`}`)
  L.push('', '=========== ELECTRIC LOADING ===========')
  L.push(`Do / Din                : ${f(el.Do, 2)} mm / ${f(el.Din, 2)} mm`)
  L.push(`kd (Din/Do)             : ${f(el.kd, 4)}`)
  L.push(`Avg radius (sheet B8)   : ${f(el.Ravg, 2)} mm`)
  L.push(`Present  Ac             : ${f(el.Ac_present, 2)} A/m`)
  L.push(`Required Ac             : ${f(el.Ac_required, 2)} A/m`)
  L.push(`Present / Required      : ${f(el.ratio, 3)}  ${el.enough ? '(present loading is enough)' : '(present loading is NOT enough)'}`)
  L.push('', '', '=========== LOSSES ===========')
  L.push(`Copper loss      : ${f(emf.Pcu, 4)} W`)
  L.push(`Eddy current loss: ${f(emf.Peddy, 4)} W`)
  L.push(`Total loss       : ${f(emf.Ploss, 4)} W`)
  L.push('', '', '===========efficiency===========')
  L.push(`Efficiency (motor)      : ${f(emf.eta, 4)}  (${f(100 * emf.eta, 2)} %)`)
  L.push(`ESC - Efficiency (motor)      : ${f(emf.etaESC, 4)}  (${f(100 * emf.etaESC, 2)} %)`)
  L.push(`Voltage drop            : ${f(emf.Vdrop, 4)} V`)
  L.push(`Terminal voltage        : ${f(emf.Vterm, 4)} V`)
  L.push(`Overall (with ESC)      : ${f(emf.etaAll, 4)}  (${f(100 * emf.etaAll, 2)} %)`)
  return L.join('\n')
}
