/* Concentrated (tooth-wound) winding: PCB trace resistance.
 * Follows the Octave reference script for the concentrated winding.
 *
 * Coil layout (one coil per slot pitch α = 360° / slots, every layer in series):
 *   - each half of the coil holds `turns` radial traces in the angle
 *     θr = α / 2 − via space (coil centre) − slot space (coil edge)
 *   - trace width is limited by the arc available minus the (turns − 1) gaps:
 *     w(r) = (θr · r − (turns − 1) · gap) / turns; it is linear in r, so the average
 *     over the radial winding is the width at the mid radius
 *   - end windings: each turn k runs radially from ORS out to Rk (IRS in to Rk at the bottom),
 *     across the end-winding span α − 2 × slot space along the trace centreline, and back.
 *     Those end-winding radial legs use the same width model with their own gap.
 *
 * Resistance per slot and layer, × slots / 3 coils per phase × total layers, + lumped
 * via / connection resistance = phase resistance. Turns per phase = turns × slots / 3 × layers.
 *
 * Only the winding (A) differs from the distributed engine; eddy loss, EMF, magnets and
 * electric loading (B–D) are shared through performance().
 */
import { performance, specWithCheck, type ConcentratedTurn, type MotorResult, type Spec, type Turn, type WindingResult } from './compute'
import { values, type MotorParams } from './schema'

const deg2rad = Math.PI / 180
const EPS = 1e-6
/** Resistance of a trace that has no width left is undefined, not negative: NaN, shown as "—" (the warning says why). */
const ifWide = (w: number, R: number) => (w > 0 ? R : NaN)

/** Winding factor of a double-layer tooth-coil winding (all teeth wound), from the star of slots.
 *  Returns NaN values when the slot / pole combination cannot form a balanced 3-phase winding. */
export function windingFactor(slots: number, poles: number): { kw: number; kp: number; kd: number } {
  const ae = 360 * (poles / 2) / slots                  // electrical angle between neighbouring coils
  const phaseA: number[] = []
  for (let i = 0; i < slots; i++) {
    const a = (((i * ae) % 360) + 360) % 360
    const fwd = ((a + 180) % 360) - 180                 // coil used as wound
    const rev = a - 180                                 // coil used reversed
    if (fwd >= -30 - EPS && fwd < 30 - EPS) phaseA.push(fwd)
    else if (rev >= -30 - EPS && rev < 30 - EPS) phaseA.push(rev)
  }
  if (!(slots > 0) || phaseA.length !== slots / 3) return { kw: NaN, kp: NaN, kd: NaN }
  const re = phaseA.reduce((s, x) => s + Math.cos(x * deg2rad), 0)
  const im = phaseA.reduce((s, x) => s + Math.sin(x * deg2rad), 0)
  const kd = Math.hypot(re, im) / phaseA.length
  const kp = Math.abs(Math.sin((ae / 2) * deg2rad))   // coil spans one slot pitch
  return { kw: kp * kd, kp, kd }
}

export function computeConcentrated(params: MotorParams): MotorResult {
  const p = values(params)
  const warnings: string[] = []
  const S = specWithCheck(params, warnings)
  const A = concentratedWinding(p, S, warnings)
  return { S, A, ...performance(p, S, A, warnings), warnings }
}

