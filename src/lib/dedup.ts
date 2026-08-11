import type { LessonRecord } from '../types'

/** 唯一键：课程类型 + 学生 + 日期 + 开始时间 + 结束时间 */
export function duplicateKey(r: Pick<LessonRecord, 'courseTypeName' | 'student' | 'date' | 'startTime' | 'endTime'>): string {
  return [r.courseTypeName, r.student, r.date, r.startTime ?? '', r.endTime ?? ''].join('|')
}

/** 查找相同记录（可排除自己，用于编辑场景） */
export function findDuplicateRecord(
  candidate: Pick<LessonRecord, 'courseTypeName' | 'student' | 'date' | 'startTime' | 'endTime'>,
  records: LessonRecord[],
  excludeId?: string
): LessonRecord | undefined {
  const key = duplicateKey(candidate)
  return records.find(r => r.id !== excludeId && duplicateKey(r) === key)
}