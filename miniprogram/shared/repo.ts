import { normalizeDate } from '../core/index'
import type { CourseType, ImportBatch, LessonRecord } from '../core/index'
import type { Repo } from '../core/index'
import {
  K_BATCHES, K_RECORD_INDEX, K_SETTINGS, K_TYPES, KEY_LIMIT_BYTES,
  estimateBytes, load, monthKey, remove, store, transaction
} from './store'

/**
 * Repo 的小程序实现（wx storage）。
 *
 * 行为必须与 Web 端 Dexie 实现一致，由 tests/repo-contract.test.ts 的同组断言保证。
 *
 * 存储布局（设计 §4.2）：
 *   ls:records:index     → string[]          已存在的月份
 *   ls:records:<YYYY-MM> → LessonRecord[]    按月分片（单 key 1 MB 限制）
 *   ls:courseTypes       → CourseType[]
 *   ls:batches           → ImportBatch[]
 *   ls:settings          → Record<string, unknown>
 */
export function createWxRepo(): Repo {
  const readIndex = (): string[] => load<string[]>(K_RECORD_INDEX, [])

  function writeIndex(months: string[]): void {
    store(K_RECORD_INDEX, [...new Set(months)].sort())
  }

  function readMonth(month: string): LessonRecord[] {
    return load<LessonRecord[]>(monthKey(month), [])
  }

  function writeMonth(month: string, rows: LessonRecord[]): void {
    if (rows.length === 0) {
      remove(monthKey(month))
      writeIndex(readIndex().filter(m => m !== month))
      return
    }
    const size = estimateBytes(rows)
    if (size > KEY_LIMIT_BYTES) {
      throw new Error(
        `本地存储单月数据超过 1 MB 上限（${month}，${(size / 1024).toFixed(0)} KB）。` +
        `请导出备份后清理部分记录。`
      )
    }
    store(monthKey(month), rows)
    const idx = readIndex()
    if (!idx.includes(month)) writeIndex([...idx, month])
  }

  /** 找到某条记录所在月份 */
  function findRecordMonth(id: string): string | null {
    for (const m of readIndex()) {
      if (readMonth(m).some(r => r.id === id)) return m
    }
    return null
  }

  return {
    async listCourseTypes() {
      const rows = load<CourseType[]>(K_TYPES, [])
      // 与 Dexie orderBy('name') 一致：code unit 序
      return [...rows].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    },

    async saveCourseType(ct) {
      const rows = load<CourseType[]>(K_TYPES, [])
      const i = rows.findIndex(c => c.id === ct.id)
      if (i === -1) rows.push(ct)
      else rows[i] = ct
      store(K_TYPES, rows)
    },

    async deleteCourseType(id) {
      store(K_TYPES, load<CourseType[]>(K_TYPES, []).filter(c => c.id !== id))
    },

    async listRecords(month?) {
      const months = month ? [month] : readIndex()
      const rows: LessonRecord[] = []
      for (const m of months) rows.push(...readMonth(m))
      // 与 Dexie orderBy('date').reverse() 一致：日期倒序
      return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    },

    async saveRecord(r) {
      // 存储层守门：月份分片依赖 date 严格为 YYYY-MM-DD。
      // 若直接 slice(0,7)，'2026/8/12' 会生成 'ls:records:2026/8/' 畸形分片，
      // 记录能存进去但不会出现在任何月份的汇总里 —— 静默丢数据。
      // 因此在此强制规范化；无法识别则明确报错，不写坏分片。
      const date = normalizeDate(r.date)
      if (!date) {
        throw new Error(`记录日期无法识别（${r.date || '空'}），请检查日期格式`)
      }
      const normalized: LessonRecord = date === r.date ? r : { ...r, date }
      const month = date.slice(0, 7)

      // 记录可能已存在于**另一个月份分片**（改了日期，或日期写法不同导致落到别的片）。
      // 必须按 id 反查其当前所在分片并移除，否则会留下重复副本。
      const oldMonth = findRecordMonth(r.id)
      if (oldMonth && oldMonth !== month) {
        writeMonth(oldMonth, readMonth(oldMonth).filter(x => x.id !== r.id))
      }

      const rows = readMonth(month)
      const i = rows.findIndex(x => x.id === r.id)
      if (i === -1) rows.push(normalized)
      else rows[i] = normalized
      writeMonth(month, rows)
    },

    async deleteRecord(id) {
      const month = findRecordMonth(id)
      if (!month) return
      writeMonth(month, readMonth(month).filter(r => r.id !== id))
    },

    async addBatch(b) {
      const rows = load<ImportBatch[]>(K_BATCHES, [])
      const i = rows.findIndex(x => x.id === b.id)
      if (i === -1) rows.push(b)
      else rows[i] = b
      store(K_BATCHES, rows)
    },

    async getBatchByHash(hash) {
      return load<ImportBatch[]>(K_BATCHES, []).find(b => b.fileHash === hash)
    },

    async deleteBatch(batchId) {
      let removed = 0
      for (const m of readIndex()) {
        const rows = readMonth(m)
        const kept = rows.filter(r => r.batchId !== batchId)
        if (kept.length !== rows.length) {
          removed += rows.length - kept.length
          writeMonth(m, kept)
        }
      }
      store(K_BATCHES, load<ImportBatch[]>(K_BATCHES, []).filter(b => b.id !== batchId))
      return removed
    },

    async getSetting<T>(key: string) {
      const all = load<Record<string, unknown>>(K_SETTINGS, {})
      return all[key] as T | undefined
    },

    async setSetting(key, value) {
      const all = load<Record<string, unknown>>(K_SETTINGS, {})
      all[key] = value
      store(K_SETTINGS, all)
    },

    async listStudentNames() {
      const names = new Set<string>()
      for (const m of readIndex()) {
        for (const r of readMonth(m)) {
          const n = (r.student || '').trim()
          if (n) names.add(n)
        }
      }
      // 与 Web 端一致：中文按拼音排序
      return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    },

    async clearAll() {
      for (const m of readIndex()) remove(monthKey(m))
      remove(K_RECORD_INDEX)
      remove(K_TYPES)
      remove(K_BATCHES)
      remove(K_SETTINGS)
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      return transaction(fn)
    }
  }
}
