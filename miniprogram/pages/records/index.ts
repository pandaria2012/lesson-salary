import {
  buildDayMap, computeHours, findDuplicateRecord, fmtDayLabel, fmtMoney,
  monthGrid, todayStr, addMinutes, nextHalfHour,
  type CourseType, type DayInfo, type LessonRecord
} from '../../core/index'
import { repo } from '../../shared/repo-singleton'
import { confirmDanger, errMsg, toast, toastOk } from '../../shared/ui'
import { currentMonth } from '../../shared/month'

type ViewMode = 'list' | 'calendar'
type StatusFilter = 'all' | 'normal' | 'cancelled'
type GroupBy = 'day' | 'course' | 'student'

interface GroupView { key: string; label: string; sub: string; rows: RecordRowView[] }
interface RecordRowView {
  id: string
  date: string
  time: string
  student: string
  courseTypeName: string
  amount: string
  isCancelled: boolean
}
interface DayCell {
  date: string | null
  day: number | null
  isToday: boolean
  count: number
  amount: string
  cancelledCount: number
}
interface PickerOption { label: string; value: string }
interface FormState {
  id: string
  date: string
  startTime: string
  endTime: string
  student: string
  courseTypeId: string
  courseTypeName: string
  rate: string
  hours: string
  status: 'normal' | 'cancelled'
  note: string
}

const emptyForm = (): FormState => {
  const start = nextHalfHour()
  return {
    id: '', date: todayStr(), startTime: start, endTime: addMinutes(start, 120) ?? '',
    student: '', courseTypeId: '', courseTypeName: '', rate: '', hours: '2',
    status: 'normal', note: ''
  }
}

/**
 * 非响应式的原始数据与列表。
 *
 * 放在模块作用域而不是 data：
 * 1. 这些是完整记录对象，放进 data 会被 setData 序列化，浪费性能（且 WXML 用不到）
 * 2. tabBar 页面在生命周期内是单实例，模块级状态即可安全复用
 * 3. 页面 data 只保留"已格式化、供渲染"的派生值（设计 §6.3）
 */
let monthRecords: LessonRecord[] = []
let allRecords: LessonRecord[] = []
let courseTypesCache: CourseType[] = []

