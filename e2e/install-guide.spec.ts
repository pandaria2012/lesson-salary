import { test, expect } from '@playwright/test'

test('安装引导：首次显示/以后再说不持久/知道了持久/设置页可再次打开', async ({ page }) => {
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: '添加到桌面' })
  await expect(dialog).toBeVisible()

  // 以后再说：本次关闭，刷新后仍会显示
  await dialog.getByRole('button', { name: '以后再说' }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(dialog).toBeVisible()

  // 知道了：持久化关闭，刷新后不再自动弹出
  await dialog.getByRole('button', { name: '知道了' }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(dialog).toBeHidden()

  // 设置页「添加到桌面」按钮可再次打开引导
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: '添加到桌面', exact: true }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '以后再说' }).click()
  await expect(dialog).toBeHidden()
})

test('从桌面/主屏幕启动：不弹引导，设置页不显示安装入口', async ({ page }) => {
  await page.addInitScript(() => {
    // 模拟 PWA 独立窗口（display-mode: standalone）
    window.matchMedia = (query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }) as MediaQueryList
  })
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: '添加到桌面' })).toBeHidden()

  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByText('添加到桌面', { exact: true })).toBeHidden()
})
