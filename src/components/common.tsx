/* Small presentational building blocks shared by every tab. */
import type { ReactNode } from 'react'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Check } from '@/lib/motor/checks'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Panel({ title, hint, action, className, children }: {
  title: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string; children: ReactNode
}) {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  )
}

/** Key/value list; rows with `em` are emphasised totals. */
export function KvList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-border/70 text-sm">{children}</dl>
}

export function Kv({ k, v, unit, em }: { k: ReactNode; v: ReactNode; unit?: string; em?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', em && 'font-semibold')}>
      <dt className={cn('text-muted-foreground', em && 'text-foreground')}>{k}</dt>
      <dd className="num text-right font-mono text-[0.8rem]">
        {v}{unit && <span className="ml-1 font-sans text-xs text-muted-foreground">{unit}</span>}
      </dd>
    </div>
  )
}

export function Formula({ lines }: { lines: [string, string][] }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed">
      {lines.map(([fn, rest], i) => (
        <div key={i}><span className="font-semibold text-primary">{fn}</span> {rest}</div>
      ))}
    </pre>
  )
}

export interface Segment { label: string; value: number; color: string; unit?: string }

/** Horizontal 100 % stacked bar with a legend. */
export function StackBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + (Number.isFinite(x.value) ? Math.max(0, x.value) : 0), 0)
  const share = (v: number) => (total > 0 && Number.isFinite(v) ? Math.max(0, v) / total * 100 : 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments.map(s => (
          <Tooltip key={s.label}>
            <TooltipTrigger asChild>
              <div style={{ width: `${share(s.value)}%`, background: s.color }} className="h-full transition-[width] duration-300" />
            </TooltipTrigger>
            <TooltipContent>{s.label}: {num(s.value, 4)} {s.unit} ({share(s.value).toFixed(1)} %)</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {segments.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <i className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label} <b className="num font-mono font-medium text-foreground">{num(s.value, 3)} {s.unit}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

const CHECK_ICON = { ok: CircleCheck, warn: TriangleAlert, bad: CircleX }
const CHECK_COLOR = { ok: 'text-good', warn: 'text-warn', bad: 'text-bad' }

export function CheckList({ items }: { items: Check[] }) {
  return (
    <ul className="space-y-2.5 text-sm">
      {items.map((c, i) => {
        const Icon = CHECK_ICON[c.level]
        return (
          <li key={i} className="flex gap-2.5">
            <Icon className={cn('mt-0.5 size-4 shrink-0', CHECK_COLOR[c.level])} />
            <span>{c.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

export const Note = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{children}</p>
)
