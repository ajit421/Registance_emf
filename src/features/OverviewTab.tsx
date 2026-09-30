import { ArrowRight } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { CheckList, Kv, KvList, Note, Panel, StackBar } from '@/components/common'
import { useMotor } from '@/hooks/useMotor'
import { designChecks, designErrors } from '@/lib/motor/checks'
import { num, pct } from '@/lib/format'
import type { TabId } from '@/features/tabs'

function Pipeline({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { R } = useMotor()
  const { A, ed, emf, el } = R
  const steps: [string, string, string, TabId][] = [
    ['A', 'Winding & resistance', `R = ${num(A.R_stack_total, 4)} Ω`, 'winding'],
    ['B', 'Eddy current loss', `P = ${num(ed.P, 4)} W`, 'eddy'],
    ['C', 'EMF & performance', `η = ${pct(emf.eta)} %`, 'emf'],
    ['D', 'Electric loading', `×${num(el.ratio, 3)}`, 'loading'],
    ['E', 'Losses & efficiency', `${num(emf.Ploss, 3)} W lost`, 'report'],
  ]
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map(([tag, title, out, tab], i) => (
        <div key={tag} className="flex flex-1 basis-40 items-center gap-2">
          <button type="button" onClick={() => onNavigate(tab)}
            className="flex-1 rounded-lg border bg-muted/40 p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent">
            <span className="font-mono text-xs font-semibold text-primary">{tag}</span>
            <div className="text-sm font-medium">{title}</div>
            <div className="num font-mono text-xs text-muted-foreground">{out}</div>
          </button>
          {i < steps.length - 1 && <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground xl:block" />}
        </div>
      ))}
    </div>
  )
}

function FlowNode({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${strong ? 'border-good/40 bg-good/10' : 'bg-muted/40'}`}>
      <div className="text-[0.7rem] text-muted-foreground">{label}</div>
      <div className="num font-mono text-sm font-semibold">{num(value, 2)} W</div>
    </div>
  )
}
function FlowArrow({ eta, loss }: { eta: number; loss: number }) {
  return (
    <div className="flex flex-1 flex-col items-center text-[0.7rem]">
      <span className="text-good">η {pct(eta, 1)}%</span>
      <ArrowRight className="size-4 text-muted-foreground" />
      <span className="num text-bad">−{num(loss, 2)} W</span>
    </div>
  )
}

export function OverviewTab({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { R } = useMotor()
  const { A, emf } = R
  const supply = emf.P / emf.etaAll, motorIn = emf.P / emf.eta, escLoss = supply - motorIn
  const errors = designErrors(R)
  const nErr = errors.filter(c => c.level === 'bad').length
  const losses = [
    { name: 'Copper loss', value: Math.max(0, emf.Pcu), fill: 'var(--chart-1)' },
    { name: 'Eddy loss', value: Math.max(0, emf.Peddy), fill: 'var(--chart-2)' },
  ]

  return (
    <div className="grid gap-4">
      <Panel title="Design errors" className={nErr ? 'ring-bad/40' : undefined}
        action={<Badge variant={nErr ? 'destructive' : 'secondary'}>{nErr ? `${nErr} error${nErr > 1 ? 's' : ''}` : 'no errors'}</Badge>}>
        <CheckList items={errors} />
      </Panel>

      <Panel title="Calculation pipeline" hint="How the sections feed each other">
        <Pipeline onNavigate={onNavigate} />
        <Note>
          The motor specification (power, speed, torque, slots, poles) feeds A, B and C. A supplies conductor width, thickness,
          turns and coil sides to B, plus phase resistance and turns per phase to C; C supplies the air-gap flux density to B.
          Eddy loss from B feeds C. Magnet dimensions use IRS from A and the spec poles. D takes peak current and flux density
          from C, turns and radii from A, and torque from the spec. Click a step to open it.
        </Note>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Energy flow" hint={`overall η ${pct(emf.etaAll)} %`}>
          <div className="flex items-center gap-2">
            <FlowNode label="Supply" value={supply} />
            <FlowArrow eta={emf.etaESC} loss={escLoss} />
            <FlowNode label="Motor input" value={motorIn} />
            <FlowArrow eta={emf.eta} loss={emf.Ploss} />
            <FlowNode label="Shaft output" value={emf.P} strong />
          </div>
          <div className="mt-5">
            <StackBar segments={[
              { label: 'Output', value: emf.P, color: 'var(--good)', unit: 'W' },
              { label: 'Copper', value: emf.Pcu, color: 'var(--chart-1)', unit: 'W' },
              { label: 'Eddy', value: emf.Peddy, color: 'var(--chart-2)', unit: 'W' },
              { label: 'ESC', value: escLoss, color: 'var(--chart-5)', unit: 'W' },
            ]} />
          </div>
          <div className="mt-4">
            <KvList>
              <Kv k="Motor efficiency  P / (P + losses)" v={`${pct(emf.eta)} %`} />
              <Kv k="ESC efficiency" v={`${pct(emf.etaESC)} %`} />
              <Kv k="Overall efficiency" v={`${pct(emf.etaAll)} %`} em />
            </KvList>
          </div>
        </Panel>

        <Panel title="Motor losses">
          <div className="relative mx-auto h-44 max-w-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={losses} dataKey="value" innerRadius="68%" outerRadius="95%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {losses.map(l => <Cell key={l.name} fill={l.fill} />)}
                </Pie>
                <Tooltip formatter={(v) => `${num(Number(v), 4)} W`} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <div className="num text-xl font-semibold">{num(emf.Ploss, 3)}</div>
              <div className="text-xs text-muted-foreground">W total</div>
            </div>
          </div>
          <KvList>
            <Kv k={<><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-chart-1" />Copper loss 3·I²rms·R</>} v={num(emf.Pcu, 4)} unit="W" />
            <Kv k={<><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-chart-2" />Eddy current loss</>} v={num(emf.Peddy, 4)} unit="W" />
            <Kv k="Total loss" v={num(emf.Ploss, 4)} unit="W" em />
          </KvList>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Phase resistance build-up">
          <StackBar segments={[
            { label: 'Radial', value: A.series_stacks * A.R_radial_total / A.total_layer_stacks, color: 'var(--chart-1)', unit: 'Ω' },
            { label: 'Top EW', value: A.series_stacks * A.R_top_total / A.total_layer_stacks, color: 'var(--chart-3)', unit: 'Ω' },
            { label: 'Bottom EW', value: A.series_stacks * A.R_bottom_total / A.total_layer_stacks, color: 'var(--chart-4)', unit: 'Ω' },
            { label: 'Vias', value: A.via_resistance, color: 'var(--chart-5)', unit: 'Ω' },
          ]} />
          <div className="mt-4">
            <KvList>
              <Kv k={`Per stack, radial (×${A.mult} coils)`} v={num(A.R_radial_total, 4)} unit="Ω" />
              <Kv k="Per stack, end-winding" v={num(A.R_endwinding_total, 4)} unit="Ω" />
              <Kv k={`Phase = ${A.series_stacks} series ÷ ${A.total_layer_stacks} + vias`} v={num(A.R_stack_total, 4)} unit="Ω" em />
            </KvList>
          </div>
        </Panel>
        <Panel title="Design checks"><CheckList items={designChecks(R)} /></Panel>
      </div>
    </div>
  )
}
