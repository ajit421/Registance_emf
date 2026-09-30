/* Importing inputs from text or files, with undo. Also handles drag-and-drop anywhere on the page. */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { parseImport, sanitize } from '@/lib/motor/io'
import { useMotorStore } from '@/store/motor'

export function useApplyImport() {
  return useCallback((raw: string, source?: string) => {
    const res = parseImport(raw)
    const { params: prev, replaceAll } = useMotorStore.getState()
    replaceAll(sanitize(res.obj))
    const what = res.partial ? `${res.n} inputs read from report text (the rest set to defaults)` : `${res.n} inputs imported`
    toast.success(`${res.kind}${source ? ` “${source}”` : ''}: ${what}`, {
      action: { label: 'Undo', onClick: () => replaceAll(prev) },
      duration: 6000,
    })
  }, [])
}

export function useImportFile() {
  const apply = useApplyImport()
  return useCallback((file: File | undefined) => {
    if (!file) return
    if (file.size > 2e6) { toast.error('That file is too large to be an export from this app'); return }
    file.text().then(t => {
      try { apply(t, file.name) } catch (e) { toast.error((e as Error).message) }
    }, () => toast.error('Could not read that file'))
  }, [apply])
}

/** Returns true while files are being dragged over the window. */
export function useFileDrop() {
  const importFile = useImportFile()
  const [over, setOver] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setOver(true) }
    const overH = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault() }
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false) }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault(); depth = 0; setOver(false)
      importFile(e.dataTransfer?.files[0])
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', overH)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', overH)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [importFile])
  return over
}
