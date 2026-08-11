import { useEffect, useMemo, useState } from 'react'
import DayDetailSheet from '../components/DayDetailSheet'
import GroupList from '../components/GroupList'
import MonthCalendar from '../components/MonthCalendar'
import MonthPicker from '../components/MonthPicker'
import SummaryCard from '../components/SummaryCard'
import { listRecords } from '../db/repo'
import { createMonthlyWorkbook, downloadWorkbook } from '../lib/export'
import { summarize } from '../lib/summary'
import { buildDayMap } from '../lib/calendar'
import { useMonth } from '../hooks/useMonth'

type ViewMode = 'list' | 'calendar'

export default function SummaryPage() {
  const { month, setMonth, prev, next } = useMonth()
  const [records, setRecords] = useState<Awaited<ReturnType<typeof listRecords>>>([])
  const [tab, setTab] = useState<'student' | 'courseType' | 'kind'>('student')
  const [view, setView] = useState<ViewMode>('calendar')
  const [detailDate, setDetailDate] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void listRecords(month).then(r => { if (alive) setRecords(r) })
    return () => { alive = false }
  }, [month])

  const s = useMemo(() => summarize(records), [records])
  const groups = tab === 'student' ? s.byStudent : tab === 'courseType' ? s.byCourseType : s.byKind
  const cancelled = records.filter(r => r.status === 'cancelled')
  const dayMap = useMemo(() => buildDayMap(records), [records])
  const dayRecords = useMemo(
    () => (detailDate ? records.filter(r => r.date === detailDate) : []),
    [records, detailDate]
  )

  const exportMonth = () => {
    downloadWorkbook(createMonthlyWorkbook(records, groups), `课时薪资-${month}.xlsx`)
  }

  return (
    <section className="page">
      <header className="page-head"><h1>月度汇总</h1></header>
      <MonthPicker month={month} onPrev={prev} onNext={next} onChange={setMonth} />
      <SummaryCard s={s} />
      <div className="view-tabs">
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>列表</button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>日历</button>
      </div>
      {view === 'list' ? (
        <>
          <div className="group-tabs">
            <button className={tab === 'student' ? 'active' : ''} onClick={() => setTab('student')}>按学生</button>
            <button className={tab === 'courseType' ? 'active' : ''} onClick={() => setTab('courseType')}>按课程类型</button>
            <button className={tab === 'kind' ? 'active' : ''} onClick={() => setTab('kind')}>按教学形式</button>
          </div>
          <GroupList groups={groups} />
        </>
      ) : (
        <MonthCalendar month={month} days={dayMap} selectedDate={detailDate} onSelectDay={setDetailDate} />
      )}
      <button style={{ width: '100%', marginTop: 12 }} onClick={exportMonth}>导出本月 Excel</button>
      {cancelled.length > 0 && (
        <details className="card" style={{ marginTop: 12 }}>
          <summary>已取消（{cancelled.length} 课）</summary>
          {cancelled.map(r => (
            <div key={r.id} className="muted" style={{ margin: '6px 0' }}>
              {r.date} {r.student} {r.courseTypeName}（{r.hours ?? '?'}小时 × ¥{r.rate ?? '?'}）
            </div>
          ))}
        </details>
      )}
      <DayDetailSheet open={detailDate !== null} date={detailDate} records={dayRecords} onClose={() => setDetailDate(null)} />
    </section>
  )
}