/** A) Concentrated winding geometry + resistance. */
function concentratedWinding(p: Record<string, number>, S: Spec, warnings: string[]): WindingResult {
  const Nslots = S.slots, Npoles = S.poles
  const ORS = p.ORS, OR = ORS + p.dOR, IRS = p.IRS, IR = IRS - p.dIR
  const turns = Math.max(1, Math.round(p.turns))
  const { gap_radial, gap_end, copper_thickness, rho } = p
  const gap_radial_ew = p.cw_gap_radial_ew, via_space = p.cw_via_space, slot_space = p.cw_slot_space
  const total_layers = p.cw_total_layers
  const via_resistance = p.cw_via_resistance
  const t_m = copper_thickness * 1e-6

  // STEP 0: slot / pole layout
  const Nsp = Nslots / Npoles
  if (Nslots % 3 !== 0)
    warnings.push(`Slots (${Nslots}) is not divisible by 3, so the coils cannot split evenly across the phases.`)
  const coils_per_phase = Nslots / 3
  const { kw, kp, kd } = windingFactor(Nslots, Npoles)
  if (!Number.isFinite(kw))
    warnings.push(`${Nslots} slots / ${Npoles} poles cannot form a balanced 3-phase tooth-coil winding.`)
  const slot_pitch = 360 / Nslots

  // STEP 1: radial winding, `turns` traces per half coil in the angle θr
  const theta_radial = slot_pitch / 2 - via_space - slot_space
  const theta_rad = theta_radial * deg2rad
  if (theta_radial <= 0)
    warnings.push(`Radial trace angle ≤ 0 (${theta_radial.toFixed(4)}°) — the via space and slot space fill the half slot pitch.`)
  const width_at = (r: number) => (theta_rad * r - (turns - 1) * gap_radial) / turns
  const width_at_ew = (r: number) => (theta_rad * r - (turns - 1) * gap_radial_ew) / turns

  const radial_len = ORS - IRS
  if (radial_len <= 0) warnings.push('Radial winding Rin ≥ Rout.')
  const r_mid = (IRS + ORS) / 2
  const w_IRS = width_at(IRS), w_ORS = width_at(ORS), w_avg_radial = width_at(r_mid)
  if (w_IRS <= 0)
    warnings.push(`Radial trace width at IRS ≤ 0 (${w_IRS.toFixed(4)} mm) — reduce turns or the gap, or increase the radial trace angle.`)

  // the traces must exist down to IRS, where they are narrowest
  const R_half_slot = radial_len > 0 ? ifWide(w_IRS, rho * (turns * radial_len * 1e-3) / ((w_avg_radial * 1e-3) * t_m)) : NaN
  const R_radial_slot = 2 * R_half_slot

  // STEP 2: end windings
  const ew_angle = slot_pitch - 2 * slot_space
  const ew_rad = ew_angle * deg2rad
  if (ew_angle <= 0) warnings.push(`End-winding span ≤ 0 (${ew_angle.toFixed(4)}°).`)
  const top_ew_thickness = (OR - ORS) / turns - gap_end
  const bottom_ew_thickness = (IRS - IR) / turns - gap_end
  const top_pitch = top_ew_thickness + gap_end
  const bottom_pitch = bottom_ew_thickness + gap_end
  if (top_ew_thickness <= 0) warnings.push('Top end-winding thickness ≤ 0.')
  if (bottom_ew_thickness <= 0) warnings.push('Bottom end-winding thickness ≤ 0.')
  const A_top = (top_ew_thickness / 1000) * t_m
  const A_bottom = (bottom_ew_thickness / 1000) * t_m

  // STEP 3: per turn, one slot, one layer
  const ew: ConcentratedTurn[] = []
  const T: Turn[] = []
  let R_top_slot = 0, R_bot_slot = 0
  for (let k = 1; k <= turns; k++) {
    const top_r = OR - (k - 1) * top_pitch
    const top_leg_len = top_r - ORS
    const top_leg_w = width_at_ew((ORS + top_r) / 2)
    const R_top_legs = ifWide(top_leg_w, 2 * rho * (top_leg_len * 1e-3) / ((top_leg_w * 1e-3) * t_m))
    const top_arc = ew_rad * (top_r - top_ew_thickness / 2)
    const R_top_arc = ifWide(top_ew_thickness, rho * (top_arc * 1e-3) / ((top_ew_thickness * 1e-3) * t_m))
    R_top_slot = R_top_slot + R_top_legs + R_top_arc

    const bottom_r = IR + (k - 1) * bottom_pitch
    const bottom_leg_len = IRS - bottom_r
    const bottom_leg_w = width_at_ew((IRS + bottom_r) / 2)
    const R_bottom_legs = ifWide(bottom_leg_w, 2 * rho * (bottom_leg_len * 1e-3) / ((bottom_leg_w * 1e-3) * t_m))
    const bottom_arc = ew_rad * (bottom_r + bottom_ew_thickness / 2)
    const R_bottom_arc = ifWide(bottom_ew_thickness, rho * (bottom_arc * 1e-3) / ((bottom_ew_thickness * 1e-3) * t_m))
    R_bot_slot = R_bot_slot + R_bottom_legs + R_bottom_arc

    ew.push({ k, top_r, top_leg_len, top_leg_w, top_arc, R_top_legs, R_top_arc, bottom_r, bottom_leg_len, bottom_leg_w, bottom_arc, R_bottom_legs, R_bottom_arc })
    T.push({
      k, Rout: top_r, Rin: bottom_r, radial_length: radial_len, ew_angle_deg: ew_angle, top_arc, bottom_arc,
      // one radial trace of the radial winding (every trace has the same average width)
      R_single_in: 0, R_parallel: R_half_slot / turns, R_single_out: 0, len_single: 0, len_parallel: radial_len,
      R_radial_leg: R_half_slot / turns,
      R_top: R_top_legs + R_top_arc,
      R_bottom: R_bottom_legs + R_bottom_arc,
    })
  }
  if (ew.some(t => !(t.top_leg_w > 0) || !(t.bottom_leg_w > 0)))
    warnings.push('End-winding radial leg width ≤ 0 — reduce turns or the end-winding radial gap.')

  // STEP 4: totals, × coils per phase × layers (all in series)
  const R_radial_total = R_radial_slot * coils_per_phase * total_layers
  const R_top_total = R_top_slot * coils_per_phase * total_layers
  const R_bottom_total = R_bot_slot * coils_per_phase * total_layers
  const R_board = R_radial_total + R_top_total + R_bottom_total
  const R_stack_total = R_board + via_resistance
  const total_turns = turns * coils_per_phase * total_layers

  const sum = (f: (t: Turn) => number) => T.reduce((s, t) => s + f(t), 0)
  // the average width (also the eddy-loss conductor width) only exists when the traces fit down to IRS
  const trace_width_radial_avg = ifWide(w_IRS, w_avg_radial)
  // net trace angle and gap expressed at the mid radius, so width = angle × r there
  const net_trace_angle_rad = trace_width_radial_avg / r_mid
  return {
    ORS, OR, IRS, IR, slots: Nslots, theta_coil_deg: slot_pitch, ew_angle_deg: ew_angle, turns,
    gap_deg: (gap_radial / r_mid) / deg2rad,
    per_turn_angle_deg: theta_radial / turns,
    net_trace_angle_deg: net_trace_angle_rad / deg2rad, net_trace_angle_rad,
    trace_width_radial_atIR: w_IRS, top_ew_thickness, bottom_ew_thickness, top_pitch, bottom_pitch,
    par_r_start: IRS, par_r_end: ORS, perTurn: T,
    total_radial_one_side: turns * radial_len, total_top_arc: sum(t => t.top_arc), total_bottom_arc: sum(t => t.bottom_arc),
    A_top, A_bottom,
    R_radial_one_side: R_half_slot, R_radial_coil: R_radial_slot, R_top_coil: R_top_slot, R_bottom_coil: R_bot_slot,
    R_coil_single_layer: R_radial_slot + R_top_slot + R_bot_slot, mult: coils_per_phase,
    R_radial_total, R_top_total, R_bottom_total, R_coil_total: R_board, total_turns, R_stack_total,
    r_mean_turns: r_mid, trace_width_radial_avg, R_endwinding_total: R_top_total + R_bottom_total,
    // expressed in the distributed terms so total layers = series × per stack × parallel still holds
    series_stacks: total_layers, total_layer_stacks: 1, layer_stack: 1,
    segments_radial: 1, via_resistance, min_trace_IR: p.min_trace_IR,
    traceOk: w_IRS >= p.min_trace_IR,
    cw: {
      poles: Npoles, Nsp, total_layers, radial_angle_deg: theta_radial, via_space_deg: via_space, slot_space_deg: slot_space,
      gap_radial, gap_radial_ew, w_IRS, w_ORS, R_half_slot, perTurnEw: ew, turns_per_coil: turns * total_layers, kw, kp, kd,
    },
  }
}
