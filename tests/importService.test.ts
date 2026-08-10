import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { getBatchByHash, listCourseTypes, listRecords } from '../src/db/repo'
import { applyImport } from '../src/lib/importService'
import type { ImportPreview } from '../src/lib/parser'

beforeEach(async () => { await db.delete(); await db.open() })

const preview: ImportPreview = {
  fileName: '课程表.xlsx',
  fileHash: 'abc123',
  sheetName: 'Sheet1',
  columnMap: { courseTypeName: 0, rate: 1, student: 2, date: 3, time: 4 },
  rows: [
    {
      rowNumber: 2, courseTypeName: '1对1', rate: 200, student: '张三',
      date: '2026-08-11', startTime: '13:00', endTime: '15:00', hours: 2,
      issues: [], isDuplicate: false, isSample: false, selected: true,
      isNewCourseType: true, courseTypeId: null
    },
    {
      rowNumber: 3, courseTypeName: '1对1', rate: 200, student: '示例学生',
      date: '2026-08-12', startTime: '13:00', endTime: '15:00', hours: 2,
      issues: [], isDuplicate: false, isSample: true, selected: false,
      isNewCourseType: false, courseTypeId: null
    }
  ]
}

describe('applyImport', () => {
  it('只导入勾选行，自动创建课程类型与批次', async () => {
    const { batchId, inserted } = await applyImport(preview)
    expect(inserted).toBe(1)
    expect(batchId).toBeTruthy()
    expect((await getBatchByHash('abc123'))?.rowCount).toBe(1)
    const types = await listCourseTypes()
    expect(types).toHaveLength(1)
    expect(types[0]).toMatchObject({ name: '1对1', defaultHours: 2, defaultRate: 200 })
    const recs = await listRecords('2026-08')
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({ student: '张三', status: 'normal', source: 'import', batchId })
  })
})
