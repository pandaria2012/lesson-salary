import type { ParsedRow } from '../lib/parser'
import { fmtHours } from '../lib/format'

export default function ImportPreview({ rows, onToggle }: { rows: ParsedRow[]; onToggle: (i: number) => void }) {
  const selectedCount = rows.filter(r => r.selected).length
  return (
    <div>
      <p className="muted">共 {rows.length} 行，将导入 {selectedCount} 行；异常/重复/示例行默认不勾选。</p>
      {rows.map((r, i) => (
        <label className="card preview-row" key={i}>
          <input type="checkbox" checked={r.selected} onChange={() => onToggle(i)} />
          <div className="preview-body">
            <div>
              <strong>{r.student || '（无学生）'}</strong>
              <span className="tag">{r.courseTypeName || '（无课程类型）'}</span>
              {r.isNewCourseType && <span className="tag new">新类型</span>}
              {r.isSample && <span className="tag sample">示例</span>}
              {r.isDuplicate && <span className="tag dup">重复</span>}
            </div>
            <div className="muted">
              {r.date ?? '日期无效'} · {r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '时间待定'}
              {r.hours !== null ? ` · ${fmtHours(r.hours)}小时` : ''}
              {r.rate !== null ? ` · ¥${r.rate}/时` : ' · 时薪待定'}
            </div>
            {r.issues.length > 0 && <div className="issues">{r.issues.join('；')}</div>}
          </div>
        </label>
      ))}
    </div>
  )
}