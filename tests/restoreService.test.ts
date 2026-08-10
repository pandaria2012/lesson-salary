import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { listCourseTypes, listRecords } from '../src/db/repo'
import { restoreBackup } from '../src/lib/restoreService'
import type { CourseType, LessonRecord } from '../src/types'

beforeEach(async () => { await db.delete(); await db.open() })

const ct: CourseType = { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: 't' }
const rec: LessonRecord = {
  id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
  rate: 200, student: '张三', date: '2026-08-10', startTime: null, endTime: null,
  hours: null, status: 'normal', source: 'import', batchId: null, note: '', createdAt: 't'
}

describe('restoreBackup', () => {
  it('merge：缺课时用默认课时补齐，重复 id 跳过', async () => {
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge')
    const recs = await listRecords()
    expect(recs).toHaveLength(1)
    expect(recs[0].hours).toBe(2)
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge')
    expect(await listRecords()).toHaveLength(1)
  })
  it('overwrite：先清空再导入', async () => {
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge')
    await restoreBackup({ records: [], courseTypes: [] }, 'overwrite')
    expect(await listRecords()).toHaveLength(0)
    expect(await listCourseTypes()).toHaveLength(0)
  })
})