import { FileUp } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { InputPanel } from '@/components/inputs/InputPanel'
import { WindingPicker } from '@/components/inputs/WindingPicker'
import { KpiStrip } from '@/components/KpiStrip'
import { Results } from '@/features/Results'
import { useFileDrop } from '@/hooks/useImport'
import { useMotor } from '@/hooks/useMotor'

function ChooseWinding() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-center shadow-xs sm:p-8">
      <h2 className="text-lg font-semibold">Choose a winding configuration</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The stator inputs and every result depend on how the coils are wound. Pick one to continue; you can change it at any time.
      </p>
      <WindingPicker className="mt-5 text-left" />
    </div>
  )
}

export default function App() {
  const { winding } = useMotor()
  const dragging = useFileDrop()

  return (
    <div className="min-h-svh">
      <AppHeader />
      <div className="lg:grid lg:grid-cols-[22rem_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] border-r bg-card/50 lg:block" aria-label="Inputs">
          <InputPanel />
        </aside>

        <main className="min-w-0 space-y-4 p-4 md:p-6">
          {winding ? <><KpiStrip /><Results /></> : <ChooseWinding />}
        </main>
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary p-10 text-center">
            <FileUp className="size-10 text-primary" />
            <div className="font-medium">Drop a JSON, CSV or TXT export to import its inputs</div>
          </div>
        </div>
      )}
    </div>
  )
}
