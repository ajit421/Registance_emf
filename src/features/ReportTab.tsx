import { Copy, Download } from 'lucide-react'
import { Panel } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useMotor } from '@/hooks/useMotor'
import { reportExport } from '@/lib/motor/io'
import { reportText } from '@/lib/motor/report'
import { copyText, download } from '@/lib/download'

export function ReportTab() {
  const { params, R } = useMotor()
  const lines = reportText(R).split('\n')
  return (
    <Panel title="Text report" hint="Plain-text summary of every section; the TXT download can be imported back"
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => copyText(reportExport(params, R), 'Report copied')}><Copy />Copy</Button>
          <Button size="sm" variant="outline" onClick={() => download('pcb_motor_report.txt', reportExport(params, R), 'text/plain')}><Download />.txt</Button>
        </div>
      }>
      <pre className="max-h-[70vh] overflow-auto rounded-lg bg-muted/60 p-4 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => {
          if (/^=+/.test(line)) return <div key={i} className="font-semibold text-primary">{line}</div>
          if (/^\*/.test(line)) return <div key={i} className="text-bad">{line}</div>
          const m = line.match(/^(.*?:\s*)(.+)$/)
          return <div key={i}>{m ? <>{m[1]}<span className="text-foreground">{m[2]}</span></> : line || ' '}</div>
        })}
      </pre>
    </Panel>
  )
}
