/* Calculation engine — pure functions, no DOM.
 *   Spec) power / speed / torque (two given, one solved), slots, poles
 *   A) Winding geometry + resistance  -> R_stack_total
 *   B) Eddy current loss
 *   C) EMF / performance              (phase R from A, eddy loss from B)
 *   M) Magnet dimensions
 *   D) Electric loading
 * Linked values (not separate inputs): eddy conductor width/thickness, turns and coil sides,
 * and EMF turns per phase all come from A; eddy Bz = C air-gap B; radii come from A ORS/IRS.
 */
import { LIMITS, isSpecSolve, values, type MotorParams, type SpecSolve } from './schema'

const mm2m = 1e-3
const deg2rad = Math.PI / 180

export interface Spec {
  solve: SpecSolve
  P: number
  rpm: number
  T: number
  omega: number
  slots: number
  poles: number
}

export interface Turn {
  k: number
  Rout: number
  Rin: number
  radial_length: number
  ew_angle_deg: number
  top_arc: number
  bottom_arc: number
  R_single_in: number
  /** parallel part of the radial leg; for a concentrated winding the whole leg, one layer */
  R_parallel: number
  R_single_out: number
  len_single: number
  len_parallel: number
  R_radial_leg: number
  R_top: number
  R_bottom: number
}

/** Extra values of a concentrated (tooth-wound) winding. */
export interface ConcentratedInfo {
  poles: number
  /** slots per pole */
  Nsp: number
  total_layers: number
  series_group_size: number
  branches: number
  /** series_group_size² / total_layers: one-layer resistance × this = stack resistance */
  layer_factor: number
  /** angular pitch of one radial trace = slot pitch / (2 × turns) [deg] */
  pitch_deg: number
  /** turns in series per coil = turns per layer × layers in series */
  turns_per_coil: number
  /** winding factor (pitch × distribution), NaN for an unbalanced slot / pole combination */
  kw: number
  kp: number
  kd: number
}

export type WindingResult = MotorResult['A']

export interface MotorResult {
  S: Spec
  A: {
    ORS: number; OR: number; IRS: number; IR: number; slots: number
    theta_coil_deg: number; ew_angle_deg: number; turns: number; gap_deg: number; per_turn_angle_deg: number
    net_trace_angle_deg: number; net_trace_angle_rad: number; trace_width_radial_atIR: number
    top_ew_thickness: number; bottom_ew_thickness: number; top_pitch: number; bottom_pitch: number
    par_r_start: number; par_r_end: number; perTurn: Turn[]
    total_radial_one_side: number; total_top_arc: number; total_bottom_arc: number; A_top: number; A_bottom: number
    R_radial_one_side: number; R_radial_coil: number; R_top_coil: number; R_bottom_coil: number
    R_coil_single_layer: number; mult: number
    R_radial_total: number; R_top_total: number; R_bottom_total: number; R_coil_total: number
    total_turns: number; R_stack_total: number
    r_mean_turns: number; trace_width_radial_avg: number; R_endwinding_total: number
    series_stacks: number; total_layer_stacks: number; layer_stack: number; segments_radial: number
    via_resistance: number; min_trace_IR: number; traceOk: boolean
    /** only for a concentrated winding */
    cw?: ConcentratedInfo
  }
  ed: {
    tw: number; Bz: number; th: number; Bphi: number; rpm: number; poles: number
    rho: number; Nc: number; sides: number; paths: number; len: number
    f: number; width_part: number; numer: number; P: number
  }
  emf: {
    Bgap: number; Ro: number; Ri: number; poles: number; pp: number; Nph: number; Kw: number
    rpm: number; P: number; R: number; Peddy: number; etaESC: number
    phi: number; Ef: number; T: number; Ipk: number; Irms: number; Pcu: number; Ploss: number
    eta: number; Vdrop: number; etaAll: number; Vterm: number
  }
  mag: { Rin: number; Rout: number; poles: number; len: number; width: number; pole_pitch: number; space: number; spaceOk: boolean }
  el: {
    Ipk: number; m: number; N: number; Do: number; Din: number; Ro: number; Ri: number; Bavg: number; T: number
    kd: number; Ravg: number; Ac_present: number; Ac_required: number; ratio: number; enough: boolean
  }
  warnings: string[]
}

