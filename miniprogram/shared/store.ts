/**
 * 小程序本地存储封装。
 *
 * 设计要点（设计 §4.2 / §4.3 / §4.4）：
 * - 单个 key 上限 1 MB，总量上限 10 MB → records 按月分片
 * - 无事务 → 用"缓冲写入 + 成功一次性落盘 + 失败丢弃"模拟
 */

export const K_RECORD_INDEX = 'ls:records:index'
export const K_TYPES = 'ls:courseTypes'
export const K_BATCHES = 'ls:batches'
export const K_SETTINGS = 'ls:settings'
export const K_META = 'ls:meta'

export const monthKey = (month: string) => `ls:records:${month}`

/** 总量上限 10 MB；留出安全余量，超过 8 MB 就提示用户导出备份 */
export const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024
export const STORAGE_WARN_BYTES = 8 * 1024 * 1024
/** 单个 key 上限 1 MB，分片需据此校验 */
export const KEY_LIMIT_BYTES = 1024 * 1024

/**
 * 事务缓冲。非 null 时，store/remove 只改缓冲不落盘。
 * 最外层事务提交时才真正写入；中途抛错则整个缓冲被丢弃 = 回滚。
 */
let pending: Map<string, unknown> | null = null

/** 已缓冲的删除标记（Map 值用此常量表示"删除该 key"） */
const DELETED = Symbol('deleted')

export function load<T>(key: string, fallback: T): T {
  if (pending && pending.has(key)) {
    const v = pending.get(key)
    return (v === DELETED ? fallback : v) as T
  }
  try {
    const v = wx.getStorageSync(key)
    // wx.getStorageSync 在 key 不存在时返回 ''
    return v === '' || v === null || v === undefined ? fallback : (v as T)
  } catch {
    return fallback
  }
}

export function store(key: string, value: unknown): void {
  if (pending) {
    pending.set(key, value)
    return
  }
  wx.setStorageSync(key, value)
}

export function remove(key: string): void {
  if (pending) {
    pending.set(key, DELETED)
    return
  }
  try {
    wx.removeStorageSync(key)
  } catch {
    /* key 不存在时忽略 */
  }
}

/**
 * 事务：小程序存储没有事务能力，这里用缓冲写入模拟。
 *
 * - 成功：缓冲一次性落盘（写入失败会抛出，由调用方处理）
 * - 失败：丢弃缓冲，等同回滚
 *
 * ⚠️ 不支持嵌套。内层调用会并入外层事务；若内层抛错但被外层捕获，
 * 内层已写入缓冲的内容**不会**被单独回滚。core 层的两个 service
 * （applyImport / restoreBackup）都只有一个事务层级，不受影响。
 */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const isOuter = pending === null
  if (isOuter) pending = new Map()

  try {
    const result = await fn()
    if (isOuter) {
      const buffered = pending as Map<string, unknown>
      pending = null
      try {
        for (const [k, v] of buffered) {
          if (v === DELETED) {
            try { wx.removeStorageSync(k) } catch { /* 忽略 */ }
          } else {
            wx.setStorageSync(k, v)
          }
        }
      } catch (err) {
        // 落盘途中失败：已写入的部分无法回滚（存储无事务），
        // 但必须让调用方知道，避免"以为成功了"
        throw new Error(`本地存储写入失败：${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return result
  } catch (err) {
    if (isOuter) pending = null
    throw err
  }
}

export interface StorageInfo {
  currentSizeKB: number
  limitSizeKB: number
}

export function storageInfo(): StorageInfo {
  try {
    const info = wx.getStorageInfoSync()
    return { currentSizeKB: info.currentSize ?? 0, limitSizeKB: info.limitSize ?? 10240 }
  } catch {
    return { currentSizeKB: 0, limitSizeKB: 10240 }
  }
}

export function usedBytes(): number {
  return storageInfo().currentSizeKB * 1024
}

/** 估算一个值的序列化体积（字节） */
export function estimateBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}

export function isNearLimit(): boolean {
  return usedBytes() >= STORAGE_WARN_BYTES
}
