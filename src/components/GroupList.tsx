import { fmtHours, fmtMoney } from '../lib/format'
import type { GroupStats } from '../lib/summary'

export default function GroupList({ groups }: { groups: GroupStats[] }) {
  if (groups.length === 0) return <p className="empty">暂无数据</p>
  return (
    <div>
      {groups.map(g => (
        <div className="card group-row" key={g.label}>
          <div className="g-left"><strong>{g.label}</strong><span className="muted">{g.count} 课次 · {fmtHours(g.hours)} 小时</span></div>
          <div className="g-right">¥{fmtMoney(g.amount)}</div>
        </div>
      ))}
    </div>
  )
}
