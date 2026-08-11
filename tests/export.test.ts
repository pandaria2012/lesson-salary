import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { createExportAllWorkbook, createImportTemplateWorkbook, createMonthlyWorkbook, parseBackupWorkbook } from '../src/lib/export'
import type { CourseType, LessonRecord } from '../src/types'

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
}

const ct: CourseType = { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: '2026-08-10T00:00:00.000Z' }
const rec: LessonRecord = {
  id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
  rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
  hours: 2, status: 'normal', source: 'import', batchId: null, note: '备注A', createdAt: '2026-08-10T00:00:00.000Z'
}

describe('createImportTemplateWorkbook', () => {
  it('表头 + 4 行示例（覆盖多种兼容格式）', () => {
    const rows = sheetRows(createImportTemplateWorkbook(), '上课记录')
    expect(rows[0]).toEqual(['课程类型', '课程单价', '学生名称', '上课日期', '上课时间'])
    expect(rows.length).toBe(5)
    for (let i = 1; i < rows.length; i++) expect(String(rows[i][2])).toContain('示例')
    expect(rows[1][1]).toBe(200)
    expect(rows[2][1]).toBe('150元/小时')
    expect(rows[3][1]).toBe('¥300')
    expect(rows[4][1]).toBe('')
    expect(rows[2][3]).toBe('2026/8/12')
    expect(rows[3][3]).toBe('08-14')
    expect(rows[2][4]).toBe('13-15')
    expect(rows[3][4]).toBe('18:30~20:30')
  })
})

describe('createExportAllWorkbook / parseBackupWorkbook', () => {
  it('全量导出表头含课时列', () => {
    const rows = sheetRows(createExportAllWorkbook([rec], [ct]), '上课记录')
    expect(rows[0]).toEqual(['课程类型', '课程单价', '学生名称', '上课日期', '上课时间', '课时', '状态', '备注', '创建时间', 'id'])
    expect(rows[1]).toEqual(['1对1', 200, '张三', '2026-08-10', '13:00-15:00', 2, 'normal', '备注A', '2026-08-10T00:00:00.000Z', 'r1'])
  })

  it('导出再解析可还原记录与课程类型', async () => {
    const wb = createExportAllWorkbook([rec], [ct])
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const back = await parseBackupWorkbook(buf)
    expect(back.courseTypes).toHaveLength(1)
    expect(back.records[0]).toMatchObject({ id: 'r1', student: '张三', rate: 200, hours: 2, note: '备注A', status: 'normal' })
  })

  it('解析优先读「课时」列，缺失/无效时回退时间计算', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间', '课时'],
      ['1对1', 200, '李四', '2026-08-11', '', 3],
      ['1对1', 200, '王五', '2026-08-12', '13:00-15:00', 'abc']
    ]), '上课记录')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['名称', '教学形式', '状态', '默认课时', '默认时薪', '创建时间'],
      ['1对1', '一对一', 'enabled', 2, 200, 't']
    ]), '课程类型')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const back = await parseBackupWorkbook(buf)
    expect(back.records[0].hours).toBe(3)
    expect(back.records[1].hours).toBe(2)
  })
})

describe('createMonthlyWorkbook', () => {
  it('含汇总与明细两个 sheet', () => {
    const wb = createMonthlyWorkbook([rec], [{ label: '张三', hours: 2, amount: 400, count: 1 }])
    expect(wb.SheetNames).toEqual(['汇总', '明细'])
    const rows = sheetRows(wb, '汇总')
    expect(rows[0]).toEqual(['分组', '课次', '课时', '金额'])
    expect(rows[1]).toEqual(['张三', 1, 2, 400])
  })
})