/* Results as one expandable card per section; the header shows the headline numbers, the body every detail. */
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, CircuitBoard, Flame, Gauge, Magnet, Waves, Zap, type LucideIcon } from 'lucide-react'
import { CheckList, Kv, KvList } from '@/components/common'
import { CoilDrawing, StatorDrawing } from '@/components/drawings/CoilDrawings'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMotor } from '@/hooks/useMotor'
import { designChecks, designErrors, type CheckLevel } from '@/lib/motor/checks'
import type { MotorResult } from '@/lib/motor/compute'
import { LIMITS, totalLayers } from '@/lib/motor/schema'
import { num, pct, turnColor } from '@/lib/format'
import { cn } from '@/lib/utils'

const DEG = Math.PI / 180

interface CardDef {
  id: string
  title: string
  Icon: LucideIcon
  status?: { level: CheckLevel; text: string }
  stats: [string, string][]
  body: ReactNode
}

const STATUS_STYLE: Record<CheckLevel, string> = {
  ok: 'bg-good/10 text-good',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/10 text-bad',
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      <KvList>{children}</KvList>
    </div>
  )
}

function ResultCard({ c, open, onOpenChange }: { c: CardDef; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}
      className={cn('rounded-xl border bg-card shadow-xs transition-shadow', open && 'shadow-sm ring-1 ring-primary/20')}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:gap-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><c.Icon className="size-4.5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{c.title}</span>
          {c.status && (
            <span className={cn('mt-0.5 inline-block rounded px-1.5 py-px text-[0.68rem] font-medium', STATUS_STYLE[c.status.level])}>{c.status.text}</span>
          )}
        </span>
        <span className="flex shrink-0 gap-5">
          {c.stats.map(([label, value], i) => (
            <span key={label} className={cn('text-right', i > 0 && 'hidden md:block')}>
              <span className="block text-[0.68rem] text-muted-foreground">{label}</span>
              <span className="num block font-mono text-sm font-semibold">{value}</span>
            </span>
          ))}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 pt-4 pb-5">{c.body}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function CoilDetails({ A }: { A: MotorResult['A'] }) {
  const [active, setActive] = useState<number | null>(null)
  return (
    <div className="space-y-5">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_13rem]">
        <CoilDrawing A={A} active={active} onHover={setActive} />
        <div>
          <StatorDrawing A={A} />
          <p className="mt-2 text-center text-xs text-muted-foreground">{A.slots} slots · 1 coil highlighted · drawn to scale</p>
        </div>
      </div>
      <Table className="num font-mono text-xs">
        <TableHeader>
          <TableRow>
            {['Turn', 'Rin mm', 'Rout mm', 'Radial mm', 'Parallel mm', 'EW angle °', 'Top arc mm', 'Bottom arc mm', 'R leg mΩ', 'R top mΩ', 'R bottom mΩ']
              .map(h => <TableHead key={h} className="font-sans">{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {A.perTurn.map(t => (
            <TableRow key={t.k} onMouseEnter={() => setActive(t.k)} onMouseLeave={() => setActive(null)} className={cn(active === t.k && 'bg-accent')}>
              <TableCell><i className="mr-2 inline-block size-2.5 rounded-sm" style={{ background: turnColor(t.k) }} />{t.k}</TableCell>
              <TableCell>{num(t.Rin, 3)}</TableCell><TableCell>{num(t.Rout, 3)}</TableCell><TableCell>{num(t.radial_length, 3)}</TableCell>
              <TableCell>{num(t.len_parallel, 3)}</TableCell><TableCell>{num(t.ew_angle_deg, 3)}</TableCell>
              <TableCell>{num(t.top_arc, 3)}</TableCell><TableCell>{num(t.bottom_arc, 3)}</TableCell>
              <TableCell>{num(t.R_radial_leg * 1e3, 3)}</TableCell><TableCell>{num(t.R_top * 1e3, 3)}</TableCell><TableCell>{num(t.R_bottom * 1e3, 3)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Σ</TableCell><TableCell /><TableCell /><TableCell>{num(A.total_radial_one_side, 3)}</TableCell><TableCell /><TableCell />
            <TableCell>{num(A.total_top_arc, 3)}</TableCell><TableCell>{num(A.total_bottom_arc, 3)}</TableCell>
            <TableCell>{num(A.R_radial_one_side * 1e3, 3)}</TableCell><TableCell>{num(A.R_top_coil * 1e3, 3)}</TableCell><TableCell>{num(A.R_bottom_coil * 1e3, 3)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

function WindingBody({ R }: { R: MotorResult }) {
  const { A, S, ed } = R
  const [coil, setCoil] = useState(false)
  return (
    <div className="space-y-5">
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        <Group title="Geometry">
          <Kv k="Radial winding Rout / Rin" v={`${num(A.ORS, 2)} / ${num(A.IRS, 2)}`} unit="mm" />
          <Kv k="Outer radius OR (Rout + end winding)" v={num(A.OR, 2)} unit="mm" />
          <Kv k="Inner radius IR (Rin − end winding)" v={num(A.IR, 2)} unit="mm" />
          <Kv k="Coil angle (360 / slots)" v={num(A.theta_coil_deg, 4)} unit="°" />
          <Kv k="End-winding span" v={num(A.ew_angle_deg, 3)} unit="°" />
          <Kv k="Per-turn angle" v={num(A.per_turn_angle_deg, 4)} unit="°" />
          <Kv k="Net trace angle" v={num(A.net_trace_angle_deg, 4)} unit="°" />
        </Group>
        <Group title="Traces">
          <Kv k="Trace width at IR" v={<>{num(A.trace_width_radial_atIR, 4)}{!A.traceOk && <b className="ml-1 text-bad">too narrow</b>}</>} unit="mm" />
          <Kv k="Min trace width at inner radius" v={num(A.min_trace_IR, 4)} unit="mm" />
          <Kv k={`Average trace width (r = ${num(A.r_mean_turns, 2)} mm)`} v={num(A.trace_width_radial_avg, 4)} unit="mm" em />
          <Kv k="Average radial gap" v={num(A.gap_deg * DEG * A.r_mean_turns, 4)} unit="mm" />
          <Kv k="Top end-winding trace" v={num(A.top_ew_thickness, 4)} unit="mm" />
          <Kv k="Bottom end-winding trace" v={num(A.bottom_ew_thickness, 4)} unit="mm" />
        </Group>
        <Group title="Winding">
          <Kv k="Poles (slots / 3)" v={num(S.poles, 2)} />
          <Kv k="Slots per phase (poles / 2)" v={num(ed.sides, 2)} />
          <Kv k="Turns per slot / layer" v={A.turns} />
          <Kv k="Series × parallel layer stacks" v={`${A.series_stacks} × ${A.total_layer_stacks}`} />
          <Kv k="Total layers" v={num(totalLayers(R), 0)} />
          <Kv k="Turns per phase" v={num(A.total_turns, 0)} em />
        </Group>
        <Group title="Resistance">
          <Kv k="Coil, single layer" v={num(A.R_coil_single_layer * 1e3, 4)} unit="mΩ" />
          <Kv k={`Radial, per stack (× ${num(A.mult, 0)} coils)`} v={num(A.R_radial_total, 4)} unit="Ω" />
          <Kv k="End-winding, per stack" v={num(A.R_endwinding_total, 4)} unit="Ω" />
          <Kv k={`× ${A.series_stacks} series ÷ ${A.total_layer_stacks} parallel`} v={num(A.R_stack_total - A.via_resistance, 4)} unit="Ω" />
          <Kv k="+ via resistance" v={num(A.via_resistance, 4)} unit="Ω" />
          <Kv k="Phase resistance" v={num(A.R_stack_total, 4)} unit="Ω" em />
        </Group>
      </div>
      <Collapsible open={coil} onOpenChange={setCoil}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            <ChevronDown className={cn('transition-transform', coil && 'rotate-180')} />
            {coil ? 'Hide' : 'Show'} coil drawing and per-turn breakdown
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4"><CoilDetails A={A} /></CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function cards(R: MotorResult): CardDef[] {
  const { A, ed, emf, mag, el } = R
  const supply = emf.P / emf.etaAll, motorIn = emf.P / emf.eta
  const windingBad = !A.traceOk || R.warnings.length > 0
  return [
    {
      id: 'winding', title: 'Winding & resistance', Icon: CircuitBoard,
      status: windingBad
        ? { level: 'bad', text: A.traceOk ? `${R.warnings.length} geometry warning${R.warnings.length > 1 ? 's' : ''}` : 'Trace too narrow at IR' }
        : { level: 'ok', text: 'Geometry OK' },
      stats: [['Phase resistance', `${num(A.R_stack_total, 4)} Ω`], ['Trace at IR', `${num(A.trace_width_radial_atIR, 3)} mm`], ['Turns / phase', num(A.total_turns, 0)]],
      body: <WindingBody R={R} />,
    },
    {
      id: 'emf', title: 'EMF & performance', Icon: Zap,
      stats: [['Back-EMF', `${num(emf.Ef, 3)} V`], ['Current rms', `${num(emf.Irms, 3)} A`], ['Terminal', `${num(emf.Vterm, 2)} V`]],
      body: (
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <Group title="Voltage">
            <Kv k="Pole pairs (poles / 2)" v={num(emf.pp, 2)} />
            <Kv k="Turns per phase" v={num(emf.Nph, 0)} />
            <Kv k="Flux per pole φ" v={num(emf.phi, 6)} unit="Wb" />
            <Kv k="Back-EMF Ef" v={num(emf.Ef, 4)} unit="V" em />
            <Kv k="I·R voltage drop" v={num(emf.Vdrop, 4)} unit="V" />
            <Kv k="Terminal voltage" v={num(emf.Vterm, 4)} unit="V" em />
          </Group>
          <Group title="Torque & current">
            <Kv k="Output power" v={num(emf.P, 3)} unit="W" />
            <Kv k="Speed" v={num(emf.rpm, 2)} unit="rpm" />
            <Kv k="Torque" v={num(emf.T, 4)} unit="N·m" />
            <Kv k="Current (peak)" v={num(emf.Ipk, 4)} unit="A" />
            <Kv k="Current (rms)" v={num(emf.Irms, 4)} unit="A" em />
          </Group>
        </div>
      ),
    },
    {
      id: 'eddy', title: 'Eddy current loss', Icon: Waves,
      stats: [['Eddy loss', `${num(ed.P, 4)} W`], ['Frequency', `${num(ed.f, 2)} Hz`]],
      body: (
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <Group title="Conductor">
            <Kv k="Width (average trace width)" v={num(ed.tw, 4)} unit="mm" />
            <Kv k="Thickness (copper)" v={num(ed.th, 3)} unit="mm" />
            <Kv k="Length (Rout − Rin)" v={num(ed.len, 2)} unit="mm" />
            <Kv k="Turns Nc" v={num(ed.Nc, 0)} />
            <Kv k="Coil sides (slots per phase)" v={num(ed.sides, 2)} />
            <Kv k="Parallel paths" v={num(ed.paths, 0)} />
          </Group>
          <Group title="Field & loss">
            <Kv k="Electrical frequency f" v={num(ed.f, 3)} unit="Hz" />
            <Kv k="Axial flux density Bz (air gap)" v={num(ed.Bz, 3)} unit="T" />
            <Kv k="Tangential flux density Bφ" v={num(ed.Bphi, 3)} unit="T" />
            <Kv k="Width part" v={num(ed.width_part, 6)} />
            <Kv k="Numerator" v={num(ed.numer, 6)} />
            <Kv k="Eddy loss" v={num(ed.P, 6)} unit="W" em />
          </Group>
        </div>
      ),
    },
    {
      id: 'magnets', title: 'Magnet dimensions', Icon: Magnet,
      status: mag.spaceOk ? { level: 'ok', text: 'Spacing within limits' } : { level: 'bad', text: `Spacing ${mag.space < LIMITS.magSpaceMin ? 'too small' : 'too large'}` },
      stats: [['Space between magnets', `${num(mag.space, 3)} mm`], ['Pole pitch', `${num(mag.pole_pitch, 3)} mm`]],
      body: (
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <Group title="Magnet">
            <Kv k="Length × width" v={`${num(mag.len, 2)} × ${num(mag.width, 2)}`} unit="mm" />
            <Kv k="Rin / Rout" v={`${num(mag.Rin, 2)} / ${num(mag.Rout, 2)}`} unit="mm" />
            <Kv k="Poles" v={num(mag.poles, 2)} />
          </Group>
          <Group title="Spacing">
            <Kv k="Pole pitch at Rin" v={num(mag.pole_pitch, 4)} unit="mm" />
            <Kv k="Space between magnets" v={num(mag.space, 4)} unit="mm" em />
            <Kv k="Allowed range" v={`${LIMITS.magSpaceMin} – ${LIMITS.magSpaceMax}`} unit="mm" />
          </Group>
        </div>
      ),
    },
    {
      id: 'loading', title: 'Electric loading', Icon: Gauge,
      status: el.enough ? { level: 'ok', text: 'Loading is enough' } : { level: 'bad', text: 'Loading is not enough' },
      stats: [['Present / required', `× ${num(el.ratio, 3)}`], ['Present Ac', `${num(el.Ac_present, 0)} A/m`]],
      body: (
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <Group title="Loading">
            <Kv k="Present Ac" v={num(el.Ac_present, 2)} unit="A/m" em />
            <Kv k="Required Ac" v={num(el.Ac_required, 2)} unit="A/m" em />
            <Kv k="Present / required" v={num(el.ratio, 3)} />
          </Group>
          <Group title="Based on">
            <Kv k="Phases" v={num(el.m, 0)} />
            <Kv k="Peak current" v={num(el.Ipk, 4)} unit="A" />
            <Kv k="Turns per phase" v={num(el.N, 0)} />
            <Kv k="Do / Din" v={`${num(el.Do, 2)} / ${num(el.Din, 2)}`} unit="mm" />
            <Kv k="kd = Din / Do" v={num(el.kd, 4)} />
            <Kv k="Average flux density" v={num(el.Bavg, 3)} unit="T" />
            <Kv k="Required torque" v={num(el.T, 4)} unit="N·m" />
          </Group>
        </div>
      ),
    },
    {
      id: 'losses', title: 'Losses & efficiency', Icon: Flame,
      stats: [['Total loss', `${num(emf.Ploss, 3)} W`], ['Motor η', `${pct(emf.eta)} %`], ['Overall η', `${pct(emf.etaAll)} %`]],
      body: (
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <Group title="Losses">
            <Kv k="Copper loss 3·I²rms·R" v={num(emf.Pcu, 4)} unit="W" />
            <Kv k="Eddy current loss" v={num(emf.Peddy, 4)} unit="W" />
            <Kv k="Total motor loss" v={num(emf.Ploss, 4)} unit="W" em />
            <Kv k="ESC loss" v={num(supply - motorIn, 4)} unit="W" />
          </Group>
          <Group title="Efficiency">
            <Kv k="Shaft output" v={num(emf.P, 3)} unit="W" />
            <Kv k="Motor input" v={num(motorIn, 3)} unit="W" />
            <Kv k="Supply power" v={num(supply, 3)} unit="W" />
            <Kv k="Motor efficiency" v={`${pct(emf.eta)} %`} />
            <Kv k="ESC efficiency" v={`${pct(emf.etaESC)} %`} />
            <Kv k="Overall efficiency" v={`${pct(emf.etaAll)} %`} em />
          </Group>
        </div>
      ),
    },
  ]
}

function ChecksCard({ R }: { R: MotorResult }) {
  const all = [...designErrors(R), ...designChecks(R)]
  const issues = all.filter(c => c.level !== 'ok')
  const passed = all.filter(c => c.level === 'ok')
  const [showPassed, setShowPassed] = useState(false)
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-xs', issues.some(c => c.level === 'bad') && 'border-bad/40')}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Design checks</h3>
        <span className="text-xs text-muted-foreground">
          {issues.length ? `${issues.length} to review · ` : ''}{passed.length} passed
        </span>
      </div>
      {issues.length > 0 && <div className="mt-3"><CheckList items={issues} /></div>}
      {passed.length > 0 && (
        <Collapsible open={showPassed || !issues.length} onOpenChange={setShowPassed} className="mt-3">
          {issues.length > 0 && (
            <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground">
              {showPassed ? 'Hide' : 'Show'} passed checks
            </CollapsibleTrigger>
          )}
          <CollapsibleContent className={cn(issues.length > 0 && 'pt-2.5')}><CheckList items={passed} /></CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

export function Results() {
  const { R } = useMotor()
  const list = cards(R)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const allOpen = list.every(c => open[c.id])

  return (
    <div className="space-y-4">
      <ChecksCard R={R} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Results by section</h2>
        <Button variant="ghost" size="xs"
          onClick={() => setOpen(Object.fromEntries(list.map(c => [c.id, !allOpen])))}>
          {allOpen ? <><ChevronsDownUp />Collapse all</> : <><ChevronsUpDown />Expand all</>}
        </Button>
      </div>
      <div className="space-y-2.5">
        {list.map(c => (
          <ResultCard key={c.id} c={c} open={!!open[c.id]} onOpenChange={o => setOpen(s => ({ ...s, [c.id]: o }))} />
        ))}
      </div>
    </div>
  )
}
