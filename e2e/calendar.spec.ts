import { test, expect } from '@playwright/test'
import { addCourseType, addRecord, dayLabel, dayOfCurrentMonth, preparePage } from './helpers'

test.beforeEach(async ({ page }) => {
  await preparePage(page)
})

test('记录页：日历展示每日课次/金额，点击弹当天明细', async ({ page }) => {
  const d10 = dayOfCurrentMonth(10)
  const d12 = dayOfCurrentMonth(12)
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page, { courseLabel: '数学1对1', student: '张三', date: d10, start: '13:00', end: '15:00', rate: '200' })
  await addRecord(page, { courseLabel: '数学1对1', student: '李四', date: d12, start: '10:00', end: '11:00', rate: '200' })

  await expect(page.locator('.calendar')).toBeHidden() // 记录页默认列表视图
  await page.getByRole('button', { name: '日历', exact: true }).click()
  await expect(page.locator('.calendar')).toBeVisible()
  await expect(page.locator(`.cal-cell[data-date="${d10}"]`)).toContainText('¥400')
  await expect(page.locator(`.cal-cell[data-date="${d10}"]`)).toContainText('1课')
  await expect(page.locator(`.cal-cell[data-date="${d12}"]`)).toContainText('¥200')

  // 点击某天 → 底部弹层当天明细
  await page.locator(`.cal-cell[data-date="${d10}"]`).click()
  const sheet = page.locator('.sheet')
  await expect(sheet.getByText(`${dayLabel(10)} 明细`)).toBeVisible()
  await expect(sheet.getByText('张三', { exact: true })).toBeVisible()
  await expect(sheet.getByText('¥400.00', { exact: true })).toBeVisible()
  await sheet.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('.sheet')).toBeHidden()
})

test('汇总页：日历展示每日收入，点击弹当天明细', async ({ page }) => {
  const d10 = dayOfCurrentMonth(10)
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page, { courseLabel: '数学1对1', student: '张三', date: d10, start: '13:00', end: '15:00', rate: '200' })

  await page.getByRole('button', { name: '汇总', exact: true }).click()
  await expect(page.locator('.calendar')).toBeVisible() // 默认即为日历视图
  await page.getByRole('button', { name: '日历', exact: true }).click()
  await expect(page.locator(`.cal-cell[data-date="${d10}"]`)).toContainText('¥400')

  await page.locator(`.cal-cell[data-date="${d10}"]`).click()
  const sheet = page.locator('.sheet')
  await expect(sheet.getByText(`${dayLabel(10)} 明细`)).toBeVisible()
  await expect(sheet.getByText('当日收入 ¥400.00')).toBeVisible()
})
