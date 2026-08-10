import Dexie, { type Table } from 'dexie'
import type { AppSettings, CourseType, ImportBatch, LessonRecord } from '../types'

export class SalaryDB extends Dexie {
  courseTypes!: Table<CourseType, string>
  records!: Table<LessonRecord, string>
  batches!: Table<ImportBatch, string>
  settings!: Table<AppSettings, string>

  constructor() {
    super('lesson-salary')
    this.version(1).stores({
      courseTypes: 'id, name, type, status',
      records: 'id, courseTypeId, student, date, status, batchId, source',
      batches: 'id, fileHash',
      settings: 'key'
    })
  }
}

export const db = new SalaryDB()