/** Power / speed / torque: two are given, the third (spec_solve) is calculated. T = P / ω, ω = 2π·rpm/60 */
export function resolveSpec(params: MotorParams): Spec {
  const p = values(params)
  const solve: SpecSolve = isSpecSolve(params.spec_solve) ? params.spec_solve : 'T'
  const w = (rpm: number) => 2 * Math.PI * rpm / 60
  let P = p.spec_P, rpm = p.spec_rpm, T = p.spec_T
  if (solve === 'T') T = P / w(rpm)
  else if (solve === 'P') P = T * w(rpm)
  else rpm = (P / T) * 60 / (2 * Math.PI)
  return { solve, P, rpm, T, omega: w(rpm), slots: p.spec_slots, poles: p.spec_poles }
}

/** Spec plus the warning when it cannot be solved. */
export function specWithCheck(params: MotorParams, warnings: string[]): Spec {
  const S = resolveSpec(params)
  if (!(Number.isFinite(S.P) && Number.isFinite(S.rpm) && Number.isFinite(S.T)) || S.rpm <= 0 || S.T <= 0)
    warnings.push('Motor specification is not solvable: power, speed and torque must all be > 0.')
  return S
}

/** Distributed winding: full design (A → D). */
export function compute(params: MotorParams): MotorResult {
  const p = values(params)
  const warnings: string[] = []
  const S = specWithCheck(params, warnings)
  const A = distributedWinding(p, S, warnings)
  return { S, A, ...performance(p, S, A, warnings), warnings }
}

