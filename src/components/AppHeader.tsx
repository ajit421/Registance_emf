/* Top bar: brand, import/export menus, reset, theme and the mobile inputs drawer. */
import { useRef, useState } from 'react'
import { ClipboardPaste, Download, FileJson, FileSpreadsheet, FileText, FileUp, Link, Monitor, Moon, RotateCcw, SlidersHorizontal, Sun, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { AdvancedSheet } from '@/components/inputs/AdvancedSheet'
import { InputPanel } from '@/components/inputs/InputPanel'
import { useMotor } from '@/hooks/useMotor'
import { useApplyImport, useImportFile } from '@/hooks/useImport'
import { encodeLink, inputsObject, reportExport, shareDiff, toCSV } from '@/lib/motor/io'
import { defaults } from '@/lib/motor/schema'
import { copyText, download } from '@/lib/download'
import { useMotorStore } from '@/store/motor'
import { useThemeStore, type Theme } from '@/store/theme'

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="hidden size-8 shrink-0 text-primary sm:block" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
    </svg>
  )
}

function PasteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const apply = useApplyImport()
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (o) { setText(''); setErr(null) } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste inputs</DialogTitle>
          <DialogDescription>Paste a shareable link, JSON, CSV or a TXT report exported from this app.</DialogDescription>
        </DialogHeader>
        <Textarea value={text} onChange={e => { setText(e.target.value); setErr(null) }} rows={9} className="max-h-[50svh] min-h-40 font-mono text-xs break-all" autoFocus />
        {err && <p className="text-sm text-bad">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { try { apply(text); onOpenChange(false) } catch (e) { setErr((e as Error).message) } }}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AppHeader() {
  const { params, winding, R } = useMotor()
  const replaceAll = useMotorStore(s => s.replaceAll)
  const { theme, setTheme } = useThemeStore()
  const importFile = useImportFile()
  const fileRef = useRef<HTMLInputElement>(null)
  const [paste, setPaste] = useState(false)

  const shareLink = () => copyText(`${location.href.split('#')[0]}#p=${encodeLink(shareDiff(params, winding))}`, 'Link with current inputs copied')
  const resetAll = () => {
    const prev = params
    replaceAll(defaults(winding))
    toast('All inputs reset to defaults', { action: { label: 'Undo', onClick: () => replaceAll(prev) } })
  }
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden" aria-label="Show inputs"><SlidersHorizontal /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[92vw] max-w-sm gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Inputs</SheetTitle>
            <SheetDescription className="sr-only">Motor specification, winding configuration and stator inputs</SheetDescription>
          </SheetHeader>
          <InputPanel />
        </SheetContent>
      </Sheet>

      <Logo />
      <div className="min-w-0">
        <h1 className="truncate text-sm leading-tight font-semibold">PCB Motor Designer</h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">Axial-flux PCB stator: winding, losses and efficiency</p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        <input ref={fileRef} type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" hidden
          onChange={e => { importFile(e.target.files?.[0]); e.target.value = '' }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm"><Upload /><span className="hidden sm:inline">Import</span></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            <DropdownMenuItem onSelect={() => fileRef.current?.click()}><FileUp />From file (JSON, CSV or TXT)…</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPaste(true)}><ClipboardPaste />Paste text or link…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm"><Download /><span className="hidden sm:inline">Export</span></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            <DropdownMenuItem onSelect={() => download('pcb_motor_results.csv', toCSV(params, winding, R), 'text/csv')}><FileSpreadsheet />Results as CSV</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download('pcb_motor_inputs.json', JSON.stringify(inputsObject(params, winding), null, 2), 'application/json')}><FileJson />Inputs as JSON</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download('pcb_motor_report.txt', reportExport(inputsObject(params, winding), R), 'text/plain')}><FileText />Report as TXT</DropdownMenuItem>
            <DropdownMenuItem onSelect={shareLink}><Link />Copy shareable link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AdvancedSheet />

        <Button variant="ghost" size="sm" onClick={resetAll} title="Reset all inputs"><RotateCcw /><span className="hidden md:inline">Reset</span></Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme"><ThemeIcon /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            <DropdownMenuRadioGroup value={theme} onValueChange={v => setTheme(v as Theme)}>
              <DropdownMenuRadioItem value="light"><Sun />Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark"><Moon />Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system"><Monitor />System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <PasteDialog open={paste} onOpenChange={setPaste} />
    </header>
  )
}
