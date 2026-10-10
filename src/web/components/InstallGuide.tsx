import { useState } from 'react'
import { detectPlatform, isStandalone } from '../lib/installGuide'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

export default function InstallGuide({ open, onDone, onLater }: {
  open: boolean
  onDone: () => void
  onLater: () => void
}) {
  const { canInstall, promptInstall } = useInstallPrompt()
  const [installing, setInstalling] = useState(false)

  if (!open) return null
  if (isStandalone()) return null

  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints)

  const install = async () => {
    setInstalling(true)
    const ok = await promptInstall()
    setInstalling(false)
    if (ok) onDone()
  }

  return (
    <div className="guide-mask" role="dialog" aria-label="添加到桌面">
      <div className="guide">
        <div className="guide-icon">📱</div>
        <h2>添加到桌面</h2>
        <p className="muted">把「课时薪资」添加到手机主屏幕，像 App 一样打开，离线也能记账。</p>

        {platform === 'ios' && (
          <ol className="install-steps">
            <li>点 Safari 底部 <b>分享</b> 按钮</li>
            <li>选 <b>添加到主屏幕</b></li>
            <li>点右上角 <b>添加</b>，完成</li>
          </ol>
        )}

        {platform === 'android' && !canInstall && (
          <ol className="install-steps">
            <li>点浏览器右上角 <b>⋮ 菜单</b></li>
            <li>选 <b>添加到主屏幕 / 安装应用</b></li>
            <li>按提示确认，完成</li>
          </ol>
        )}

        {platform === 'desktop' && !canInstall && (
          <ol className="install-steps">
            <li>点地址栏右侧 <b>安装</b> 图标</li>
            <li>确认「安装」，完成</li>
          </ol>
        )}

        <div className="guide-actions">
          {canInstall ? (
            <button disabled={installing} onClick={() => void install()}>
              {installing ? '安装中…' : '立即安装'}
            </button>
          ) : (
            <button onClick={onDone}>知道了</button>
          )}
          <button className="btn-ghost-guide" onClick={onLater}>以后再说</button>
        </div>
      </div>
    </div>
  )
}
