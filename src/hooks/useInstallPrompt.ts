import { useCallback, useEffect, useState } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>
}

let captured: BeforeInstallPromptEvent | null = null
const listeners = new Set<(e: BeforeInstallPromptEvent | null) => void>()

function notify(e: BeforeInstallPromptEvent | null) {
  captured = e
  listeners.forEach(fn => fn(e))
}

// 模块级监听：尽早捕获 beforeinstallprompt（避免 React 挂载前事件丢失）
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    notify(e as BeforeInstallPromptEvent)
  })
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(captured)

  useEffect(() => {
    const fn = (e: BeforeInstallPromptEvent | null) => setPrompt(e)
    listeners.add(fn)
    setPrompt(captured)
    return () => { listeners.delete(fn) }
  }, [])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    const evt = captured
    if (!evt) return false
    try {
      await evt.prompt()
      const choice = await evt.userChoice
      if (choice.outcome === 'accepted') {
        notify(null)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  return { canInstall: prompt != null, promptInstall }
}
