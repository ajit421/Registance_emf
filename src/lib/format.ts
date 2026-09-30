/* Number formatting for the UI. */
import type { FieldDef } from '@/lib/motor/schema'

/** Fixed decimals, switching to scientific notation for very small or very large values. */
export function num(v: number | null | undefined, d = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a !== 0 && (a < 1e-3 || a >= 1e7)) return v.toExponential(Math.min(d, 3))
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export const pct = (v: number, d = 2) => (Number.isFinite(v) ? (v * 100).toFixed(d) : '—')

/** Text shown inside an editable input. */
export function inputText(v: number, f: Pick<FieldDef, 'sci'>): string {
  if (f.sci) return Number(v).toExponential()
  return String(+Number(v).toPrecision(10))
}

/** Compact axis tick label. */
export function tick(v: number): string {
  const a = Math.abs(v)
  if (v === 0) return '0'
  if (a < 1e-3 || a >= 1e6) return v.toExponential(1)
  if (a >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return String(+v.toPrecision(4))
}

/** Colour of the k-th turn in the coil drawing (cycles through 5 copper shades). */
export const turnColor = (k: number) => `var(--turn-${((k - 1) % 5) + 1})`
