import { fmtHours, fmtMoney } from '../lib/format'
import type { LessonRecord } from '../types'

export default function RecordCard({ record, onEdit, onToggleCancel, onDelete }: {
  record: LessonRecord
  onEdit: () => void
  onToggleCancel: () => void
  onDelete: () => void
}) {
  const amount = record.rate !== null && record.hours !== null ? record.rate * record.hours : null
  const time = record.startTime && record.endTime ? `${record.startTime}-${record.endTime}` : '时间待定'
  return (
    <div className={`card record ${record.status === 'cancelled' ? 'cancelled' : ''}`}>
      <div className="rec-top">
        <strong>{record.date}</strong>
        <span className="rec-time">{time}</span>
        <span className="rec-amount">{amount === null ? '—' : `¥${fmtMoney(amount)}`}</span>
      </div>
      <div className="rec-sub">{record.student} · {record.courseTypeName}{record.hours !== null ? ` · ${fmtHours(record.hours)}小时` : ''}</div>
      {record.status === 'cancelled' && <div className="rec-cancel">已取消（不计薪）</div>}
      <div className="row-actions">
        <button onClick={onEdit}>编辑</button>
        <button onClick={onToggleCancel}>{record.status === 'normal' ? '取消' : '恢复'}</button>
        <button className="btn-danger" onClick={onDelete}>删除</button>
      </div>
    </div>
  )
}