/** A) Distributed winding geometry + resistance. */
function distributedWinding(p: Record<string, number>, S: Spec, warnings: string[]): WindingResult {
  const ORS = p.ORS, OR = ORS + p.dOR, IRS = p.IRS, IR = IRS - p.dIR
  const slots = S.slots
  const theta_coil_deg = 360 / slots
  const ew_angle_deg = (360 / slots) * p.ewMult
  const turns = Math.max(1, Math.round(p.turns))
  const { gap_radial, gap_end, copper_thickness, rho, layers, layer_stack,
    total_layer_stacks, slots_per_phase, series_stacks, via_resistance } = p
  const segments_radial = Math.max(1, Math.round(p.segments_radial))
  const par_r_start = IRS + p.parInsetIn
  const par_r_end = ORS - p.parInsetOut

  // STEP 1: radial trace width from angle
  const gap_deg = (gap_radial / IR) * (180 / Math.PI)
  const per_turn_angle_deg = theta_coil_deg / turns
  const net_trace_angle_deg = per_turn_angle_deg - gap_deg
  if (net_trace_angle_deg <= 0)
    warnings.push(`Net trace angle ≤ 0 (${net_trace_angle_deg.toFixed(4)}°) — radial traces don't fit in the coil angle.`)
  const trace_width_radial_atIR = net_trace_angle_deg * deg2rad * IR
  const net_trace_angle_rad = net_trace_angle_deg * deg2rad

  // STEP 2: end-winding trace thickness
  const top_ew_thickness = (OR - ORS) / turns - gap_end
  const bottom_ew_thickness = (IRS - IR) / turns - gap_end
  const top_pitch = top_ew_thickness + gap_end
  const bottom_pitch = bottom_ew_thickness + gap_end
  if (top_ew_thickness <= 0) warnings.push('Top end-winding thickness ≤ 0.')
  if (bottom_ew_thickness <= 0) warnings.push('Bottom end-winding thickness ≤ 0.')

  // STEP 3b helper: resistance of a radial segment r1→r2 integrated over n slices
  const segR = (r1: number, r2: number, n: number) => {
    const L = Math.max(r2 - r1, 0)
    let s = 0
    for (let i = 1; i <= n; i++) {
      s += rho * (L / n / 1000) /
        ((net_trace_angle_rad * (r1 + (L / n) * (i - 0.5)) / 1000) * (copper_thickness * 1e-6))
    }
    return s
  }

  // STEP 5 areas
  const A_top = (top_ew_thickness / 1000) * (copper_thickness * 1e-6)
  const A_bottom = (bottom_ew_thickness / 1000) * (copper_thickness * 1e-6)

  // STEP 3: per-turn geometry; radial leg = single (inner) + parallel + single (outer)
  const T: Turn[] = []
  for (let k = 1; k <= turns; k++) {
    const Rout = OR - (k - 1) * top_pitch
    const Rin = IR + (k - 1) * bottom_pitch
    const ew = ew_angle_deg - (k - 1) * per_turn_angle_deg
    if (ew <= 0) warnings.push(`Turn ${k}: end-winding angle ≤ 0 (${ew.toFixed(4)}°).`)
    if (Rin >= Rout) warnings.push(`Turn ${k}: invalid geometry, Rin ≥ Rout.`)
    const top_arc = ew * deg2rad * Rout
    const bottom_arc = ew * deg2rad * Rin
    const a = Math.min(Math.max(Rin, par_r_start), Rout)
    const b = Math.max(Math.min(Rout, par_r_end), a)
    const R_single_in = segR(Rin, a, segments_radial)
    const R_parallel = segR(a, b, segments_radial)
    const R_single_out = segR(b, Rout, segments_radial)
    T.push({
      k, Rout, Rin, radial_length: Rout - Rin, ew_angle_deg: ew, top_arc, bottom_arc,
      R_single_in, R_parallel, R_single_out,
      len_single: (a - Rin) + (Rout - b),
      len_parallel: b - a,
      R_radial_leg: R_single_in + R_single_out + R_parallel / layer_stack,
      R_top: rho * (top_arc / 1000) / A_top,
      R_bottom: rho * (bottom_arc / 1000) / A_bottom,
    })
  }

  // STEP 4 / 5: totals and resistance
  const sum = (f: (t: Turn) => number) => T.reduce((s, t) => s + f(t), 0)
  const total_radial_one_side = sum(t => t.radial_length)
  const total_top_arc = sum(t => t.top_arc)
  const total_bottom_arc = sum(t => t.bottom_arc)
  const R_radial_one_side = sum(t => t.R_radial_leg)
  const R_radial_coil = 2 * R_radial_one_side
  const R_top_coil = sum(t => t.R_top)
  const R_bottom_coil = sum(t => t.R_bottom)
  const R_coil_single_layer = R_radial_coil + R_top_coil + R_bottom_coil

  const mult = layers * slots_per_phase
  const R_radial_total = R_radial_coil * mult
  const R_top_total = R_top_coil * mult
  const R_bottom_total = R_bottom_coil * mult
  const R_coil_total = R_coil_single_layer * mult
  const total_turns = turns * layers * slots_per_phase * series_stacks
  const R_stack_total = (series_stacks * (R_radial_total + R_top_total + R_bottom_total) / total_layer_stacks) + via_resistance

  const r_mean_turns = sum(t => (t.Rout + t.Rin) / 2) / turns
  const trace_width_radial_avg = net_trace_angle_rad * r_mean_turns
  const R_endwinding_total = R_top_total + R_bottom_total

  return {
    ORS, OR, IRS, IR, slots, theta_coil_deg, ew_angle_deg, turns, gap_deg, per_turn_angle_deg,
    net_trace_angle_deg, net_trace_angle_rad, trace_width_radial_atIR, top_ew_thickness,
    bottom_ew_thickness, top_pitch, bottom_pitch, par_r_start, par_r_end, perTurn: T,
    total_radial_one_side, total_top_arc, total_bottom_arc, A_top, A_bottom,
    R_radial_one_side, R_radial_coil, R_top_coil, R_bottom_coil, R_coil_single_layer, mult,
    R_radial_total, R_top_total, R_bottom_total, R_coil_total, total_turns, R_stack_total,
    r_mean_turns, trace_width_radial_avg, R_endwinding_total, series_stacks, total_layer_stacks,
    layer_stack, segments_radial, via_resistance, min_trace_IR: p.min_trace_IR,
    traceOk: trace_width_radial_atIR >= p.min_trace_IR,
  }
}

