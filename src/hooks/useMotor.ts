import { useMemo } from 'react'
import { evaluate } from '@/lib/motor/derive'
import { defaults, type Winding } from '@/lib/motor/schema'
import { useMotorStore } from '@/store/motor'

/** Results for the default design of each winding, used for the "vs defaults" deltas. */
export const baselines: Record<Winding, ReturnType<typeof evaluate>> = {
  distributed: evaluate(defaults(), 'distributed'),
  concentrated: evaluate(defaults('concentrated'), 'concentrated'),
}

/** Current inputs, the chosen winding configuration and the derived results. */
export function useMotor() {
  const params = useMotorStore(s => s.params)
  const winding = useMotorStore(s => s.winding)
  const R = useMemo(() => evaluate(params, winding ?? 'distributed'), [params, winding])
  return { params, winding, R }
}
