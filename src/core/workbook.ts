import * as XLSX from 'xlsx'
import type { CourseType, LessonRecord } from './types'
import { buildPreviewFromRows, detectColumns, type ImportPreview } from './parser'
import { fileHash } from './sha256'
import { fmtDateTime, fmtMoney } from './format'
import { computeHours, parseTimeRange } from './time'

/** 把 Date | string | number 归一化为 Date；非法值返回当前时间 */
function toJsDate(v: Date | string | number): Date {
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

/**
 * 工作簿读写（依赖 SheetJS）。
 *
 * ⚠️ 小程序分包边界：本文件**只能**被 `miniprogram/packageImport/` 引用。
 * 一旦被主包入口（`core/index.ts`）引入，424 KB 的 SheetJS 就会进入主包（上限 2 MB）。
 *
 * 本文件仍是"纯逻辑"（无 window/document/wx），只是依赖较重。
 */

export async function parseWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  existing: { courseTypes: CourseType[]; records: LessonRecord[] }
): Promise<ImportPreview> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  let sheetName = wb.SheetNames[0]
  let best: unknown[][] = []
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
    const headers = (rows[0] ?? []).map(h => String(h ?? '').trim())
    const col = detectColumns(headers)
    const hasHeader = col.courseTypeName !== null || col.student !== null || col.date !== null
    if (hasHeader && rows.length > best.length) {
      best = rows
      sheetName = name
    }
  }
  return {
    fileName,
    fileHash: fileHash(buffer),
    sheetName,
    columnMap: detectColumns((best[0] ?? []).map(h => String(h ?? ''))),
    rows: buildPreviewFromRows(best, existing)
  }
}

/**
 * 把 workbook 序列化为 ArrayBuffer。
 *
 * 存在的意义：两端都需要"得到字节"，但消费方式不同
 * （Web → Blob 下载；小程序 → FileSystemManager.writeFile），
 * 且都不需要接触 XLSX 库本身。故在此收口，避免把 SheetJS 泄到页面层。
 */
export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

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

/** 备份元信息在 workbook 属性中的键名（`!props` 存字符串值） */
export const BACKUP_AT_KEY = '课时备份创建时间'

/**
 * 备份文件的创建时间。
 *
 * 写入方式：workbook 的 `!props`（SheetJS 的文档属性区），
 * 也会落进 xlsx 的 docProps。不占用数据表的列，因此不影响
 * 「上课记录 / 课程类型」两个 sheet 的结构与既有导入逻辑。
 *
 * 格式：'YYYY-MM-DD HH:mm:ss'（本地时区，与界面展示一致）。
 */
export function createExportAllWorkbook(
  records: LessonRecord[],
  courseTypes: CourseType[],
  options: { createdAt?: Date | string | number } = {}
): XLSX.WorkBook {
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

  // 备份创建时间写入文档属性（'YYYY-MM-DD HH:mm:ss'，本地时区）
  const createdAt = fmtDateTime(options.createdAt ?? new Date())
  if (createdAt) {
    wb.Props = {
      ...(wb.Props ?? {}),
      Title: '课时记账备份',
      Subject: `${BACKUP_AT_KEY}: ${createdAt}`,
      CreatedDate: toJsDate(options.createdAt ?? new Date())
    }
  }
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

export interface ParsedBackup {
  records: LessonRecord[]
  courseTypes: CourseType[]
  /** 备份文件的创建时间，'YYYY-MM-DD HH:mm:ss'（本地时区）；读不到时为 null */
  createdAt: string | null
}

/**
 * 读取备份文件的创建时间。
 *
 * 兼容三级来源，任一命中即返回：
 * 1. `Subject` 里的 `课时备份创建时间: ...`（本应用写入的显式标记，最可靠）
 * 2. `Props.CreatedDate`（xlsx 标准文档属性，第三方工具也可能写）
 * 3. 都没有 → null（调用方显示"未知"）
 */
function readBackupCreatedAt(wb: XLSX.WorkBook): string | null {
  const subject = typeof wb.Props?.Subject === 'string' ? wb.Props.Subject : ''
  const m = subject.match(new RegExp(`${BACKUP_AT_KEY}\\s*[:：]\\s*(\\S+ \\S+)`))
  if (m) return m[1]

  const cd = wb.Props?.CreatedDate
  if (cd instanceof Date && !Number.isNaN(cd.getTime())) {
    const s = fmtDateTime(cd)
    return s || null
  }
  return null
}

export async function parseBackupWorkbook(buffer: ArrayBuffer): Promise<ParsedBackup> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const createdAt = readBackupCreatedAt(wb)
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
  return { records, courseTypes, createdAt }
}
