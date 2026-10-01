import { useMemo } from 'react'
import { evaluate } from '@/lib/motor/derive'
import { defaults } from '@/lib/motor/schema'
import { useMotorStore } from '@/store/motor'

/** Results for the default design, used for the "vs defaults" deltas. */
export const baseline = evaluate(defaults())

/** Current inputs, the chosen winding configuration and the derived results. */
export function useMotor() {
  const params = useMotorStore(s => s.params)
  const winding = useMotorStore(s => s.winding)
  const R = useMemo(() => evaluate(params), [params])
  return { params, winding, R }
}
