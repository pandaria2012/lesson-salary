import { monthGrid, todayStr, type DayInfo } from '../lib/calendar'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export default function MonthCalendar({ month, days, selectedDate, onSelectDay }: {
  month: string
  days: Map<string, DayInfo>
  selectedDate?: string | null
  onSelectDay?: (date: string) => void
}) {
  const cells = monthGrid(month)
  const today = todayStr()
  return (
    <div className="card calendar">
      <div className="cal-week">
        {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((date, i) => {
          if (!date) return <span key={`empty-${i}`} className="cal-cell empty" />
          const info = days.get(date)
          const isToday = date === today
          const isSelected = date === selectedDate
          return (
            <button
              key={date}
              type="button"
              className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              data-date={date}
              onClick={() => onSelectDay?.(date)}
            >
              <span className="cal-day">{Number(date.slice(8))}</span>
              {info && info.count > 0 && (
                <span className="cal-info">
                  <span className="cal-amount">¥{Math.round(info.amount)}</span>
                  <span className="cal-count">{info.count}课</span>
                </span>
              )}
              {info && info.count === 0 && info.cancelledCount > 0 && (
                <span className="cal-info"><span className="cal-count cancelled">取消</span></span>
              )}
            </button>
          )
        })}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>点击有课的日子查看当天明细</p>
    </div>
  )
}
