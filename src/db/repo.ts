import { db } from './db'
import type { CourseType, ImportBatch, LessonRecord } from '../types'

export async function listCourseTypes(): Promise<CourseType[]> {
  return db.courseTypes.orderBy('name').toArray()
}

export async function saveCourseType(ct: CourseType): Promise<void> {
  await db.courseTypes.put(ct)
}

export async function deleteCourseType(id: string): Promise<void> {
  await db.courseTypes.delete(id)
}

export async function listRecords(month?: string): Promise<LessonRecord[]> {
  let coll = db.records.orderBy('date').reverse()
  if (month) coll = coll.filter(r => r.date.startsWith(month))
  return coll.toArray()
}

export async function saveRecord(r: LessonRecord): Promise<void> {
  await db.records.put(r)
}

export async function deleteRecord(id: string): Promise<void> {
  await db.records.delete(id)
}

export async function addBatch(b: ImportBatch): Promise<void> {
  await db.batches.put(b)
}

export async function getBatchByHash(hash: string): Promise<ImportBatch | undefined> {
  return db.batches.where('fileHash').equals(hash).first()
}

export async function deleteBatch(batchId: string): Promise<number> {
  const rows = await db.records.where('batchId').equals(batchId).toArray()
  await db.records.bulkDelete(rows.map(r => r.id))
  await db.batches.delete(batchId)
  return rows.length
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}
