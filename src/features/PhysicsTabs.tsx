/* Eddy loss (B), EMF & performance (C) and electric loading (D) tabs. */
import { useMemo } from 'react'
import { Formula, Kv, KvList, Note, Panel, StackBar } from '@/components/common'
import { MetricChart } from '@/components/charts/MetricChart'
import { useMotor } from '@/hooks/useMotor'
import { compute } from '@/lib/motor/compute'
import { num, pct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { override } from '@/lib/motor/override'

export function EddyTab() {
  const { params, R } = useMotor()
  const { ed } = R
  const data = useMemo(() => {
    const rmax = Math.max(ed.rpm * 2, 100)
    return Array.from({ length: 61 }, (_, i) => {
      const rpm = rmax * i / 60
      return { x: rpm, y: compute(override(params, 'spec_rpm', rpm)).ed.P }
    })
  }, [params, ed.rpm])

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <Panel title="Eddy current loss vs speed" hint="P ∝ f², where f = rpm · poles / 120">
        <MetricChart data={data} xLabel="Speed (rpm)" yLabel="Eddy loss (W)" zeroBased
          fx={v => `${num(v, 0)} rpm`} fy={v => `${num(v, 4)} W`} mark={{ x: ed.rpm, y: ed.P }} />
      </Panel>
      <Panel title="Results">
        <KvList>
          <Kv k="Electrical frequency f" v={num(ed.f, 3)} unit="Hz" />
          <Kv k="Conductor width (← A avg trace width)" v={num(ed.tw, 4)} unit="mm" />
          <Kv k="Conductor thickness (← A copper)" v={num(ed.th, 3)} unit="mm" />
          <Kv k="Conductor length" v={num(ed.len, 2)} unit="mm" />
          <Kv k="Turns per coil Nc (← A total turns)" v={num(ed.Nc, 0)} />
          <Kv k="Coil sides (← A slots per phase)" v={num(ed.sides, 0)} />
          <Kv k="Width part" v={num(ed.width_part, 6)} />
          <Kv k="Numerator" v={num(ed.numer, 6)} />
          <Kv k="Eddy loss" v={num(ed.P, 6)} unit="W" em />
        </KvList>
        <Formula lines={[
          ['f', '= rpm · poles / 120'],
          ['width', '= (w·Bz)² + (t·Bφ)²'],
          ['num', '= π² · sides · Nc · paths · f² · w · t · len'],
          ['P', '= num · width / (6 ρ)'],
        ]} />
      </Panel>
    </div>
  )
}

export function EmfTab() {
  const { params, R } = useMotor()
  const { emf } = R
  const data = useMemo(() => {
    const pmax = Math.max(emf.P * 3, 1)
    return Array.from({ length: 60 }, (_, i) => {
      const P = pmax * (i + 1) / 60
      return { x: P, y: compute({ ...params, spec_P: P, spec_solve: 'T' }).emf.eta * 100 }
    })
  }, [params, emf.P])

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <div className="grid content-start gap-4">
        <Panel title="Efficiency vs output power" hint={`at ${num(emf.rpm, 0)} rpm; copper loss grows as P²`}>
          <MetricChart data={data} xLabel="Output power (W)" yLabel="Motor efficiency (%)" color="var(--good)"
            fx={v => `${num(v, 2)} W`} fy={v => `${v.toFixed(2)} %`} mark={{ x: emf.P, y: emf.eta * 100 }} />
        </Panel>
        <Panel title="Voltage balance">
          <StackBar segments={[
            { label: 'Back-EMF Ef', value: emf.Ef, color: 'var(--chart-2)', unit: 'V' },
            { label: 'I·R drop', value: emf.Vdrop, color: 'var(--chart-1)', unit: 'V' },
          ]} />
          <Note>Terminal voltage = Ef + Ipk·R = <b className="num font-mono text-foreground">{num(emf.Vterm, 4)} V</b></Note>
        </Panel>
      </div>
      <Panel title="Results">
        <KvList>
          <Kv k="Phase resistance (from A)" v={num(emf.R, 4)} unit="Ω" />
          <Kv k="Turns per phase Nph (← A total turns)" v={num(emf.Nph, 0)} />
          <Kv k="Flux per pole φ" v={num(emf.phi, 6)} unit="Wb" />
          <Kv k="Back-EMF Ef" v={num(emf.Ef, 4)} unit="V" em />
          <Kv k="Torque" v={num(emf.T, 4)} unit="N·m" />
          <Kv k="Current (peak)" v={num(emf.Ipk, 4)} unit="A" />
          <Kv k="Current (rms)" v={num(emf.Irms, 4)} unit="A" />
          <Kv k="Copper loss" v={num(emf.Pcu, 4)} unit="W" />
          <Kv k="Eddy loss (from B)" v={num(emf.Peddy, 4)} unit="W" />
          <Kv k="Efficiency (motor)" v={`${num(emf.eta, 4)} (${pct(emf.eta)} %)`} em />
          <Kv k="Voltage drop" v={num(emf.Vdrop, 4)} unit="V" />
          <Kv k="ESC efficiency" v={`${num(emf.etaESC, 4)} (${pct(emf.etaESC)} %)`} />
          <Kv k="Overall (with ESC)" v={`${num(emf.etaAll, 4)} (${pct(emf.etaAll)} %)`} em />
          <Kv k="Terminal voltage" v={num(emf.Vterm, 4)} unit="V" />
        </KvList>
        <Formula lines={[
          ['φ', ' = 3.1416 · B · (Ro² − Ri²) / (2 pp)'],
          ['Ef', '= π√2 · pp · Nph · Kw · rpm · φ / 60 · √2'],
          ['T', ' = P / ω,   ω = 2π · rpm / 60'],
          ['Ipk', '= 2P / (3 Ef),   Irms = Ipk / 1.414'],
          ['Pcu', '= 3 · Irms² · R'],
          ['η', ' = P / (P + Pcu + Peddy)'],
        ]} />
      </Panel>
    </div>
  )
}

