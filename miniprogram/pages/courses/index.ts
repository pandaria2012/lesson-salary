import type { CourseType, CourseTypeStatus } from '../../core/index'
import { repo } from '../../shared/repo-singleton'
import { confirmDanger, errMsg, toast, toastOk } from '../../shared/ui'

interface CourseTypeRowView {
  id: string
  name: string
  type: string
  statusLabel: string
  statusClass: string
  defaults: string
}

interface CtForm {
  id: string
  name: string
  type: string
  status: CourseTypeStatus
  defaultHours: string
  defaultRate: string
}

const emptyForm = (): CtForm => ({
  id: '', name: '', type: '', status: 'enabled', defaultHours: '', defaultRate: ''
})

/** 课程类型：对应 Web 端 src/web/pages/CourseTypesPage.tsx */
Page({
  data: {
    rows: [] as CourseTypeRowView[],
    formOpen: false,
    formTitle: '新增课程类型',
    form: emptyForm(),
    busy: false
  },

  onShow() {
    void this.reload()
  },

  async reload() {
    try {
      const items = await repo.listCourseTypes()
      this.setData({ rows: items.map(ct => this.toRow(ct)) })
    } catch (err) {
      toast(`读取失败：${errMsg(err)}`)
    }
  },

  toRow(ct: CourseType): CourseTypeRowView {
    const h = ct.defaultHours === null ? '—' : String(ct.defaultHours)
    const r = ct.defaultRate === null ? '—' : String(ct.defaultRate)
    return {
      id: ct.id,
      name: ct.name,
      type: ct.type,
      statusLabel: ct.status === 'enabled' ? '启用' : '停用',
      statusClass: ct.status === 'enabled' ? 'ok' : 'off',
      defaults: `默认 ${h} 小时 · ${r} 元/小时`
    }
  },

  onAdd() {
    this.setData({ formOpen: true, formTitle: '新增课程类型', form: emptyForm() })
  },

  onEdit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    void this.loadForEdit(id)
  },

  async loadForEdit(id: string) {
    const items = await repo.listCourseTypes()
    const ct = items.find(c => c.id === id)
    if (!ct) return
    this.setData({
      formOpen: true,
      formTitle: '编辑课程类型',
      form: {
        id: ct.id,
        name: ct.name,
        type: ct.type,
        status: ct.status,
        defaultHours: ct.defaultHours === null ? '' : String(ct.defaultHours),
        defaultRate: ct.defaultRate === null ? '' : String(ct.defaultRate)
      }
    })
  },

  onCloseForm() {
    this.setData({ formOpen: false })
  },

  onFormName(e: WechatMiniprogram.Input) {
    this.setData({ 'form.name': e.detail.value })
  },

  onFormType(e: WechatMiniprogram.Input) {
    this.setData({ 'form.type': e.detail.value })
  },

  onFormHours(e: WechatMiniprogram.Input) {
    this.setData({ 'form.defaultHours': e.detail.value })
  },

  onFormRate(e: WechatMiniprogram.Input) {
    this.setData({ 'form.defaultRate': e.detail.value })
  },

  onToggleStatus() {
    this.setData({ 'form.status': this.data.form.status === 'enabled' ? 'disabled' : 'enabled' })
  },

  async onSave() {
    if (this.data.busy) return
    const f = this.data.form
    if (!f.name.trim()) return toast('请填写名称')

    const hours = f.defaultHours === '' ? null : Number(f.defaultHours)
    const rate = f.defaultRate === '' ? null : Number(f.defaultRate)
    if (hours !== null && !Number.isFinite(hours)) return toast('默认课时格式不正确')
    if (rate !== null && !Number.isFinite(rate)) return toast('默认时薪格式不正确')

    this.setData({ busy: true })
    try {
      await repo.saveCourseType({
        id: f.id || `ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name.trim(),
        type: f.type.trim(),
        status: f.status,
        defaultHours: hours,
        defaultRate: rate,
        createdAt: new Date().toISOString()
      })
      this.setData({ formOpen: false })
      toastOk(f.id ? '已保存' : '已新增')
      await this.reload()
    } catch (err) {
      toast(`保存失败：${errMsg(err)}`)
    } finally {
      this.setData({ busy: false })
    }
  },

  async onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const name = e.currentTarget.dataset.name as string
    const ok = await confirmDanger(`删除课程类型「${name}」？历史记录不受影响。`)
    if (!ok) return
    try {
      await repo.deleteCourseType(id)
      toast('已删除')
      await this.reload()
    } catch (err) {
      toast(`删除失败：${errMsg(err)}`)
    }
  }
})
