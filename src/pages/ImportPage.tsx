import { useRef, useState } from 'react'
import ImportPreview from '../components/ImportPreview'
import { deleteBatch, getBatchByHash, listCourseTypes, listRecords } from '../db/repo'
import { applyImport } from '../lib/importService'
import { createImportTemplateWorkbook, downloadWorkbook } from '../lib/export'
import { parseWorkbook, type ImportPreview as Preview } from '../lib/parser'

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [sameFile, setSameFile] = useState(false)
  const [lastBatch, setLastBatch] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const pickFile = async (file: File) => {
    setMsg('')
    const buffer = await file.arrayBuffer()
    const [courseTypes, records] = await Promise.all([listCourseTypes(), listRecords()])
    const p = await parseWorkbook(buffer, file.name, { courseTypes, records })
    setSameFile(!!(await getBatchByHash(p.fileHash)))
    setPreview(p)
    setLastBatch(null)
  }

  const confirm = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const res = await applyImport(preview)
      setLastBatch(res.batchId)
      setMsg(`已导入 ${res.inserted} 条记录`)
      setPreview(null)
    } finally {
      setBusy(false)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const undo = async () => {
    if (!lastBatch) return
    const n = await deleteBatch(lastBatch)
    setLastBatch(null)
    setMsg(`已撤销导入，删除 ${n} 条记录`)
  }

  return (
    <section className="page">
      <header className="page-head"><h1>导入课程表</h1></header>
      <button className="btn-ghost" onClick={() => downloadWorkbook(createImportTemplateWorkbook(), '课时薪资-导入模板.xlsx')}>下载导入模板</button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void pickFile(f) }} />
      <button onClick={() => inputRef.current?.click()} disabled={busy}>选择 Excel 文件</button>
      {sameFile && preview && <p className="warn">该文件之前导入过，请检查下方重复标记。</p>}
      {preview && (
        <>
          <ImportPreview rows={preview.rows} onToggle={i => {
            const rows = [...preview.rows]
            rows[i] = { ...rows[i], selected: !rows[i].selected }
            setPreview({ ...preview, rows })
          }} />
          <button style={{ width: '100%', marginTop: 12 }} onClick={confirm} disabled={busy || preview.rows.every(r => !r.selected)}>
            {busy ? '导入中…' : '确认导入'}
          </button>
        </>
      )}
      {lastBatch && <button className="btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={undo}>撤销上一批导入</button>}
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}