import * as XLSX from 'xlsx'

/**
 * Excel 保存层（**Web 专有**，含 DOM 依赖）。
 *
 * 建表逻辑在 `core/workbook.ts`（纯逻辑，两端共用）；
 * 本文件只负责"把 workbook 变成用户能拿到的文件"。
 * 小程序端的对应实现是 `miniprogram/shared/file.ts`（FileSystemManager + openDocument）。
 */

export type SaveResult = 'shared' | 'saved' | 'downloaded' | 'opened' | 'cancelled' | 'failed'

let lastExportUrl: string | null = null

/** 上次导出的文件：手动点击重新打开（绕过自动弹窗被浏览器拦截的情况） */
export function openLastExport(): boolean {
  if (!lastExportUrl) return false
  window.open(lastExportUrl, '_blank')
  return true
}

/**
 * 保存 Excel：
 * - iOS：直接新窗口打开文件（<a download> 在 iOS 无效），用户可在文件页分享/存储
 * - 安卓：优先系统分享，失败/取消则浏览器下载
 * - 桌面：系统保存对话框，最后浏览器下载兜底
 */
export async function saveWorkbook(wb: XLSX.WorkBook, filename: string): Promise<SaveResult> {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const blob = new Blob([data], { type })
  const file = new File([blob], filename, { type })

  const ua = navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipod|ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /android/.test(ua)

  // 1) iOS：同步打开（保留用户手势），用户可分享/存储到文件
  if (isIOS) {
    const url = URL.createObjectURL(blob)
    if (lastExportUrl) URL.revokeObjectURL(lastExportUrl)
    lastExportUrl = url
    window.open(url, '_blank')
    return 'opened'
  }

  // 2) 安卓：优先系统分享，失败/取消则继续下载兜底
  const nav = navigator as Navigator & { share?: (d: { files?: File[]; title?: string }) => Promise<void> }
  if (isAndroid && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], title: filename })
      return 'shared'
    } catch {
      // 继续走下载兜底
    }
  }

  // 3) 桌面 Chrome/Edge：系统保存对话框
  const win = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName: string
      types: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<{
      createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>
    }>
  }
  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Excel 表格', accept: { [type]: ['.xlsx'] } }]
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'SecurityError')) return 'cancelled'
      // 保存失败 → 下载兜底
    }
  }

  // 4) 兜底：浏览器下载
  try {
    const url = URL.createObjectURL(blob)
    if (lastExportUrl) URL.revokeObjectURL(lastExportUrl)
    lastExportUrl = url
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
