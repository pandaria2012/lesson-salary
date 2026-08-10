import { useRef, useState } from 'react'
import { usePin } from '../hooks/usePin'
import { listCourseTypes, listRecords } from '../db/repo'
import { createExportAllWorkbook, downloadWorkbook, parseBackupWorkbook } from '../lib/export'
import { restoreBackup } from '../lib/restoreService'

export default function SettingsPage() {
  const pin = usePin()
  const restoreRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')

  const exportAll = async () => {
    const [records, courseTypes] = await Promise.all([listRecords(), listCourseTypes()])
    downloadWorkbook(createExportAllWorkbook(records, courseTypes), `课时薪资-全部数据-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const onRestoreFile = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const backup = await parseBackupWorkbook(buffer)
    const mode = confirm('覆盖会先清空本地数据，合并则保留并去重。点击"确定"= 合并；"取消"= 覆盖') ? 'merge' : 'overwrite'
    const res = await restoreBackup(backup, mode)
    setMsg(`恢复完成：记录 ${res.records} 条，课程类型 ${res.courseTypes} 个（${mode === 'merge' ? '合并' : '覆盖'}）`)
    if (restoreRef.current) restoreRef.current.value = ''
  }

  const savePin = async () => {
    if (pin.enabled) {
      if (newPin.length < 4) { setMsg('新 PIN 至少 4 位'); return }
      const ok = await pin.change(oldPin, newPin)
      setMsg(ok ? 'PIN 已修改' : '原 PIN 错误')
    } else {
      if (newPin.length < 4) { setMsg('PIN 至少 4 位'); return }
      await pin.setup(newPin)
      setMsg('PIN 已开启')
    }
    setOldPin(''); setNewPin('')
  }

  const disablePin = async () => {
    if (await pin.disable(oldPin)) setMsg('PIN 已关闭')
    else setMsg('PIN 错误')
    setOldPin(''); setNewPin('')
  }

  return (
    <section className="page settings">
      <header className="page-head"><h1>设置</h1></header>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2>备份</h2>
        <p className="muted">导出全部数据（含课程类型与记录），换手机/重装后可恢复。</p>
        <button style={{ width: '100%' }} onClick={exportAll}>导出全部数据 Excel</button>
        <input ref={restoreRef} type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void onRestoreFile(f) }} />
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => restoreRef.current?.click()}>从备份文件恢复</button>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2>PIN 锁</h2>
        <div className="field"><label>原 PIN（修改/关闭时填写）</label><input type="password" inputMode="numeric" value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
        <div className="field"><label>新 PIN（4~6 位数字）</label><input type="password" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
        <button style={{ width: '100%' }} onClick={savePin}>{pin.enabled ? '修改 PIN' : '开启 PIN 锁'}</button>
        {pin.enabled && <button className="btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={disablePin}>关闭 PIN 锁</button>}
      </div>
      <div className="card">
        <h2>关于</h2>
        <p className="muted">课时薪资 v0.1 · 数据仅存储在本机浏览器（IndexedDB），不联网不上传。备份文件请自行妥善保管。</p>
      </div>
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}