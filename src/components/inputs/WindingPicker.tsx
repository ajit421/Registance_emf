/* Choice between a distributed and a concentrated winding, asked before the stator inputs. */
import { Check } from 'lucide-react'
import type { Winding } from '@/lib/motor/schema'
import { cn } from '@/lib/utils'
import { useMotorStore } from '@/store/motor'

function DistributedIcon() {
  return (
    <svg viewBox="0 0 64 36" className="h-9 w-16" aria-hidden="true">
      {[8, 16, 24, 32, 40, 48, 56].map(x => <line key={x} x1={x} y1={12} x2={x} y2={32} className="stroke-muted-foreground/40" strokeWidth={2} />)}
      <path d="M12 32V16q0-8 8-8h8q8 0 8 8v16" fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M28 32V20q0-8 8-8h8q8 0 8 8v12" fill="none" className="stroke-primary/45" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}

function ConcentratedIcon() {
  return (
    <svg viewBox="0 0 64 36" className="h-9 w-16" aria-hidden="true">
      {[6, 26, 46].map(x => <rect key={x} x={x} y={12} width={12} height={20} rx={1.5} className="fill-muted-foreground/25" />)}
      <rect x={22} y={9} width={20} height={20} rx={4} fill="none" className="stroke-primary" strokeWidth={2.5} />
      <path d="M22 15h20M22 21h20" className="stroke-primary/45" strokeWidth={1.5} />
    </svg>
  )
}

const OPTIONS: { id: Winding; title: string; text: string; Icon: () => React.JSX.Element; soon?: boolean }[] = [
  { id: 'distributed', title: 'Distributed', text: 'Coils span several slots and overlap', Icon: DistributedIcon },
  { id: 'concentrated', title: 'Concentrated', text: 'Each coil sits around a single tooth', Icon: ConcentratedIcon, soon: true },
]

export function WindingPicker({ className }: { className?: string }) {
  const winding = useMotorStore(s => s.winding)
  const setWinding = useMotorStore(s => s.setWinding)
  return (
    <div role="radiogroup" aria-label="Winding configuration" className={cn('grid grid-cols-2 gap-2', className)}>
      {OPTIONS.map(({ id, title, text, Icon, soon }) => {
        const on = winding === id
        return (
          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setWinding(id)}
            className={cn(
              'relative flex flex-col items-start gap-1.5 rounded-lg border bg-card p-3 text-left transition-all',
              'hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
              on && 'border-primary bg-primary/5 ring-1 ring-primary',
            )}>
            <span className={cn('absolute top-2 right-2 grid size-4 place-items-center rounded-full border',
              on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
              {on && <Check className="size-3" strokeWidth={3} />}
            </span>
            <Icon />
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {title}
              {soon && <span className="rounded bg-muted px-1 py-px text-[0.6rem] font-normal text-muted-foreground">soon</span>}
            </span>
            <span className="text-[0.7rem] leading-snug text-muted-foreground">{text}</span>
          </button>
        )
      })}
    </div>
  )
}
