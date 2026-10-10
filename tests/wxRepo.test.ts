import { beforeEach, describe, expect, it, vi } from 'vitest'
import { describeRepoContract } from './helpers/repoContract'
import { createWxRepo } from '../miniprogram/shared/repo'
import { applyImport } from '../src/core/services/importService'
import type { ImportPreview } from '../src/core/parser'
import type { LessonRecord } from '../src/core/types'

/**
 * 用 wx storage 模拟验证小程序 Repo。
 *
 * 小程序端无法直接跑 Vitest（设计 §10.3），但 Repo 是"业务逻辑下沉"的边界：
 * 把它接到契约测试上，就能用同一组断言覆盖 Web 与小程序两端的数据层 ——
 * 这是把"无法自动化测试"的影响面最小化的关键一环。
 */

const storage = new Map<string, string>()
let simulateWriteFailure = false

function installWxShim() {
  storage.clear()
  simulateWriteFailure = false
  const wx = {
    getStorageSync: vi.fn((key: string) => (storage.has(key) ? JSON.parse(storage.get(key) as string) : '')),
    setStorageSync: vi.fn((key: string, value: unknown) => {
      if (simulateWriteFailure) throw new Error('quota exceeded')
      storage.set(key, JSON.stringify(value))
    }),
    removeStorageSync: vi.fn((key: string) => { storage.delete(key) }),
    getStorageInfoSync: vi.fn(() => {
      let total = 0
      for (const v of storage.values()) total += v.length
      return { keys: [...storage.keys()], currentSize: Math.ceil(total / 1024), limitSize: 10240 }
    })
  }
  ;(globalThis as Record<string, unknown>).wx = wx
  return wx
}

function makeRec(over: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: 'r1', courseTypeId: null, courseTypeName: '1对1', courseTypeKind: '',
    rate: 200, student: '张三', date: '2026-08-10', startTime: null, endTime: null,
    hours: 2, status: 'normal', source: 'manual', batchId: null, note: '', createdAt: 'T', ...over
  }
}

