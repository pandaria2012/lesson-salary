import { fmtMonthRange, restoreBackup } from '../../../core/index'
import {
  createExportAllWorkbook, parseBackupWorkbook, workbookToArrayBuffer
} from '../../core-workbook'
import { repo } from '../../../shared/repo-singleton'
import { chooseExcelFile, readFileAsArrayBuffer, saveAndPresent } from '../../../shared/file'
import { confirmDanger, errMsg, hideLoading, showLoading, toast, toastOk } from '../../../shared/ui'
import { markBackedUp } from '../../../shared/backupReminder'
import type { CourseType, LessonRecord } from '../../../core/index'

type RestoreMode = 'merge' | 'overwrite'

interface PendingBackup {
  records: LessonRecord[]
  courseTypes: CourseType[]
  createdAt: string | null
}

/**
 * 备份与恢复（分包页面）。
 *
 * 纯本地架构下这是**唯一**的数据保全与迁移手段（设计 §7）：
 * 删除小程序、换手机、微信清理缓存都会丢失本地数据。
 */
Page({
  data: {
    recordCount: 0,
    courseTypeCount: 0,
    pending: null as PendingBackup | null,
    pendingSummary: '',
    pendingCreatedAt: '',
    busy: false,
    msg: '',
    msgClass: 'ok'
  },

  onShow() {
    void this.loadCounts()
  },

  async loadCounts() {
    try {
      const [records, types] = await Promise.all([repo.listRecords(), repo.listCourseTypes()])
      this.setData({ recordCount: records.length, courseTypeCount: types.length })
    } catch (err) {
      this.setMsg(`读取失败：${errMsg(err)}`, 'error')
    }
  },

  async onExportAll() {
    if (this.data.busy) return
    if (this.data.recordCount === 0 && this.data.courseTypeCount === 0) {
      return toast('暂无数据可备份')
    }
    this.setData({ busy: true })
    showLoading('正在生成…')
    try {
      const [records, courseTypes] = await Promise.all([repo.listRecords(), repo.listCourseTypes()])
      const wb = createExportAllWorkbook(records, courseTypes)
      const buf = workbookToArrayBuffer(wb)
      hideLoading()
      // 文件名描述**数据覆盖的月份范围**（首月月初 ~ 末月月末），而非导出时刻：
      //   课时备份-2026-08-01_2026-08-31.xlsx   单月
      //   课时备份-2026-08-01_2026-09-30.xlsx   跨月
      // 好处：名字本身就是"装了什么"的说明；且同一批数据重复导出得到同一个名字，
      // writeFile 覆盖同名文件 —— 不会像时间戳命名那样只增不减。
      // （被 openDocument 打开过的文件会持有文件锁无法删除，见 shared/file.ts）
      //
      // 边界：只有课程类型、没有任何记录时，范围无意义 → 用「无记录」而非「空」，
      // 避免出现"课时备份-空.xlsx"这种读起来像出错的文件名。
      const range = records.length > 0 ? fmtMonthRange(records.map(r => r.date)) : '无记录'
      const res = await saveAndPresent(buf, `课时备份-${range}.xlsx`)

      if (res === 'opened' || res === 'shared') {
        // 只有真正产出了文件才记录备份时间，避免"点了但没存"造成误判
        await markBackedUp()
        this.setMsg(
          res === 'opened'
            ? '已打开备份文件。请点右上角菜单转发到聊天或保存，才算真正备份完成。'
            : '已转发备份文件。',
          'ok'
        )
        await this.loadCounts()
      } else if (res === 'cancelled') {
        this.setMsg('已取消导出', 'ok')
      } else {
        this.setMsg('导出失败，请重试', 'error')
      }
    } catch (err) {
      hideLoading()
      this.setMsg(`导出失败：${errMsg(err)}`, 'error')
    } finally {
      this.setData({ busy: false })
    }
  },

  async onPickBackup() {
    if (this.data.busy) return
    const picked = await chooseExcelFile()
    if (!picked) return

    this.setData({ busy: true })
    showLoading('正在解析备份…')
    try {
      const buffer = await readFileAsArrayBuffer(picked.tempFilePath)
      const backup = await parseBackupWorkbook(buffer)
      hideLoading()

      if (backup.records.length === 0 && backup.courseTypes.length === 0) {
        this.setData({ pending: null })
        return this.setMsg('该文件不含可恢复的数据，请确认是「导出全部数据」生成的文件。', 'error')
      }

      this.setData({
        pending: backup,
        pendingSummary: `记录 ${backup.records.length} 条，课程类型 ${backup.courseTypes.length} 个`,
        // 展示备份文件自身的创建时间，便于用户确认选对了哪一份备份
        pendingCreatedAt: backup.createdAt ?? '未知（该文件未记录创建时间）'
      })
      this.setMsg('解析完成，请选择恢复方式。', 'ok')
    } catch (err) {
      hideLoading()
      this.setData({ pending: null })
      this.setMsg(`解析失败：${errMsg(err)}`, 'error')
    } finally {
      this.setData({ busy: false })
    }
  },

  async onRestore(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as RestoreMode
    const backup = this.data.pending
    if (!backup || this.data.busy) return

    if (mode === 'overwrite') {
      const ok = await confirmDanger(
        '覆盖恢复会先清空本机现有的全部记录与课程类型，且无法撤销。确定继续？',
        '覆盖恢复'
      )
      if (!ok) return
    }

    this.setData({ busy: true })
    showLoading('正在恢复…')
    try {
      const res = await restoreBackup(backup, mode, repo)
      hideLoading()
      this.setData({ pending: null })
      this.setMsg(
        `恢复完成：新增记录 ${res.records} 条，课程类型 ${res.courseTypes} 个（${mode === 'merge' ? '合并' : '覆盖'}）`,
        'ok'
      )
      await this.loadCounts()
      toastOk('已恢复')
    } catch (err) {
      hideLoading()
      this.setMsg(`恢复失败：${errMsg(err)}`, 'error')
    } finally {
      this.setData({ busy: false })
    }
  },

  onCancelPending() {
    this.setData({ pending: null })
  },

  setMsg(msg: string, cls: 'ok' | 'error') {
    this.setData({ msg, msgClass: cls })
  }
})
