import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryRepo } from '../src/core/memoryRepo'
import { restoreBackup } from '../src/core/services/restoreService'
import type { Repo } from '../src/core/repo'
import type { CourseType, LessonRecord } from '../src/core/types'

let repo: Repo
beforeEach(() => { repo = createMemoryRepo() })

const ct: CourseType = { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: 't' }
const rec: LessonRecord = {
  id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
  rate: 200, student: '张三', date: '2026-08-10', startTime: null, endTime: null,
  hours: null, status: 'normal', source: 'import', batchId: null, note: '', createdAt: 't'
}

describe('restoreBackup', () => {
  it('merge：缺课时用默认课时补齐，重复 id 跳过', async () => {
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge', repo)
    const recs = await repo.listRecords()
    expect(recs).toHaveLength(1)
    expect(recs[0].hours).toBe(2)
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge', repo)
    expect(await repo.listRecords()).toHaveLength(1)
  })

  it('overwrite：先清空再导入', async () => {
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge', repo)
    await restoreBackup({ records: [], courseTypes: [] }, 'overwrite', repo)
    expect(await repo.listRecords()).toHaveLength(0)
    expect(await repo.listCourseTypes()).toHaveLength(0)
  })

  it('overwrite 后恢复的数据量正确（clearAll 生效）', async () => {
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge', repo)
    const res = await restoreBackup({ records: [rec], courseTypes: [ct] }, 'overwrite', repo)
    expect(res.records).toBe(1)
    expect(await repo.listRecords()).toHaveLength(1)
  })
})
