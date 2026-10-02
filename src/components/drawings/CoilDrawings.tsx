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

interface Ref { r: number; t: string; cls: string; side: number; dash?: string }

/** View box covering the annulus IR…OR over ±hmax, with room for the radius labels. */
function frame(A: MotorResult['A'], hmax: number) {
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
  const refs: Ref[] = [
    { r: A.OR, t: `OR ${num(A.OR, 1)}`, cls: 'stroke-muted-foreground', side: 1 },
    { r: A.ORS, t: `ORS ${num(A.ORS, 1)}`, cls: 'stroke-muted-foreground', side: 1, dash: `${lw * 4} ${lw * 3}` },
    { r: A.IRS, t: `IRS ${num(A.IRS, 1)}`, cls: 'stroke-muted-foreground', side: 1, dash: `${lw * 4} ${lw * 3}` },
    { r: A.IR, t: `IR ${num(A.IR, 1)}`, cls: 'stroke-muted-foreground', side: 1 },
  ]
  return { viewBox: vb.map(v => v.toFixed(3)).join(' '), fs, lw, refs }
}

function RefArcs({ refs, hmax, fs, lw }: { refs: Ref[]; hmax: number; fs: number; lw: number }) {
  return refs.map(o => {
    const [x, y] = P(o.r, o.side * hmax)
    return (
      <g key={o.t}>
        <path d={arcPath(o.r, -hmax, hmax)} className={cn('fill-none', o.cls)} strokeWidth={lw} strokeDasharray={o.dash} />
        <text x={x + o.side * fs * 0.6} y={y + fs * 0.35} fontSize={fs} textAnchor={o.side > 0 ? 'start' : 'end'} className="fill-muted-foreground">{o.t}</text>
      </g>
    )
  })
}

/** Concentrated coil: one slot pitch, `turns` radial traces per half next to the slot edge,
 *  end-winding radial legs out to each turn's arc. Turn 1 is the outermost loop. */
