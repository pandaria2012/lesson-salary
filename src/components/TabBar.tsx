import type { TabKey } from '../App'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'summary', label: '汇总' },
  { key: 'records', label: '记录' },
  { key: 'import', label: '导入' },
  { key: 'courseTypes', label: '课程' },
  { key: 'settings', label: '设置' }
]

export default function TabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map(t => (
        <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => onChange(t.key)}>{t.label}</button>
      ))}
    </nav>
  )
}