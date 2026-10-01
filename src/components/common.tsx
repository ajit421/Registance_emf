/* Small presentational building blocks shared by the results. */
import type { ReactNode } from 'react'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import type { Check } from '@/lib/motor/checks'
import { cn } from '@/lib/utils'

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
