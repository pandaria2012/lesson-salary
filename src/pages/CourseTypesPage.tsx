import { useState } from 'react'
import CourseTypeFormSheet from '../components/CourseTypeFormSheet'
import { useCourseTypes } from '../hooks/useCourseTypes'
import type { CourseType } from '../types'

export default function CourseTypesPage() {
  const { items, save, remove } = useCourseTypes()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CourseType | null>(null)

  const del = (ct: CourseType) => {
    if (confirm(`删除课程类型「${ct.name}」？历史记录不受影响。`)) void remove(ct.id)
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>课程类型</h1>
        <button onClick={() => { setEditing(null); setOpen(true) }}>新增</button>
      </header>
      {items.map(ct => (
        <div className="card course-type" key={ct.id}>
          <div>
            <strong>{ct.name}</strong>
            <span className="tag">{ct.type}</span>
            <span className={ct.status === 'enabled' ? 'tag ok' : 'tag off'}>{ct.status === 'enabled' ? '启用' : '停用'}</span>
          </div>
          <div className="muted">默认 {ct.defaultHours ?? '—'} 小时 · {ct.defaultRate ?? '—'} 元/小时</div>
          <div className="row-actions">
            <button onClick={() => { setEditing(ct); setOpen(true) }}>编辑</button>
            <button className="btn-danger" onClick={() => del(ct)}>删除</button>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="empty">还没有课程类型，点右上角"新增"创建。</p>}
      <CourseTypeFormSheet open={open} initial={editing} onClose={() => setOpen(false)} onSaved={async ct => { await save(ct); setOpen(false) }} />
    </section>
  )
}