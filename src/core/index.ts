/**
 * 小程序主包入口（编译目标）。
 *
 * ⚠️ 禁止 `export * from './workbook'` —— workbook 依赖 XLSX（压缩后 424 KB），
 * 一旦引入就会把 SheetJS 拖进主包（上限 2 MB）。构建脚本会做断言拦截。
 *
 * ⚠️ 也不导出 memoryRepo.ts —— 它只供测试使用，线上是死代码。
 */

export * from './types'
export * from './time'
export * from './format'
export * from './summary'
export * from './calendar'
export * from './dedup'
export * from './parser'
export * from './repo'
export * from './sha256'
export * from './services/importService'
export * from './services/restoreService'
