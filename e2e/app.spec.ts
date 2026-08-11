import { test, expect, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'

// 默认跳过“添加到桌面”引导，避免遮挡页面（引导流程有独立用例）
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ls.installGuideDismissed', '1'))
})

async function addCourseType(page: Page, name = '数学1对1', hours = '2', rate = '200') {
  await page.getByRole('button', { name: '课程', exact: true }).click()
  await page.getByRole('button', { name: '新增', exact: true }).click()
  await page.locator('.sheet input[placeholder*="初三数学"]').fill(name)
  await page.locator('.sheet input[list="teaching-forms"]').fill('一对一')
  await page.locator('.sheet input[inputmode="decimal"]').nth(0).fill(hours)
  await page.locator('.sheet input[inputmode="decimal"]').nth(1).fill(rate)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

async function addRecord(page: Page, opts: { courseLabel: string; student: string; date: string; start: string; end: string; rate: string }) {
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

test('课程类型：新增/编辑/删除', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '课程', exact: true }).click()
  await expect(page.getByText('还没有课程类型', { exact: false })).toBeVisible()

  await addCourseType(page)
  await expect(page.getByText('默认 2 小时 · 200 元/小时')).toBeVisible()

  // 编辑
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.locator('.sheet input[placeholder*="初三数学"]').fill('数学1对1改')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('数学1对1改', { exact: true })).toBeVisible()

  // 删除（confirm 接受）
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByText('还没有课程类型', { exact: false })).toBeVisible()
})

test('补录记录 → 月度汇总金额正确 → 导出月报', async ({ page }) => {
  await page.goto('/')
  await addCourseType(page)

  await addRecord(page, { courseLabel: '数学1对1', student: '张三', date: '2026-08-10', start: '13:00', end: '15:00', rate: '200' })
  await expect(page.getByText('2026-08-10')).toBeVisible()
  await expect(page.getByText('¥400.00')).toBeVisible()

  // 汇总
  await page.getByRole('button', { name: '汇总', exact: true }).click()
  await expect(page.getByText('总收入', { exact: false })).toBeVisible()
  await expect(page.getByText('¥400.00').first()).toBeVisible()
  await expect(page.getByText('张三', { exact: true })).toBeVisible()
  await expect(page.getByText('2 小时', { exact: true })).toBeVisible()

  // 导出月报
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出本月 Excel' }).click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/课时薪资-.*\.xlsx/)
})

test('Excel 导入（预览/确认/撤销）', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '导入', exact: true }).click()

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间'],
    ['英语小班', 150, '李四', '2026-08-12', '18:30-20:30'],
    ['示例学生', 100, '示例学生', '2026-08-13', '09:00-10:00']
  ]), '课程表')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  await page.locator('input[type="file"]').setInputFiles({
    name: '课程表.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buf
  })

  await expect(page.getByText(/共 2 行，将导入 1 行/)).toBeVisible()
  await expect(page.getByText('示例', { exact: false }).first()).toBeVisible()

  await page.getByRole('button', { name: '确认导入' }).click()
  await expect(page.getByText('已导入 1 条记录')).toBeVisible()

  // 记录页出现导入记录
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(page.locator('.record', { hasText: '李四' })).toBeVisible()
  await expect(page.getByText('¥300.00')).toBeVisible()

  // 撤销整批
  await page.getByRole('button', { name: '导入', exact: true }).click()
  await page.getByRole('button', { name: '撤销上一批导入' }).click()
  await expect(page.getByText('已撤销导入，删除 1 条记录')).toBeVisible()

  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(page.getByText('本月暂无记录', { exact: false })).toBeVisible()
})

test('PIN 锁：开启/锁定/错误提示/解锁/忘记重置', async ({ page }) => {
  await page.goto('/')
  // 开启 PIN
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.locator('input[type="password"]').nth(1).fill('1234')
  await page.getByRole('button', { name: '开启 PIN 锁' }).click()
  await expect(page.getByText('PIN 已开启')).toBeVisible()

  // 先造一条数据
  await addCourseType(page, '数学1对1', '2', '200')
  await addRecord(page, { courseLabel: '数学1对1', student: '张三', date: '2026-08-10', start: '13:00', end: '15:00', rate: '200' })

  // 刷新后锁定
  await page.reload()
  await expect(page.getByText('请输入 PIN 解锁')).toBeVisible()

  // 错误 PIN
  await page.locator('input[type="password"]').fill('9999')
  await page.getByRole('button', { name: '解锁' }).click()
  await expect(page.getByText('PIN 错误，请重试')).toBeVisible()

  // 正确 PIN
  await page.locator('input[type="password"]').fill('1234')
  await page.getByRole('button', { name: '解锁' }).click()
  await expect(page.getByText('月度汇总', { exact: false })).toBeVisible()

  // 忘记 PIN → 二次确认 → 数据清空并解锁
  await page.reload()
  await expect(page.getByText('请输入 PIN 解锁')).toBeVisible()
  page.on('dialog', d => d.accept())
  await page.getByRole('button', { name: '忘记 PIN' }).click()
  await expect(page.getByText('月度汇总', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(page.getByText('本月暂无记录', { exact: false })).toBeVisible()
})

test('设置页：导出全部数据 Excel', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出全部数据 Excel' }).click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/课时薪资-全部数据-.*\.xlsx/)
})
