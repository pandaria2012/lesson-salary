import * as XLSX from 'xlsx'
import type { CourseType, LessonRecord } from '../types'
import { computeHours, parseExcelDate, parseTimeRange } from './time'

const ALIASES: Record<'courseTypeName' | 'rate' | 'student' | 'date' | 'time', string[]> = {
  courseTypeName: ['课程类型', '课程', '科目', '类型'],
  rate: ['课程单价', '单价', '时薪', '价格', '课时费'],
  student: ['学生名称', '学生', '姓名'],
  date: ['上课日期', '日期'],
  time: ['上课时间', '时间', '时间段']
}

export type ColumnKey = 'courseTypeName' | 'rate' | 'student' | 'date' | 'time'

export function detectColumns(headers: string[]): Partial<Record<ColumnKey, number | null>> {
  const map: Partial<Record<ColumnKey, number | null>> = {}
  for (const key of Object.keys(ALIASES) as ColumnKey[]) {
    map[key] = null
  }
  const claimed = new Set<number>()
  headers.forEach((h, i) => {
    const cell = String(h ?? '').trim().replace(/\s/g, '')
    for (const key of Object.keys(ALIASES) as ColumnKey[]) {
      if (map[key] === null && ALIASES[key].some(a => cell === a)) {
        map[key] = i
        claimed.add(i)
      }
    }
  })
  headers.forEach((h, i) => {
    if (claimed.has(i)) return
    const cell = String(h ?? '').trim().replace(/\s/g, '')
    for (const key of Object.keys(ALIASES) as ColumnKey[]) {
      if (map[key] === null && ALIASES[key].some(a => cell.includes(a))) {
        map[key] = i
      }
    }
  })
  return map
}

function parseRate(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/[¥￥元,\s]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export interface ParsedRow {
  rowNumber: number
  courseTypeName: string
  rate: number | null
  student: string
  date: string | null
  startTime: string | null
  endTime: string | null
  hours: number | null
  issues: string[]
  isDuplicate: boolean
  isSample: boolean
  selected: boolean
  isNewCourseType: boolean
  courseTypeId: string | null
}

export function buildPreviewFromRows(
  rows: unknown[][],
  existing: { courseTypes: CourseType[]; records: LessonRecord[] }
): ParsedRow[] {
  const headers = (rows[0] ?? []).map(h => String(h ?? ''))
  const col = detectColumns(headers)
  const out: ParsedRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue
    const get = (key: ColumnKey): unknown => (col[key] === null ? undefined : row[col[key] as number])
    const courseTypeName = String(get('courseTypeName') ?? '').trim()
    const student = String(get('student') ?? '').trim()
    const matched = existing.courseTypes.find(c => c.name === courseTypeName)
    const rate = parseRate(get('rate')) ?? matched?.defaultRate ?? null
    const dateRes = parseExcelDate(get('date'))
    const timeRes = parseTimeRange(get('time'))
    const hours = computeHours(timeRes.startTime, timeRes.endTime) ?? matched?.defaultHours ?? null

    const issues: string[] = []
    if (!courseTypeName) issues.push('缺少课程类型')
    if (!student) issues.push('缺少学生')
    if (!dateRes.ok || !dateRes.date) issues.push(dateRes.message ?? '日期无效')
    if (!timeRes.ok) issues.push(timeRes.message ?? '时间无效')
    if (hours === null) issues.push('无法确定课时')
    if (rate === null) issues.push('缺少时薪')

    const isDuplicate = dateRes.date !== null && existing.records.some(r =>
      r.date === dateRes.date && r.student === student &&
      r.startTime === timeRes.startTime && r.endTime === timeRes.endTime &&
      r.courseTypeName === courseTypeName && r.status === 'normal'
    )
    const isSample = student.startsWith('示例')
    const isNewCourseType = courseTypeName !== '' && !matched

    out.push({
      rowNumber: i + 1,
      courseTypeName,
      rate,
      student,
      date: dateRes.date,
      startTime: timeRes.startTime,
      endTime: timeRes.endTime,
      hours,
      issues,
      isDuplicate,
      isSample,
      isNewCourseType,
      selected: issues.length === 0 && !isDuplicate && !isSample,
      courseTypeId: matched?.id ?? null
    })
  }
  return out
}

export interface ImportPreview {
  fileName: string
  fileHash: string
  sheetName: string
  columnMap: Partial<Record<ColumnKey, number | null>>
  rows: ParsedRow[]
}

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
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer)
  const fileHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return {
    fileName,
    fileHash,
    sheetName,
    columnMap: detectColumns((best[0] ?? []).map(h => String(h ?? ''))),
    rows: buildPreviewFromRows(best, existing)
  }
}