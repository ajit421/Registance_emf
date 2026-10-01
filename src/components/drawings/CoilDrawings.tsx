/* To-scale SVG drawings of one coil and of the whole stator (all dimensions in mm). */
import type { MotorResult } from '@/lib/motor/compute'
import { num, turnColor } from '@/lib/format'
import { cn } from '@/lib/utils'

const DEG = Math.PI / 180
const P = (r: number, a: number): [number, number] => [r * Math.sin(a * DEG), -r * Math.cos(a * DEG)]
const f4 = (v: number) => v.toFixed(4)

/** Annular sector path between radii r1<r2 and angles a1<a2 (degrees, 0 = up). */
function sector(r1: number, r2: number, a1: number, a2: number) {
  if (!(r2 > r1) || !(a2 > a1)) return ''
  const large = a2 - a1 > 180 ? 1 : 0
  const [x1, y1] = P(r2, a1), [x2, y2] = P(r2, a2), [x3, y3] = P(r1, a2), [x4, y4] = P(r1, a1)
  return `M${f4(x1)} ${f4(y1)}A${r2} ${r2} 0 ${large} 1 ${f4(x2)} ${f4(y2)}L${f4(x3)} ${f4(y3)}A${r1} ${r1} 0 ${large} 0 ${f4(x4)} ${f4(y4)}Z`
}
function arcPath(r: number, a1: number, a2: number) {
  const [x1, y1] = P(r, a1), [x2, y2] = P(r, a2)
  return `M${x1} ${y1}A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

export function CoilDrawing({ A, active, onHover }: {
  A: MotorResult['A']; active: number | null; onHover: (k: number | null) => void
}) {
  if (!(A.OR > A.IR) || !(A.IR > 0)) return <p className="text-sm text-muted-foreground">Geometry is invalid (OR must exceed IR &gt; 0).</p>
  const net = Math.max(A.net_trace_angle_deg, 0.02)
  const hmax = Math.min(A.ew_angle_deg / 2 + net * 1.5, 179)

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i <= 48; i++) {
    const a = -hmax + (2 * hmax) * i / 48
    for (const r of [A.OR, A.IR]) {
      const [x, y] = P(r, a)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
  }
  const dim = Math.max(maxX - minX, maxY - minY)
  const pad = dim * 0.05, fs = dim * 0.03, lw = dim * 0.0025
  const vb = [minX - pad - fs * 7, minY - pad, (maxX - minX) + 2 * pad + fs * 14, (maxY - minY) + 2 * pad]

  // a concentrated winding has its branches tied along the whole leg, so no separate parallel zone
  const zone = !A.cw
  const refs = [
    { r: A.OR, t: `OR ${num(A.OR, 1)}`, cls: 'stroke-muted-foreground', side: 1, dash: undefined },
    { r: A.ORS, t: `ORS ${num(A.ORS, 1)}`, cls: 'stroke-muted-foreground', side: 1, dash: `${lw * 4} ${lw * 3}` },
    { r: A.IRS, t: `IRS ${num(A.IRS, 1)}`, cls: 'stroke-muted-foreground', side: 1, dash: `${lw * 4} ${lw * 3}` },
    { r: A.IR, t: `IR ${num(A.IR, 1)}`, cls: 'stroke-muted-foreground', side: 1, dash: undefined },
    ...(zone ? [
      { r: A.par_r_end, t: `‖ ${num(A.par_r_end, 1)}`, cls: 'stroke-chart-3', side: -1, dash: `${lw * 2} ${lw * 2}` },
      { r: A.par_r_start, t: `‖ ${num(A.par_r_start, 1)}`, cls: 'stroke-chart-3', side: -1, dash: `${lw * 2} ${lw * 2}` },
    ] : []),
  ]
  const topT = Math.max(A.top_ew_thickness, 0.05), botT = Math.max(A.bottom_ew_thickness, 0.05)

  return (
    <svg viewBox={vb.map(v => v.toFixed(3)).join(' ')} className="h-auto w-full" role="img" aria-label={`One coil with ${A.turns} turns`}
      onMouseLeave={() => onHover(null)}>
      <path d={sector(A.IR, A.OR, -hmax, hmax)} className="fill-muted" />
      {zone && <path d={sector(A.par_r_start, A.par_r_end, -hmax, hmax)} className="fill-chart-3/15" />}
      {refs.map(o => {
        const [x, y] = P(o.r, o.side * hmax)
        return (
          <g key={o.t}>
            <path d={arcPath(o.r, -hmax, hmax)} className={cn('fill-none', o.cls)} strokeWidth={lw} strokeDasharray={o.dash} />
            <text x={x + o.side * fs * 0.6} y={y + fs * 0.35} fontSize={fs} textAnchor={o.side > 0 ? 'start' : 'end'} className="fill-muted-foreground">{o.t}</text>
          </g>
        )
      })}
      {A.perTurn.map(t => {
        const h = t.ew_angle_deg / 2
        if (!(h > 0) || !(t.Rout > t.Rin)) return null
        const d = [
          sector(t.Rin, t.Rout, -h - net / 2, -h + net / 2),
          sector(t.Rin, t.Rout, h - net / 2, h + net / 2),
          sector(t.Rout - topT, t.Rout, -h - net / 2, h + net / 2),
          sector(t.Rin, t.Rin + botT, -h - net / 2, h + net / 2),
        ].join('')
        const dim = active !== null && active !== t.k
        return (
          <path key={t.k} d={d} fill={turnColor(t.k)} onMouseEnter={() => onHover(t.k)}
            className={cn('transition-opacity', dim && 'opacity-20')}>
            <title>{`Turn ${t.k}: r ${num(t.Rin, 2)}–${num(t.Rout, 2)} mm, span ${num(t.ew_angle_deg, 2)}°, R = ${num((2 * t.R_radial_leg + t.R_top + t.R_bottom) * 1000, 3)} mΩ`}</title>
          </path>
        )
      })}
    </svg>
  )
}

export function StatorDrawing({ A }: { A: MotorResult['A'] }) {
  if (!(A.OR > A.IR) || !(A.IR > 0)) return null
  const s = A.OR * 1.04, lw = A.OR * 0.006
  const ring = (r1: number, r2: number) =>
    `M0 ${-r2}A${r2} ${r2} 0 1 1 0 ${r2}A${r2} ${r2} 0 1 1 0 ${-r2}ZM0 ${-r1}A${r1} ${r1} 0 1 0 0 ${r1}A${r1} ${r1} 0 1 0 0 ${-r1}Z`
  const n = Math.min(Math.round(A.slots), 720)
  let slots = ''
  for (let i = 0; i < n; i++) {
    const a = i * 360 / A.slots
    const [x1, y1] = P(A.IRS, a), [x2, y2] = P(A.ORS, a)
    slots += `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`
  }
  const h = Math.min(A.ew_angle_deg / 2 + Math.max(A.net_trace_angle_deg, 0) / 2, 179)
  return (
    <svg viewBox={`${-s} ${-s} ${2 * s} ${2 * s}`} className="mx-auto h-auto w-full max-w-60" role="img" aria-label="Stator overview">
      <path fillRule="evenodd" d={ring(A.IR, A.OR)} className="fill-muted" />
      <path fillRule="evenodd" d={ring(Math.max(A.IRS, A.IR), Math.min(A.ORS, A.OR))} className="fill-primary/10" />
      <path d={slots} strokeWidth={lw} className="stroke-muted-foreground/50" />
      <path d={sector(A.IR, A.OR, -h, h)} className="fill-primary/80" />
    </svg>
  )
}
