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

test('记录页筛选：按学生/状态过滤与清除', async ({ page }) => {
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page, '张三', '2026-08-10', '13:00', '15:00')
  await addRecord(page, '李四', '2026-08-12', '10:00', '11:00')

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
  await addRecord(page, '张三', '2026-08-10', '13:00', '15:00')
  await addRecord(page, '李四', '2026-08-12', '10:00', '11:00')

  // 默认按天分组
  await expect(page.locator('.group-head', { hasText: '8月10日' })).toBeVisible()
  await expect(page.locator('.group-head', { hasText: '8月12日' })).toBeVisible()

  // 按课程分组
  await page.getByRole('button', { name: '按课程', exact: true }).click()
  await expect(page.locator('.group-head', { hasText: '数学1对1' })).toBeVisible()
  await expect(page.locator('.group-head', { hasText: '2 条' })).toBeVisible()

  // 按学生分组
  await page.getByRole('button', { name: '按学生', exact: true }).click()
  await expect(page.locator('.group-head', { hasText: '张三' })).toBeVisible()
  await expect(page.locator('.group-head', { hasText: '李四' })).toBeVisible()
})
