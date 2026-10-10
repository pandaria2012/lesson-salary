export type CourseTypeStatus = 'enabled' | 'disabled'
export type RecordStatus = 'normal' | 'cancelled'
export type RecordSource = 'import' | 'manual'

export interface CourseType {
  id: string
  name: string
  type: string
  status: CourseTypeStatus
  defaultHours: number | null
  defaultRate: number | null
  createdAt: string
}

export interface LessonRecord {
  id: string
  courseTypeId: string | null
  courseTypeName: string
  courseTypeKind: string
  rate: number | null
  student: string
  date: string
  startTime: string | null
  endTime: string | null
  hours: number | null
  status: RecordStatus
  source: RecordSource
  batchId: string | null
  note: string
  createdAt: string
}

export interface ImportBatch {
  id: string
  filename: string
  fileHash: string
  importedAt: string
  rowCount: number
}

export interface AppSettings {
  key: string
  value: unknown
}
