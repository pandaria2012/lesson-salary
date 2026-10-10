import type { Repo } from '../repo'
import type { ImportPreview } from '../parser'

/** 预览确认后写库（含新建课程类型与批次记录）。 */
export async function applyImport(
  preview: ImportPreview,
  repo: Repo
): Promise<{ batchId: string; inserted: number }> {
  const existingTypes = await repo.listCourseTypes()
  const batchId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const inserted = preview.rows.filter(r => r.selected).length

  await repo.transaction(async () => {
    for (const row of preview.rows) {
      if (!row.selected) continue
      if (row.isNewCourseType && row.courseTypeName) {
        const found = existingTypes.find(t => t.name === row.courseTypeName)
        if (!found) {
          const ct = {
            id: `ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: row.courseTypeName,
            type: '',
            status: 'enabled' as const,
            defaultHours: row.hours,
            defaultRate: row.rate,
            createdAt: new Date().toISOString()
          }
          await repo.saveCourseType(ct)
          existingTypes.push(ct)
        }
      }
      const ct = existingTypes.find(t => t.name === row.courseTypeName)
      await repo.saveRecord({
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${row.rowNumber}`,
        courseTypeId: ct?.id ?? null,
        courseTypeName: row.courseTypeName,
        courseTypeKind: ct?.type ?? '',
        rate: row.rate,
        student: row.student,
        date: row.date ?? '',
        startTime: row.startTime,
        endTime: row.endTime,
        hours: row.hours,
        status: 'normal',
        source: 'import',
        batchId,
        note: '',
        createdAt: new Date().toISOString()
      })
    }

    await repo.addBatch({
      id: batchId,
      filename: preview.fileName,
      fileHash: preview.fileHash,
      importedAt: new Date().toISOString(),
      rowCount: inserted
    })
  })

  return { batchId, inserted }
}
