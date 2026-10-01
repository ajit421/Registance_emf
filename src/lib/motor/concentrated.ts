/* Concentrated (tooth-wound) winding: PCB trace resistance.
 *
 * Coil layout (every copper layer carries every coil):
 *   - each coil is wound around one tooth and fits inside one slot pitch α = 360° / slots
 *   - the coil is a planar spiral filling that pitch: 2 × turns radial traces side by side,
 *     so one trace pitch = α / (2 × turns) and the span between a turn's two legs is
 *     α − (2k − 1) × pitch for turn k (it shrinks by two pitches per turn)
 *   - trace widths come from the pitch minus the radial gap (referenced to IR); the same gap
 *     separates neighbouring coils
 *   - lengths are taken along the trace centrelines
 *
 * Resistance is worked out for ONE layer, then scaled to the layer stack:
 *   total_layers wired in series groups of series_group_size; the branches
 *   (total_layers / series_group_size) are tied in parallel, so
 *   stack R = one-layer R × series_group_size² / total_layers
 * Phase resistance = one coil × (slots / 3) coils in series + lumped via / connection resistance.
 * Turns in series per coil = turns per layer × series_group_size.
 *
 * Only the winding (A) differs from the distributed engine; eddy loss, EMF, magnets and
 * electric loading (B–D) are shared through performance().
 */
import { performance, specWithCheck, type MotorResult, type Spec, type Turn, type WindingResult } from './compute'
import { values, type MotorParams } from './schema'

