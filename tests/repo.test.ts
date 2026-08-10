import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import {
  addBatch, deleteBatch, deleteCourseType, deleteRecord,
  getBatchByHash, getSetting, listCourseTypes, listRecords,
  saveCourseType, saveRecord, setSetting
} from '../src/db/repo'
import type { CourseType, ImportBatch, LessonRecord } from '../src/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

function ct(over: Partial<CourseType> = {}): CourseType {
  return { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: '2026-08-10T00:00:00.000Z', ...over }
}

function rec(over: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
    rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
    hours: 2, status: 'normal', source: 'import', batchId: null, note: '',
    createdAt: '2026-08-10T00:00:00.000Z', ...over
  }
}

describe('repo', () => {
  it('课程类型增删查', async () => {
    await saveCourseType(ct())
    expect((await listCourseTypes()).map(c => c.id)).toEqual(['ct1'])
    await deleteCourseType('ct1')
    expect(await listCourseTypes()).toHaveLength(0)
  })

  it('按月份筛选记录（倒序）', async () => {
    await saveRecord(rec({ id: 'a', date: '2026-08-10' }))
    await saveRecord(rec({ id: 'b', date: '2026-09-01' }))
    await saveRecord(rec({ id: 'c', date: '2026-08-20' }))
    const rows = await listRecords('2026-08')
    expect(rows.map(r => r.id)).toEqual(['c', 'a'])
  })

  it('记录删除', async () => {
    await saveRecord(rec())
    await deleteRecord('r1')
    expect(await listRecords()).toHaveLength(0)
  })

  it('批次按 hash 查找与整批删除', async () => {
    const b: ImportBatch = { id: 'b1', filename: 'a.xlsx', fileHash: 'h1', importedAt: '2026-08-10T00:00:00.000Z', rowCount: 2 }
    await addBatch(b)
    expect((await getBatchByHash('h1'))?.id).toBe('b1')
    await saveRecord(rec({ id: 'x', batchId: 'b1' }))
    expect(await deleteBatch('b1')).toBe(1)
    expect(await getBatchByHash('h1')).toBeUndefined()
    expect(await listRecords()).toHaveLength(0)
  })

  it('设置读写', async () => {
    await setSetting('pin_hash', 'abc123')
    expect(await getSetting<string>('pin_hash')).toBe('abc123')
    expect(await getSetting<string>('missing')).toBeUndefined()
  })
})
