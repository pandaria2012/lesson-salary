import { summarize, fmtHours, fmtMoney, type GroupStats } from '../../../core/index'
import { createMonthlyWorkbook, workbookToArrayBuffer } from '../../core-workbook'
import { repo } from '../../../shared/repo-singleton'
import { saveAndPresent } from '../../../shared/file'
import { errMsg, hideLoading, showLoading, toast } from '../../../shared/ui'

/** 导出月报（分包页面）。对应 Web 端汇总页的「导出本月 Excel」。 */
Page({
  data: {
    month: '',
    totalAmount: '0.00',
    totalHours: '0',
    totalCount: 0,
    groupRows: [] as { label: string; sub: string; amount: string }[],
    busy: false,
    ready: false
  },

  onLoad(query: Record<string, string | undefined>) {
    const month = query.month || ''
    this.setData({ month })
    void this.load(month)
  },

  async load(month: string) {
    if (!month) {
      wx.showToast({ title: '缺少月份参数', icon: 'none' })
      return
    }
    try {
      const records = await repo.listRecords(month)
      const s = summarize(records)
      const groups: GroupStats[] = s.byStudent
      this.setData({
        totalAmount: fmtMoney(s.totalAmount),
        totalHours: fmtHours(s.totalHours),
        totalCount: s.totalCount,
        groupRows: groups.map(g => ({
          label: g.label,
          sub: `${g.count} 课次 · ${fmtHours(g.hours)} 小时`,
          amount: `¥${fmtMoney(g.amount)}`
        })),
        ready: records.length > 0
      })
    } catch (err) {
      toast(`读取失败：${errMsg(err)}`)
    }
  },

  async onExport() {
    if (this.data.busy) return
    if (!this.data.ready) return toast('当月暂无记录')
    this.setData({ busy: true })
    showLoading('正在生成…')
    try {
      const records = await repo.listRecords(this.data.month)
      const s = summarize(records)
      const wb = createMonthlyWorkbook(records, s.byStudent)
      const buf = workbookToArrayBuffer(wb)
      hideLoading()
      const res = await saveAndPresent(buf, `课时月报-${this.data.month}.xlsx`)
      toast(
        res === 'opened' ? '已打开月报，可点右上角转发保存'
          : res === 'shared' ? '已转发月报'
            : res === 'cancelled' ? '已取消'
              : '导出失败，请重试'
      )
    } catch (err) {
      hideLoading()
      toast(`导出失败：${errMsg(err)}`)
    } finally {
      this.setData({ busy: false })
    }
  }
})