/** B) eddy loss, C) EMF / performance, M) magnets and D) electric loading, for any winding A. */
export function performance(p: Record<string, number>, S: Spec, A: WindingResult, warnings: string[]): Pick<MotorResult, 'ed' | 'emf' | 'mag' | 'el'> {
  const { ORS, IRS, trace_width_radial_avg, total_turns, R_stack_total } = A
  const { copper_thickness, rho, slots_per_phase } = p

  // ===== B) EDDY CURRENT LOSS =====
  const tw = trace_width_radial_avg, th = copper_thickness * 1e-3
  const Bz = p.emf_Bgap, Bphi = p.ed_Bphi, sides = slots_per_phase, paths = p.ed_paths, len = p.ed_len
  const f = (S.rpm * S.poles) / 120
  const width_part = ((tw * mm2m) ** 2 * Bz ** 2) + ((th * mm2m) ** 2 * Bphi ** 2)
  const numer = Math.PI ** 2 * sides * total_turns * paths * f ** 2 * (tw * mm2m) * (th * mm2m) * (len * mm2m)
  const ed: MotorResult['ed'] = {
    tw, Bz, th, Bphi, rpm: S.rpm, poles: S.poles, rho, Nc: total_turns, sides, paths, len,
    f, width_part, numer, P: (numer * width_part) / (rho * 6),
  }

  // ===== C) EMF / PERFORMANCE =====
  const pp = p.emf_pp, Kw = p.emf_Kw, Bgap = p.emf_Bgap, etaESC = p.emf_etaESC
  const phi = (3.1416 * Bgap * ((ORS * mm2m) ** 2 - (IRS * mm2m) ** 2)) / (2 * pp)
  const Ef = ((Math.PI * Math.sqrt(2) * pp * total_turns * Kw * S.rpm * phi) / 60) * Math.sqrt(2)
  const Ipk = (S.P * 2) / (3 * Ef)
  const Irms = Ipk / 1.414
  const Pcu = 3 * Irms ** 2 * R_stack_total
  const Ploss = Pcu + ed.P
  const eta = S.P / (S.P + Ploss)
  const Vdrop = Ipk * R_stack_total
  const emf: MotorResult['emf'] = {
    Bgap, Ro: ORS, Ri: IRS, poles: S.poles, pp, Nph: total_turns, Kw, rpm: S.rpm, P: S.P,
    R: R_stack_total, Peddy: ed.P, etaESC,
    phi, Ef, T: S.T, Ipk, Irms, Pcu, Ploss, eta, Vdrop, etaAll: etaESC * eta, Vterm: Ef + Vdrop,
  }

  // ===== MAGNET DIMENSIONS =====  Rin/Rout = IRS/ORS from A, poles from the spec
  const pole_pitch = ((360 / S.poles) * IRS * Math.PI) / 180   // arc length of one pole at Rin [mm]
  const space = pole_pitch - p.mag_width                        // gap between two magnets [mm]
  const mag: MotorResult['mag'] = {
    Rin: IRS, Rout: ORS, poles: S.poles, len: p.mag_len, width: p.mag_width, pole_pitch, space,
    spaceOk: Number.isFinite(space) && space >= LIMITS.magSpaceMin && space <= LIMITS.magSpaceMax,
  }

  // ===== D) ELECTRIC LOADING =====
  const m = p.el_m, Do = 2 * ORS, Din = 2 * IRS
  const kd = Din / Do
  const Ac_present = (4 * Math.sqrt(2) * m * Ipk * total_turns) / (Math.PI * (Do * mm2m) * (1 + kd))
  const Ac_required = S.T / ((2 / 3) * Math.PI * Bgap * ((ORS * mm2m) ** 3 - (IRS * mm2m) ** 3))
  const el: MotorResult['el'] = {
    Ipk, m, N: total_turns, Do, Din, Ro: ORS, Ri: IRS, Bavg: Bgap, T: S.T,
    kd, Ravg: (Do + Din) / 2, Ac_present, Ac_required,
    ratio: Ac_present / Ac_required, enough: Ac_present >= Ac_required,
  }

  if (!Number.isFinite(R_stack_total)) warnings.push('Phase resistance is not finite — check the winding inputs.')
  if (eta < 0 || eta > 1 || !Number.isFinite(eta)) warnings.push('Efficiency is outside 0–100 % — check the inputs.')

  return { ed, emf, mag, el }
}
