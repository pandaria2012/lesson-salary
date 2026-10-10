App({
  onLaunch() {
    // 备份提醒不在这里做：onLaunch 时页面栈为空，
    // showModal / navigateTo 在部分机型上会失败。
    // 改由首页 onReady 调用 maybeShowBackupReminder()。
  }
})