Page({
  data: {
    month: currentMonth(),
    view: 'list' as ViewMode,
    groupBy: 'day' as GroupBy,
    // 分组结果
    groups: [] as GroupView[],
    emptyText: '本月暂无记录，可导入课程表或手动补录。',
    // 筛选
    filterStudent: '',
    filterCourse: '',
    filterStatus: 'all' as StatusFilter,
    hasFilter: false,
    filteredCount: 0,
    studentFilterIndex: 0,
    courseFilterIndex: 0,
    statusFilterIndex: 0,
    studentFilterOptions: [] as PickerOption[],
    courseFilterOptions: [] as PickerOption[],
    statusFilterOptions: [
      { label: '全部状态', value: 'all' },
      { label: '正常', value: 'normal' },
      { label: '已取消', value: 'cancelled' }
    ] as PickerOption[],
    // 日历
    calCells: [] as DayCell[],
    detailTitle: '',
    detailOpen: false,
    detailRows: [] as { id: string; text: string }[],
    // 表单
    formOpen: false,
    form: emptyForm(),
    formTitle: '补录记录',
    courseTypeOptions: [] as PickerOption[],
    courseTypeIndex: -1,
    studentOptions: [] as string[],
    dupWarning: '',
    busy: false
  },

  onLoad() {
    void this.reload()
  },

  onShow() {
    void this.reload()
  },

  async reload() {
    try {
      const [monthRecords, allRecords, courseTypes, studentNames] = await Promise.all([
        repo.listRecords(this.data.month),
        repo.listRecords(),
        repo.listCourseTypes(),
        repo.listStudentNames()
      ])
      this.applyAll(monthRecords, allRecords, courseTypes, studentNames)
    } catch (err) {
      wx.showToast({ title: `读取失败：${errMsg(err)}`, icon: 'none' })
    }
  },

  applyAll(monthRows: LessonRecord[], allRows: LessonRecord[], types: CourseType[], studentNames: string[]) {
    allRecords = allRows
    monthRecords = monthRows
    courseTypesCache = types

    const students = [...new Set(monthRows.map(r => r.student).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    const courses = [...new Set(monthRows.map(r => r.courseTypeName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))

    const studentFilterOptions: PickerOption[] = [
      { label: '全部学生', value: '' },
      ...students.map(s => ({ label: s, value: s }))
    ]
    const courseFilterOptions: PickerOption[] = [
      { label: '全部课程', value: '' },
      ...courses.map(c => ({ label: c, value: c }))
    ]
    const courseTypeOptions: PickerOption[] = types
      .filter(c => c.status === 'enabled' || this.data.form.courseTypeId === c.id)
      .map(c => ({ label: c.name, value: c.id }))

    this.setData({
      studentFilterOptions,
      courseFilterOptions,
      courseTypeOptions,
      studentOptions: studentNames
    })
    this.recompute()
  },

  /** 应用筛选 + 分组 + 日历，全部展示值在此预格式化 */
  recompute() {
    const items = monthRecords ?? []
    const { filterStudent, filterCourse, filterStatus, groupBy, month } = this.data

    const filtered = items.filter(r =>
      (!filterStudent || r.student === filterStudent) &&
      (!filterCourse || r.courseTypeName === filterCourse) &&
      (filterStatus === 'all' || r.status === filterStatus)
    )

    const hasFilter = filterStudent !== '' || filterCourse !== '' || filterStatus !== 'all'
    const groups = this.toGroups(filtered, groupBy)

    this.setData({
      groups,
      hasFilter,
      filteredCount: filtered.length,
      emptyText: items.length === 0
        ? '本月暂无记录，可导入课程表或手动补录。'
        : '没有符合筛选条件的记录。',
      calCells: this.toDayCells(month, buildDayMap(filtered))
    })
  },

  toGroups(rows: LessonRecord[], groupBy: GroupBy): GroupView[] {
    const map = new Map<string, LessonRecord[]>()
    for (const r of rows) {
      const key = groupBy === 'day' ? r.date : groupBy === 'course' ? r.courseTypeName : r.student
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }

    const list: GroupView[] = [...map.entries()].map(([key, groupRows]) => {
      const label = groupBy === 'day'
        ? (key ? fmtDayLabel(key) : '未填日期')
        : (key || '（未分类）')
      const amount = groupRows.reduce(
        (sum, r) => sum + (r.status === 'normal' && r.rate !== null && r.hours !== null ? r.rate * r.hours : 0), 0)
      return {
        key,
        label,
        sub: `${groupRows.length} 条 · ¥${fmtMoney(amount)}`,
        rows: groupRows.map(r => this.toRowView(r))
      }
    })

    if (groupBy === 'day') list.sort((a, b) => (a.key < b.key ? 1 : -1))
    else list.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
    return list
  },

  toRowView(r: LessonRecord): RecordRowView {
    return {
      id: r.id,
      date: r.date,
      time: r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '未填时间',
      student: r.student,
      courseTypeName: r.courseTypeName,
      amount: r.rate !== null && r.hours !== null ? `¥${fmtMoney(r.rate * r.hours)}` : '金额待补',
      isCancelled: r.status === 'cancelled'
    }
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

  // ---- 交互 ----

  onMonthChange(e: WechatMiniprogram.CustomEvent<{ month: string }>) {
    this.setData({ month: e.detail.month }, () => { void this.reload() })
  },

  onViewChange(e: WechatMiniprogram.TouchEvent) {
    this.setData({ view: e.currentTarget.dataset.view as ViewMode })
  },

  onGroupByChange(e: WechatMiniprogram.TouchEvent) {
    const groupBy = e.currentTarget.dataset.by as GroupBy
    this.setData({ groupBy })
    this.recompute()
  },

  onStudentFilter(e: WechatMiniprogram.PickerChange) {
    const i = Number(e.detail.value)
    const opt = this.data.studentFilterOptions[i]
    this.setData({ studentFilterIndex: i, filterStudent: opt?.value ?? '' })
    this.recompute()
  },

  onCourseFilter(e: WechatMiniprogram.PickerChange) {
    const i = Number(e.detail.value)
    const opt = this.data.courseFilterOptions[i]
    this.setData({ courseFilterIndex: i, filterCourse: opt?.value ?? '' })
    this.recompute()
  },

  onStatusFilter(e: WechatMiniprogram.PickerChange) {
    const i = Number(e.detail.value)
    const opt = this.data.statusFilterOptions[i]
    this.setData({ statusFilterIndex: i, filterStatus: (opt?.value ?? 'all') as StatusFilter })
    this.recompute()
  },

  onClearFilters() {
    this.setData({
      filterStudent: '', filterCourse: '', filterStatus: 'all',
      studentFilterIndex: 0, courseFilterIndex: 0, statusFilterIndex: 0
    })
    this.recompute()
  },

  onSelectDay(e: WechatMiniprogram.TouchEvent) {
    const date = e.currentTarget.dataset.date as string
    if (!date) return
    if (this.data.detailTitle === fmtDayLabel(date) && this.data.detailOpen) {
      this.setData({ detailOpen: false })
      return
    }
    const rows = (monthRecords ?? []).filter(r => r.date === date).map(r => {
      const time = r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '未填时间'
      const amount = r.rate !== null && r.hours !== null ? `¥${fmtMoney(r.rate * r.hours)}` : '金额待补'
      const status = r.status === 'cancelled' ? '（已取消）' : ''
      return { id: r.id, text: `${r.student} · ${r.courseTypeName} · ${time} · ${amount}${status}` }
    })
    this.setData({ detailOpen: true, detailTitle: fmtDayLabel(date), detailRows: rows })
  },

  onCloseDetail() {
    this.setData({ detailOpen: false })
  },

  // ---- 记录增删改 ----

  onAdd() {
    this.setData({
      formOpen: true,
      formTitle: '补录记录',
      form: emptyForm(),
      courseTypeIndex: -1,
      dupWarning: ''
    })
  },

  onEdit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const r = (monthRecords ?? []).find(x => x.id === id)
    if (!r) return
    const idx = this.data.courseTypeOptions.findIndex(o => o.value === (r.courseTypeId ?? ''))
    this.setData({
      formOpen: true,
      formTitle: '编辑记录',
      courseTypeIndex: idx,
      dupWarning: '',
      form: {
        id: r.id,
        date: r.date,
        startTime: r.startTime ?? '',
        endTime: r.endTime ?? '',
        student: r.student,
        courseTypeId: r.courseTypeId ?? '',
        courseTypeName: r.courseTypeName,
        rate: r.rate === null ? '' : String(r.rate),
        hours: r.hours === null ? '' : String(r.hours),
        status: r.status,
        note: r.note ?? ''
      }
    })
  },

  onCloseForm() {
    this.setData({ formOpen: false })
  },

  onFormDate(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'form.date': String(e.detail.value) })
  },

  onFormStart(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'form.startTime': String(e.detail.value) }, () => this.recalcHours())
  },

  onFormEnd(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'form.endTime': String(e.detail.value) }, () => this.recalcHours())
  },

  recalcHours() {
    const { startTime, endTime } = this.data.form
    const h = computeHours(startTime || null, endTime || null)
    if (h !== null) this.setData({ 'form.hours': String(h) })
  },

  onFormStudent(e: WechatMiniprogram.Input) {
    this.setData({ 'form.student': e.detail.value })
  },

  onFormRate(e: WechatMiniprogram.Input) {
    this.setData({ 'form.rate': e.detail.value })
  },

  onFormHours(e: WechatMiniprogram.Input) {
    this.setData({ 'form.hours': e.detail.value })
  },

  onFormNote(e: WechatMiniprogram.Input) {
    this.setData({ 'form.note': e.detail.value })
  },

  onFormCourseType(e: WechatMiniprogram.PickerChange) {
    const i = Number(e.detail.value)
    const opt = this.data.courseTypeOptions[i]
    if (!opt) return
    const ct = (courseTypesCache ?? []).find(c => c.id === opt.value)
    this.setData({
      courseTypeIndex: i,
      'form.courseTypeId': opt.value,
      'form.courseTypeName': ct?.name ?? opt.label,
      // 默认时薪/课时：仅在用户尚未填写时带入，避免覆盖手填值
      'form.rate': this.data.form.rate || (ct?.defaultRate !== null && ct?.defaultRate !== undefined ? String(ct.defaultRate) : ''),
      'form.hours': this.data.form.hours || (ct?.defaultHours !== null && ct?.defaultHours !== undefined ? String(ct.defaultHours) : '')
    })
  },

  onFormDuration(e: WechatMiniprogram.TouchEvent) {
    const hours = Number(e.currentTarget.dataset.hours)
    const start = this.data.form.startTime || nextHalfHour()
    const end = addMinutes(start, Math.round(hours * 60))
    this.setData({
      'form.startTime': start,
      'form.endTime': end ?? '',
      'form.hours': String(hours)
    })
  },

  onToggleFormStatus() {
    const next = this.data.form.status === 'normal' ? 'cancelled' : 'normal'
    this.setData({ 'form.status': next })
  },

  async onSave() {
    if (this.data.busy) return
    const f = this.data.form

    if (!f.date) return toast('请选择日期')
    if (!f.student.trim()) return toast('请填写学生')
    if (!f.courseTypeName) return toast('请选择课程类型')

    const rate = f.rate === '' ? null : Number(f.rate)
    const hours = f.hours === '' ? null : Number(f.hours)
    if (rate !== null && !Number.isFinite(rate)) return toast('时薪格式不正确')
    if (hours !== null && !Number.isFinite(hours)) return toast('课时格式不正确')

    const candidate = {
      courseTypeName: f.courseTypeName,
      student: f.student.trim(),
      date: f.date,
      startTime: f.startTime || null,
      endTime: f.endTime || null
    }

    // 防重复确认（复用 core 的 dedup 逻辑）
    if (f.status === 'normal') {
      const dup = findDuplicateRecord(candidate, allRecords ?? [], f.id || undefined)
      if (dup) {
        const ok = await confirmDanger(
          `已存在相同记录：${dup.date} ${dup.student} ${dup.courseTypeName}。仍要保存吗？`,
          '可能重复'
        )
        if (!ok) return
      }
    }

    this.setData({ busy: true })
    try {
      const ct = (courseTypesCache ?? []).find(c => c.id === f.courseTypeId)
      const record: LessonRecord = {
        id: f.id || `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        courseTypeId: f.courseTypeId || null,
        courseTypeName: f.courseTypeName,
        courseTypeKind: ct?.type ?? '',
        rate,
        student: f.student.trim(),
        date: f.date,
        startTime: f.startTime || null,
        endTime: f.endTime || null,
        hours,
        status: f.status,
        source: 'manual',
        batchId: null,
        note: f.note,
        createdAt: new Date().toISOString()
      }
      await repo.saveRecord(record)
      this.setData({ formOpen: false })
      toastOk(f.id ? '已保存' : '已补录')
      await this.reload()
    } catch (err) {
      toast(`保存失败：${errMsg(err)}`)
    } finally {
      this.setData({ busy: false })
    }
  },

  async onToggleCancel(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const r = (monthRecords ?? []).find(x => x.id === id)
    if (!r) return
    try {
      await repo.saveRecord({ ...r, status: r.status === 'normal' ? 'cancelled' : 'normal' })
      toast(r.status === 'normal' ? '已标记取消' : '已恢复')
      await this.reload()
    } catch (err) {
      toast(`操作失败：${errMsg(err)}`)
    }
  },

  async onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const ok = await confirmDanger('删除这条记录？删除后无法恢复。', '删除记录')
    if (!ok) return
    try {
      await repo.deleteRecord(id)
      toast('已删除')
      await this.reload()
    } catch (err) {
      toast(`删除失败：${errMsg(err)}`)
    }
  },

  onGoImport() {
    wx.navigateTo({ url: '/packageImport/pages/import/index' })
  }
})
