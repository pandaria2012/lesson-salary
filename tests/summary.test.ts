import { describe, expect, it } from 'vitest'
import { summarize } from '../src/lib/summary'
import type { LessonRecord } from '../src/types'

function rec(over: Partial<LessonRecord>): LessonRecord {
  return {
    id: 'r', courseTypeId: 'ct', courseTypeName: '1对1', courseTypeKind: '一对一',
    rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
    hours: 2, status: 'normal', source: 'manual', batchId: null, note: '', createdAt: 't', ...over
  }
}

describe('summarize', () => {
  const rows = [
    rec({ id: 'a', student: '张三', rate: 200, hours: 2, courseTypeName: '1对1', courseTypeKind: '一对一' }),
    rec({ id: 'b', student: '张三', rate: 200, hours: 1, courseTypeName: '1对1', courseTypeKind: '一对一' }),
    rec({ id: 'c', student: '李四', rate: 150, hours: 2, courseTypeName: '小班英语', courseTypeKind: '小班' }),
    rec({ id: 'd', student: '张三', rate: 200, hours: 2, status: 'cancelled' })
  ]
  it('总收入=正常记录合计，取消课单列', () => {
    const s = summarize(rows)
    expect(s.totalAmount).toBe(200 * 2 + 200 * 1 + 150 * 2)
    expect(s.totalHours).toBe(5)
    expect(s.totalCount).toBe(3)
    expect(s.cancelledCount).toBe(1)
    expect(s.cancelledAmount).toBe(400)
  })
  it('按学生/课程类型/教学形式分组', () => {
    const s = summarize(rows)
    expect(s.byStudent.find(g => g.label === '张三')?.amount).toBe(600)
    expect(s.byStudent.find(g => g.label === '李四')?.amount).toBe(300)
    expect(s.byCourseType.find(g => g.label === '小班英语')?.count).toBe(1)
    expect(s.byKind.find(g => g.label === '小班')?.amount).toBe(300)
  })
  it('空列表返回全零', () => {
    const s = summarize([])
    expect(s.totalAmount).toBe(0)
    expect(s.byStudent).toEqual([])
  })
})
