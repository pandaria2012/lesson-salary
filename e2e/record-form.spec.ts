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

async function addRecord(page: Page) {
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.getByRole('button', { name: /补录/ }).click()
  await page.locator('.sheet select').nth(0).selectOption({ label: '数学1对1' })
  await page.locator('.sheet input[placeholder*="张三"]').fill('张三')
  await page.locator('.sheet input[type="date"]').fill('2026-08-10')
  await page.locator('.sheet input[type="time"]').nth(0).fill('13:00')
  await page.locator('.sheet input[type="time"]').nth(1).fill('15:00')
  await page.locator('.sheet input[inputmode="decimal"]').fill('200')
  await page.getByRole('button', { name: '保存', exact: true }).click()
}

test('补录表单：课程类型联动自动带出时薪/时长快捷/学生历史下拉', async ({ page }) => {
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page)

  // 打开补录：自动带出默认时薪 200
  await page.getByRole('button', { name: /补录/ }).click()
  const rateInput = page.locator('.sheet input[inputmode="decimal"]')
  await expect(rateInput).toHaveValue('200')
  await expect(page.getByText('默认 2 小时 · 200 元/小时')).toBeVisible()

  // 时长快捷：先选开始时间，点 2小时 自动算结束
  await page.locator('.sheet input[type="time"]').nth(0).fill('16:00')
  await page.getByRole('button', { name: '2小时', exact: true }).click()
  await expect(page.locator('.sheet input[type="time"]').nth(1)).toHaveValue('18:00')
  await expect(page.getByText('课时：2 小时', { exact: false })).toBeVisible()

  // 学生名称：历史学生可下拉选择
  await expect(page.locator('#student-options option[value="张三"]')).toHaveCount(1)

  await page.getByRole('button', { name: '关闭', exact: true }).click()
})

test('记录卡片：编辑按钮可修改记录', async ({ page }) => {
  await page.goto('/')
  await addCourseType(page)
  await addRecord(page)

  // 列表上的「编辑」按钮打开编辑弹层
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page.getByText('编辑上课记录')).toBeVisible()

  // 修改学生名称并保存
  await page.locator('.sheet input[placeholder*="张三"]').fill('张小三')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('.record', { hasText: '张小三' })).toBeVisible()
})
