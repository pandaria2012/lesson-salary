import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import type { CourseType, CourseTypeStatus } from '../types'

export default function CourseTypeFormSheet({ open, initial, onClose, onSaved }: {
  open: boolean
  initial: CourseType | null
  onClose: () => void
  onSaved: (ct: CourseType) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('一对一')
  const [status, setStatus] = useState<CourseTypeStatus>('enabled')
  const [defaultHours, setDefaultHours] = useState('')
  const [defaultRate, setDefaultRate] = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setType(initial?.type ?? '一对一')
      setStatus(initial?.status ?? 'enabled')
      setDefaultHours(initial?.defaultHours === null ? '' : String(initial?.defaultHours ?? ''))
      setDefaultRate(initial?.defaultRate === null ? '' : String(initial?.defaultRate ?? ''))
    }
  }, [open, initial])

  const submit = () => {
    if (!name.trim()) return
    onSaved({
      id: initial?.id ?? `ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      type: type.trim(),
      status,
      defaultHours: defaultHours === '' ? null : Number(defaultHours),
      defaultRate: defaultRate === '' ? null : Number(defaultRate),
      createdAt: initial?.createdAt ?? new Date().toISOString()
    })
  }

  return (
    <Sheet open={open} title={initial ? '编辑课程类型' : '新增课程类型'} onClose={onClose}>
      <div className="field"><label>名称 *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="如：初三数学1对1" /></div>
      <div className="field"><label>教学形式</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option>一对一</option><option>小班</option><option>线上</option><option>其他</option>
        </select>
      </div>
      <div className="field"><label>状态</label>
        <select value={status} onChange={e => setStatus(e.target.value as CourseTypeStatus)}>
          <option value="enabled">启用</option><option value="disabled">停用</option>
        </select>
      </div>
      <div className="row2">
        <div className="field"><label>默认课时（小时）</label><input inputMode="decimal" value={defaultHours} onChange={e => setDefaultHours(e.target.value)} placeholder="如 2" /></div>
        <div className="field"><label>默认时薪（元/小时）</label><input inputMode="decimal" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} placeholder="如 200" /></div>
      </div>
      <button style={{ width: '100%' }} onClick={submit}>保存</button>
    </Sheet>
  )
}