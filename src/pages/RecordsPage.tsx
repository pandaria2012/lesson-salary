import { useCallback, useEffect, useMemo, useState } from 'react'
import DayDetailSheet from '../components/DayDetailSheet'
import MonthCalendar from '../components/MonthCalendar'
import MonthPicker from '../components/MonthPicker'
import RecordCard from '../components/RecordCard'
import RecordFormSheet from '../components/RecordFormSheet'
import { useCourseTypes } from '../hooks/useCourseTypes'
import { useMonth } from '../hooks/useMonth'
import { useRecords } from '../hooks/useRecords'
import { listStudentNames } from '../db/repo'
import { buildDayMap } from '../lib/calendar'
import type { LessonRecord } from '../types'

type ViewMode = 'list' | 'calendar'
type StatusFilter = 'all' | 'normal' | 'cancelled'

export default function RecordsPage() {
  const { month, setMonth, prev, next } = useMonth()
  const { items, save, remove } = useRecords(month)
  const { items: courseTypes } = useCourseTypes()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LessonRecord | null>(null)
  const [view, setView] = useState<ViewMode>('list')
  const [detailDate, setDetailDate] = useState<string | null>(null)
  const [studentOptions, setStudentOptions] = useState<string[]>([])
  const [filterStudent, setFilterStudent] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')

  const refreshStudents = useCallback(async () => {
    setStudentOptions(await listStudentNames())
  }, [])

  useEffect(() => { void refreshStudents() }, [refreshStudents])

  const studentFilterOptions = useMemo(
    () => [...new Set(items.map(r => r.student).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [items]
  )
  const courseFilterOptions = useMemo(
    () => [...new Set(items.map(r => r.courseTypeName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [items]
  )

  const filtered = useMemo(
    () => items.filter(r =>
      (!filterStudent || r.student === filterStudent) &&
      (!filterCourse || r.courseTypeName === filterCourse) &&
      (filterStatus === 'all' || r.status === filterStatus)
    ),
    [items, filterStudent, filterCourse, filterStatus]
  )

  const hasFilter = filterStudent !== '' || filterCourse !== '' || filterStatus !== 'all'
  const clearFilters = () => {
    setFilterStudent('')
    setFilterCourse('')
    setFilterStatus('all')
  }

  const dayMap = useMemo(() => buildDayMap(filtered), [filtered])
  const dayRecords = useMemo(
    () => (detailDate ? filtered.filter(r => r.date === detailDate) : []),
    [filtered, detailDate]
  )

  return (
    <section className="page">
      <header className="page-head"><h1>上课记录</h1></header>
      <MonthPicker month={month} onPrev={prev} onNext={next} onChange={setMonth} />
      <div className="view-tabs">
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>列表</button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>日历</button>
      </div>
      <div className="filters">
        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
          <option value="">全部学生</option>
          {studentFilterOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
          <option value="">全部课程</option>
          {courseFilterOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)}>
          <option value="all">全部状态</option>
          <option value="normal">正常</option>
          <option value="cancelled">已取消</option>
        </select>
        {hasFilter && <button className="btn-clear" onClick={clearFilters}>清除筛选</button>}
      </div>
      {hasFilter && <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>筛选结果：{filtered.length} 条</p>}
      {view === 'list' ? (
        <>
          {filtered.map(r => (
            <RecordCard
              key={r.id}
              record={r}
              onEdit={() => { setEditing(r); setOpen(true) }}
              onToggleCancel={() => void save({ ...r, status: r.status === 'normal' ? 'cancelled' : 'normal' })}
              onDelete={() => { if (confirm('删除这条记录？')) void remove(r.id) }}
            />
          ))}
          {filtered.length === 0 && (
            <p className="empty">{items.length === 0 ? '本月暂无记录，可导入课程表或手动补录。' : '没有符合筛选条件的记录。'}</p>
          )}
        </>
      ) : (
        <MonthCalendar month={month} days={dayMap} selectedDate={detailDate} onSelectDay={setDetailDate} />
      )}
      <button className="fab" onClick={() => { setEditing(null); setOpen(true) }}>＋ 补录</button>
      <RecordFormSheet
        open={open}
        initial={editing}
        courseTypes={courseTypes}
        studentOptions={studentOptions}
        onClose={() => setOpen(false)}
        onSaved={async r => { await save(r); setOpen(false); void refreshStudents() }}
      />
      <DayDetailSheet open={detailDate !== null} date={detailDate} records={dayRecords} onClose={() => setDetailDate(null)} />
    </section>
  )
}