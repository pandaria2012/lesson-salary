import type { CourseType, ImportBatch, LessonRecord } from './types'

/**
 * 数据访问接口（依赖倒置）。
 *
 * 三个实现，行为必须一致，由 `tests/repo-contract.test.ts` 用同一组断言保证：
 * - Dexie（Web）           src/web/db/repo.ts
 * - wx storage（小程序）    miniprogram/shared/repo.ts
 * - 内存（测试）            src/core/memoryRepo.ts
 *
 * 前 12 个方法签名与原 `src/db/repo.ts` 完全一致，未做任何改动。
 */
export interface Repo {
  listCourseTypes(): Promise<CourseType[]>
  saveCourseType(ct: CourseType): Promise<void>
  deleteCourseType(id: string): Promise<void>
  listRecords(month?: string): Promise<LessonRecord[]>
  saveRecord(r: LessonRecord): Promise<void>
  deleteRecord(id: string): Promise<void>
  addBatch(b: ImportBatch): Promise<void>
  getBatchByHash(hash: string): Promise<ImportBatch | undefined>
  deleteBatch(batchId: string): Promise<number>
  getSetting<T>(key: string): Promise<T | undefined>
  setSetting(key: string, value: unknown): Promise<void>
  listStudentNames(): Promise<string[]>
  /** 清空全部数据（备份恢复的"覆盖"模式需要）。 */
  clearAll(): Promise<void>
  /**
   * 事务。Dexie 映射到真实事务；小程序存储无事务，实现为
   * "内存缓冲写入 → 成功一次性落盘 → 失败丢弃缓冲"。
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * 课程类型排序用的比较函数。
 *
 * ⚠️ 刻意使用 UTF-16 code unit 顺序（而非 localeCompare），
 * 因为 Dexie 的 `orderBy('name')` 走 IndexedDB 键序 = code unit 顺序。
 * 若这里改用 localeCompare（拼音序），内存实现会与 Dexie 实现排序不一致，
 * 契约测试将无法保证两端口径相同。
 */
export function compareName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
