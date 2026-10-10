import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/web/db/db'
import { createDexieRepo } from '../src/web/db/repo'
import { createMemoryRepo } from '../src/core/memoryRepo'
import type { Repo } from '../src/core/repo'
import type { CourseType, ImportBatch, LessonRecord } from '../src/core/types'

function ct(over: Partial<CourseType> = {}): CourseType {
  return {
    id: 'ct1', name: '1对1', type: '一对一', status: 'enabled',
    defaultHours: 2, defaultRate: 200, createdAt: 'T', ...over
  }
}

function rec(over: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
    rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
    hours: 2, status: 'normal', source: 'import', batchId: null, note: '', createdAt: 'T', ...over
  }
}

function batch(over: Partial<ImportBatch> = {}): ImportBatch {
  return { id: 'b1', filename: 'a.xlsx', fileHash: 'h1', importedAt: 'T', rowCount: 2, ...over }
}

/**
 * Repo 契约：同一组断言跑遍所有实现，保证 Web 与小程序口径一致。
 * 新增实现时必须在这里挂上，否则契约形同虚设。
 */
export function describeRepoContract(name: string, make: () => Promise<Repo> | Repo) {
  describe(`Repo 契约: ${name}`, () => {
    let r: Repo
    beforeEach(async () => { r = await make() })

    it('课程类型增删查', async () => {
      await r.saveCourseType(ct({ id: 'ct1', name: '甲' }))
      await r.saveCourseType(ct({ id: 'ct2', name: '乙' }))
      expect((await r.listCourseTypes()).map(c => c.id).sort()).toEqual(['ct1', 'ct2'])
      await r.deleteCourseType('ct1')
      expect((await r.listCourseTypes()).map(c => c.id)).toEqual(['ct2'])
    })

    it('课程类型按名称 code unit 序排列（与 IndexedDB 键序一致）', async () => {
      // 用 ASCII 名称，避免中文拼音序与 code unit 序的歧义
      await r.saveCourseType(ct({ id: 'b', name: 'Banana' }))
      await r.saveCourseType(ct({ id: 'a', name: 'Apple' }))
      await r.saveCourseType(ct({ id: 'c', name: 'Cherry' }))
      expect((await r.listCourseTypes()).map(c => c.name)).toEqual(['Apple', 'Banana', 'Cherry'])
    })

    it('listRecords 按日期倒序', async () => {
      await r.saveRecord(rec({ id: 'a', date: '2026-08-10' }))
      await r.saveRecord(rec({ id: 'b', date: '2026-09-01' }))
      await r.saveRecord(rec({ id: 'c', date: '2026-08-20' }))
      expect((await r.listRecords()).map(x => x.id)).toEqual(['b', 'c', 'a'])
    })

    it('listRecords(month) 只返回该月', async () => {
      await r.saveRecord(rec({ id: 'a', date: '2026-08-10' }))
      await r.saveRecord(rec({ id: 'b', date: '2026-09-01' }))
      expect((await r.listRecords('2026-08')).map(x => x.id)).toEqual(['a'])
    })

    it('saveRecord 同 id 覆盖而非新增', async () => {
      await r.saveRecord(rec({ id: 'a', student: '张三' }))
      await r.saveRecord(rec({ id: 'a', student: '李四' }))
      const rows = await r.listRecords()
      expect(rows).toHaveLength(1)
      expect(rows[0].student).toBe('李四')
    })

    it('deleteRecord 删除单条', async () => {
      await r.saveRecord(rec({ id: 'a' }))
      await r.deleteRecord('a')
      expect(await r.listRecords()).toHaveLength(0)
    })

    it('批次按 hash 查找与整批级联删除', async () => {
      await r.addBatch(batch({ id: 'b1', fileHash: 'h1' }))
      expect((await r.getBatchByHash('h1'))?.id).toBe('b1')
      await r.saveRecord(rec({ id: 'x', batchId: 'b1' }))
      await r.saveRecord(rec({ id: 'y', batchId: null }))
      expect(await r.deleteBatch('b1')).toBe(1)
      expect(await r.getBatchByHash('h1')).toBeUndefined()
      expect((await r.listRecords()).map(x => x.id)).toEqual(['y'])
    })

    it('设置读写与缺省返回 undefined', async () => {
      await r.setSetting('k', 'v')
      expect(await r.getSetting<string>('k')).toBe('v')
      expect(await r.getSetting<string>('缺失')).toBeUndefined()
    })

    it('listStudentNames 去重、去空白、按拼音排序', async () => {
      await r.saveRecord(rec({ id: 'a', student: '张三' }))
      await r.saveRecord(rec({ id: 'b', student: '李四' }))
      await r.saveRecord(rec({ id: 'c', student: '张三' }))
      await r.saveRecord(rec({ id: 'd', student: '  ' }))
      expect(await r.listStudentNames()).toEqual(['李四', '张三'])
    })

    it('clearAll 清空全部数据', async () => {
      await r.saveCourseType(ct())
      await r.saveRecord(rec())
      await r.addBatch(batch())
      await r.setSetting('k', 'v')
      await r.clearAll()
      expect(await r.listCourseTypes()).toHaveLength(0)
      expect(await r.listRecords()).toHaveLength(0)
      expect(await r.getBatchByHash('h1')).toBeUndefined()
      expect(await r.getSetting<string>('k')).toBeUndefined()
    })

    it('transaction 成功提交', async () => {
      await r.transaction(async () => {
        await r.saveRecord(rec({ id: 'a' }))
        await r.saveCourseType(ct())
      })
      expect(await r.listRecords()).toHaveLength(1)
      expect(await r.listCourseTypes()).toHaveLength(1)
    })

    it('transaction 失败回滚，不落半成品', async () => {
      await r.saveRecord(rec({ id: 'keep' }))
      await expect(
        r.transaction(async () => {
          await r.saveRecord(rec({ id: 'gone' }))
          throw new Error('boom')
        })
      ).rejects.toThrow('boom')
      expect((await r.listRecords()).map(x => x.id)).toEqual(['keep'])
    })
  })
}

describeRepoContract('memoryRepo', () => createMemoryRepo())

describeRepoContract('dexieRepo', async () => {
  await db.delete()
  await db.open()
  return createDexieRepo()
})
