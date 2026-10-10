import {
  buildDayMap, fmtDayLabel, fmtHours, fmtMoney, monthGrid, summarize, todayStr,
  type DayInfo, type GroupStats, type LessonRecord
} from '../../core/index'
import { repo } from '../../shared/repo-singleton'
import { errMsg } from '../../shared/ui'
import { currentMonth } from '../../shared/month'

type GroupTab = 'student' | 'courseType' | 'kind'
type ViewMode = 'list' | 'calendar'

/** 预格式化后的分组行（WXML 不能调用函数，展示值必须在 setData 前算好） */
interface GroupRowView { label: string; sub: string; amount: string }

interface DayCell {
  date: string | null
  day: number | null
  isToday: boolean
  count: number
  amount: string
  cancelledCount: number
}

interface CancelledRowView { id: string; text: string }

Page({
  data: {
    month: currentMonth(),
    view: 'calendar' as ViewMode,
    tab: 'student' as GroupTab,
    // 摘要卡
    totalAmount: '0.00',
    totalHours: '0',
    totalCount: 0,
    cancelledCount: 0,
    // 列表
    groups: [] as GroupRowView[],
    hasGroups: false,
    cancelledRows: [] as CancelledRowView[],
    cancelledOpen: false,
    // 日历
    calCells: [] as DayCell[],
    detailDate: '' as string,
    detailTitle: '',
    detailOpen: false,
    detailRows: [] as CancelledRowView[],
    // 状态
    hasAnyRecord: false
  },

  onLoad() {
    void this.reload()
  },

  onShow() {
    // 从记录页/导入页返回时需要刷新
    void this.reload()
  },

  async reload() {
    try {
      const records = await repo.listRecords(this.data.month)
      this.applyRecords(records)
    } catch (err) {
      wx.showToast({ title: `读取失败：${errMsg(err)}`, icon: 'none' })
    }
  },

  /** 把当月记录换算成页面所需的全部展示数据 */
  applyRecords(records: LessonRecord[]) {
    const s = summarize(records)
    const byTab: Record<GroupTab, GroupStats[]> = {
      student: s.byStudent,
      courseType: s.byCourseType,
      kind: s.byKind
    }
    const cancelled = records.filter(r => r.status === 'cancelled')
    const dayMap = buildDayMap(records)

    this.setData({
      totalAmount: fmtMoney(s.totalAmount),
      totalHours: fmtHours(s.totalHours),
      totalCount: s.totalCount,
      cancelledCount: s.cancelledCount,
      groups: this.toGroupRows(byTab[this.data.tab]),
      hasGroups: byTab[this.data.tab].length > 0,
      cancelledRows: cancelled.map(r => ({
        id: r.id,
        text: `${r.date} ${r.student} ${r.courseTypeName}（${r.hours ?? '?'}小时 × ¥${r.rate ?? '?'}）`
      })),
      calCells: this.toDayCells(this.data.month, dayMap),
      hasAnyRecord: records.length > 0
    })

    // 明细面板开着时同步刷新
    if (this.data.detailDate) this.openDetail(this.data.detailDate, records)
  },

  toGroupRows(groups: GroupStats[]): GroupRowView[] {
    return groups.map(g => ({
      label: g.label,
      sub: `${g.count} 课次 · ${fmtHours(g.hours)} 小时`,
      amount: `¥${fmtMoney(g.amount)}`
    }))
  },

  toDayCells(month: string, dayMap: Map<string, DayInfo>): DayCell[] {
    const today = todayStr()
    return monthGrid(month).map(date => {
      if (!date) return { date: null, day: null, isToday: false, count: 0, amount: '', cancelledCount: 0 }
      const info = dayMap.get(date)
      return {
        date,
        day: Number(date.slice(8)),
        isToday: date === today,
        count: info?.count ?? 0,
        amount: info && info.count > 0 ? fmtMoney(info.amount) : '',
        cancelledCount: info?.cancelledCount ?? 0
      }
    })
  },

  onMonthChange(e: WechatMiniprogram.CustomEvent<{ month: string }>) {
    this.setData({ month: e.detail.month, detailDate: '', detailOpen: false }, () => {
      void this.reload()
    })
  },

  onViewChange(e: WechatMiniprogram.TouchEvent) {
    this.setData({ view: e.currentTarget.dataset.view as ViewMode })
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as GroupTab
    this.setData({ tab })
    void this.reload()
  },

  onToggleCancelled() {
    this.setData({ cancelledOpen: !this.data.cancelledOpen })
  },

  onSelectDay(e: WechatMiniprogram.TouchEvent) {
    const date = e.currentTarget.dataset.date as string
    if (!date) return
    if (this.data.detailDate === date && this.data.detailOpen) {
      this.setData({ detailOpen: false })
      return
    }
    void this.openDetailById(date)
  },

  async openDetailById(date: string) {
    const records = await repo.listRecords(this.data.month)
    this.openDetail(date, records)
  },

  openDetail(date: string, records: LessonRecord[]) {
    const rows = records
      .filter(r => r.date === date)
      .map(r => {
        const time = r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '未填时间'
        const amount = r.rate !== null && r.hours !== null ? `¥${fmtMoney(r.rate * r.hours)}` : '金额待补'
        const status = r.status === 'cancelled' ? '（已取消）' : ''
        return { id: r.id, text: `${r.student} · ${r.courseTypeName} · ${time} · ${amount}${status}` }
      })
    this.setData({
      detailOpen: true,
      detailDate: date,
      detailTitle: fmtDayLabel(date),
      detailRows: rows
    })
  },

  onCloseDetail() {
    this.setData({ detailOpen: false })
  },

  onExportMonth() {
    if (!this.data.hasAnyRecord) {
      wx.showToast({ title: '当月暂无记录', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/packageImport/pages/export/index?month=${this.data.month}`
    })
  },

  onGoRecords() {
    wx.switchTab({ url: '/pages/records/index' })
  }
})
