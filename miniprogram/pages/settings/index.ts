import { fmtDateTime } from '../../core/index'
import { repo } from '../../shared/repo-singleton'
import { storageInfo, usedBytes, STORAGE_LIMIT_BYTES } from '../../shared/store'
import { confirmDanger, errMsg, toast, toastOk } from '../../shared/ui'
import { getLastBackupAt, isRemindDisabled, needsBackupReminder, setRemindDisabled } from '../../shared/backupReminder'

/**
 * 设置页。
 *
 * 与 Web 端差异：
 * - 移除「添加到桌面（PWA）」与「PIN 锁」（设计 D7：小程序不需要 PWA；PIN 已砍）
 * - 新增「清空所有数据」：PIN 移除后，原本挂在 PinLock 里的重置入口消失了，
 *   而小程序上架要求提供用户数据删除入口（设计 §8），因此必须在此补回。
 * - 新增存储用量显示：纯本地架构下用户需要知道还剩多少空间
 */
Page({
  data: {
    lastBackupAt: '从未备份',
    remindDisabled: false,
    showRemindBanner: false,
    storageUsed: '0 KB',
    storageLimit: '10 MB',
    storagePercent: 0,
    busy: false
  },

  onShow() {
    void this.refresh()
  },

  async refresh() {
    try {
      const info = storageInfo()
      const last = await getLastBackupAt()
      const used = usedBytes()
      this.setData({
        // 完整到秒（本地时区）；fmtDateTime 对非法值返回空串，回落到"从未备份"
        lastBackupAt: fmtDateTime(last ?? '') || '从未备份',
        remindDisabled: await isRemindDisabled(),
        showRemindBanner: await needsBackupReminder(),
        storageUsed: this.fmtSize(used),
        storageLimit: this.fmtSize(info.limitSizeKB * 1024 || STORAGE_LIMIT_BYTES),
        storagePercent: Math.min(100, Math.round(used / (info.limitSizeKB * 1024 || STORAGE_LIMIT_BYTES) * 100))
      })
    } catch (err) {
      toast(`读取失败：${errMsg(err)}`)
    }
  },

  fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  },

  onGoBackup() {
    wx.navigateTo({ url: '/packageImport/pages/backup/index' })
  },

  onGoImport() {
    wx.navigateTo({ url: '/packageImport/pages/import/index' })
  },

  async onToggleRemind(e: WechatMiniprogram.SwitchChange) {
    // switch 的 value 表示"开启提醒"；存储的是 reminderDisabled，故取反
    const next = !e.detail.value
    try {
      await setRemindDisabled(next)
      toast(next ? '已关闭备份提醒' : '已开启备份提醒')
      await this.refresh()
    } catch (err) {
      toast(`操作失败：${errMsg(err)}`)
    }
  },

  /** 清空所有数据（用户数据删除入口，上架要求） */
  async onClearAll() {
    if (this.data.busy) return
    const first = await confirmDanger(
      '将删除本机全部课程类型、上课记录与设置，且无法恢复。\n建议先导出备份。确定继续？',
      '清空所有数据'
    )
    if (!first) return
    const second = await confirmDanger('最后确认：删除后数据不可找回。', '再次确认')
    if (!second) return

    this.setData({ busy: true })
    try {
      await repo.clearAll()
      toastOk('已清空')
      await this.refresh()
    } catch (err) {
      toast(`清空失败：${errMsg(err)}`)
    } finally {
      this.setData({ busy: false })
    }
  },

  onAbout() {
    wx.showModal({
      title: '关于',
      content: '三尺课时账 v1.0.0\n\n数据仅保存在本机，不联网、不上传、无需注册。\n删除小程序或更换手机都会丢失数据，请定期导出备份。',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
