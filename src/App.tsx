import { useState } from 'react'
import TabBar from './components/TabBar'
import { usePin } from './hooks/usePin'
import PinLock from './components/PinLock'
import CourseTypesPage from './pages/CourseTypesPage'

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
      {tab === 'summary' && <div className="page"><h1>汇总（后续任务）</h1></div>}
      {tab === 'records' && <div className="page"><h1>上课记录（后续任务）</h1></div>}
      {tab === 'import' && <div className="page"><h1>导入（后续任务）</h1></div>}
      {tab === 'settings' && <div className="page"><h1>设置（后续任务）</h1></div>}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}