import { checkBackupReminder } from './shared/backupReminder'

App({
  onLaunch() {
    // 备份提醒（设计 §7）：数据只在本机，导出备份是唯一的保全手段
    checkBackupReminder()
  }
})
