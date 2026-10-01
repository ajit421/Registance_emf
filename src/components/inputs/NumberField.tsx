/* One numeric input row: label, value box with unit, and an optional live note underneath. */
import { useState } from 'react'
import { CornerDownRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { same } from '@/lib/motor/io'
import { defaults, inRange, values, type ComputedDef, type FieldDef } from '@/lib/motor/schema'
import type { MotorResult } from '@/lib/motor/compute'
import { inputText, num } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMotorStore } from '@/store/motor'

const DEF = values(defaults())
const ROW = 'grid grid-cols-[1fr_8.5rem] items-center gap-x-2 py-1'

function Hint({ children }: { children: string }) {
  return (
    <p className="col-span-2 mt-1 flex items-start gap-1 text-[0.7rem] leading-snug text-primary">
      <CornerDownRight className="mt-px size-3 shrink-0" />
      <span className="num">{children}</span>
    </p>
  )
}

export function NumberField({ f, value, solved, R }: { f: FieldDef; value: number; solved?: boolean; R: MotorResult }) {
  const setField = useMotorStore(s => s.setField)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (solved ? String(+value.toPrecision(6)) : inputText(value, f))
  const invalid = draft !== null && (draft.trim() === '' || !inRange(f, Number(draft)))
  const changed = !same(value, DEF[f.key])
  const id = `in-${f.key}`
  const hint = f.hint?.(R)
  const range = f.max !== undefined ? `Allowed ${f.min ?? '−∞'} – ${f.max}` : f.min !== undefined ? `Must be ≥ ${f.min}` : 'Enter a number'

  return (
    <div className={ROW}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-[0.8rem] leading-tight text-muted-foreground">
        {changed && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="changed from default" />}
        <span>{f.label}</span>
        {solved && <Badge variant="secondary" className="h-4 px-1 text-[0.6rem]">calculated</Badge>}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={f.sci ? 'text' : 'number'}
          inputMode="decimal"
          step={f.step}
          min={f.min}
          max={f.max}
          value={shown}
          aria-invalid={invalid || undefined}
          title={invalid ? range : undefined}
          className={cn('num h-7 pr-9 font-mono text-xs', solved && 'bg-primary/5 font-semibold')}
          onChange={e => {
            const raw = e.target.value
            setDraft(raw)
            const n = Number(raw)
            if (raw.trim() !== '' && inRange(f, n)) setField(f.key, n)
          }}
          onBlur={() => setDraft(null)}
        />
        {f.unit && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[0.65rem] text-muted-foreground">{f.unit}</span>}
      </div>
      {invalid && <p className="col-span-2 mt-0.5 text-right text-[0.7rem] text-bad">{range}</p>}
      {hint && <Hint>{hint}</Hint>}
    </div>
  )
}

/** A value calculated from the inputs, shown read-only in the input list. */
export function ComputedField({ c, R }: { c: ComputedDef; R: MotorResult }) {
  const v = c.get(R)
  return (
    <div className={ROW}>
      <div className="flex items-center gap-1.5 text-[0.8rem] leading-tight text-muted-foreground">
        {c.label}
        <Badge variant="secondary" className="h-4 px-1 text-[0.6rem]">auto</Badge>
      </div>
      <div className="num flex h-7 items-center rounded-md bg-muted px-2.5 font-mono text-xs font-semibold">
        {Number.isInteger(v) ? v : num(v, c.d)}
        {c.unit && <span className="ml-auto font-sans text-[0.65rem] font-normal text-muted-foreground">{c.unit}</span>}
      </div>
    </div>
  )
}
