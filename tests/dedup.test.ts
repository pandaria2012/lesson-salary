import { describe, expect, it } from 'vitest'
import { duplicateKey, findDuplicateRecord } from '../src/lib/dedup'
import type { LessonRecord } from '../src/types'

function rec(over: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: 'r1', courseTypeId: 'ct1', courseTypeName: '数学1对1', courseTypeKind: '一对一',
    rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
    hours: 2, status: 'normal', source: 'manual', batchId: null, note: '',
    createdAt: '2026-08-10T00:00:00.000Z', ...over
  }
}

describe('dedup', () => {
  it('相同课程/学生/日期/时间段判定为重复', () => {
    const rows = [rec()]
    expect(findDuplicateRecord(rec(), rows)).toBeDefined()
    expect(findDuplicateRecord(rec({ student: '李四' }), rows)).toBeUndefined()
    expect(findDuplicateRecord(rec({ date: '2026-08-11' }), rows)).toBeUndefined()
    expect(findDuplicateRecord(rec({ startTime: '14:00' }), rows)).toBeUndefined()
    expect(findDuplicateRecord(rec({ courseTypeName: '英语' }), rows)).toBeUndefined()
  })

  it('编辑时排除自己', () => {
    const rows = [rec({ id: 'r1' })]
    expect(findDuplicateRecord(rec({ id: 'r1' }), rows, 'r1')).toBeUndefined()
  })

  it('空时间段按相同键处理', () => {
    const rows = [rec({ startTime: null, endTime: null })]
    expect(findDuplicateRecord(rec({ startTime: null, endTime: null }), rows)).toBeDefined()
    expect(findDuplicateRecord(rec({ startTime: '13:00', endTime: null }), rows)).toBeUndefined()
  })

  it('duplicateKey 稳定格式', () => {
    expect(duplicateKey(rec())).toBe('数学1对1|张三|2026-08-10|13:00|15:00')
  })
})