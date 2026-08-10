import { useState } from 'react'
import MonthPicker from '../components/MonthPicker'
import RecordCard from '../components/RecordCard'
import RecordFormSheet from '../components/RecordFormSheet'
import { useCourseTypes } from '../hooks/useCourseTypes'
import { useMonth } from '../hooks/useMonth'
import { useRecords } from '../hooks/useRecords'
import type { LessonRecord } from '../types'

export default function RecordsPage() {
  const { month, setMonth, prev, next } = useMonth()
  const { items, save, remove } = useRecords(month)
  const { items: courseTypes } = useCourseTypes()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LessonRecord | null>(null)

  return (
    <section className="page">
      <header className="page-head"><h1>上课记录</h1></header>
      <MonthPicker month={month} onPrev={prev} onNext={next} onChange={setMonth} />
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
      <button className="fab" onClick={() => { setEditing(null); setOpen(true) }}>＋ 补录</button>
      <RecordFormSheet open={open} initial={editing} courseTypes={courseTypes} onClose={() => setOpen(false)} onSaved={async r => { await save(r); setOpen(false) }} />
    </section>
  )
}
