import { useRef, useState } from 'react'
import ImportPreview from '../components/ImportPreview'
import { deleteBatch, getBatchByHash, listCourseTypes, listRecords } from '../db/repo'
import { applyImport } from '../lib/importService'
import { createImportTemplateWorkbook, openLastExport, saveWorkbook } from '../lib/export'
import { parseWorkbook, type ImportPreview as Preview } from '../lib/parser'

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [sameFile, setSameFile] = useState(false)
  const [lastBatch, setLastBatchState] = useState<string | null>(() => {
    try { return sessionStorage.getItem('lastBatchId') } catch { return null }
  })
  const setLastBatch = (id: string | null) => {
    setLastBatchState(id)
    try {
      if (id) sessionStorage.setItem('lastBatchId', id)
      else sessionStorage.removeItem('lastBatchId')
    } catch { /* ignore */ }
  }
  const [msg, setMsg] = useState('')
  const [showOpenFile, setShowOpenFile] = useState(false)

  const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

  const pickFile = async (file: File) => {
    setMsg('')
    setBusy(true)
    try {
      const buffer = await file.arrayBuffer()
      if (inputRef.current) inputRef.current.value = ''
      const [courseTypes, records] = await Promise.all([listCourseTypes(), listRecords()])
      const p = await parseWorkbook(buffer, file.name, { courseTypes, records })
      setSameFile(!!(await getBatchByHash(p.fileHash)))
      setPreview(p)
      setLastBatch(null)
    } catch (err) {
      if (inputRef.current) inputRef.current.value = ''
      setPreview(null)
      setSameFile(false)
      setMsg(`导入失败：${errMsg(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const res = await applyImport(preview)
      setLastBatch(res.batchId)
      setMsg(`已导入 ${res.inserted} 条记录`)
      setPreview(null)
    } catch (err) {
      setMsg(`导入失败：${errMsg(err)}`)
    } finally {
      setBusy(false)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const downloadTemplate = async () => {
    setMsg('正在生成…')
    const res = await saveWorkbook(createImportTemplateWorkbook(), '课时薪资-导入模板.xlsx')
    if (res === 'cancelled') setMsg('已取消下载')
    else if (res === 'shared') setMsg('已通过系统分享/存储')
    else if (res === 'saved') setMsg('已保存')
    else if (res === 'failed') setMsg('下载失败')
    else if (res === 'opened') { setMsg('已在浏览器打开文件，可点右上角分享/存储'); setShowOpenFile(true) }
    else { setMsg('已开始下载（如无反应，点下方按钮打开文件）'); setShowOpenFile(true) }
  }

  const undo = async () => {
    if (!lastBatch || busy) return
    try {
      const n = await deleteBatch(lastBatch)
      setLastBatch(null)
      setMsg(`已撤销导入，删除 ${n} 条记录`)
    } catch (err) {
      setMsg(`撤销失败：${errMsg(err)}`)
    }
  }

  return (
    <section className="page">
      <header className="page-head"><h1>导入课程表</h1></header>
      <button className="btn-ghost" onClick={() => void downloadTemplate()}>下载导入模板</button>
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
      {lastBatch && <button className="btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={undo} disabled={busy}>撤销上一批导入</button>}
      {msg && <p className={msg.startsWith('导入失败') || msg.startsWith('撤销失败') || msg.startsWith('下载失败') ? 'error' : 'ok'}>{msg}</p>}
      {showOpenFile && <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => openLastExport()}>打不开？点这里打开文件</button>}
    </section>
  )
}
