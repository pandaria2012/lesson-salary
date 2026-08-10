import { useCallback, useEffect, useState } from 'react'
import { deleteRecord, listRecords, saveRecord } from '../db/repo'
import type { LessonRecord } from '../types'

export function useRecords(month: string) {
  const [items, setItems] = useState<LessonRecord[]>([])
  const reload = useCallback(async () => {
    setItems(await listRecords(month))
  }, [month])
  useEffect(() => { void reload() }, [reload])
  const save = useCallback(async (r: LessonRecord) => { await saveRecord(r); await reload() }, [reload])
  const remove = useCallback(async (id: string) => { await deleteRecord(id); await reload() }, [reload])
  return { items, reload, save, remove }
}
