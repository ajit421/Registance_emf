/* Values that follow from other inputs, per winding configuration.
 * They are filled in here and handed to the engines, so each engine still sees every
 * quantity it was written for.
 */
import { compute, type MotorResult } from './compute'
import { computeConcentrated, windingFactor } from './concentrated'
import { values, type MotorParams, type Winding } from './schema'

/** Shared by both windings: one end-winding thickness and the eddy conductor length. */
function common(v: Record<string, number>) {
  return {
    // one end-winding thickness for both the outer (OR − Rout) and inner (Rin − IR) band
    dOR: v.ew_band,
    dIR: v.ew_band,
    // conductor length for the eddy loss = radial winding length
    ed_len: v.ORS - v.IRS,
  }
}

/** Distributed winding: poles come from the slot count. */
export function derive(p: MotorParams): MotorParams {
  const v = values(p)
  const poles = v.spec_slots / 3
  return {
    ...p,
    ...common(v),
    spec_poles: poles,
    emf_pp: poles / 2,
    slots_per_phase: poles / 2,
    // parallel paths = layers per stack × parallel layer stacks
    ed_paths: v.layer_stack * v.total_layer_stacks,
  }
}

/** Concentrated winding: poles are an input, coils per phase = slots / 3, Kw from the slot / pole combination. */
export function deriveConcentrated(p: MotorParams): MotorParams {
  const v = values(p)
  return {
    ...p,
    ...common(v),
    emf_pp: v.spec_poles / 2,
    emf_Kw: windingFactor(v.spec_slots, v.spec_poles).kw,
    slots_per_phase: v.spec_slots / 3,
    // parallel paths = parallel branches of the layer stack
    ed_paths: v.cw_total_layers / v.cw_series_group,
  }
}

/** Results for a design with the given winding configuration. */
export const evaluate = (p: MotorParams, winding: Winding = 'distributed'): MotorResult =>
  winding === 'concentrated' ? computeConcentrated(deriveConcentrated(p)) : compute(derive(p))
