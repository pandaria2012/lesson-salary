import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildPreviewFromRows, detectColumns, parseWorkbook } from '../src/lib/parser'
import type { CourseType, LessonRecord } from '../src/types'

const courseTypes: CourseType[] = [
  { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: 't' }
]

const records: LessonRecord[] = [{
  id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
  rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
  hours: 2, status: 'normal', source: 'import', batchId: null, note: '', createdAt: 't'
}]

describe('detectColumns', () => {
  it('按别名识别且顺序无关', () => {
    const map = detectColumns(['学生名称', '上课时间', '课程单价', '课程类型', '上课日期'])
    expect(map).toEqual({ courseTypeName: 3, rate: 2, student: 0, date: 4, time: 1 })
  })
  it('未知列返回 null', () => {
    const map = detectColumns(['随便', '课程类型'])
    expect(map.courseTypeName).toBe(1)
    expect(map.rate).toBeNull()
  })
})

describe('buildPreviewFromRows', () => {
  const header = ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间']
  it('正常行：小时=区间差、金额字段、已勾选', () => {
    const rows = [header, ['1对1', 200, '张三', '2026-08-11', '13-15']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.hours).toBe(2)
    expect(parsed.rate).toBe(200)
    expect(parsed.isDuplicate).toBe(false)
    expect(parsed.selected).toBe(true)
  })
  it('重复行被标记且不勾选', () => {
    const rows = [header, ['1对1', 200, '张三', '2026-08-10', '13:00-15:00']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.isDuplicate).toBe(true)
    expect(parsed.selected).toBe(false)
  })
  it('示例行默认不勾选', () => {
    const rows = [header, ['1对1', 200, '示例学生', '2026-08-11', '13-15']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.isSample).toBe(true)
    expect(parsed.selected).toBe(false)
  })
  it('未知课程类型标记 isNewCourseType', () => {
    const rows = [header, ['小班英语', 150, '李四', '2026-08-11', '13-15']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.isNewCourseType).toBe(true)
  })
  it('时间缺失时用课程类型默认课时', () => {
    const rows = [header, ['1对1', 200, '张三', '2026-08-11', '']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.hours).toBe(2)
    expect(parsed.startTime).toBeNull()
  })
  it('单价缺失用默认时薪；两者皆无 → issues', () => {
    const rows = [header, ['1对1', '', '张三', '2026-08-11', '13-15']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.rate).toBe(200)
    const rows2 = [header, ['新类型', '', '王五', '2026-08-11', '13-15']]
    const parsed2 = buildPreviewFromRows(rows2, { courseTypes, records })[0]
    expect(parsed2.rate).toBeNull()
    expect(parsed2.issues).toContain('缺少时薪')
    expect(parsed2.selected).toBe(false)
  })
  it('空行忽略、列顺序无关', () => {
    const rows = [
      ['学生名称', '上课时间', '课程单价', '课程类型', '上课日期'],
      ['张三', '13-15', 200, '1对1', '2026-08-11'],
      ['', '', '', '', '']
    ]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })
    expect(parsed).toHaveLength(1)
  })
})

describe('parseWorkbook', () => {
  it('读取真实 xlsx 并返回预览', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间'],
      ['1对1', 200, '张三', '2026-08-11', '13-15']
    ]), '课程表')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const preview = await parseWorkbook(buf, '课程表.xlsx', { courseTypes, records })
    expect(preview.sheetName).toBe('课程表')
    expect(preview.rows).toHaveLength(1)
    expect(preview.fileHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
