import { useState } from 'react'
import { Formula, Kv, KvList, Note, Panel } from '@/components/common'
import { CoilDrawing, StatorDrawing } from '@/components/drawings/CoilDrawings'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMotor } from '@/hooks/useMotor'
import { num, turnColor } from '@/lib/format'
import { cn } from '@/lib/utils'

export function WindingTab() {
  const { R } = useMotor()
  const { A } = R
  const [active, setActive] = useState<number | null>(null)

  return (
    <div className="grid gap-4">
      <Panel title="Coil geometry" hint={`${A.turns} turns · ${num(A.ew_angle_deg, 2)}° end-winding span`}>
        <div className="grid items-center gap-6 md:grid-cols-[1fr_15rem]">
          <CoilDrawing A={A} active={active} onHover={setActive} />
          <div>
            <StatorDrawing A={A} />
            <p className="mt-2 text-center text-xs text-muted-foreground">{A.slots} slots · 1 coil highlighted</p>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: 'var(--turn-1)' }} />Copper traces (one colour per turn)</li>
              <li className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-chart-3/40" />Parallel zone (÷{A.layer_stack} layers)</li>
              <li className="flex items-center gap-2"><i className="size-2.5 rounded-sm border border-dashed border-muted-foreground" />Slab boundary ORS / IRS</li>
            </ul>
          </div>
        </div>
        <Note>Drawn to scale in mm. Hover a turn, or a table row below, to highlight it.</Note>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Derived geometry">
          <KvList>
            <Kv k="Coil side angle (360 / slots)" v={num(A.theta_coil_deg, 4)} unit="°" />
            <Kv k="Per-turn angle" v={num(A.per_turn_angle_deg, 4)} unit="°" />
            <Kv k="Radial gap angle at IR" v={num(A.gap_deg, 4)} unit="°" />
            <Kv k="Net trace angle" v={num(A.net_trace_angle_deg, 4)} unit="°" />
            <Kv k="Trace width at IR" v={num(A.trace_width_radial_atIR, 4)} unit="mm" />
            <Kv k="Min trace width at IR" v={<>{num(A.min_trace_IR, 4)}{!A.traceOk && <b className="ml-1 text-bad">✕ too narrow</b>}</>} unit="mm" />
            <Kv k={`Average trace width (r = ${num(A.r_mean_turns, 2)} mm)`} v={num(A.trace_width_radial_avg, 4)} unit="mm" em />
            <Kv k="Top end-winding thickness" v={num(A.top_ew_thickness, 4)} unit="mm" />
            <Kv k="Bottom end-winding thickness" v={num(A.bottom_ew_thickness, 4)} unit="mm" />
            <Kv k="Parallel zone" v={`${num(A.par_r_start, 2)} – ${num(A.par_r_end, 2)}`} unit="mm" />
            <Kv k="Total radial length (one side)" v={num(A.total_radial_one_side, 3)} unit="mm" />
            <Kv k="Total top / bottom arc" v={`${num(A.total_top_arc, 3)} / ${num(A.total_bottom_arc, 3)}`} unit="mm" />
          </KvList>
        </Panel>
        <Panel title="Resistance chain">
          <KvList>
            <Kv k="Radial, one side (Σ legs)" v={num(A.R_radial_one_side * 1e3, 4)} unit="mΩ" />
            <Kv k="Radial, coil (× 2 sides)" v={num(A.R_radial_coil * 1e3, 4)} unit="mΩ" />
            <Kv k="Top end-winding, coil" v={num(A.R_top_coil * 1e3, 4)} unit="mΩ" />
            <Kv k="Bottom end-winding, coil" v={num(A.R_bottom_coil * 1e3, 4)} unit="mΩ" />
            <Kv k="Coil, single layer" v={num(A.R_coil_single_layer * 1e3, 4)} unit="mΩ" em />
            <Kv k={`× layers · slots/phase = × ${A.mult}`} v={num(A.R_coil_total, 4)} unit="Ω" />
            <Kv k={`× ${A.series_stacks} series stacks ÷ ${A.total_layer_stacks}`} v={num(A.R_stack_total - A.via_resistance, 4)} unit="Ω" />
            <Kv k="+ via resistance" v={num(A.via_resistance, 4)} unit="Ω" />
            <Kv k="Phase resistance R_stack_total" v={num(A.R_stack_total, 4)} unit="Ω" em />
          </KvList>
          <Formula lines={[
            ['R', `= ρ · L / (w · t)     radial legs integrated over ${A.segments_radial} segment(s)`],
            ['R_leg', `= R_in + R_out + R_parallel / ${A.layer_stack}`],
          ]} />
        </Panel>
      </div>

      <Panel title="Per-turn breakdown" hint="one coil, one layer">
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
      </Panel>
    </div>
  )
}
