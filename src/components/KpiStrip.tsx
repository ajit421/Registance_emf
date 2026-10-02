/* Headline results with the change against the default design. */
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { baselines, useMotor } from '@/hooks/useMotor'
import { same } from '@/lib/motor/io'
import { num, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Kpi { label: string; v: number; b: number; unit: string; d: number; better?: 1 | -1; color: string; sub: string }

export function KpiStrip() {
  const { R, winding } = useMotor()
  const { A, emf, el } = R, B = baselines[winding ?? 'distributed']
  const items: Kpi[] = [
    { label: 'Motor efficiency', v: emf.eta * 100, b: B.emf.eta * 100, unit: '%', d: 2, better: 1, color: 'var(--good)', sub: `Overall with ESC ${pct(emf.etaAll)}\u00a0%` },
    { label: 'Phase resistance', v: A.R_stack_total, b: B.A.R_stack_total, unit: 'Ω', d: A.R_stack_total < 1 ? 4 : 3, better: -1, color: 'var(--chart-1)', sub: `${num(A.total_turns, 0)} turns per phase` },
    { label: 'Back-EMF', v: emf.Ef, b: B.emf.Ef, unit: 'V', d: 2, color: 'var(--chart-2)', sub: `Terminal ${num(emf.Vterm, 2)}\u00a0V` },
    { label: 'Total loss', v: emf.Ploss, b: B.emf.Ploss, unit: 'W', d: 3, better: -1, color: 'var(--bad)', sub: `Cu ${num(emf.Pcu, 2)}\u00a0W · Eddy ${num(emf.Peddy, 2)}\u00a0W` },
    { label: 'Torque', v: emf.T, b: B.emf.T, unit: 'N·m', d: 3, color: 'var(--chart-4)', sub: `${num(emf.P, 1)}\u00a0W at ${num(emf.rpm, 0)}\u00a0rpm` },
    { label: 'Phase current', v: emf.Irms, b: B.emf.Irms, unit: 'A rms', d: 3, better: -1, color: 'var(--chart-3)', sub: `${num(emf.Ipk, 3)}\u00a0A peak` },
    { label: 'Loading ratio', v: el.ratio, b: B.el.ratio, unit: '×', d: 3, better: 1, color: el.enough ? 'var(--good)' : 'var(--bad)', sub: el.enough ? 'Present ≥ required' : 'Present < required' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
      {items.map(k => {
        const showDelta = Number.isFinite(k.v) && Number.isFinite(k.b) && k.b !== 0 && !same(k.v, k.b)
        const rel = showDelta ? (k.v - k.b) / Math.abs(k.b) * 100 : 0
        const good = k.better ? (rel > 0) === (k.better > 0) : null
        return (
          <div key={k.label} className="relative overflow-hidden rounded-xl border bg-card p-3.5 shadow-xs">
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: k.color }} />
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              {/* beside the label, so it never pushes the value onto a second line */}
              {showDelta && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn('num inline-flex shrink-0 items-center text-[0.7rem] font-medium',
                      good === null ? 'text-muted-foreground' : good ? 'text-good' : 'text-bad')}>
                      {rel > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {Math.abs(rel).toFixed(1)}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>vs default design ({num(k.b, k.d)} {k.unit})</TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
              <span className="num text-xl font-semibold tracking-tight">{num(k.v, k.d)}</span>
              <span className="text-xs text-muted-foreground">{k.unit}</span>
            </div>
            <div className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">{k.sub}</div>
          </div>
        )
      })}
    </div>
  )
}
