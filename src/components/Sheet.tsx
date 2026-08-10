import type { ReactNode } from 'react'

export default function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn-close" onClick={onClose}>关闭</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}