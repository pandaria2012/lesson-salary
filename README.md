# 课时薪资

移动端优先的课时薪资记账 PWA 应用（React + TypeScript + Vite + Vitest）。

## 功能

- 上课记录：录入 / 编辑 / 补录 / 取消
- Excel 导入（预览 / 确认 / 撤销）
- 月度汇总与月报导出
- 备份 / 恢复 / PIN 锁
- 离线可用，可安装到主屏幕（PWA）

## 开发

```bash
npm install
npm run dev
npm run build
npm test
```

## 构建产物

`npm run build` 会在 `dist/` 目录生成可部署的静态站点，包含 `sw.js`（Service Worker）、`manifest.webmanifest` 与 PWA 图标（`icons/icon-192.png`、`icons/icon-512.png`）。

## 部署

### GitHub Pages

1. 创建仓库并推送代码。
2. 进入仓库 **Settings → Pages → Source: Deploy from a branch**。
3. 选择 `main` 分支与 `/docs` 目录（需先将构建产物复制到 `docs/`），或推送 `dist/` 内容到 `gh-pages` 分支（也可用 GitHub Actions 自动构建部署）。
4. 若部署到子路径（如 `https://<user>.github.io/<repo>/`），需在 `vite.config.ts` 中加入 `base: '/<repo>/'` 并重新执行 `npm run build`；部署到根路径则无需修改。

### Cloudflare Pages

1. 登录 Cloudflare Dashboard → **Workers & Pages → Create → Pages → Create project**。
2. 上传 `dist/` 目录（或连接 Git 仓库后设置构建命令 `npm run build`、输出目录 `dist`）。
3. 部署完成后自动获得 HTTPS 域名，可直接在手机浏览器打开安装。

## 手机安装

- **Android（Chrome）**：用 Chrome 打开部署后的网址 → 菜单“⋮”→“添加到主屏幕”→ 安装。
- **iPhone（Safari）**：用 Safari 打开部署后的网址 → 分享按钮 →“添加到主屏幕”。

安装后可从主屏幕图标直接打开应用，并支持离线使用。

## 数据安全

- 应用安装后可离线使用；所有数据仅保存在手机浏览器的本地 IndexedDB 中，不联网、不上传。
- 建议定期在 **设置 → 导出全部数据** 中备份，并妥善保存备份文件（含 PIN 时请牢记 PIN）。