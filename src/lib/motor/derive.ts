/* Values that follow from other inputs in a distributed winding.
 * They are filled in here and handed to the unchanged engine in compute.ts, so the
 * engine still sees every quantity it was written for.
 */
import { compute, type MotorResult } from './compute'
import { values, type MotorParams } from './schema'

export function derive(p: MotorParams): MotorParams {
  const v = values(p)
  const poles = v.spec_slots / 3
  return {
    ...p,
    spec_poles: poles,
    emf_pp: poles / 2,
    slots_per_phase: poles / 2,
    // one end-winding thickness for both the outer (OR − Rout) and inner (Rin − IR) band
    dOR: v.ew_band,
    dIR: v.ew_band,
    // conductor length for the eddy loss = radial winding length
    ed_len: v.ORS - v.IRS,
    // parallel paths = layers per stack × parallel layer stacks
    ed_paths: v.layer_stack * v.total_layer_stacks,
  }
}

/** Results for a distributed-winding design. */
export const evaluate = (p: MotorParams): MotorResult => compute(derive(p))
