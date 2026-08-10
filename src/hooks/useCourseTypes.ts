import { useCallback, useEffect, useState } from 'react'
import { deleteCourseType, listCourseTypes, saveCourseType } from '../db/repo'
import type { CourseType } from '../types'

export function useCourseTypes() {
  const [items, setItems] = useState<CourseType[]>([])

  const reload = useCallback(async () => {
    setItems(await listCourseTypes())
  }, [])

  useEffect(() => { void reload() }, [reload])

  const save = useCallback(async (ct: CourseType) => {
    await saveCourseType(ct)
    await reload()
  }, [reload])

  const remove = useCallback(async (id: string) => {
    await deleteCourseType(id)
    await reload()
  }, [reload])

  return { items, reload, save, remove }
}