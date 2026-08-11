import { useRef, useState } from 'react'
import { usePin } from '../hooks/usePin'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { isStandalone } from '../lib/installGuide'
import { listCourseTypes, listRecords } from '../db/repo'
import { createExportAllWorkbook, parseBackupWorkbook, saveWorkbook } from '../lib/export'
import { restoreBackup } from '../lib/restoreService'
import type { CourseType, LessonRecord } from '../types'

type BackupData = { records: LessonRecord[]; courseTypes: CourseType[] }
type MsgKind = 'ok' | 'error'

export default function SettingsPage({ onOpenInstallGuide }: { onOpenInstallGuide: () => void }) {
  const pin = usePin()
  const { canInstall, promptInstall } = useInstallPrompt()
  const [installing, setInstalling] = useState(false)
  const standalone = isStandalone()
  const restoreRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [msgKind, setMsgKind] = useState<MsgKind>('ok')
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')

  const showOk = (text: string) => { setMsgKind('ok'); setMsg(text) }
  const showError = (text: string) => { setMsgKind('error'); setMsg(text) }

  const installToHome = async () => {
    setInstalling(true)
    try {
      if (canInstall) {
        const ok = await promptInstall()
        if (ok) { showOk('已添加，可从桌面启动'); return }
      }
    } finally {
      setInstalling(false)
    }
    onOpenInstallGuide()
  }

  const exportAll = async () => {
    try {
      const [records, courseTypes] = await Promise.all([listRecords(), listCourseTypes()])
      const res = await saveWorkbook(createExportAllWorkbook(records, courseTypes), `课时薪资-全部数据-${new Date().toISOString().slice(0, 10)}.xlsx`)
      if (res === 'cancelled') showOk('已取消导出')
      else if (res === 'shared') showOk('已通过系统分享/存储')
      else if (res === 'saved') showOk('已保存')
      else if (res === 'failed') showError('导出失败')
      else showOk('已开始下载')
    } catch (err) {
      showError(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const onRestoreFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const backup = await parseBackupWorkbook(buffer)
      setPendingBackup(backup)
      showOk('已解析备份文件，请选择恢复方式')
    } catch (err) {
      setPendingBackup(null)
      showError(`恢复失败：无法解析备份文件（${err instanceof Error ? err.message : String(err)}）`)
    } finally {
      if (restoreRef.current) restoreRef.current.value = ''
    }
  }

  const doRestore = async (mode: 'merge' | 'overwrite') => {
    if (!pendingBackup) return
    if (mode === 'overwrite' && !confirm('将清空全部现有数据且无法撤销，确定继续？')) return
    try {
      const res = await restoreBackup(pendingBackup, mode)
      setPendingBackup(null)
      showOk(`恢复完成：记录 ${res.records} 条，课程类型 ${res.courseTypes} 个（${mode === 'merge' ? '合并' : '覆盖'}）`)
    } catch (err) {
      showError(`恢复失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const savePin = async () => {
    try {
      if (pin.enabled) {
        if (newPin.length < 4) { showError('新 PIN 至少 4 位'); return }
        const ok = await pin.change(oldPin, newPin)
        if (ok) showOk('PIN 已修改')
        else showError('原 PIN 错误')
      } else {
        if (newPin.length < 4) { showError('PIN 至少 4 位'); return }
        await pin.setup(newPin)
        showOk('PIN 已开启')
      }
      setOldPin(''); setNewPin('')
    } catch (err) {
      showError(`PIN 操作失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const disablePin = async () => {
    try {
      if (await pin.disable(oldPin)) showOk('PIN 已关闭')
      else showError('PIN 错误')
      setOldPin(''); setNewPin('')
    } catch (err) {
      showError(`PIN 操作失败：${err instanceof Error ? err.message : String(err)}`)
    }
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
        {pendingBackup && (
          <div>
            <p className="muted">已解析：记录 {pendingBackup.records.length} 条，课程类型 {pendingBackup.courseTypes.length} 个。合并恢复会保留现有数据并去重；覆盖会先清空本地数据。</p>
            <button style={{ width: '100%', marginTop: 4 }} onClick={() => void doRestore('merge')}>合并恢复（推荐）</button>
            <button className="btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={() => void doRestore('overwrite')}>覆盖恢复（危险）</button>
          </div>
        )}
      </div>
      {!standalone && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2>添加到桌面</h2>
          <p className="muted">添加到手机主屏幕，像 App 一样使用，离线也能打开。</p>
          <button style={{ width: '100%' }} disabled={installing} onClick={() => void installToHome()}>
            {installing ? '处理中…' : '添加到桌面'}
          </button>
        </div>
      )}
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
      {msg && <p className={msgKind === 'error' ? 'error' : 'ok'}>{msg}</p>}
    </section>
  )
}
