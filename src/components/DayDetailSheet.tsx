import Sheet from './Sheet'
import { fmtDayLabel } from '../lib/calendar'
import { fmtHours, fmtMoney } from '../lib/format'
import type { LessonRecord } from '../types'

export default function DayDetailSheet({ open, date, records, onClose }: {
  open: boolean
  date: string | null
  records: LessonRecord[]
  onClose: () => void
}) {
  if (!open || !date) return null
  const normal = records.filter(r => r.status === 'normal')
  const cancelled = records.filter(r => r.status === 'cancelled')
  const total = normal.reduce((s, r) => s + (r.rate !== null && r.hours !== null ? r.rate * r.hours : 0), 0)
  return (
    <Sheet open={open} title={`${fmtDayLabel(date)} 明细`} onClose={onClose}>
      {records.length === 0 && <p className="empty">当天暂无记录</p>}
      {records.map(r => {
        const amount = r.rate !== null && r.hours !== null ? r.rate * r.hours : null
        return (
          <div key={r.id} className={`card record ${r.status === 'cancelled' ? 'cancelled' : ''}`}>
            <div className="rec-top">
              <strong>{r.student}</strong>
              <span className="rec-time">{r.courseTypeName}</span>
              <span className="rec-amount">{amount === null ? '—' : `¥${fmtMoney(amount)}`}</span>
            </div>
            <div className="rec-sub">
              {r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '时间待定'}
              {r.hours !== null ? ` · ${fmtHours(r.hours)}小时` : ''} · {r.rate ?? '—'} 元/小时
            </div>
            {r.status === 'cancelled' && <div className="rec-cancel">已取消（不计薪）</div>}
          </div>
        )
      })}
      {normal.length > 0 && <p className="ok" style={{ textAlign: 'right', marginTop: 10 }}>当日收入 ¥{fmtMoney(total)}</p>}
      {cancelled.length > 0 && <p className="muted" style={{ textAlign: 'right' }}>取消 {cancelled.length} 课</p>}
    </Sheet>
  )
}