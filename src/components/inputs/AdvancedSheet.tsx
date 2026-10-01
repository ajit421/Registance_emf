/* Header button + side sheet with rarely changed inputs and the values calculated from other inputs. */
import { RotateCcw, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Kv, KvList } from '@/components/common'
import { NumberField } from '@/components/inputs/NumberField'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useMotor } from '@/hooks/useMotor'
import { SCHEMA, totalLayers, values } from '@/lib/motor/schema'
import { num } from '@/lib/format'
import { useMotorStore } from '@/store/motor'

const ADVANCED = SCHEMA.filter(g => g.advanced)

export function AdvancedSheet() {
  const { params, R } = useMotor()
  const resetSection = useMotorStore(s => s.resetSection)
  const p = values(params)
  const { S, A, ed, emf } = R

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" title="Advanced settings"><Settings2 /><span className="hidden md:inline">Advanced</span></Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[92vw] max-w-md gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Advanced settings</SheetTitle>
          <SheetDescription>Values that rarely change. Edits apply to the results straight away.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {ADVANCED.map(g => (
            <section key={g.id}>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-medium">Hidden inputs</h3>
                <Button variant="ghost" size="xs" onClick={() => { resetSection(g.id); toast('Advanced settings reset to defaults') }}>
                  <RotateCcw />Reset
                </Button>
              </div>
              {g.fields.map(f => <NumberField key={f.key} f={f} value={p[f.key]} R={R} />)}
            </section>
          ))}

          <section>
            <h3 className="mb-1 text-sm font-medium">Calculated automatically</h3>
            <KvList>
              <Kv k="Poles = slots / 3" v={num(S.poles, 2)} />
              <Kv k="Pole pairs = poles / 2" v={num(emf.pp, 2)} />
              <Kv k="Slots per phase = poles / 2" v={num(ed.sides, 2)} />
              <Kv k="End-winding bands (outer, inner) = end winding thickness" v={`${num(A.OR - A.ORS, 2)}, ${num(A.IRS - A.IR, 2)}`} unit="mm" />
              <Kv k="End-winding span = span × coil angle" v={num(A.ew_angle_deg, 3)} unit="°" />
              <Kv k="Conductor length = Rout − Rin" v={num(ed.len, 2)} unit="mm" />
              <Kv k="Parallel paths = layers per stack × parallel stacks" v={num(ed.paths, 0)} />
              <Kv k="Total layers = series × layers per stack × parallel" v={num(totalLayers(R), 0)} />
            </KvList>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
