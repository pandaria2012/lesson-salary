export const DISMISS_KEY = 'ls.installGuideDismissed'

export type InstallPlatform = 'ios' | 'android' | 'desktop'

/** 根据 UA 与触屏能力判断平台（iPadOS Safari 的 UA 是 Macintosh，靠触屏点数区分） */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipod|ipad/.test(ua)) return 'ios'
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

/** 是否已以独立模式运行（已从桌面/主屏幕启动） */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches
  return !!nav.standalone || displayMode
}

/** 是否应在启动时自动弹出安装引导 */
export function shouldAutoShow(dismissed: boolean, standalone: boolean): boolean {
  return !dismissed && !standalone
}

/** 读取是否已持久化关闭引导 */
export function isGuideDismissed(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    return s?.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** 持久化标记「已关闭引导」 */
export function markGuideDismissed(storage?: Pick<Storage, 'setItem'>): void {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    s?.setItem(DISMISS_KEY, '1')
  } catch {
    /* 忽略隐私模式等写入失败 */
  }
}
