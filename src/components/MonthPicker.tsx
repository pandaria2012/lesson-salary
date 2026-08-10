export default function MonthPicker({ month, onPrev, onNext, onChange }: {
  month: string
  onPrev: () => void
  onNext: () => void
  onChange: (m: string) => void
}) {
  return (
    <div className="month-picker">
      <button onClick={onPrev}>‹</button>
      <input type="month" value={month} onChange={e => e.target.value && onChange(e.target.value)} />
      <button onClick={onNext}>›</button>
    </div>
  )
}
