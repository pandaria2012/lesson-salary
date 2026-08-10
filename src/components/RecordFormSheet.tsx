import { useEffect, useMemo, useState } from 'react'
import Sheet from './Sheet'
import { computeHours } from '../lib/time'
import type { CourseType, LessonRecord } from '../types'

export default function RecordFormSheet({ open, initial, courseTypes, onClose, onSaved }: {
  open: boolean
  initial: LessonRecord | null
  courseTypes: CourseType[]
  onClose: () => void
  onSaved: (r: LessonRecord) => void
}) {
  const [courseTypeId, setCourseTypeId] = useState('')
  const [student, setStudent] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rate, setRate] = useState('')
  const [status, setStatus] = useState<'normal' | 'cancelled'>('normal')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCourseTypeId(initial?.courseTypeId ?? courseTypes[0]?.id ?? '')
      setStudent(initial?.student ?? '')
      setDate(initial?.date ?? '')
      setStart(initial?.startTime ?? '')
      setEnd(initial?.endTime ?? '')
      setRate(initial?.rate === null ? '' : String(initial?.rate ?? ''))
      setStatus(initial?.status ?? 'normal')
      setNote(initial?.note ?? '')
      setError('')
    }
  }, [open, initial, courseTypes])

  const ct = useMemo(() => courseTypes.find(c => c.id === courseTypeId) ?? null, [courseTypeId, courseTypes])

  const computedHours = useMemo(
    () => computeHours(start || null, end || null) ?? (start && !end ? ct?.defaultHours ?? null : null) ?? (initial?.hours ?? null),
    [start, end, ct, initial?.hours]
  )

  const submit = () => {
    if (!student.trim()) { setError('请填写学生名称'); return }
    if (!date) { setError('请选择日期'); return }
    if (!ct) { setError('请选择课程类型'); return }
    const hours = computedHours
    if (hours === null) { setError('无法确定课时：请填写时间段或设置课程默认课时'); return }
    const r = Number(rate)
    if (rate === '' || Number.isNaN(r) || r < 0) { setError('请填写有效时薪'); return }
    onSaved({
      id: initial?.id ?? `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      courseTypeId: ct.id,
      courseTypeName: ct.name,
      courseTypeKind: ct.type,
      rate: r,
      student: student.trim(),
      date,
      startTime: start || null,
      endTime: end || null,
      hours,
      status,
      source: initial?.source ?? 'manual',
      batchId: initial?.batchId ?? null,
      note: note.trim(),
      createdAt: initial?.createdAt ?? new Date().toISOString()
    })
  }

  return (
    <Sheet open={open} title={initial ? '编辑上课记录' : '补录上课记录'} onClose={onClose}>
      <div className="field"><label>课程类型 *</label>
        <select value={courseTypeId} onChange={e => setCourseTypeId(e.target.value)}>
          {courseTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="field"><label>学生名称 *</label><input value={student} onChange={e => setStudent(e.target.value)} placeholder="如：张三" /></div>
      <div className="field"><label>日期 *</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="row2">
        <div className="field"><label>开始时间</label><input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div className="field"><label>结束时间</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
      </div>
      <p className="muted">课时：{computedHours === null ? '待定' : `${computedHours} 小时`}（结束早于开始按跨天计算；只填开始时间用默认课时）</p>
      <div className="field"><label>时薪（元/小时）*</label><input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder={ct?.defaultRate ? `默认 ${ct.defaultRate}` : '如 200'} /></div>
      <div className="field"><label>状态</label>
        <select value={status} onChange={e => setStatus(e.target.value as 'normal' | 'cancelled')}>
          <option value="normal">正常</option><option value="cancelled">已取消（不计薪）</option>
        </select>
      </div>
      <div className="field"><label>备注</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="选填" /></div>
      {error && <p className="error">{error}</p>}
      <button style={{ width: '100%' }} onClick={submit}>保存</button>
    </Sheet>
  )
}
