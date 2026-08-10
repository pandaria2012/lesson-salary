import 'fake-indexeddb/auto'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { usePin } from '../src/hooks/usePin'

let api: ReturnType<typeof usePin> | null = null

function Probe() {
  api = usePin()
  return null
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  api = null
  renderToString(createElement(Probe))
  if (!api) throw new Error('usePin 未挂载')
})

describe('usePin', () => {
  it('setup 拒绝非 4~6 位数字', async () => {
    for (const bad of ['1', '12', '123', '1234567', 'abc', '12a4']) {
      await expect(api!.setup(bad)).rejects.toThrow('PIN 必须为 4~6 位数字')
    }
  })

  it('change 新 PIN 非法时返回 false 且不改动旧 PIN', async () => {
    await api!.setup('1234')
    expect(await api!.change('1234', '1')).toBe(false)
    expect(await api!.change('1234', '1234567')).toBe(false)
    expect(await api!.unlock('1234')).toBe(true)
  })

  it('disable 删除 pin_salt/pin_hash 设置', async () => {
    await api!.setup('1234')
    expect(await db.settings.get('pin_hash')).toBeDefined()
    expect(await db.settings.get('pin_salt')).toBeDefined()
    expect(await api!.disable('1234')).toBe(true)
    expect(await db.settings.get('pin_hash')).toBeUndefined()
    expect(await db.settings.get('pin_salt')).toBeUndefined()
  })
  it('resetAll 清空全部表与 PIN 设置并解锁', async () => {
    await api!.setup('1234')
    await db.records.put({ id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一', rate: 200, student: '张三', date: '2026-08-10', startTime: null, endTime: null, hours: 2, status: 'normal', source: 'manual', batchId: null, note: '', createdAt: 't' })
    await db.courseTypes.put({ id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: null, defaultRate: null, createdAt: 't' })
    await db.batches.put({ id: 'b1', filename: 'a.xlsx', fileHash: 'h', importedAt: 't', rowCount: 1 })
    await api!.resetAll()
    expect(await db.settings.get('pin_hash')).toBeUndefined()
    expect(await db.settings.get('pin_salt')).toBeUndefined()
    expect(await db.records.count()).toBe(0)
    expect(await db.courseTypes.count()).toBe(0)
    expect(await db.batches.count()).toBe(0)
    expect(api!.enabled).toBe(false)
    expect(api!.locked).toBe(false)
    expect(await api!.unlock('1234')).toBe(false)
  })
})
