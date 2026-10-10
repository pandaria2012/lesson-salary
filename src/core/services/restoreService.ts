import type { CourseType, LessonRecord } from '../types'
import type { Repo } from '../repo'

/** 从备份恢复数据。mode: 'merge' 按 id 去重追加；'overwrite' 先清空。 */
export async function restoreBackup(
  backup: { records: LessonRecord[]; courseTypes: CourseType[] },
  mode: 'merge' | 'overwrite',
  repo: Repo
): Promise<{ records: number; courseTypes: number }> {
  return repo.transaction(async () => {
    if (mode === 'overwrite') {
      await repo.clearAll()
    }

    let ctCount = 0
    const existingTypes = await repo.listCourseTypes()
    for (const ct of backup.courseTypes) {
      if (!ct.name) continue
      const found = existingTypes.find(t => t.name === ct.name)
      if (found) {
        if (mode === 'merge') {
          const merged = { ...found, ...ct, id: found.id, createdAt: found.createdAt }
          await repo.saveCourseType(merged)
          existingTypes[existingTypes.indexOf(found)] = merged
        }
      } else {
        await repo.saveCourseType(ct)
        existingTypes.push(ct)
        ctCount += 1
      }
    }

    let recCount = 0
    const existingRecs = await repo.listRecords()
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
      await repo.saveRecord(row)
      recCount += 1
    }

    return { records: recCount, courseTypes: ctCount }
  })
}