function LoadingBar({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><b className="num font-mono">{num(v, 2)} A/m</b></div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, v) / max * 100}%`, background: color }} />
      </div>
    </div>
  )
}

export function LoadingTab() {
  const { R } = useMotor()
  const { el } = R
  const mx = Math.max(el.Ac_present, el.Ac_required) * 1.1 || 1
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Present vs required electric loading">
        <div className="space-y-4">
          <LoadingBar label="Present Ac" v={el.Ac_present} max={mx} color={el.enough ? 'var(--good)' : 'var(--bad)'} />
          <LoadingBar label="Required Ac" v={el.Ac_required} max={mx} color="var(--chart-5)" />
        </div>
        <div className={cn('mt-6 flex items-center gap-4 rounded-xl border p-4', el.enough ? 'border-good/40 bg-good/10' : 'border-bad/40 bg-bad/10')}>
          <div className={cn('num text-3xl font-semibold', el.enough ? 'text-good' : 'text-bad')}>×{num(el.ratio, 3)}</div>
          <div className="text-sm">
            <b>{el.enough ? 'Present loading is enough.' : 'Present loading is NOT enough.'}</b><br />
            <span className="text-muted-foreground">
              {el.enough
                ? `Margin of ${num((el.ratio - 1) * 100, 1)} % over the torque requirement.`
                : `Short by ${num((1 - el.ratio) * 100, 1)} %: raise current or turns, or lower the torque target.`}
            </span>
          </div>
        </div>
      </Panel>
      <Panel title="Details">
        <KvList>
          <Kv k="Peak current Ipk (← C)" v={num(el.Ipk, 4)} unit="A" />
          <Kv k="Turns per phase N (← A total turns)" v={num(el.N, 0)} />
          <Kv k="Ro / Ri (← A ORS / IRS)" v={`${num(el.Ro, 2)} / ${num(el.Ri, 2)}`} unit="mm" />
          <Kv k="Do / Din (2 × radius)" v={`${num(el.Do, 2)} / ${num(el.Din, 2)}`} unit="mm" />
          <Kv k="Average flux density (← C air-gap B)" v={num(el.Bavg, 3)} unit="T" />
          <Kv k="Required torque (← spec)" v={num(el.T, 4)} unit="N·m" />
          <Kv k="kd = Din / Do" v={num(el.kd, 4)} />
          <Kv k="Average (sheet B8, mean of diameters)" v={num(el.Ravg, 2)} unit="mm" />
          <Kv k="Present Ac" v={num(el.Ac_present, 2)} unit="A/m" em />
          <Kv k="Required Ac" v={num(el.Ac_required, 2)} unit="A/m" em />
          <Kv k="Present / required" v={num(el.ratio, 3)} />
        </KvList>
        <Formula lines={[
          ['Ac,present ', '= 4√2 · m · Ipk · N / (π · Do · (1 + kd))'],
          ['Ac,required', '= T / ( ⅔ π · Bavg · (Ro³ − Ri³) )'],
        ]} />
      </Panel>
    </div>
  )
}
