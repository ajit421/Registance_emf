/* Parameter sweep: vary any input, plot any result, click the chart to apply a value. */
import { create } from 'zustand'
import { toast } from 'sonner'
import { Panel } from '@/components/common'
import { MetricChart } from '@/components/charts/MetricChart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMotor } from '@/hooks/useMotor'
import { METRICS, runSweep } from '@/lib/motor/metrics'
import { FIELDS, SCHEMA, values } from '@/lib/motor/schema'
import { inputText, num } from '@/lib/format'
import { useMotorStore } from '@/store/motor'


interface SweepState { key: string; metric: string; from: string; to: string; n: string; set: (s: Partial<SweepState>) => void }
const useSweep = create<SweepState>(set => ({ key: 'spec_rpm', metric: 'eta', from: '', to: '', n: '41', set: s => set(s) }))

function defaultRange(key: string, cur: number): [string, string] {
  const f = FIELDS[key]
  let a = cur > 0 ? cur * 0.5 : 0, b = cur > 0 ? cur * 1.5 : 1
  if (f.int) { a = Math.max(f.min ?? 0, Math.floor(a)); b = Math.ceil(b) }
  return [String(+a.toPrecision(6)), String(+b.toPrecision(6))]
}

export function SweepTab() {
  const { params, R } = useMotor()
  const applyValue = useMotorStore(s => s.applyValue)
  const sw = useSweep()
  const { key, metric, n, from, to } = sw
  const f = FIELDS[sw.key], m = METRICS[sw.metric]
  const cur = values(params)[sw.key]
  const [dFrom, dTo] = defaultRange(sw.key, cur)
  const fromS = from || dFrom, toS = to || dTo

  // re-renders only happen when inputs or sweep settings change, so no memo is needed
  const result = runSweep(params, key, metric, Number(fromS), Number(toS), Number(n))

  const apply = (x: number) => {
    applyValue(sw.key, x)
    const v = values(useMotorStore.getState().params)[sw.key]
    toast(`${f.label} set to ${inputText(v, f)} ${f.unit}`)
  }
  const cy = m.get(R)

  return (
    <Panel title="Parameter sweep" hint="Click the chart to apply that value">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_0.7fr_2fr]">
        <div className="grid gap-1.5">
          <Label>Vary input</Label>
          <Select value={sw.key} onValueChange={key => sw.set({ key, from: '', to: '' })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCHEMA.map(g => (
                <SelectGroup key={g.id}>
                  <SelectLabel>{g.id} · {g.title}</SelectLabel>
                  {g.fields.map(x => <SelectItem key={x.key} value={x.key}>{x.label}{x.unit && ` (${x.unit})`}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5"><Label htmlFor="swFrom">From</Label><Input id="swFrom" type="number" value={fromS} onChange={e => sw.set({ from: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="swTo">To</Label><Input id="swTo" type="number" value={toS} onChange={e => sw.set({ to: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="swN">Points</Label><Input id="swN" type="number" min={3} max={400} value={sw.n} onChange={e => sw.set({ n: e.target.value })} /></div>
        <div className="grid gap-1.5">
          <Label>Plot result</Label>
          <Select value={sw.metric} onValueChange={metric => sw.set({ metric })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(METRICS).map(([k, x]) => <SelectItem key={k} value={k}>{x.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5">
        {result ? (
          <MetricChart data={result.pts} height={340} onPick={apply}
            xLabel={`${f.label}${f.unit ? ` (${f.unit})` : ''}`} yLabel={m.label}
            fx={v => `${f.key} = ${num(v, 4)} ${f.unit}`} fy={v => `${num(v, 4)} ${m.unit}`}
            mark={{ x: cur, y: cy }} />
        ) : <p className="py-10 text-center text-sm text-muted-foreground">Enter a valid range.</p>}
      </div>

      {result && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-4 py-3 text-sm">
          <span>Current: <b className="num font-mono">{num(cur, 4)} {f.unit}</b> → <b className="num font-mono">{num(cy, 4)} {m.unit}</b></span>
          {result.good.length > 0 && (
            <span>Range: <b className="num font-mono">{num(Math.min(...result.good.map(p => p.y)), 4)}</b> – <b className="num font-mono">{num(Math.max(...result.good.map(p => p.y)), 4)} {m.unit}</b></span>
          )}
          {result.best && (
            <span className="flex items-center gap-2">
              {m.best === 'max' ? 'Best (max)' : 'Best (min)'}: <b className="num font-mono">{num(result.best.y, 4)} {m.unit}</b> at <b className="num font-mono">{num(result.best.x, 4)} {f.unit}</b>
              <Button size="xs" onClick={() => apply(result.best!.x)}>Apply</Button>
            </span>
          )}
        </div>
      )}
    </Panel>
  )
}
