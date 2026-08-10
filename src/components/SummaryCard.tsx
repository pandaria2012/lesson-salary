import { fmtHours, fmtMoney } from '../lib/format'
import type { Summary } from '../lib/summary'

export default function SummaryCard({ s }: { s: Summary }) {
  return (
    <div className="card summary-card">
      <div className="sum-main">总收入 <strong>¥{fmtMoney(s.totalAmount)}</strong></div>
      <div className="sum-sub">
        <span>{s.totalCount} 课次</span>
        <span>{fmtHours(s.totalHours)} 小时</span>
        <span>取消 {s.cancelledCount} 课 / ¥{fmtMoney(s.cancelledAmount)}</span>
      </div>
    </div>
  )
}
