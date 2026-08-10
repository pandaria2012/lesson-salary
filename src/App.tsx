import { useState } from 'react'
import TabBar from './components/TabBar'
import { usePin } from './hooks/usePin'
import PinLock from './components/PinLock'
import CourseTypesPage from './pages/CourseTypesPage'
import ImportPage from './pages/ImportPage'
import RecordsPage from './pages/RecordsPage'
import SummaryPage from './pages/SummaryPage'

export type TabKey = 'summary' | 'records' | 'import' | 'courseTypes' | 'settings'

export default function App() {
  const pin = usePin()
  const [tab, setTab] = useState<TabKey>('summary')
  if (!pin.ready) return <main className="app" />
  if (pin.enabled && pin.locked) {
    return <main className="app"><PinLock onUnlock={pin.unlock} /></main>
  }
  return (
    <div className="app">
      {tab === 'courseTypes' && <CourseTypesPage />}
      {tab === 'summary' && <SummaryPage />}
      {tab === 'records' && <RecordsPage />}
      {tab === 'import' && <ImportPage />}
      {tab === 'settings' && <div className="page"><h1>设置（后续任务）</h1></div>}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}