// 表单/服务层用主包 core；工作簿相关必须用分包 core-workbook（含 XLSX）
import { applyImport, type ImportPreview, type ParsedRow } from '../../../core/index'
import {
  workbookToArrayBuffer, createImportTemplateWorkbook, parseWorkbook
} from '../../core-workbook'
import { repo } from '../../../shared/repo-singleton'
import { chooseExcelFile, readFileAsArrayBuffer, saveAndPresent } from '../../../shared/file'
import { confirmDanger, errMsg, hideLoading, showLoading, toast, toastOk } from '../../../shared/ui'

/** 预览行的展示形态（WXML 不能调用函数，故预格式化） */
interface PreviewRowView {
  index: number
  rowNumber: number
  checked: boolean
  title: string
  detail: string
  tags: { text: string; cls: string }[]
  issues: string
}

Page({
  data: {
    preview: null as ImportPreview | null,
    rows: [] as PreviewRowView[],
    selectedCount: 0,
    canImport: false,
    sameFile: false,
    msg: '',
    msgClass: 'ok',
    busy: false,
    lastBatchId: '',
    summary: ''
  },

  async onDownloadTemplate() {
    showLoading('正在生成…')
    try {
      const wb = createImportTemplateWorkbook()
      const buf = workbookToArrayBuffer(wb)
      hideLoading()
      const res = await saveAndPresent(buf, '课时导入模板.xlsx')
      this.setMsg(
        res === 'opened' ? '已打开模板，可点右上角转发保存到聊天'
          : res === 'shared' ? '已转发模板文件'
            : res === 'cancelled' ? '已取消'
              : '生成失败，请重试',
        res === 'failed' ? 'error' : 'ok'
      )
    } catch (err) {
      hideLoading()
      this.setMsg(`生成模板失败：${errMsg(err)}`, 'error')
    }
  },

  async onPickFile() {
    if (this.data.busy) return
    const picked = await chooseExcelFile()
    if (!picked) return

    this.setData({ busy: true, msg: '' })
    showLoading('正在解析…')
    try {
      const buffer = await readFileAsArrayBuffer(picked.tempFilePath)
      const [courseTypes, records] = await Promise.all([repo.listCourseTypes(), repo.listRecords()])
      const preview = await parseWorkbook(buffer, picked.name, { courseTypes, records })
      const sameFile = !!(await repo.getBatchByHash(preview.fileHash))

      hideLoading()
      this.setData({ preview, sameFile })
      this.renderRows(preview.rows)
      this.setMsg(
        `解析完成：${preview.sheetName} · 共 ${preview.rows.length} 行，已勾选 ${preview.rows.filter(r => r.selected).length} 行`,
        'ok'
      )
    } catch (err) {
      hideLoading()
      this.setMsg(`导入失败：${errMsg(err)}`, 'error')
      this.setData({ preview: null, rows: [], canImport: false })
    } finally {
      this.setData({ busy: false })
    }
  },

  renderRows(rows: ParsedRow[]) {
    const view: PreviewRowView[] = rows.map((r, i) => {
      const tags: { text: string; cls: string }[] = []
      if (r.isNewCourseType) tags.push({ text: '将新建课程类型', cls: 'new' })
      if (r.isDuplicate) tags.push({ text: '重复', cls: 'dup' })
      if (r.isSample) tags.push({ text: '示例行', cls: 'sample' })

      const time = r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : (r.startTime ?? '未填时间')
      const hours = r.hours === null ? '课时?' : `${r.hours} 小时`
      const rate = r.rate === null ? '时薪?' : `¥${r.rate}/小时`
      return {
        index: i,
        rowNumber: r.rowNumber,
        checked: r.selected,
        title: `第 ${r.rowNumber} 行 · ${r.student || '（无学生）'}`,
        detail: `${r.date ?? '日期?'} · ${r.courseTypeName || '（无课程类型）'} · ${time} · ${hours} × ${rate}`,
        tags,
        issues: r.issues.length ? `问题：${r.issues.join('、')}` : ''
      }
    })
    const selectedCount = rows.filter(r => r.selected).length
    this.setData({
      rows: view,
      selectedCount,
      canImport: selectedCount > 0,
      summary: `${rows.length} 行 · 已选 ${selectedCount} 行`
    })
  },

  onToggleRow(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const preview = this.data.preview
    if (!preview) return
    const rows = [...preview.rows]
    if (!rows[index]) return
    rows[index] = { ...rows[index], selected: !rows[index].selected }
    this.setData({ preview: { ...preview, rows } })
    this.renderRows(rows)
  },

  onSelectAll() {
    const preview = this.data.preview
    if (!preview) return
    // 只勾选"无问题且非示例"的行，避免把异常数据一起导入
    const rows = preview.rows.map(r => ({ ...r, selected: r.issues.length === 0 && !r.isSample && !r.isDuplicate }))
    this.setData({ preview: { ...preview, rows } })
    this.renderRows(rows)
  },

  onSelectNone() {
    const preview = this.data.preview
    if (!preview) return
    const rows = preview.rows.map(r => ({ ...r, selected: false }))
    this.setData({ preview: { ...preview, rows } })
    this.renderRows(rows)
  },

  async onConfirm() {
    const preview = this.data.preview
    if (!preview || this.data.busy) return
    if (!this.data.canImport) return toast('请至少勾选一行')

    if (this.data.sameFile) {
      const ok = await confirmDanger('该文件之前导入过，继续可能产生重复记录。仍要导入吗？', '重复文件')
      if (!ok) return
    }

    this.setData({ busy: true })
    showLoading('正在导入…')
    try {
      const res = await applyImport(preview, repo)
      hideLoading()
      this.setData({ lastBatchId: res.batchId, preview: null, rows: [], canImport: false })
      toastOk(`已导入 ${res.inserted} 条`)
      this.setMsg(`已导入 ${res.inserted} 条记录，可在记录页查看。`, 'ok')
    } catch (err) {
      hideLoading()
      this.setMsg(`导入失败：${errMsg(err)}`, 'error')
    } finally {
      this.setData({ busy: false })
    }
  },

  async onUndo() {
    const batchId = this.data.lastBatchId
    if (!batchId || this.data.busy) return
    const ok = await confirmDanger('撤销本次导入？将删除这批新增的记录。', '撤销导入')
    if (!ok) return
    try {
      const n = await repo.deleteBatch(batchId)
      this.setData({ lastBatchId: '' })
      this.setMsg(`已撤销导入，删除 ${n} 条记录`, 'ok')
    } catch (err) {
      this.setMsg(`撤销失败：${errMsg(err)}`, 'error')
    }
  },

  setMsg(msg: string, cls: 'ok' | 'error') {
    this.setData({ msg, msgClass: cls })
  }
})
