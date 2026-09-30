import { useEffect, useState } from 'react'
import { FileUp } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { InputPanel } from '@/components/inputs/InputPanel'
import { KpiStrip } from '@/components/KpiStrip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverviewTab } from '@/features/OverviewTab'
import { EddyTab, EmfTab, LoadingTab } from '@/features/PhysicsTabs'
import { ReportTab } from '@/features/ReportTab'
import { SweepTab } from '@/features/SweepTab'
import { TABS, isTabId, type TabId } from '@/features/tabs'
import { WindingTab } from '@/features/WindingTab'
import { useFileDrop } from '@/hooks/useImport'
import { useMotor } from '@/hooks/useMotor'
import { designErrors } from '@/lib/motor/checks'

function initialTab(): TabId {
  const t = new URLSearchParams(location.search).get('tab')
  return isTabId(t) ? t : 'overview'
}

export default function App() {
  const { R } = useMotor()
  const [tab, setTab] = useState<TabId>(initialTab)
  const dragging = useFileDrop()

  useEffect(() => {
    const url = new URL(location.href)
    if (tab === 'overview') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    history.replaceState(null, '', url)
  }, [tab])

  // red dots on tabs that need attention
  const alert: Partial<Record<TabId, boolean>> = {
    overview: designErrors(R).some(c => c.level === 'bad'),
    winding: R.warnings.length > 0,
    loading: !R.el.enough,
  }

  return (
    <div className="min-h-svh">
      <AppHeader />
      <div className="lg:grid lg:grid-cols-[22rem_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] border-r bg-card/50 lg:block" aria-label="Inputs">
          <InputPanel />
        </aside>

        <main className="min-w-0 space-y-4 p-4 md:p-6">
          <KpiStrip />
          <Tabs value={tab} onValueChange={v => isTabId(v) && setTab(v)}>
            <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <TabsList>
                {TABS.map(t => (
                  <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                    {t.label}
                    {alert[t.id] && <span className="size-1.5 rounded-full bg-bad" aria-label="needs attention" />}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="overview"><OverviewTab onNavigate={setTab} /></TabsContent>
            <TabsContent value="winding"><WindingTab /></TabsContent>
            <TabsContent value="eddy"><EddyTab /></TabsContent>
            <TabsContent value="emf"><EmfTab /></TabsContent>
            <TabsContent value="loading"><LoadingTab /></TabsContent>
            <TabsContent value="sweep"><SweepTab /></TabsContent>
            <TabsContent value="report"><ReportTab /></TabsContent>
          </Tabs>
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
