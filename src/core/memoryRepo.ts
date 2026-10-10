import type { CourseType, ImportBatch, LessonRecord } from './types'
import { compareName, type Repo } from './repo'

/**
 * Repo 的内存实现。仅供测试使用（不进入小程序主包）。
 *
 * 用途：
 * 1. 作为契约测试的参照实现
 * 2. 让 core 层的 importService / restoreService 脱离 IndexedDB 被 Vitest 覆盖
 */
export function createMemoryRepo(): Repo {
  let courseTypes: CourseType[] = []
  let records: LessonRecord[] = []
  let batches: ImportBatch[] = []
  let settings = new Map<string, unknown>()

  function snapshot() {
    return {
      courseTypes: courseTypes.map(c => ({ ...c })),
      records: records.map(r => ({ ...r })),
      batches: batches.map(b => ({ ...b })),
      settings: new Map(settings)
    }
  }

  function restore(s: ReturnType<typeof snapshot>) {
    courseTypes = s.courseTypes
    records = s.records
    batches = s.batches
    settings = s.settings
  }

  const repo: Repo = {
    async listCourseTypes() {
      // 与 Dexie orderBy('name') 一致：code unit 序，非拼音序
      return [...courseTypes].sort((a, b) => compareName(a.name, b.name))
    },

    async saveCourseType(ct) {
      const i = courseTypes.findIndex(c => c.id === ct.id)
      if (i === -1) courseTypes.push({ ...ct })
      else courseTypes[i] = { ...ct }
    },

    async deleteCourseType(id) {
      courseTypes = courseTypes.filter(c => c.id !== id)
    },

    async listRecords(month) {
      const rows = month ? records.filter(r => r.date.startsWith(month)) : records
      return [...rows].sort((a, b) => compareName(b.date, a.date))
    },

    async saveRecord(r) {
      const i = records.findIndex(x => x.id === r.id)
      if (i === -1) records.push({ ...r })
      else records[i] = { ...r }
    },

    async deleteRecord(id) {
      records = records.filter(r => r.id !== id)
    },

    async addBatch(b) {
      const i = batches.findIndex(x => x.id === b.id)
      if (i === -1) batches.push({ ...b })
      else batches[i] = { ...b }
    },

    async getBatchByHash(hash) {
      const found = batches.find(b => b.fileHash === hash)
      return found ? { ...found } : undefined
    },

    async deleteBatch(batchId) {
      const hit = records.filter(r => r.batchId === batchId)
      records = records.filter(r => r.batchId !== batchId)
      batches = batches.filter(b => b.id !== batchId)
      return hit.length
    },

    async getSetting<T>(key: string) {
      return settings.get(key) as T | undefined
    },

    async setSetting(key, value) {
      settings.set(key, value)
    },

    async listStudentNames() {
      const names = new Set<string>()
      for (const r of records) {
        const n = r.student.trim()
        if (n) names.add(n)
      }
      // 与 Web 端一致：中文按拼音排序
      return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    },

    async clearAll() {
      courseTypes = []
      records = []
      batches = []
      settings = new Map()
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      const s = snapshot()
      try {
        return await fn()
      } catch (err) {
        restore(s)
        throw err
      }
    }
  }

  return repo
}