function ConcentratedCoilDrawing({ A, active, onHover }: {
  A: MotorResult['A']; active: number | null; onHover: (k: number | null) => void
}) {
  const cw = A.cw!
  const n = A.turns
  const half = A.theta_coil_deg / 2
  const edge = half - cw.slot_space_deg                     // outer edge of the traces, each side [deg]
  const th = cw.radial_angle_deg * DEG
  const { viewBox, fs, lw, refs } = frame(A, half)

  /** angle [deg] of the outer (slot-edge) or inner side of turn k's trace at radius r */
  const side = (k: number, r: number, gap: number, inner: boolean) => {
    const w = (th * r - (n - 1) * gap) / n
    const out = edge * DEG * r - (k - 1) * (w + gap)
    return (inner ? out - w : out) / r / DEG
  }
  /** radial trace of turn k from r1 to r2 on one side (s = ±1), edges follow the fixed-mm gap */
  const trace = (k: number, r1: number, r2: number, gap: number, s: number) => {
    // no copper left where the width is ≤ 0 (the engine warns about it)
    if (!(r2 > r1) || !((th * r1 - (n - 1) * gap) / n > 0) || !((th * r2 - (n - 1) * gap) / n > 0)) return ''
    const pts: [number, number][] = []
    for (let i = 0; i <= 8; i++) { const r = r1 + (r2 - r1) * i / 8; pts.push(P(r, s * side(k, r, gap, false))) }
    for (let i = 8; i >= 0; i--) { const r = r1 + (r2 - r1) * i / 8; pts.push(P(r, s * side(k, r, gap, true))) }
    if (pts.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return ''
    return `M${pts.map(([x, y]) => `${f4(x)} ${f4(y)}`).join('L')}Z`
  }
  const topT = Math.max(A.top_ew_thickness, 0.05), botT = Math.max(A.bottom_ew_thickness, 0.05)

  return (
    <svg viewBox={viewBox} className="h-auto w-full" role="img" aria-label={`One concentrated coil with ${n} turns`}
      onMouseLeave={() => onHover(null)}>
      <path d={sector(A.IR, A.OR, -half, half)} className="fill-muted" />
      {[-half, half].map(a => {
        const [x1, y1] = P(A.IR, a), [x2, y2] = P(A.OR, a)
        return <path key={a} d={`M${f4(x1)} ${f4(y1)}L${f4(x2)} ${f4(y2)}`} className="stroke-muted-foreground" strokeWidth={lw} strokeDasharray={`${lw * 2} ${lw * 2}`} />
      })}
      <RefArcs refs={refs} hmax={half} fs={fs} lw={lw} />
      {cw.perTurnEw.map(t => {
        const k = t.k
        const aTop = side(k, t.top_r - topT / 2, cw.gap_radial_ew, false)
        const aBot = side(k, t.bottom_r + botT / 2, cw.gap_radial_ew, false)
        const d = [1, -1].flatMap(s => [
          trace(k, A.IRS, A.ORS, cw.gap_radial, s),
          trace(k, A.ORS, t.top_r, cw.gap_radial_ew, s),
          trace(k, t.bottom_r, A.IRS, cw.gap_radial_ew, s),
        ]).concat(
          sector(t.top_r - topT, t.top_r, -aTop, aTop),
          sector(t.bottom_r, t.bottom_r + botT, -aBot, aBot),
        ).join('')
        const turn = A.perTurn[k - 1]
        return (
          <path key={k} d={d} fill={turnColor(k)} onMouseEnter={() => onHover(k)}
            className={cn('transition-opacity', active !== null && active !== k && 'opacity-20')}>
            <title>{`Turn ${k}: top arc at ${num(t.top_r, 2)} mm, bottom arc at ${num(t.bottom_r, 2)} mm, R = ${num((2 * turn.R_radial_leg + turn.R_top + turn.R_bottom) * 1000, 3)} mΩ (one layer)`}</title>
          </path>
        )
      })}
    </svg>
  )
}

export function CoilDrawing({ A, active, onHover }: {
  A: MotorResult['A']; active: number | null; onHover: (k: number | null) => void
}) {
  if (!(A.OR > A.IR) || !(A.IR > 0)) return <p className="text-sm text-muted-foreground">Geometry is invalid (OR must exceed IR &gt; 0).</p>
  if (A.cw) return <ConcentratedCoilDrawing A={A} active={active} onHover={onHover} />
  const net = Math.max(A.net_trace_angle_deg, 0.02)
  const hmax = Math.min(A.ew_angle_deg / 2 + net * 1.5, 179)
  const { viewBox, fs, lw, refs } = frame(A, hmax)
  refs.push(
    { r: A.par_r_end, t: `‖ ${num(A.par_r_end, 1)}`, cls: 'stroke-chart-3', side: -1, dash: `${lw * 2} ${lw * 2}` },
    { r: A.par_r_start, t: `‖ ${num(A.par_r_start, 1)}`, cls: 'stroke-chart-3', side: -1, dash: `${lw * 2} ${lw * 2}` },
  )
  const topT = Math.max(A.top_ew_thickness, 0.05), botT = Math.max(A.bottom_ew_thickness, 0.05)

  return (
    <svg viewBox={viewBox} className="h-auto w-full" role="img" aria-label={`One coil with ${A.turns} turns`}
      onMouseLeave={() => onHover(null)}>
      <path d={sector(A.IR, A.OR, -hmax, hmax)} className="fill-muted" />
      <path d={sector(A.par_r_start, A.par_r_end, -hmax, hmax)} className="fill-chart-3/15" />
      <RefArcs refs={refs} hmax={hmax} fs={fs} lw={lw} />
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
  // concentrated: the coil fills its slot pitch up to the slot space on each side
  const h = A.cw ? A.ew_angle_deg / 2 : Math.min(A.ew_angle_deg / 2 + Math.max(A.net_trace_angle_deg, 0) / 2, 179)
  return (
    <svg viewBox={`${-s} ${-s} ${2 * s} ${2 * s}`} className="mx-auto h-auto w-full max-w-60" role="img" aria-label="Stator overview">
      <path fillRule="evenodd" d={ring(A.IR, A.OR)} className="fill-muted" />
      <path fillRule="evenodd" d={ring(Math.max(A.IRS, A.IR), Math.min(A.ORS, A.OR))} className="fill-primary/10" />
      <path d={slots} strokeWidth={lw} className="stroke-muted-foreground/50" />
      <path d={sector(A.IR, A.OR, -h, h)} className="fill-primary/80" />
    </svg>
  )
}
