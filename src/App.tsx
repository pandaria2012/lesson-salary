import { usePin } from './hooks/usePin'
import PinLock from './components/PinLock'

export default function App() {
  const pin = usePin()
  if (!pin.ready) return <main className="app" />
  if (pin.enabled && pin.locked) {
    return <main className="app"><PinLock onUnlock={pin.unlock} /></main>
  }
  return <main className="app"><h1>课时薪资（后续任务接入页面）</h1></main>
}
