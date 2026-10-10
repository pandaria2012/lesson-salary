import { db } from './db'
import type { CourseType, ImportBatch, LessonRecord } from '../../core/types'
import type { Repo } from '../../core/repo'

/**
 * Repo 的 Dexie（IndexedDB）实现 —— Web 端。
 *
 * 既有具名导出（listRecords 等）保持原样转发，Web 页面与 hooks 的调用点无需改动。
 * 小程序端的对应实现是 `miniprogram/shared/repo.ts`（wx storage）。
 */
export function createDexieRepo(): Repo {
  return {
    async listCourseTypes() {
      return db.courseTypes.orderBy('name').toArray()
    },

    async saveCourseType(ct) {
      await db.courseTypes.put(ct)
    },

    async deleteCourseType(id) {
      await db.courseTypes.delete(id)
    },

    async listRecords(month?) {
      let coll = db.records.orderBy('date').reverse()
      if (month) coll = coll.filter(r => r.date.startsWith(month))
      return coll.toArray()
    },

    async saveRecord(r) {
      await db.records.put(r)
    },

    async deleteRecord(id) {
      await db.records.delete(id)
    },

    async addBatch(b) {
      await db.batches.put(b)
    },

    async getBatchByHash(hash) {
      return db.batches.where('fileHash').equals(hash).first()
    },

    async deleteBatch(batchId) {
      const rows = await db.records.where('batchId').equals(batchId).toArray()
      await db.records.bulkDelete(rows.map(r => r.id))
      await db.batches.delete(batchId)
      return rows.length
    },

    async getSetting<T>(key: string) {
      const row = await db.settings.get(key)
      return row?.value as T | undefined
    },

    async setSetting(key, value) {
      await db.settings.put({ key, value })
    },

    async listStudentNames() {
      const keys = await db.records.orderBy('student').uniqueKeys()
      const names = new Set<string>()
      for (const k of keys) {
        if (typeof k === 'string' && k.trim()) names.add(k.trim())
      }
      // 中文按拼音排序（与 memoryRepo / wxRepo 口径一致）
      return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    },

    async clearAll() {
      await db.records.clear()
      await db.courseTypes.clear()
      await db.batches.clear()
      await db.settings.clear()
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      return db.transaction('rw', [db.records, db.courseTypes, db.batches, db.settings], fn)
    }
  }
}

/** 全局唯一的 Dexie Repo 实例。 */
export const repo = createDexieRepo()

// ---- 以下具名导出保持与原 src/db/repo.ts 完全一致的签名 ----

export async function listCourseTypes(): Promise<CourseType[]> {
  return repo.listCourseTypes()
}

export async function saveCourseType(ct: CourseType): Promise<void> {
  return repo.saveCourseType(ct)
}

export async function deleteCourseType(id: string): Promise<void> {
  return repo.deleteCourseType(id)
}

export async function listRecords(month?: string): Promise<LessonRecord[]> {
  return repo.listRecords(month)
}

export async function saveRecord(r: LessonRecord): Promise<void> {
  return repo.saveRecord(r)
}

export async function deleteRecord(id: string): Promise<void> {
  return repo.deleteRecord(id)
}

export async function addBatch(b: ImportBatch): Promise<void> {
  return repo.addBatch(b)
}

export async function getBatchByHash(hash: string): Promise<ImportBatch | undefined> {
  return repo.getBatchByHash(hash)
}

export async function deleteBatch(batchId: string): Promise<number> {
  return repo.deleteBatch(batchId)
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return repo.getSetting<T>(key)
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  return repo.setSetting(key, value)
}

export async function listStudentNames(): Promise<string[]> {
  return repo.listStudentNames()
}