describe('wx 存储层：分片与容量', () => {
  beforeEach(() => { installWxShim() })

  it('按月分片：写入对应月份 key 并维护索引', async () => {
    const repo = createWxRepo()
    await repo.saveRecord(makeRec({ id: 'r1', date: '2026-08-10' }))
    await repo.saveRecord(makeRec({ id: 'r2', date: '2026-09-02' }))
    expect(storage.has('ls:records:2026-08')).toBe(true)
    expect(storage.has('ls:records:2026-09')).toBe(true)
    expect(JSON.parse(storage.get('ls:records:index') as string)).toEqual(['2026-08', '2026-09'])
  })

  it('单月分片超过 1 MB 时抛出明确错误，而不是静默截断', async () => {
    const repo = createWxRepo()
    // 每条约 4 KB → 约 260 条即触顶。用大记录是为了减少迭代次数：
    // 每次写入都要重新序列化整个分片，小记录会导致 O(n²) 的慢测。
    const big = 'x'.repeat(4000)
    let err: Error | null = null
    for (let i = 0; i < 1000 && !err; i++) {
      try {
        await repo.saveRecord(makeRec({ id: `r${i}`, date: '2026-08-10', note: big }))
      } catch (e) {
        err = e as Error
      }
    }
    expect(err).not.toBeNull()
    expect(err?.message).toContain('1 MB')
  }, 30000)

  it('删除该月最后一条记录后，分片 key 与索引一并清理', async () => {
    const repo = createWxRepo()
    await repo.saveRecord(makeRec({ id: 'r1' }))
    await repo.deleteRecord('r1')
    expect(storage.has('ls:records:2026-08')).toBe(false)
    expect(JSON.parse(storage.get('ls:records:index') as string)).toEqual([])
  })

  it('事务中途失败时不落任何半成品（回滚）', async () => {
    const repo = createWxRepo()
    await repo.saveRecord(makeRec({ id: 'keep', date: '2026-08-01' }))
    await expect(
      repo.transaction(async () => {
        await repo.saveRecord(makeRec({ id: 'gone', date: '2026-08-02' }))
        await repo.saveCourseType({ id: 'ctX', name: '临时', type: '', status: 'enabled', defaultHours: 1, defaultRate: 1, createdAt: 'T' })
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    const rows = await repo.listRecords()
    expect(rows.map(r => r.id)).toEqual(['keep'])
    expect(await repo.listCourseTypes()).toHaveLength(0)
  })

  it('落盘失败时向上抛出，不假装成功', async () => {
    const repo = createWxRepo()
    simulateWriteFailure = true
    await expect(repo.transaction(async () => {
      await repo.saveRecord(makeRec({ id: 'r1' }))
    })).rejects.toThrow(/本地存储写入失败/)
  })
})

describeRepoContract('wxRepo (wx storage 模拟)', () => {
  installWxShim()
  return createWxRepo()
})

/**
 * 端到端：core 的 importService 跑在小程序 Repo 上。
 *
 * 这一层是真正的生产路径（导入页 → applyImport → wx storage）。
 * 契约测试只覆盖 Repo 单方法，这里验证"多方法组合 + 事务"的整体语义，
 * 尤其是导入中途失败时不能留下半批数据。
 */
describe('wxRepo + applyImport 端到端', () => {
  beforeEach(() => { installWxShim() })

  const preview = (over: Partial<ImportPreview> = {}): ImportPreview => ({
    fileName: '课程表.xlsx',
    fileHash: 'hash-1',
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
        rowNumber: 3, courseTypeName: '1对1', rate: 200, student: '李四',
        date: '2026-08-12', startTime: '13:00', endTime: '15:00', hours: 2,
        issues: [], isDuplicate: false, isSample: false, selected: true,
        isNewCourseType: false, courseTypeId: null
      }
    ],
    ...over
  })

  it('导入成功后记录、课程类型、批次全部落盘', async () => {
    const repo = createWxRepo()
    const res = await applyImport(preview(), repo)

    expect(res.inserted).toBe(2)
    const rows = await repo.listRecords('2026-08')
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.student).sort()).toEqual(['张三', '李四'])
    expect(await repo.listCourseTypes()).toHaveLength(1)
    expect((await repo.getBatchByHash('hash-1'))?.rowCount).toBe(2)
  })

  it('月分片正确落库，跨月导入各归其片', async () => {
    const repo = createWxRepo()
    await applyImport(preview({
      rows: [
        { rowNumber: 2, courseTypeName: '1对1', rate: 200, student: '张三', date: '2026-08-11', startTime: null, endTime: null, hours: 2, issues: [], isDuplicate: false, isSample: false, selected: true, isNewCourseType: true, courseTypeId: null },
        { rowNumber: 3, courseTypeName: '1对1', rate: 200, student: '李四', date: '2026-09-02', startTime: null, endTime: null, hours: 2, issues: [], isDuplicate: false, isSample: false, selected: true, isNewCourseType: false, courseTypeId: null }
      ]
    }), repo)

    expect(storage.has('ls:records:2026-08')).toBe(true)
    expect(storage.has('ls:records:2026-09')).toBe(true)
    expect(JSON.parse(storage.get('ls:records:index') as string)).toEqual(['2026-08', '2026-09'])
  })

  it('落盘失败时整批回滚，不留半批数据（事务原子性）', async () => {
    const repo = createWxRepo()
    // 先存一条基线数据
    await repo.saveRecord(makeRec({ id: 'base', date: '2026-08-01' }))

    simulateWriteFailure = true
    await expect(applyImport(preview(), repo)).rejects.toThrow()

    // 关键断言：失败后不应出现任何本次导入的痕迹
    simulateWriteFailure = false
    const rows = await repo.listRecords()
    expect(rows.map(r => r.id)).toEqual(['base'])
    expect(await repo.listCourseTypes()).toHaveLength(0)
    expect(await repo.getBatchByHash('hash-1')).toBeUndefined()
  })
})
