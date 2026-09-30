import { useMemo } from 'react'
import { compute } from '@/lib/motor/compute'
import { defaults } from '@/lib/motor/schema'
import { useMotorStore } from '@/store/motor'

/** Results for the default design, used for the "vs defaults" deltas. */
export const baseline = compute(defaults())

/** Current inputs plus the derived results. */
export function useMotor() {
  const params = useMotorStore(s => s.params)
  const R = useMemo(() => compute(params), [params])
  return { params, R }
}
