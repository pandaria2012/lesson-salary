import * as XLSX from 'xlsx'
import type { CourseType, LessonRecord } from '../types'
import { fmtMoney } from './format'
import { computeHours, parseTimeRange } from './time'

export function createImportTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间'],
    ['1对1', 200, '示例学生', '2026-08-10', '13:00-15:00'],
    ['小班英语', '150元/小时', '示例学生', '2026/8/12', '13-15'],
    ['线上英语', '¥300', '示例学生', '08-14', '18:30~20:30'],
    ['暑期集训', '', '示例学生', '2026-08-16', '09:00-10:30']
  ]), '上课记录')
  return wb
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function createExportAllWorkbook(records: LessonRecord[], courseTypes: CourseType[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const recRows = [
    ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间', '课时', '状态', '备注', '创建时间', 'id'],
    ...records.map(r => [r.courseTypeName, r.rate, r.student, r.date, r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '', r.hours, r.status, r.note, r.createdAt, r.id])
  ]
  const typeRows = [
    ['名称', '教学形式', '状态', '默认课时', '默认时薪', '创建时间'],
    ...courseTypes.map(c => [c.name, c.type, c.status, c.defaultHours, c.defaultRate, c.createdAt])
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recRows), '上课记录')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(typeRows), '课程类型')
  return wb
}

export function createMonthlyWorkbook(
  records: LessonRecord[],
  groups: { label: string; hours: number; amount: number; count: number }[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const sumRows = [
    ['分组', '课次', '课时', '金额'],
    ...groups.map(g => [g.label, g.count, g.hours, g.amount])
  ]
  const detailRows = [
    ['日期', '课程类型', '学生', '时间', '时薪', '课时', '金额', '状态'],
    ...records.map(r => [
      r.date, r.courseTypeName, r.student,
      r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '',
      r.rate, r.hours,
      r.rate !== null && r.hours !== null ? Number(fmtMoney(r.rate * r.hours)) : 0,
      r.status === 'normal' ? '正常' : '已取消'
    ])
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), '汇总')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), '明细')
  return wb
}

export async function parseBackupWorkbook(buffer: ArrayBuffer): Promise<{ records: LessonRecord[]; courseTypes: CourseType[] }> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const recRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['上课记录'], { header: 1, defval: '' })
  const typeRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['课程类型'], { header: 1, defval: '' })
  const recHeader = (recRows[0] ?? []).map(h => String(h ?? ''))
  const typeHeader = (typeRows[0] ?? []).map(h => String(h ?? ''))
  const idx = (arr: string[], name: string) => {
    const i = arr.findIndex(h => h === name)
    return i === -1 ? null : i
  }
  const records: LessonRecord[] = []
  for (let i = 1; i < recRows.length; i++) {
    const r = recRows[i]
    if (!r || r.every(c => c === null || c === undefined || String(c).trim() === '')) continue
    const g = (name: string) => {
      const k = idx(recHeader, name)
      return k === null ? undefined : r[k]
    }
    const timeRes = parseTimeRange(g('上课时间'))
    const hoursCell = g('课时')
    const hoursNum = hoursCell === undefined || hoursCell === null || hoursCell === '' ? NaN : Number(hoursCell)
    records.push({
      id: String(g('id') ?? `bk-${i}-${Date.now()}`),
      courseTypeId: null,
      courseTypeName: String(g('课程类型') ?? ''),
      courseTypeKind: '',
      rate: g('课程单价') === undefined || g('课程单价') === '' ? null : Number(g('课程单价')),
      student: String(g('学生名称') ?? ''),
      date: String(g('上课日期') ?? ''),
      startTime: timeRes.startTime,
      endTime: timeRes.endTime,
      hours: Number.isFinite(hoursNum) ? hoursNum : computeHours(timeRes.startTime, timeRes.endTime),
      status: String(g('状态') ?? 'normal') === 'cancelled' ? 'cancelled' : 'normal',
      source: 'import',
      batchId: null,
      note: String(g('备注') ?? ''),
      createdAt: String(g('创建时间') ?? new Date().toISOString())
    })
  }
  const courseTypes: CourseType[] = []
  for (let i = 1; i < typeRows.length; i++) {
    const r = typeRows[i]
    if (!r || r.every(c => c === null || c === undefined || String(c).trim() === '')) continue
    const g = (name: string) => {
      const k = idx(typeHeader, name)
      return k === null ? undefined : r[k]
    }
    courseTypes.push({
      id: `ct-${Date.now()}-${i}`,
      name: String(g('名称') ?? ''),
      type: String(g('教学形式') ?? ''),
      status: String(g('状态') ?? 'enabled') === 'disabled' ? 'disabled' : 'enabled',
      defaultHours: g('默认课时') === undefined || g('默认课时') === '' ? null : Number(g('默认课时')),
      defaultRate: g('默认时薪') === undefined || g('默认时薪') === '' ? null : Number(g('默认时薪')),
      createdAt: String(g('创建时间') ?? new Date().toISOString())
    })
  }
  return { records, courseTypes }
}