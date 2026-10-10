import { repo } from './repo-singleton'

/**
 * 备份提醒（设计 §7）。
 *
 * 纯本地架构下，删小程序 / 换手机 / 微信清理缓存都会丢数据，
 * 因此「导出全部数据」是唯一的数据保全手段，需要主动提醒。
 *
 * 策略：超过 30 天未导出 → 每次启动提醒一次；用户可选择"不再提醒"。
 *
 * ⚠️ 触发时机：必须由**页面**（summary 的 onReady）调用，不能在 app.onLaunch 里做。
 * onLaunch 时页面栈为空，此时 showModal / navigateTo 在部分机型上会失败或丢失跳转。
 * 本模块用 once 守卫保证每次启动只提醒一次。
 */

const K_LAST_BACKUP = 'lastBackupAt'
const K_REMIND_OFF = 'backupRemindDisabled'
const REMIND_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

/** 每次启动只检查一次 */
let checkedThisLaunch = false

export async function markBackedUp(): Promise<void> {
  await repo.setSetting(K_LAST_BACKUP, new Date().toISOString())
}

export async function getLastBackupAt(): Promise<string | null> {
  const v = await repo.getSetting<string>(K_LAST_BACKUP)
  return v ?? null
}

export async function isRemindDisabled(): Promise<boolean> {
  return (await repo.getSetting<boolean>(K_REMIND_OFF)) === true
}

export async function setRemindDisabled(disabled: boolean): Promise<void> {
  await repo.setSetting(K_REMIND_OFF, disabled)
}

/** 是否需要提醒（设置页也用它显示提醒条，故不做 once 限制） */
export async function needsBackupReminder(): Promise<boolean> {
  if (await isRemindDisabled()) return false
  const last = await getLastBackupAt()
  if (!last) {
    // 从未备份过：只有在确实有数据时才提醒，避免新用户被骚扰
    const records = await repo.listRecords()
    return records.length > 0
  }
  const t = Date.parse(last)
  if (Number.isNaN(t)) return true
  return Date.now() - t > REMIND_INTERVAL_MS
}

/**
 * 由首页 onReady 调用：本次启动内最多提醒一次。
 * 使用不弹窗的静默失败策略 —— 提醒失败绝不影响主流程。
 */
export async function maybeShowBackupReminder(): Promise<void> {
  if (checkedThisLaunch) return
  checkedThisLaunch = true

  try {
    if (!(await needsBackupReminder())) return
    const last = await getLastBackupAt()
    const detail = last
      ? `上次导出备份是 ${last.slice(0, 10)}，已超过 30 天。`
      : '你还没有导出过备份。'

    wx.showModal({
      title: '建议导出备份',
      content: `${detail}\n数据仅保存在本机，删除小程序或更换手机都会丢失。`,
      confirmText: '去备份',
      cancelText: '以后再说',
      success: res => {
        if (res.confirm) {
          wx.navigateTo({ url: '/packageImport/pages/backup/index' })
        }
      }
    })
  } catch {
    // 提醒失败不应影响启动
  }
}
