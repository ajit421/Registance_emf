/* Line/area chart of one result against one input, with the current design marked. */
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { tick } from '@/lib/format'

export interface Point { x: number; y: number }

interface Props {
  data: Point[]
  xLabel: string
  yLabel: string
  fx: (v: number) => string
  fy: (v: number) => string
  mark?: Point
  markLabel?: string
  /** include 0 in the y range */
  zeroBased?: boolean
  height?: number
  /** called with the x value of the clicked point */
  onPick?: (x: number) => void
  color?: string
}

export function MetricChart({ data, xLabel, yLabel, fx, fy, mark, markLabel = 'current', zeroBased, height = 290, onPick, color = 'var(--chart-1)' }: Props) {
  const good = data.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  if (good.length < 2) return <p className="py-10 text-center text-sm text-muted-foreground">Not enough valid points to plot for this range.</p>
  const xs = good.map(p => p.x)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const showMark = mark && Number.isFinite(mark.x) && Number.isFinite(mark.y) && mark.x >= x0 && mark.x <= x1
  const gid = `g-${yLabel.replace(/\W/g, '')}`

  return (
    <div style={{ height }} className={onPick ? 'cursor-crosshair' : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={good}
          margin={{ top: 12, right: 16, bottom: 24, left: 8 }}
          onClick={onPick ? s => {
            const i = Number(s.activeTooltipIndex)
            if (Number.isInteger(i) && good[i]) onPick(good[i].x)
          } : undefined}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="x" type="number" domain={[x0, x1]} tickFormatter={tick}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} stroke="var(--border)"
            label={{ value: xLabel, position: 'insideBottom', offset: -14, fontSize: 12, fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            dataKey="y" type="number" domain={zeroBased ? [(min: number) => Math.min(0, min), 'auto'] : ['auto', 'auto']}
            tickFormatter={tick} width={64} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} stroke="var(--border)"
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 4, fontSize: 12, fill: 'var(--muted-foreground)', style: { textAnchor: 'middle' } }}
          />
          <Tooltip
            cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as Point | undefined
              if (!p) return null
              return (
                <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
                  <div className="text-muted-foreground">{fx(p.x)}</div>
                  <div className="num font-mono font-medium">{fy(p.y)}</div>
                </div>
              )
            }}
          />
          <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} activeDot={{ r: 4 }} />
          {showMark && <ReferenceLine x={mark.x} stroke="var(--primary)" strokeOpacity={0.5} strokeDasharray="4 3" />}
          {showMark && (
            <ReferenceDot x={mark.x} y={mark.y} r={5.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2}
              label={{ value: markLabel, position: 'top', fontSize: 11, fill: 'var(--foreground)' }} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
