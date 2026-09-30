import { SPEC_OF_KEY, type MotorParams } from './schema'

/** Copy of params with one input changed, keeping that input a given (not solved) spec value. */
export function override(p: MotorParams, key: string, v: number): MotorParams {
  const o: MotorParams = { ...p, [key]: v }
  const me = SPEC_OF_KEY[key]
  if (me && o.spec_solve === me) o.spec_solve = me === 'T' ? 'P' : 'T'
  return o
}
