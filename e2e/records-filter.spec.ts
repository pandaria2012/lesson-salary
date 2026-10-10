import { test, expect, type Page } from '@playwright/test'
import { addCourseType, addRecord, dayLabel, dayOfCurrentMonth, preparePage } from './helpers'

test.beforeEach(async ({ page }) => {
  await preparePage(page)
})

test('记录页筛选：按学生/状态过滤与清除', async ({ page }) => {
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page, { courseLabel: '数学1对1', student: '张三', date: dayOfCurrentMonth(10), start: '13:00', end: '15:00', rate: '200' })
  await addRecord(page, { courseLabel: '数学1对1', student: '李四', date: dayOfCurrentMonth(12), start: '10:00', end: '11:00', rate: '200' })

  // 默认两条都在
  await expect(page.locator('.record', { hasText: '张三' })).toBeVisible()
  await expect(page.locator('.record', { hasText: '李四' })).toBeVisible()

  // 按学生筛选
  await page.locator('.filters select').nth(0).selectOption({ label: '张三' })
  await expect(page.locator('.record', { hasText: '张三' })).toBeVisible()
  await expect(page.locator('.record', { hasText: '李四' })).toBeHidden()
  await expect(page.getByText('筛选结果：1 条')).toBeVisible()

  // 按状态筛选：本月无已取消 → 空结果
  await page.locator('.filters select').nth(2).selectOption({ label: '已取消' })
  await expect(page.getByText('没有符合筛选条件的记录。')).toBeVisible()

  // 清除筛选 → 两条都在
  await page.getByRole('button', { name: '清除', exact: true }).click()
  await expect(page.locator('.record', { hasText: '张三' })).toBeVisible()
  await expect(page.locator('.record', { hasText: '李四' })).toBeVisible()

  // 取消张三后按状态筛选 → 只剩张三
  await page.locator('.record', { hasText: '张三' }).getByRole('button', { name: '取消', exact: true }).click()
  await page.locator('.filters select').nth(2).selectOption({ label: '已取消' })
  await expect(page.locator('.record', { hasText: '张三' })).toBeVisible()
  await expect(page.locator('.record', { hasText: '李四' })).toBeHidden()
})

test('记录列表按天/课程/学生分组', async ({ page }) => {
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page, { courseLabel: '数学1对1', student: '张三', date: dayOfCurrentMonth(10), start: '13:00', end: '15:00', rate: '200' })
  await addRecord(page, { courseLabel: '数学1对1', student: '李四', date: dayOfCurrentMonth(12), start: '10:00', end: '11:00', rate: '200' })

  // 默认按天分组
  await expect(page.locator('.group-head', { hasText: dayLabel(10) })).toBeVisible()
  await expect(page.locator('.group-head', { hasText: dayLabel(12) })).toBeVisible()

  // 按课程分组
  await page.getByRole('button', { name: '按课程', exact: true }).click()
  await expect(page.locator('.group-head', { hasText: '数学1对1' })).toBeVisible()
  await expect(page.locator('.group-head', { hasText: '2 条' })).toBeVisible()

  // 按学生分组
  await page.getByRole('button', { name: '按学生', exact: true }).click()
  await expect(page.locator('.group-head', { hasText: '张三' })).toBeVisible()
  await expect(page.locator('.group-head', { hasText: '李四' })).toBeVisible()
})