const deg2rad = Math.PI / 180
const EPS = 1e-6

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
  const total_layers = p.cw_total_layers, series_group_size = p.cw_series_group
  const via_resistance = p.cw_via_resistance

  // STEP 0: layer-stack topology
  if (total_layers % series_group_size !== 0)
    warnings.push(`Total layers (${total_layers}) is not evenly divisible by the layers in series per branch (${series_group_size}).`)
  const branches = total_layers / series_group_size
  const layer_factor = series_group_size ** 2 / total_layers

  // STEP 0b: slot / pole layout
  const Nsp = Nslots / Npoles
  const theta_coil_deg = 360 / Nslots                   // one coil = one slot pitch
  if (Nslots % 3 !== 0)
    warnings.push(`Slots (${Nslots}) is not divisible by 3, so the coils cannot split evenly across the phases.`)
  const coils_per_phase = Nslots / 3
  const { kw, kp, kd } = windingFactor(Nslots, Npoles)
  if (!Number.isFinite(kw))
    warnings.push(`${Nslots} slots / ${Npoles} poles cannot form a balanced 3-phase tooth-coil winding.`)

  // STEP 1: radial trace pitch and width (2 × turns traces share the slot pitch)
  const pitch_deg = theta_coil_deg / (2 * turns)
  const gap_deg = (gap_radial / IR) * (180 / Math.PI)
  const net_trace_angle_deg = pitch_deg - gap_deg
  if (net_trace_angle_deg <= 0)
    warnings.push(`Net trace angle ≤ 0 (${net_trace_angle_deg.toFixed(4)}°) — radial traces don't fit in the coil angle.`)
  const net_trace_angle_rad = net_trace_angle_deg * deg2rad
  const trace_width_radial_atIR = net_trace_angle_rad * IR

  // STEP 2: end-winding trace thickness from the end-winding bands
  const top_ew_thickness = (OR - ORS) / turns - gap_end
  const bottom_ew_thickness = (IRS - IR) / turns - gap_end
  const top_pitch = top_ew_thickness + gap_end
  const bottom_pitch = bottom_ew_thickness + gap_end
  if (top_ew_thickness <= 0) warnings.push('Top end-winding thickness ≤ 0.')
  if (bottom_ew_thickness <= 0) warnings.push('Bottom end-winding thickness ≤ 0.')

  const A_top = (top_ew_thickness / 1000) * (copper_thickness * 1e-6)
  const A_bottom = (bottom_ew_thickness / 1000) * (copper_thickness * 1e-6)

  // STEP 3: per-turn geometry and one-layer resistance, along the trace centrelines
  const T: Turn[] = []
  for (let k = 1; k <= turns; k++) {
    const Rout = OR - (k - 1) * top_pitch                // outer edge of this turn's top end-winding
    const Rin = IR + (k - 1) * bottom_pitch              // inner edge of this turn's bottom end-winding
    const r_top = Rout - top_ew_thickness / 2            // centreline radii
    const r_bottom = Rin + bottom_ew_thickness / 2
    if (r_bottom >= r_top) warnings.push(`Turn ${k}: invalid geometry, Rin ≥ Rout.`)
    const span = theta_coil_deg - (2 * k - 1) * pitch_deg  // between the centres of the two legs
    const top_arc = span * deg2rad * r_top
    const bottom_arc = span * deg2rad * r_bottom
    // width grows with radius (w = angle × r), so R = ρ · ln(r_top / r_bottom) / (angle × thickness)
    const R_one_layer_leg = rho * Math.log(r_top / r_bottom) / (net_trace_angle_rad * copper_thickness * 1e-6)

    T.push({
      k, Rout, Rin, radial_length: r_top - r_bottom, ew_angle_deg: span, top_arc, bottom_arc,
      // the whole leg is shared by the parallel branches, so it is reported as the "parallel" part
      R_single_in: 0, R_parallel: R_one_layer_leg, R_single_out: 0,
      len_single: 0, len_parallel: r_top - r_bottom,
      R_radial_leg: R_one_layer_leg * layer_factor,
      R_top: (rho * (top_arc / 1000) / A_top) * layer_factor,
      R_bottom: (rho * (bottom_arc / 1000) / A_bottom) * layer_factor,
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
  const R_coil_single_pass = R_radial_coil + R_top_coil + R_bottom_coil   // one coil, full layer stack

  const mult = coils_per_phase                     // coils per phase, in series
  const R_radial_total = R_radial_coil * mult
  const R_top_total = R_top_coil * mult
  const R_bottom_total = R_bottom_coil * mult
  const R_coil_total = R_coil_single_pass * mult
  const R_stack_total = R_coil_total + via_resistance
  const total_turns = turns * series_group_size * mult

  const r_mean_turns = sum(t => (t.Rout - top_ew_thickness / 2 + t.Rin + bottom_ew_thickness / 2) / 2) / turns
  const trace_width_radial_avg = net_trace_angle_rad * r_mean_turns

  return {
    ORS, OR, IRS, IR, slots: Nslots, theta_coil_deg, ew_angle_deg: T[0].ew_angle_deg, turns, gap_deg,
    per_turn_angle_deg: pitch_deg,
    net_trace_angle_deg, net_trace_angle_rad, trace_width_radial_atIR, top_ew_thickness,
    bottom_ew_thickness, top_pitch, bottom_pitch,
    // branches are tied together along the whole leg
    par_r_start: IR, par_r_end: OR, perTurn: T,
    total_radial_one_side, total_top_arc, total_bottom_arc, A_top, A_bottom,
    R_radial_one_side, R_radial_coil, R_top_coil, R_bottom_coil, R_coil_single_layer: R_coil_single_pass, mult,
    R_radial_total, R_top_total, R_bottom_total, R_coil_total, total_turns, R_stack_total,
    r_mean_turns, trace_width_radial_avg, R_endwinding_total: R_top_total + R_bottom_total,
    // expressed in the distributed terms so total layers = series × per stack × parallel still holds
    series_stacks: series_group_size, total_layer_stacks: branches, layer_stack: 1,
    segments_radial: 1, via_resistance, min_trace_IR: p.min_trace_IR,
    traceOk: trace_width_radial_atIR >= p.min_trace_IR,
    cw: {
      poles: Npoles, Nsp, total_layers, series_group_size, branches, layer_factor,
      pitch_deg, turns_per_coil: turns * series_group_size, kw, kp, kd,
    },
  }
}
