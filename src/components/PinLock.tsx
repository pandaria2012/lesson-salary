import { useState } from 'react'

export default function PinLock({ onUnlock }: { onUnlock: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    if (pin.length < 4) { setError('请输入至少 4 位 PIN'); return }
    const ok = await onUnlock(pin)
    if (!ok) { setError('PIN 错误，请重试'); setPin('') }
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
    </div>
  )
}
