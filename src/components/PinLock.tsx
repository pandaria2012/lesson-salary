import { useState } from 'react'

export default function PinLock({ onUnlock, onResetAll }: {
  onUnlock: (pin: string) => Promise<boolean>
  onResetAll: () => Promise<void>
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    if (pin.length < 4) { setError('请输入至少 4 位 PIN'); return }
    const ok = await onUnlock(pin)
    if (!ok) { setError('PIN 错误，请重试'); setPin('') }
  }

  const forgot = async () => {
    if (!confirm('将清空全部数据（记录/课程类型）且无法撤销，确定？')) return
    if (!confirm('再次确认：将清空全部数据且无法撤销，确定？')) return
    setPin('')
    setError('')
    await onResetAll()
  }

  return (
    <div className="pin-lock">
      <h1>课时薪资</h1>
      <p>请输入 PIN 解锁</p>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        placeholder="PIN"
        value={pin}
        onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
      />
      {error && <p className="error">{error}</p>}
      <button onClick={submit}>解锁</button>
      <button className="btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={() => void forgot()}>忘记 PIN</button>
    </div>
  )
}
