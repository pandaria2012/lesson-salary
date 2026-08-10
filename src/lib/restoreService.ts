import { db } from '../db/db'
import type { CourseType, LessonRecord } from '../types'

export async function restoreBackup(
  backup: { records: LessonRecord[]; courseTypes: CourseType[] },
  mode: 'merge' | 'overwrite'
): Promise<{ records: number; courseTypes: number }> {
  return db.transaction('rw', [db.records, db.courseTypes, db.batches], async () => {
    if (mode === 'overwrite') {
      await db.records.clear()
      await db.courseTypes.clear()
      await db.batches.clear()
    }

    let ctCount = 0
    const existingTypes = await db.courseTypes.toArray()
    for (const ct of backup.courseTypes) {
      if (!ct.name) continue
      const found = existingTypes.find(t => t.name === ct.name)
      if (found) {
        if (mode === 'merge') {
          await db.courseTypes.put({ ...found, ...ct, id: found.id, createdAt: found.createdAt })
          existingTypes[existingTypes.indexOf(found)] = { ...found, ...ct, id: found.id, createdAt: found.createdAt }
        }
      } else {
        await db.courseTypes.put(ct)
        existingTypes.push(ct)
        ctCount += 1
      }
    }

    let recCount = 0
    const existingRecs = await db.records.toArray()
    const seenIds = new Set(existingRecs.map(x => x.id))
    for (const r of backup.records) {
      if (mode === 'merge' && seenIds.has(r.id)) continue
      if (mode === 'merge') seenIds.add(r.id)
      if (!r.date || !r.student) continue
      let hours = r.hours
      if (hours === null) {
        const ct = existingTypes.find(t => t.name === r.courseTypeName)
        hours = ct?.defaultHours ?? null
      }
      if (hours === null) continue
      const ct = existingTypes.find(t => t.name === r.courseTypeName)
      const row: LessonRecord = {
        ...r,
        id: mode === 'merge' ? r.id : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        courseTypeId: ct?.id ?? null,
        courseTypeKind: ct?.type ?? '',
        hours,
        status: r.status === 'cancelled' ? 'cancelled' : 'normal',
        source: 'import',
        batchId: null
      }
      await db.records.put(row)
      recCount += 1
    }

    return { records: recCount, courseTypes: ctCount }
  })
}