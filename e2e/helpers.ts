import { test, expect, type Page } from '@playwright/test'

/**
 * e2e 公共工具。
 *
 * ⚠️ 关于日期：应用默认展示**当前月**，而测试曾硬编码 2026-08 的日期。
 * 一旦真实时间跨月（2026-09 之后），补录的记录落在 8 月、视图停在当前月，
 * 所有依赖列表/日历/汇总的断言就会失败 —— 与代码无关的时间炸弹。
 *
 * 因此这里统一提供「当前月」的日期生成，任何用例都不应再硬编码年月。
 */

/** 当前月 'YYYY-MM' */
export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 当前月的第 n 天，'YYYY-MM-DD'；n 超出当月天数时自动落到下月（由 Date 归一化） */
export function dayOfCurrentMonth(n: number): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`
}

/** 当前月第 n 天的「8月10日」式标签（与 core/calendar.fmtDayLabel 一致，用于断言） */
export function dayLabel(n: number): string {
  const d = new Date()
  return `${d.getMonth() + 1}月${n}日`
}

/** 跳过「添加到桌面」引导，并禁用系统分享/保存对话框（强制走下载兜底） */
export async function preparePage(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('ls.installGuideDismissed', '1'))
  await page.addInitScript(() => {
    try { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }) } catch { /* ignore */ }
    try { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }) } catch { /* ignore */ }
    try { Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }) } catch { /* ignore */ }
  })
}

export async function addCourseType(page: Page, name = '数学1对1', hours = '2', rate = '200') {
  await page.getByRole('button', { name: '课程', exact: true }).click()
  await page.getByRole('button', { name: '新增', exact: true }).click()
  await page.locator('.sheet input[placeholder*="初三数学"]').fill(name)
  await page.locator('.sheet input[list="teaching-forms"]').fill('一对一')
  await page.locator('.sheet input[inputmode="decimal"]').nth(0).fill(hours)
  await page.locator('.sheet input[inputmode="decimal"]').nth(1).fill(rate)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

export async function addRecord(
  page: Page,
  opts: { courseLabel: string; student: string; date: string; start: string; end: string; rate: string }
) {
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.getByRole('button', { name: /补录/ }).click()
  await page.locator('.sheet select').nth(0).selectOption({ label: opts.courseLabel })
  await page.locator('.sheet input[placeholder*="张三"]').fill(opts.student)
  await page.locator('.sheet input[type="date"]').fill(opts.date)
  await page.locator('.sheet input[type="time"]').nth(0).fill(opts.start)
  await page.locator('.sheet input[type="time"]').nth(1).fill(opts.end)
  await page.locator('.sheet input[inputmode="decimal"]').fill(opts.rate)
  await page.getByRole('button', { name: '保存', exact: true }).click()
}

/** 切到列表视图（记录页/汇总页默认是日历视图） */
export async function showList(page: Page) {
  await page.getByRole('button', { name: '列表', exact: true }).click()
}
