import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ls.installGuideDismissed', '1'))
})

async function addCourseType(page: Page) {
  await page.getByRole('button', { name: '课程', exact: true }).click()
  await page.getByRole('button', { name: '新增', exact: true }).click()
  await page.locator('.sheet input[placeholder*="初三数学"]').fill('数学1对1')
  await page.locator('.sheet input[list="teaching-forms"]').fill('一对一')
  await page.locator('.sheet input[inputmode="decimal"]').nth(0).fill('2')
  await page.locator('.sheet input[inputmode="decimal"]').nth(1).fill('200')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('数学1对1', { exact: true })).toBeVisible()
}

async function addRecord(page: Page, student: string, date: string, start: string, end: string) {
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.getByRole('button', { name: /补录/ }).click()
  await page.locator('.sheet select').nth(0).selectOption({ label: '数学1对1' })
  await page.locator('.sheet input[placeholder*="张三"]').fill(student)
  await page.locator('.sheet input[type="date"]').fill(date)
  await page.locator('.sheet input[type="time"]').nth(0).fill(start)
  await page.locator('.sheet input[type="time"]').nth(1).fill(end)
  await page.locator('.sheet input[inputmode="decimal"]').fill('200')
  await page.getByRole('button', { name: '保存', exact: true }).click()
}

test('记录页：日历展示每日课次/金额，点击弹当天明细', async ({ page }) => {
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page, '张三', '2026-08-10', '13:00', '15:00')
  await addRecord(page, '李四', '2026-08-12', '10:00', '11:00')

  await expect(page.locator('.calendar')).toBeVisible() // 默认即为日历视图
  await page.getByRole('button', { name: '日历', exact: true }).click()
  await expect(page.locator('.calendar')).toBeVisible()
  await expect(page.locator('.cal-cell[data-date="2026-08-10"]')).toContainText('¥400')
  await expect(page.locator('.cal-cell[data-date="2026-08-10"]')).toContainText('1课')
  await expect(page.locator('.cal-cell[data-date="2026-08-12"]')).toContainText('¥200')

  // 点击某天 → 底部弹层当天明细
  await page.locator('.cal-cell[data-date="2026-08-10"]').click()
  const sheet = page.locator('.sheet')
  await expect(sheet.getByText('8月10日 明细')).toBeVisible()
  await expect(sheet.getByText('张三', { exact: true })).toBeVisible()
  await expect(sheet.getByText('¥400.00', { exact: true })).toBeVisible()
  await sheet.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('.sheet')).toBeHidden()
})

test('汇总页：日历展示每日收入，点击弹当天明细', async ({ page }) => {
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page, '张三', '2026-08-10', '13:00', '15:00')

  await page.getByRole('button', { name: '汇总', exact: true }).click()
  await expect(page.locator('.calendar')).toBeVisible() // 默认即为日历视图
  await page.getByRole('button', { name: '日历', exact: true }).click()
  await expect(page.locator('.cal-cell[data-date="2026-08-10"]')).toContainText('¥400')

  await page.locator('.cal-cell[data-date="2026-08-10"]').click()
  const sheet = page.locator('.sheet')
  await expect(sheet.getByText('8月10日 明细')).toBeVisible()
  await expect(sheet.getByText('当日收入 ¥400.00')).toBeVisible()
})