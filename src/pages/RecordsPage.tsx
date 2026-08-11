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

export default function RecordsPage() {
  const { month, setMonth, prev, next } = useMonth()
  const { items, save, remove } = useRecords(month)
  const { items: courseTypes } = useCourseTypes()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LessonRecord | null>(null)
  const [view, setView] = useState<ViewMode>('calendar')
  const [detailDate, setDetailDate] = useState<string | null>(null)
  const [studentOptions, setStudentOptions] = useState<string[]>([])

  const refreshStudents = useCallback(async () => {
    setStudentOptions(await listStudentNames())
  }, [])

  useEffect(() => { void refreshStudents() }, [refreshStudents])

  const dayMap = useMemo(() => buildDayMap(items), [items])
  const dayRecords = useMemo(
    () => (detailDate ? items.filter(r => r.date === detailDate) : []),
    [items, detailDate]
  )

  return (
    <section className="page">
      <header className="page-head"><h1>上课记录</h1></header>
      <MonthPicker month={month} onPrev={prev} onNext={next} onChange={setMonth} />
      <div className="view-tabs">
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>列表</button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>日历</button>
      </div>
      {view === 'list' ? (
        <>
          {items.map(r => (
            <RecordCard
              key={r.id}
              record={r}
              onEdit={() => { setEditing(r); setOpen(true) }}
              onToggleCancel={() => void save({ ...r, status: r.status === 'normal' ? 'cancelled' : 'normal' })}
              onDelete={() => { if (confirm('删除这条记录？')) void remove(r.id) }}
            />
          ))}
          {items.length === 0 && <p className="empty">本月暂无记录，可导入课程表或手动补录。</p>}
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