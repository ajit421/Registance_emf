/* Sidebar: motor specification, winding configuration, then the stator inputs (generated from SCHEMA). */
import { useState, type ReactNode } from 'react'
import { ChevronDown, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { ComputedField, NumberField } from '@/components/inputs/NumberField'
import { WindingPicker } from '@/components/inputs/WindingPicker'
import { useMotor } from '@/hooks/useMotor'
import { changedKeys } from '@/lib/motor/io'
import { FIELDS, SCHEMA, SPEC_OF_KEY, usedBy, values, type SectionDef, type SpecSolve } from '@/lib/motor/schema'
import type { MotorResult } from '@/lib/motor/compute'
import { cn } from '@/lib/utils'
import { useMotorStore } from '@/store/motor'

const SPEC = SCHEMA.find(g => g.id === 'S')!
const STATOR = SCHEMA.filter(g => g.id !== 'S' && !g.advanced)

function SolveToggle({ solve }: { solve: SpecSolve }) {
  const setSolve = useMotorStore(s => s.setSolve)
  const opts: [SpecSolve, string][] = [['T', 'Torque'], ['P', 'Power'], ['rpm', 'Speed']]
  return (
    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground" role="group" aria-label="Which value to calculate">
      Calculate
      <div className="inline-flex rounded-md bg-muted p-0.5">
        {opts.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={solve === k} onClick={() => setSolve(k)}
            className={cn('rounded px-2 py-0.5 transition-colors', solve === k ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground')}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Collapsible step with a number badge and an optional reset button. */
function Step({ n, title, onReset, forceOpen, children }: {
  n: number; title: string; onReset?: () => void; forceOpen?: boolean; children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  const shown = open || !!forceOpen
  return (
    <Collapsible open={shown} onOpenChange={setOpen} className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
          <span className="grid size-5 place-items-center rounded-full bg-primary/10 font-mono text-[0.7rem] font-semibold text-primary">{n}</span>
          {title}
          <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform', !shown && '-rotate-90')} />
        </CollapsibleTrigger>
        {onReset && (
          <Button variant="ghost" size="icon-xs" title="Reset this section" aria-label={`Reset ${title}`} onClick={onReset}>
            <RotateCcw />
          </Button>
        )}
      </div>
      <CollapsibleContent className="px-4 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function Section({ g, n, R, query }: { g: SectionDef; n: number; R: MotorResult; query: string }) {
  const { params, winding } = useMotor()
  const resetSection = useMotorStore(s => s.resetSection)
  const p = values(params)
  const hit = (s: string) => !query || s.toLowerCase().includes(query)
  const fields = g.fields.filter(f => usedBy(f, winding) && hit(`${f.label} ${f.key} ${f.unit}`))
  const computed = (g.computed ?? []).filter(c => usedBy(c, winding) && hit(c.label))
  if (!fields.length && !computed.length) return null

  return (
    <Step n={n} title={g.title} forceOpen={!!query} onReset={() => { resetSection(g.id); toast(`${g.title} reset to defaults`) }}>
      {g.id === 'S' && <SolveToggle solve={R.S.solve} />}
      {fields.map(f => <NumberField key={f.key} f={f} value={p[f.key]} solved={SPEC_OF_KEY[f.key] === R.S.solve} R={R} />)}
      {computed.map(c => <ComputedField key={c.key} c={c} R={R} />)}
    </Step>
  )
}

export function InputPanel() {
  const { params, winding, R } = useMotor()
  const [q, setQ] = useState('')
  const n = changedKeys(params, winding).filter(k => usedBy(FIELDS[k], winding)).length
  const query = q.trim().toLowerCase()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search inputs…" className="h-8 pl-8 text-sm" aria-label="Search inputs" />
        </div>
        {n > 0 && <Badge variant="outline" className="shrink-0">{n} changed</Badge>}
      </div>
      <div className="flex-1 overflow-y-auto">
        <Section g={SPEC} n={1} R={R} query={query} />

        {!query && (
          <Step n={2} title="Winding configuration">
            <WindingPicker />
          </Step>
        )}

        {winding && STATOR.map((g, i) => <Section key={g.id} g={g} n={i + 3} R={R} query={query} />)}

        {!query && winding === null && (
          <p className="m-4 text-xs text-muted-foreground">Choose a winding configuration above to enter the stator dimensions.</p>
        )}
      </div>
    </div>
  )
}
