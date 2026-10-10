/** wx 交互 API 的 Promise 封装。 */

export function toast(title: string, icon: 'success' | 'none' | 'error' = 'none'): void {
  wx.showToast({ title, icon, duration: 2000 })
}

export function toastOk(title: string): void {
  wx.showToast({ title, icon: 'success', duration: 1500 })
}

/** 确认框，返回是否点击了确定 */
export function confirm(content: string, title = '提示'): Promise<boolean> {
  return new Promise(resolve => {
    wx.showModal({
      title,
      content,
      success: res => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}

/** 危险操作确认：确定按钮标红 */
export function confirmDanger(content: string, title = '确认操作'): Promise<boolean> {
  return new Promise(resolve => {
    wx.showModal({
      title,
      content,
      confirmText: '确定',
      confirmColor: '#d93025',
      success: res => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}

export function showLoading(title: string): void {
  wx.showLoading({ title, mask: true })
}

export function hideLoading(): void {
  try {
    wx.hideLoading()
  } catch {
    /* 未显示时忽略 */
  }
}

export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}
