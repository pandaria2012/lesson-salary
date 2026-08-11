function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

function isValidDate(y: number, mo: number, d: number): boolean {
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
}

export function parseExcelDate(value: unknown, now = new Date()): { date: string | null; ok: boolean; message?: string } {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: toDateStr(value.getFullYear(), value.getMonth() + 1, value.getDate()), ok: true }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel 日期序列号：1899-12-30 起算
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    return { date: toDateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), ok: true }
  }
  if (typeof value !== 'string') return { date: null, ok: false, message: '日期格式无法识别' }
  const s = value.trim()
  let m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/)
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || !isValidDate(y, mo, d)) return { date: null, ok: false, message: '日期数值越界' }
    return { date: toDateStr(y, mo, d), ok: true }
  }
  m = s.match(/^(\d{1,2})[-/.月](\d{1,2})日?$/)
  if (m) {
    const y = now.getFullYear(), mo = Number(m[1]), d = Number(m[2])
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || !isValidDate(y, mo, d)) return { date: null, ok: false, message: '日期数值越界' }
    return { date: toDateStr(y, mo, d), ok: true }
  }
  return { date: null, ok: false, message: '日期格式无法识别' }
}

function normTime(token: string): string | null {
  const m = token.trim().match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = Number(m[1]), min = m[2] ? Number(m[2]) : 0
  if (h > 23 || min > 59) return null
  return `${pad2(h)}:${pad2(min)}`
}

export function parseTimeRange(value: unknown): { startTime: string | null; endTime: string | null; ok: boolean; message?: string } {
  if (value === null || value === undefined || value === '') {
    return { startTime: null, endTime: null, ok: true }
  }
  if (typeof value !== 'string') return { startTime: null, endTime: null, ok: false, message: '时间格式无法识别' }
  let s = value.trim().replace(/[～~—–至到]/g, '-')
  s = s.replace(/\s+/g, '')
  if (!s) return { startTime: null, endTime: null, ok: true }
  const parts = s.split('-').filter(Boolean)
  if (parts.length === 1) {
    const st = normTime(parts[0])
    if (!st) return { startTime: null, endTime: null, ok: false, message: '时间格式无法识别' }
    return { startTime: st, endTime: null, ok: true }
  }
  if (parts.length === 2) {
    const st = normTime(parts[0]), et = normTime(parts[1])
    if (!st || !et) return { startTime: null, endTime: null, ok: false, message: '时间格式无法识别' }
    return { startTime: st, endTime: et, ok: true }
  }
  return { startTime: null, endTime: null, ok: false, message: '时间段格式无法识别' }
}

export function computeHours(startTime: string | null, endTime: string | null): number | null {
  if (!startTime || !endTime) return null
  const sm = startTime.match(/^(\d{2}):(\d{2})$/)
  const em = endTime.match(/^(\d{2}):(\d{2})$/)
  if (!sm || !em) return null
  const sh = Number(sm[1]), smin = Number(sm[2])
  const eh = Number(em[1]), emin = Number(em[2])
  if (sh > 23 || smin > 59 || eh > 23 || emin > 59) return null
  let s = sh * 60 + smin
  let e = eh * 60 + emin
  if (e < s) e += 24 * 60
  const h = (e - s) / 60
  return Math.round(h * 100) / 100
}

export function addMinutes(time: string, minutes: number): string | null {
  const m = time.match(/^(\d{2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return null
  const total = (h * 60 + min + Math.round(minutes)) % (24 * 60)
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}

/** 当前时间向后取最近的半点（用于时长快捷按钮的默认开始时间）：整点顺延半点，半点保持，其余向上取半点 */
export function nextHalfHour(now = new Date()): string {
  const total = now.getHours() * 60 + now.getMinutes()
  const rounded = (total % 60 === 0 ? total + 30 : Math.ceil(total / 30) * 30) % (24 * 60)
  return `${pad2(Math.floor(rounded / 60))}:${pad2(rounded % 60)}`
}