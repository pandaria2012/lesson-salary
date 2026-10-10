import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryRepo } from '../src/core/memoryRepo'
import { applyImport } from '../src/core/services/importService'
import type { Repo } from '../src/core/repo'
import type { ImportPreview } from '../src/core/parser'

// 注入内存实现：core 层的 service 已脱离 IndexedDB，两端都能跑
let repo: Repo
beforeEach(() => { repo = createMemoryRepo() })

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
    const { batchId, inserted } = await applyImport(preview, repo)
    expect(inserted).toBe(1)
    expect(batchId).toBeTruthy()
    expect((await repo.getBatchByHash('abc123'))?.rowCount).toBe(1)
    const types = await repo.listCourseTypes()
    expect(types).toHaveLength(1)
    expect(types[0]).toMatchObject({ name: '1对1', defaultHours: 2, defaultRate: 200 })
    const recs = await repo.listRecords('2026-08')
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({ student: '张三', status: 'normal', source: 'import', batchId })
  })
})
