/* Sidebar with every input section, generated from SCHEMA. */
import { useState } from 'react'
import { ChevronDown, Link2, RotateCcw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { useMotor } from '@/hooks/useMotor'
import { changedKeys, same } from '@/lib/motor/io'
import { SCHEMA, SPEC_OF_KEY, defaults, values, type FieldDef, type LinkDef, type SectionDef, type SpecSolve } from '@/lib/motor/schema'
import type { MotorResult } from '@/lib/motor/compute'
import { inputText, num } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMotorStore } from '@/store/motor'
import { toast } from 'sonner'

const DEF = values(defaults())

function NumberField({ f, value, solved }: { f: FieldDef; value: number; solved: boolean }) {
  const setField = useMotorStore(s => s.setField)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (solved ? String(+value.toPrecision(6)) : inputText(value, f))
  const v = Number(draft)
  const invalid = draft !== null && (draft.trim() === '' || !Number.isFinite(v) || (f.min !== undefined && v < f.min))
  const changed = !same(value, DEF[f.key])
  const id = `in-${f.key}`

  return (
    <div className="grid grid-cols-[1fr_8.5rem] items-center gap-2 py-1">
      <label htmlFor={id} title={f.key} className="flex items-center gap-1.5 text-[0.8rem] leading-tight text-muted-foreground">
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
          value={shown}
          aria-invalid={invalid || undefined}
          className={cn('num h-7 pr-9 font-mono text-xs', solved && 'bg-primary/5 font-semibold')}
          onChange={e => {
            const raw = e.target.value
            setDraft(raw)
            const n = Number(raw)
            if (raw.trim() !== '' && Number.isFinite(n) && (f.min === undefined || n >= f.min)) setField(f.key, n)
          }}
          onBlur={() => setDraft(null)}
        />
        {f.unit && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[0.65rem] text-muted-foreground">{f.unit}</span>}
      </div>
    </div>
  )
}

function LinkedField({ l, R }: { l: LinkDef; R: MotorResult }) {
  return (
    <div className="grid grid-cols-[1fr_8.5rem] items-center gap-2 py-1" title={`Linked: taken from ${l.src}`}>
      <div className="text-[0.8rem] leading-tight text-muted-foreground">
        {l.label}
        <div className="text-[0.65rem] text-muted-foreground/70">← {l.src}</div>
      </div>
      <div className="flex h-7 items-center gap-1.5 rounded-md border border-dashed px-2 font-mono text-xs text-muted-foreground">
        <Link2 className="size-3 shrink-0" />
        <span className="num truncate">{num(l.get(R), l.d)}</span>
        {l.unit && <span className="ml-auto font-sans text-[0.65rem]">{l.unit}</span>}
      </div>
    </div>
  )
}

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

function derivedFor(id: SectionDef['id'], R: MotorResult): [string, string][] {
  const { A, ed, emf, mag, el, S } = R
  switch (id) {
    case 'S': return [['ω', `${num(S.omega, 4)} rad/s`], ['T = P/ω', `${num(S.T, 4)} N·m`]]
    case 'A': return [['OR', `${num(A.OR, 2)} mm`], ['IR', `${num(A.IR, 2)} mm`], ['Coil angle', `${num(A.theta_coil_deg, 3)}°`], ['EW angle', `${num(A.ew_angle_deg, 3)}°`], ['Total turns', `${A.total_turns}`]]
    case 'B': return [['Frequency', `${num(ed.f, 3)} Hz`], ['Eddy loss', `${num(ed.P, 4)} W`]]
    case 'C': return [['Phase R ← A', `${num(emf.R, 4)} Ω`], ['Eddy ← B', `${num(emf.Peddy, 4)} W`]]
    case 'M': return [['Pole pitch', `${num(mag.pole_pitch, 4)} mm`], ['Magnet gap', `${num(mag.space, 4)} mm`]]
    case 'D': return [['kd', num(el.kd, 4)], ['Avg (sheet)', `${num(el.Ravg, 2)} mm`]]
  }
}

function Section({ g, R, query }: { g: SectionDef; R: MotorResult; query: string }) {
  const { params } = useMotor()
  const resetSection = useMotorStore(s => s.resetSection)
  const [open, setOpen] = useState(true)
  const p = values(params)
  const hit = (s: string) => !query || s.toLowerCase().includes(query)
  const fields = g.fields.filter(f => hit(`${f.label} ${f.key} ${f.unit}`))
  const links = (g.links ?? []).filter(l => hit(`${l.label} ${l.key} ${l.src}`))
  if (!fields.length && !links.length) return null

  return (
    <Collapsible open={open || !!query} onOpenChange={setOpen} className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
          <span className="grid size-5 place-items-center rounded bg-primary/10 font-mono text-[0.7rem] font-semibold text-primary">{g.id}</span>
          {g.title}
          <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform', !(open || query) && '-rotate-90')} />
        </CollapsibleTrigger>
        <Button variant="ghost" size="icon-xs" title="Reset this section" aria-label={`Reset ${g.title}`}
          onClick={() => { resetSection(g.id); toast(`${g.title} reset to defaults`) }}>
          <RotateCcw />
        </Button>
      </div>
      <CollapsibleContent className="px-4 pb-3">
        {g.id === 'S' && <SolveToggle solve={R.S.solve} />}
        {links.map(l => <LinkedField key={l.key} l={l} R={R} />)}
        {fields.map(f => (
          <NumberField key={f.key} f={f} value={p[f.key]} solved={SPEC_OF_KEY[f.key] === R.S.solve} />
        ))}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-[0.7rem] text-muted-foreground">
          {derivedFor(g.id, R).map(([k, v]) => <span key={k}>{k} <b className="num font-mono font-medium text-foreground">{v}</b></span>)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function InputPanel() {
  const { params, R } = useMotor()
  const [q, setQ] = useState('')
  const n = changedKeys(params).length
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
        {SCHEMA.map(g => <Section key={g.id} g={g} R={R} query={query} />)}
      </div>
    </div>
  )
}
