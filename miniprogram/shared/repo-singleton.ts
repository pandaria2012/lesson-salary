import { createWxRepo } from './repo'
import { isNearLimit } from './store'
import type { Repo } from '../core/index'

/**
 * 全局唯一的 Repo 实例（对应 Web 端 src/web/db/repo.ts 的 `repo`）。
 *
 * 放在模块作用域，页面通过 `import { repo } from '../../shared/repo-singleton'` 使用；
 * 这样各页面共享同一个实例，避免重复构造。
 */
export const repo: Repo = createWxRepo()

/** 存储接近上限时的统一提示（设计 §4.4）。返回 true 表示已提示。 */
export function warnIfStorageFull(): boolean {
  if (!isNearLimit()) return false
  wx.showModal({
    title: '存储空间不足',
    content: '本地存储已接近上限，建议先导出备份，再清理部分历史记录。',
    confirmText: '知道了',
    showCancel: false
  })
  return true
}
