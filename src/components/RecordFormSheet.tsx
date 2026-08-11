import { useEffect, useMemo, useState } from 'react'
import Sheet from './Sheet'
import { addMinutes, computeHours, nextHalfHour } from '../lib/time'
import { findDuplicateRecord } from '../lib/dedup'
import type { CourseType, LessonRecord } from '../types'

const QUICK_HOURS = [0.5, 1, 1.5, 2, 3]

export default function RecordFormSheet({ open, initial, courseTypes, studentOptions, records, onClose, onSaved }: {
  open: boolean
  initial: LessonRecord | null
  courseTypes: CourseType[]
  studentOptions: string[]
  records: LessonRecord[]
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
  const [dupWarning, setDupWarning] = useState<LessonRecord | null>(null)

  useEffect(() => {
    if (open) {
      const first = courseTypes[0] ?? null
      setCourseTypeId(initial?.courseTypeId ?? first?.id ?? '')
      setStudent(initial?.student ?? '')
      setDate(initial?.date ?? '')
      setStart(initial?.startTime ?? '')
      setEnd(initial?.endTime ?? '')
      setRate(initial ? (initial.rate === null ? '' : String(initial.rate)) : (first?.defaultRate != null ? String(first.defaultRate) : ''))
      setStatus(initial?.status ?? 'normal')
      setNote(initial?.note ?? '')
      setError('')
      setDupWarning(null)
    }
  }, [open, initial, courseTypes])

  const ct = useMemo(() => courseTypes.find(c => c.id === courseTypeId) ?? null, [courseTypeId, courseTypes])

  const computedHours = useMemo(
    () => computeHours(start || null, end || null) ?? (start && !end ? ct?.defaultHours ?? null : null) ?? (initial?.hours ?? null),
    [start, end, ct, initial?.hours]
  )

  /** 课程类型联动：自动带出默认时薪（仅在用户没改过时薪时覆盖） */
  const onCourseTypeChange = (id: string) => {
    const next = courseTypes.find(c => c.id === id) ?? null
    setCourseTypeId(id)
    if (next?.defaultRate != null) {
      const prevDefault = ct?.defaultRate
      if (rate === '' || (prevDefault != null && rate === String(prevDefault))) {
        setRate(String(next.defaultRate))
      }
    }
  }

  /** 时长快捷：有开始时间则自动算结束；没有则先用最近半点当开始时间 */
  const applyDuration = (hours: number) => {
    const base = start || nextHalfHour()
    if (!start) setStart(base)
    const endTime = addMinutes(base, hours * 60)
    if (endTime) setEnd(endTime)
  }

  const buildRecord = (): LessonRecord | null => {
    if (!student.trim()) { setError('请填写学生名称'); return null }
    if (!date) { setError('请选择日期'); return null }
    if (!ct) { setError('请选择课程类型'); return null }
    const hours = computedHours
    if (hours === null) { setError('无法确定课时：请填写时间段或设置课程默认课时'); return null }
    const r = Number(rate)
    if (rate === '' || Number.isNaN(r) || r < 0) { setError('请填写有效时薪'); return null }
    return {
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
    }
  }

  const submit = () => {
    const rec = buildRecord()
    if (!rec) return
    const dup = findDuplicateRecord(rec, records, initial?.id)
    if (dup) {
      setError('')
      setDupWarning(dup)
      return
    }
    onSaved(rec)
  }

  const saveAnyway = () => {
    const rec = buildRecord()
    if (!rec) return
    setDupWarning(null)
    onSaved(rec)
  }

  return (
    <Sheet open={open} title={initial ? '编辑上课记录' : '补录上课记录'} onClose={onClose}>
      <div className="field"><label>课程类型 *</label>
        <select value={courseTypeId} onChange={e => onCourseTypeChange(e.target.value)}>
          {courseTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {ct && <p className="muted">默认 {ct.defaultHours ?? '—'} 小时 · {ct.defaultRate ?? '—'} 元/小时</p>}
      </div>
      <div className="field"><label>学生名称 *</label>
        <input value={student} onChange={e => setStudent(e.target.value)} list="student-options" placeholder="如：张三" autoComplete="off" />
        <datalist id="student-options">
          {studentOptions.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>
      <div className="field"><label>日期 *</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="field"><label>开始时间</label><input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
      <div className="duration-chips">
        {QUICK_HOURS.map(h => (
          <button key={h} type="button" onClick={() => applyDuration(h)}>{h}小时</button>
        ))}
      </div>
      <div className="field"><label>结束时间</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
      <p className="muted">课时：{computedHours === null ? '待定' : `${computedHours} 小时`}（先选开始时间，再用时长快捷按钮自动算结束；结束早于开始按跨天计算）</p>
      <div className="field"><label>时薪（元/小时）*</label><input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder={ct?.defaultRate ? `默认 ${ct.defaultRate}` : '如 200'} /></div>
      <div className="field"><label>状态</label>
        <select value={status} onChange={e => setStatus(e.target.value as 'normal' | 'cancelled')}>
          <option value="normal">正常</option><option value="cancelled">已取消（不计薪）</option>
        </select>
      </div>
      <div className="field"><label>备注</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="选填" /></div>
      {error && <p className="error">{error}</p>}
      {dupWarning && (
        <div className="dup-warn">
          <p className="warn">⚠️ 已存在相同记录：{dupWarning.date} {dupWarning.student} · {dupWarning.courseTypeName}
            {dupWarning.startTime && dupWarning.endTime ? ` ${dupWarning.startTime}-${dupWarning.endTime}` : '（时间待定）'}。确认仍要保存吗？</p>
          <div className="row-actions">
            <button onClick={saveAnyway}>仍要保存</button>
            <button className="btn-ghost-guide" onClick={() => setDupWarning(null)}>返回修改</button>
          </div>
        </div>
      )}
      <button style={{ width: '100%' }} onClick={submit}>保存</button>
    </Sheet>
  )
}